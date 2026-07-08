const fs = require('fs');
const path = require('path');

const API_DATA_PATH = './data/campings.json';
const WEBSITE_DATA_PATH = './bestanden/detailpagina.txt';
const REPORT_PATH = './discrepancy_report_svr.txt';

function normalizeName(name) {
    return name.toLowerCase()
        .replace(/^camping\s+/i, '')
        .replace(/^minicamping\s+/i, '')
        .replace(/['"\s-]/g, '')
        .trim();
}

function heal() {
    try {
        console.log('--- SVR ID Healer & Reporter ---');
        
        // 1. Load API data
        const apiData = JSON.parse(fs.readFileSync(API_DATA_PATH, 'utf8'));
        console.log(`Loaded ${apiData.campings.length} campings from API data.`);

        // 2. Load Website data (extract from the map dump)
        const websiteContent = fs.readFileSync(WEBSITE_DATA_PATH, 'utf8');
        const websiteCampings = [];
        
        // Extracting from GeoJSON Feature structure in detailpagina.txt
        // Example: "id": "uuid", "properties": { "city": "city", "name": "name" ... }
        const featureRegex = /"geometry":\s*\{\s*"coordinates":\s*\[([\d.-]+),\s*([\d.-]+)\].*?"id":\s*"([^"]+)".*?"properties":\s*\{.*?"city":\s*"([^"]+)".*?"name":\s*"([^"]+)"/gs;
        
        let match;
        while ((match = featureRegex.exec(websiteContent)) !== null) {
            websiteCampings.push({
                lng: parseFloat(match[1]),
                lat: parseFloat(match[2]),
                id: match[3],
                city: match[4].toUpperCase(),
                name: match[5]
            });
        }
        console.log(`Extracted ${websiteCampings.length} campings from website dump.`);

        // 3. Matching and Healing
        let healedCount = 0;
        let matchCount = 0;
        let reportLines = [
            'SVR ID DISCREPANTIE RAPPORT',
            'Gegenereerd op: ' + new Date().toLocaleString(),
            '-------------------------------------------',
            'Dit rapport bevat campings waarbij het ID in de API (backend) afwijkt van het ID op de Website (CMS).',
            'Deze afwijking veroorzaakt HTTP 500 errors bij het direct opvragen van de detailpagina.',
            '',
            'Naam | Stad | API ID (Fout) | Website ID (Werkend)',
            '-------------------------------------------'
        ];

        apiData.campings.forEach(apiCamping => {
            const normApiName = normalizeName(apiCamping.naam);
            const apiCity = apiCamping.stad.toUpperCase();

            // Precise matching: City + Name Match OR Coordinate Match
            const webMatch = websiteCampings.find(w => {
                const normWebName = normalizeName(w.name);
                
                // Match by name and city
                const nameMatch = (normWebName === normApiName || normApiName.includes(normWebName) || normWebName.includes(normApiName)) && (w.city === apiCity);
                
                // Match by coordinates (with tolerance for rounding)
                const coordMatch = Math.abs(w.lat - apiCamping.lat) < 0.001 && Math.abs(w.lng - apiCamping.lng) < 0.001;

                return nameMatch || coordMatch;
            });

            if (webMatch) {
                matchCount++;
                if (apiCamping.id !== webMatch.id) {
                    reportLines.push(`${apiCamping.naam} | ${apiCamping.stad} | ${apiCamping.id} | ${webMatch.id}`);
                    
                    // HEAL THE ID
                    apiCamping.id = webMatch.id;
                    healedCount++;
                }
            }
        });

        // 4. Save updated data
        if (healedCount > 0) {
            apiData.updated = new Date().toISOString();
            fs.writeFileSync(API_DATA_PATH, JSON.stringify(apiData, null, 2));
            console.log(`Successfully healed ${healedCount} IDs in ${API_DATA_PATH}`);
        }

        // 5. Save Report
        fs.writeFileSync(REPORT_PATH, reportLines.join('\n'));
        console.log(`Report saved to ${REPORT_PATH}`);

        console.log(`--- Statistics ---`);
        console.log(`Total Matches found: ${matchCount}`);
        console.log(`IDs updated: ${healedCount}`);

    } catch (err) {
        console.error('Healing failed:', err.message);
        console.error(err.stack);
    }
}

heal();
