const fs = require('fs');
const path = require('path');

const detailPath = path.join(__dirname, 'bestanden', 'detailpagina.txt');
const content = fs.readFileSync(detailPath, 'utf8');

// The JSON array starts after 'let all_pins = ['
const startIdx = content.indexOf('let all_pins = [');
if (startIdx === -1) {
    console.error('Could not find all_pins in detailpagina.txt');
    process.exit(1);
}

// We need to find the matching closing bracket for the array
// Or just regex extract the pairs
const mapping = {};
const regex = /"id":\s*"([^"]+)",.*?"state":\s*"([^"]+)"/gs;
let match;
let count = 0;

while ((match = regex.exec(content)) !== null) {
    const uuid = match[1];
    const stateId = match[2];
    mapping[uuid] = stateId;
    count++;
}

console.log(`Extracted ${count} mappings.`);
fs.writeFileSync('id_mapping.json', JSON.stringify(mapping, null, 2));
console.log('Saved to id_mapping.json');
