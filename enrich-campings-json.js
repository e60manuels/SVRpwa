const https = require('https');
const fs = require('fs');
const path = require('path');

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
                    resolve({ body: data, headers: res.headers });
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
        const sourcePath = path.join(__dirname, 'data', 'campings.json');
        const outputPath = path.join(__dirname, 'data', 'campings_enriched.json');
        const mappingPath = path.join(__dirname, 'id_mapping.json');
        
        if (!fs.existsSync(sourcePath)) {
            throw new Error('data/campings.json not found. Run build-campings-json.js first.');
        }

        const idMapping = fs.existsSync(mappingPath) ? JSON.parse(fs.readFileSync(mappingPath, 'utf8')) : {};
        console.log(`Loaded ${Object.keys(idMapping).length} ID mappings.`);

        // Load existing enriched data if it exists, otherwise start from source
        let campingData;
        if (fs.existsSync(outputPath)) {
            console.log('Loading existing enriched data to resume...');
            campingData = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
        } else {
            console.log('Starting new enrichment from source...');
            campingData = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
        }

        const campings = campingData.campings;

        console.log('Logging in to SVR Proxy...');
        const loginRes = await request(`${PROXY_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: SVR_EMAIL, password: SVR_PASSWORD })
        });
        const loginData = JSON.parse(loginRes.body);
        const sessionId = loginData.session_id;
        if (!sessionId) throw new Error('No session_id received');
        console.log('Login successful.');

        const commonHeaders = { 
            'X-SVR-Session': sessionId,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        };

        // Process all campings
        for (let i = 0; i < campings.length; i++) {
            const camping = campings[i];
            
            // Get the real SVR ID (integer) for reference
            const svrId = camping.svr_id || idMapping[camping.id];
            camping.svr_id = svrId;

            // Skip if already processed
            if (camping.images_fetched === true) {
                continue;
            }

            process.stdout.write(`[${i+1}/${campings.length}] Discovering images for: ${camping.naam} ... `);

            try {
                // Fetch the detail page HTML via Cloudflare Worker using UUID
                const detailUrl = `${PROXY_URL}/object/${camping.id}`;
                const res = await request(detailUrl, { headers: commonHeaders });
                const html = res.body;

                const imgRegex = /https:\/\/old\.svr\.nl\/campingfoto\/[^\/]+\/([^"'\)]+\.(?:JPG|jpg|png|jpeg))/gi;
                const imageUrls = new Set();
                let match;

                while ((match = imgRegex.exec(html)) !== null) {
                    imageUrls.add(match[0]);
                }
                
                camping.images = [...imageUrls].map(url => url.split('/').pop());
                camping.images_fetched = true;
                console.log(`${camping.images.length} found.`);

                // Save periodically (every 10 campings)
                if (i % 10 === 0) {
                    fs.writeFileSync(outputPath, JSON.stringify(campingData, null, 2));
                }

            } catch (err) {
                console.log(`FAILED: ${err.message}`);
                // Continue to next camping even if this one fails
            }

            // Politeness delay
            await new Promise(r => setTimeout(r, 1000));
        }

        // Final save
        fs.writeFileSync(outputPath, JSON.stringify(campingData, null, 2));
        console.log(`\nSuccess! All discovered images saved to ${outputPath}`);

    } catch (err) {
        console.error('\nFailed:', err.message);
        process.exit(1);
    }
}

run();
