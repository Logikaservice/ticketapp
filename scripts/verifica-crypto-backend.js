// Script di diagnostica per verificare lo stato del backend crypto
const db = require('./backend/crypto_db');
const path = require('path');
const fs = require('fs');

console.log('🔍 Verifica Backend Crypto...\n');

// 1. Verifica esistenza database
const dbPath = path.resolve(__dirname, 'backend', 'crypto.db');
console.log('1. Verifica database crypto.db...');
if (fs.existsSync(dbPath)) {
    console.log('   ✅ Database crypto.db esiste:', dbPath);
    const stats = fs.statSync(dbPath);
    console.log('   📊 Dimensione:', (stats.size / 1024).toFixed(2), 'KB');
} else {
    console.log('   ❌ Database crypto.db NON esiste:', dbPath);
    console.log('   ⚠️  Il database verrà creato automaticamente all\'avvio del backend');
}

// 2. Test connessione database
console.log('\n2. Test connessione database...');
db.get("SELECT count(*) as count FROM portfolio", (err, row) => {
    if (err) {
        console.log('   ❌ Errore connessione database:', err.message);
        console.log('   ⚠️  Questo potrebbe causare errori 502');
    } else {
        console.log('   ✅ Connessione database OK');
        console.log('   📊 Record portfolio:', row.count);
    }

    // 3. Verifica tabelle
    console.log('\n3. Verifica tabelle...');
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
        if (err) {
            console.log('   ❌ Errore lettura tabelle:', err.message);
        } else {
            console.log('   ✅ Tabelle trovate:', tables.length);
            tables.forEach(t => console.log('      -', t.name));
        }

        // 4. Verifica portfolio
        console.log('\n4. Verifica dati portfolio...');
        db.get("SELECT * FROM portfolio LIMIT 1", (err, portfolio) => {
            if (err) {
                console.log('   ❌ Errore lettura portfolio:', err.message);
            } else if (!portfolio) {
                console.log('   ⚠️  Portfolio vuoto - verrà inizializzato all\'avvio');
            } else {
                console.log('   ✅ Portfolio trovato:');
                console.log('      Balance USD:', portfolio.balance_usd);
                console.log('      Holdings:', portfolio.holdings);
            }

            // 5. Verifica bot settings
            console.log('\n5. Verifica bot settings...');
            db.all("SELECT * FROM bot_settings", (err, settings) => {
                if (err) {
                    console.log('   ❌ Errore lettura bot_settings:', err.message);
                } else {
                    console.log('   ✅ Bot settings trovati:', settings.length);
                    settings.forEach(s => {
                        console.log(`      - ${s.strategy_name} (${s.symbol}): ${s.is_active ? 'ATTIVO' : 'PAUSED'}`);
                    });
                }

                // 6. Verifica posizioni aperte
                console.log('\n6. Verifica posizioni aperte...');
                db.all("SELECT COUNT(*) as count FROM open_positions WHERE status = 'open'", (err, result) => {
                    if (err) {
                        console.log('   ❌ Errore lettura posizioni:', err.message);
                    } else {
                        console.log('   ✅ Posizioni aperte:', result[0].count);
                    }

                    // Chiudi connessione
                    db.close((err) => {
                        if (err) {
                            console.error('❌ Errore chiusura database:', err.message);
                        } else {
                            console.log('\n✅ Verifica completata!');
                            console.log('\n📋 Riepilogo:');
                            console.log('   - Se il database non esiste, verrà creato automaticamente');
                            console.log('   - Se ci sono errori, controlla i log del backend');
                            console.log('   - Per riavviare il backend: pm2 restart ticketapp-backend');
                        }
                        process.exit(0);
                    });
                });
            });
        });
    });
});
