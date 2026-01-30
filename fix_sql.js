const fs = require('fs');

const filePath = 'c:\\TicketApp\\backend\\routes\\networkMonitoring.js';
let content = fs.readFileSync(filePath, 'utf8');

// Fix the SQL query - replace escaped double quotes with single quotes
const oldQuery = 'REPLACE(REPLACE(UPPER(mac_address), \\":\\", \\"\\"), \\"-\\", \\"\\")';
const newQuery = "REPLACE(REPLACE(UPPER(mac_address), ':', ''), '-', '')";
content = content.replace(oldQuery, newQuery);

const oldQuery2 = 'REPLACE(REPLACE(UPPER($2), \\":\\", \\"\\"), \\"-\\", \\"\\")';
const newQuery2 = "REPLACE(REPLACE(UPPER($2), ':', ''), '-', '')";
content = content.replace(oldQuery2, newQuery2);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed SQL quotes in networkMonitoring.js');
