const fs = require('fs');

const filePath = 'c:\\TicketApp\\backend\\routes\\networkMonitoring.js';
let content = fs.readFileSync(filePath, 'utf8');

console.log('Searching for SQL pattern with double quotes...');

// The actual pattern in the file when read as string
const oldPattern1 = '", ""), "-", "")';
const newPattern1 = "', ''), '-', '')";

if (content.includes(oldPattern1)) {
    console.log('Found pattern! Replacing...');
    content = content.replaceAll(oldPattern1, newPattern1);

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('File updated successfully');

    // Verify
    const newContent = fs.readFileSync(filePath, 'utf8');
    const lines = newContent.split(/\r?\n/);
    if (lines[1609]) {
        console.log('New line 1610 preview:', lines[1609].substring(100, 250));
    }
} else {
    console.log('Pattern not found. Showing what we have:');
    const lines = content.split(/\r?\n/);
    if (lines[1609]) {
        console.log('Line 1610:', lines[1609]);
    }
}
