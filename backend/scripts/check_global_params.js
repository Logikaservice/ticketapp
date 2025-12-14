/**
 * 🔍 Script per verificare i parametri globali nel database
 * Controlla cosa c'è effettivamente salvato nella tabella bot_settings per symbol='global'
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Usa il database locale SQLite
const dbPath = path.join(__dirname, '..', 'crypto_trading.db');

async function checkGlobalParams() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Errore apertura database:', err.message);
                reject(err);
                return;
            }
            console.log('✅ Database aperto:', dbPath);
            console.log('');
        });

        console.log('🔍 Verifica Parametri Globali nel Database\n');

        // Query per ottenere i parametri globali
        db.get(
            "SELECT * FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = 'global' LIMIT 1",
            [],
            (err, record) => {
                if (err) {
                    console.error('❌ Errore query:', err.message);
                    db.close();
                    reject(err);
                    return;
                }

                if (!record) {
                    console.log('❌ NESSUN RECORD TROVATO per symbol=\'global\'');
                    console.log('   Il database non ha parametri globali salvati.');
                    console.log('   Questo è il problema! Il backend non trova i parametri globali.\n');
                    db.close();
                    resolve();
                    return;
                }

                console.log('✅ Record trovato:');
                console.log('   ID:', record.id);
                console.log('   Strategy Name:', record.strategy_name);
                console.log('   Symbol:', record.symbol);
                console.log('   Is Active:', record.is_active);
                console.log('');

                // Parse dei parametri
                let params;
                try {
                    if (typeof record.parameters === 'string') {
                        params = JSON.parse(record.parameters);
                    } else {
                        params = record.parameters;
                    }
                } catch (parseErr) {
                    console.error('❌ Errore parsing parametri:', parseErr.message);
                    console.log('   Raw parameters:', record.parameters);
                    db.close();
                    reject(parseErr);
                    return;
                }

                console.log('📋 Parametri salvati nel database:');
                console.log('   Totale chiavi:', Object.keys(params).length);
                console.log('');

                // Verifica parametri critici
                console.log('🔍 Parametri Critici:');
                console.log('   ✓ trade_size_usdt:', params.trade_size_usdt !== undefined ? `$${params.trade_size_usdt}` : '❌ NON PRESENTE');
                console.log('   ✓ trade_size_eur:', params.trade_size_eur !== undefined ? `€${params.trade_size_eur}` : '❌ NON PRESENTE');
                console.log('   ✓ max_positions:', params.max_positions !== undefined ? params.max_positions : '❌ NON PRESENTE');
                console.log('   ✓ stop_loss_pct:', params.stop_loss_pct !== undefined ? `${params.stop_loss_pct}%` : '❌ NON PRESENTE');
                console.log('   ✓ take_profit_pct:', params.take_profit_pct !== undefined ? `${params.take_profit_pct}%` : '❌ NON PRESENTE');
                console.log('');

                // Mostra tutti i parametri
                console.log('📝 Tutti i parametri:');
                for (const [key, value] of Object.entries(params)) {
                    console.log(`   - ${key}: ${JSON.stringify(value)}`);
                }
                console.log('');

                // Diagnosi
                if (params.trade_size_usdt === undefined && params.trade_size_eur === undefined) {
                    console.log('🔴 PROBLEMA IDENTIFICATO:');
                    console.log('   Il database NON contiene né trade_size_usdt né trade_size_eur!');
                    console.log('   Questo è il motivo per cui il frontend mostra sempre 100 (valore di default).\n');
                    console.log('💡 SOLUZIONE:');
                    console.log('   Quando salvi i parametri dal frontend, assicurati che trade_size_usdt');
                    console.log('   venga effettivamente scritto nel database.\n');
                } else {
                    console.log('✅ I parametri trade_size sono presenti nel database.');
                    console.log('   Valore salvato: trade_size_usdt =', params.trade_size_usdt);
                    console.log('   Il problema potrebbe essere nel merge o nell\'invio al frontend.\n');
                }

                db.close((err) => {
                    if (err) {
                        console.error('❌ Errore chiusura database:', err.message);
                    }
                    resolve();
                });
            }
        );
    });
}

checkGlobalParams().catch(err => {
    console.error('❌ Errore fatale:', err);
    process.exit(1);
});
