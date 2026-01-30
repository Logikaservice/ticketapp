const fs = require('fs');

const filePath = 'c:\\TicketApp\\backend\\routes\\networkMonitoring.js';
let content = fs.readFileSync(filePath, 'utf8');

// The exact string we need to find and replace
const searchStr = 'pool.query(\'SELECT * FROM network_devices WHERE agent_id = $1 AND REPLACE(REPLACE(UPPER(mac_address), ":", ""), "-", "") = REPLACE(REPLACE(UPPER($2), ":", ""), "-", "") LIMIT 1\', [agentId, normalizedMac])';

const replaceStr = 'pool.query("SELECT * FROM network_devices WHERE agent_id = $1 AND REPLACE(REPLACE(UPPER(mac_address), \':\', \'\'), \'-\', \'\') = REPLACE(REPLACE(UPPER($2), \':\', \'\'), \'-\', \'\') LIMIT 1", [agentId, normalizedMac])';

if (content.includes(searchStr)) {
    console.log('Found the exact pattern!');
    content = content.replace(searchStr, replaceStr);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Successfully fixed SQL query');
} else {
    console.log('Pattern not found. This might mean the file was already fixed or is different than expected.');
    // Show what's actually there
    const lines = content.split(/\r?\n/);
    console.log('Actual line 1610:', lines[1609]);
}
