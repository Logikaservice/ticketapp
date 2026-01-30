const fs = require('fs');

const filePath = 'c:\\TicketApp\\backend\\routes\\networkMonitoring.js';
let content = fs.readFileSync(filePath, 'utf8');

console.log('Fixing remaining double quotes...');

// Fix any remaining double quote literals in SQL
content = content.replace(
    /REPLACE\(REPLACE\(UPPER\(mac_address\), "[^"]*", "[^"]*"\), "[^"]*", "[^"]*"\)/g,
    "REPLACE(REPLACE(UPPER(mac_address), ':', ''), '-', '')"
);

content = content.replace(
    /REPLACE\(REPLACE\(UPPER\(\$2\), "[^"]*", "[^"]*"\), "[^"]*", "[^"]*"\)/g,
    "REPLACE(REPLACE(UPPER($2), ':', ''), '-', '')"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('File updated');

// Verify
const newContent = fs.readFileSync(filePath, 'utf8');
const lines = newContent.split(/\r?\n/);
if (lines[1609]) {
    console.log('Line 1610:', lines[1609].trim());
}
