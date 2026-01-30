const fs = require('fs');

const filePath = 'c:\\TicketApp\\backend\\routes\\networkMonitoring.js';
let content = fs.readFileSync(filePath, 'utf8');

console.log('Original content includes escaped quotes:', content.includes('\\":\\"'));
console.log('Searching for pattern...');

// Show a snippet around line 1610
const lines = content.split(/\r?\n/);
if (lines[1609]) {
    console.log('Line 1610 preview:', lines[1609].substring(0, 150));
}

// Try different replacement approaches
let modified = false;

// Approach 1: Replace the exact escaped sequence
if (content.includes('\\":"\\')) {
    content = content.replaceAll('\\":"\\', "'':'");
    content = content.replaceAll('\\"-\\"', "'-'");
    modified = true;
    console.log('Applied replacement approach 1');
}

if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('File updated successfully');

    // Verify
    const newContent = fs.readFileSync(filePath, 'utf8');
    const newLines = newContent.split(/\r?\n/);
    if (newLines[1609]) {
        console.log('New line 1610 preview:', newLines[1609].substring(0, 150));
    }
} else {
    console.log('No changes needed or pattern not found');
}
