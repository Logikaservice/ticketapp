/**
 * Script per verificare la struttura della tabella bot_settings
 */

const db = require('../crypto_db');

async function checkTableStructure() {
    try {
        console.log('🔍 Verifica struttura tabella bot_settings...\n');

        // Ottieni schema della tabella
        const schema = await new Promise((resolve, reject) => {
            db.all("PRAGMA table_info(bot_settings)", (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        console.log('📊 Colonne presenti:');
        schema.forEach(col => {
            console.log(`   • ${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : ''} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`);
        });

        // Mostra un esempio di record
        const example = await new Promise((resolve, reject) => {
            db.get("SELECT * FROM bot_settings LIMIT 1", (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (example) {
            console.log('\n📋 Esempio di record:');
            console.log(JSON.stringify(example, null, 2));
        }

    } catch (err) {
        console.error('❌ Errore:', err.message);
    } finally {
        db.close();
    }
}

checkTableStructure();
