const fs = require('fs');

const args = process.argv.slice(2);
if (args.length === 0) {
    console.error('Gebruik: node update-version.js <versie> (bijv. 0.2.51)');
    process.exit(1);
}

const newVersion = args[0].replace(/^v/, ''); // Strip 'v' prefix if provided
console.log(`Versie bijwerken naar: ${newVersion}`);

const filesToUpdate = [
    { path: 'index.html', regex: /v=0\.2\.\d+/g, replacement: `v=${newVersion}` },
    { path: 'js/local_app.js', regex: /window\.SVR_PWA_VERSION = "0\.2\.\d+"/g, replacement: `window.SVR_PWA_VERSION = "${newVersion}"` },
    { path: 'js/pwa_install.js', regex: /const APP_VERSION = "0\.2\.\d+"/g, replacement: `const APP_VERSION = "${newVersion}"` },
    { path: 'merge-and-enrich.js', regex: /version: "0\.2\.\d+"/g, replacement: `version: "${newVersion}"` },
    { path: 'sw.js', regex: /svr-pwa-cache-v0\.2\.\d+/g, replacement: `svr-pwa-cache-v${newVersion}` }
];

filesToUpdate.forEach(file => {
    try {
        let content = fs.readFileSync(file.path, 'utf8');
        content = content.replace(file.regex, file.replacement);
        fs.writeFileSync(file.path, content, 'utf8');
        console.log(`Updated ${file.path}`);
    } catch (err) {
        console.error(`Error updating ${file.path}:`, err.message);
    }
});
