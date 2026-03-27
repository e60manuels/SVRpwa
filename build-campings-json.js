const https = require('https');
const fs = require('fs');

const PROXY_URL = 'https://svr-proxy-worker.e60-manuels.workers.dev';
const SVR_EMAIL = process.env.SVR_EMAIL;
const SVR_PASSWORD = process.env.SVR_PASSWORD;

if (!SVR_EMAIL || !SVR_PASSWORD) {
    console.error('Error: SVR_EMAIL and SVR_PASSWORD environment variables are required.');
    process.exit(1);
}

async function request(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data);
                } else {
                    reject(new Error(`Status ${res.statusCode}: ${data}`));
                }
            });
        });
        req.on('error', reject);
        if (options.body) req.write(options.body);
        req.end();
    });
}

async function run() {
    try {
        console.log('Logging in...');
        const loginRes = await request(`${PROXY_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: SVR_EMAIL, password: SVR_PASSWORD })
        });
        const loginData = JSON.parse(loginRes);
        const sessionId = loginData.session_id;
        if (!sessionId) throw new Error('No session_id received');
        console.log('Login successful.');

        const commonHeaders = { 'X-SVR-Session': sessionId };

        console.log('Fetching filters...');
        const filtersHtml = await request(`${PROXY_URL}/objects`, { headers: commonHeaders });
        
        // Simple regex to find filter IDs and their categories
        // We look for sections starting with .befalow
        const filterMap = {}; // id -> { name, category }
        const categories = []; // { name, ids: [] }

        // This is a bit crude but should work for SVR's structure
        const sections = filtersHtml.split(/<[^>]+class="[^"]*befalow[^"]*"[^>]*>/);
        const sectionTitles = filtersHtml.match(/<[^>]+class="[^"]*befalow[^"]*"[^>]*>([^<]+)/g) || [];
        
        console.log(`Found ${sectionTitles.length} filter sections.`);

        for (let i = 0; i < sectionTitles.length; i++) {
            const title = sectionTitles[i].replace(/<[^>]+>/g, '').trim().replace(/:$/, '').replace(/\s+/g, ' ');
            const content = sections[i + 1];
            if (!content) continue;

            const category = { name: title, ids: [] };
            categories.push(category);

            const filterRegex = /data-filter-id="([^"]+)"[^>]*>.*?<label[^>]*>([^<]+)<\/label>/gs;
            let match;
            while ((match = filterRegex.exec(content)) !== null) {
                const id = match[1];
                const name = match[2].trim();
                filterMap[id] = { name, category: title };
                category.ids.push(id);
            }
            console.log(`Section "${title}": ${category.ids.length} filters found.`);
        }

        // Identify ALL filters to process (no longer excluding Countries/Regions)
        const allFilterIds = categories.flatMap(c => c.ids);
        console.log(`Total filters to process: ${allFilterIds.length}`);

        console.log('Fetching all campings (base list)...');
        // Center of NL, large radius to get all
        const baseApiUrl = `${PROXY_URL}/api/objects?page=0&lat=52.2&lng=5.5&distance=1000000&limit=3000`;
        const baseRes = await request(baseApiUrl, { headers: commonHeaders });
        const baseData = JSON.parse(baseRes);
        let allCampings = baseData.objects || [];
        
        console.log(`Found ${allCampings.length} campings in total.`);

        const campingData = {}; // id -> camping object
        allCampings.forEach(o => {
            campingData[o.id] = {
                id: o.id,
                naam: o.properties.name,
                stad: o.properties.city,
                lat: o.geometry.coordinates[1],
                lng: o.geometry.coordinates[0],
                type: o.properties.type_camping,
                filters: []
            };
        });

        // Step 4: Fetch filtered lists
        console.log('Processing filters...');

        for (let i = 0; i < allFilterIds.length; i++) {
            const filterId = allFilterIds[i];
            const filterName = filterMap[filterId].name;
            process.stdout.write(`[${i+1}/${allFilterIds.length}] Filter: ${filterName} ... `);

            try {
                // SVR requires filters to be present in both the URL and often in the session config
                const filterUrl = `${baseApiUrl}&filter[facilities][]=${filterId}`;
                
                // Add the specific headers that the Cloudflare Worker expects
                const filterHeaders = { 
                    ...commonHeaders,
                    'X-SVR-Filters': JSON.stringify([filterId]),
                    'X-SVR-Config': JSON.stringify({
                        filters: [filterId],
                        geo: {},
                        search_free: {},
                        favorite: "0"
                    })
                };

                const filterRes = await request(filterUrl, { headers: filterHeaders });
                const filterData = JSON.parse(filterRes);
                const results = filterData.objects || [];
                
                let matches = 0;
                let typeCounts = {};

                results.forEach(o => {
                    const typeCamping = String(o.properties.type_camping);
                    typeCounts[typeCamping] = (typeCounts[typeCamping] || 0) + 1;

                    // "3" is the ONLY value that means NO match. 
                    // "0", "1", "2" or anything else is a match.
                    const isMatch = (typeCamping !== "3" && typeCamping !== "undefined" && typeCamping !== "null");
                    
                    if (isMatch && campingData[o.id]) {
                        campingData[o.id].filters.push(filterId);
                        matches++;
                    }
                });
                
                // Log detailed info for the first few filters to verify server behavior
                if (i < 5 || matches === allCampings.length) {
                    console.log(`${matches} matches. (Types: ${JSON.stringify(typeCounts)})`);
                } else {
                    console.log(`${matches} matches.`);
                }

            } catch (err) {
                console.log(`Error: ${err.message}`);
            }
            
            // Small delay to be polite to the proxy/SVR
            await new Promise(r => setTimeout(r, 100));
        }

        const finalOutput = {
            updated: new Date().toISOString(),
            version: '1.0.0',
            categories: categories.map(c => ({ name: c.name, ids: c.ids })),
            campings: Object.values(campingData)
        };

        if (!fs.existsSync('./data')) fs.mkdirSync('./data');
        fs.writeFileSync('./data/campings.json', JSON.stringify(finalOutput, null, 2));
        console.log('\nSuccess! Written to data/campings.json');

    } catch (err) {
        console.error('\nFailed:', err.message);
        process.exit(1);
    }
}

run();
