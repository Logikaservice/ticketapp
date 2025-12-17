const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./crypto.db');

console.log('🔧 Aggiungendo colonna close_reason alla tabella open_positions...\n');

db.run(`
    ALTER TABLE open_positions 
    ADD COLUMN close_reason TEXT
`, (err) => {
    if (err) {
        if (err.message.includes('duplicate column name')) {
            console.log('✅ Colonna close_reason già esiste');
        } else {
            console.error('❌ Errore:', err.message);
        }
    } else {
        console.log('✅ Colonna close_reason aggiunta con successo!');
    }

    db.close();
});
