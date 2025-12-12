const db = require('./backend/crypto_db');

console.log('🔍 ANALISI COMPLETA DEL MISTERO €12.50');
console.log('='.repeat(80));

// 1. Verifica se ci sono tabelle nascoste o log
db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) {
        console.error('Error:', err);
        return;
    }

    console.log('\n📋 TUTTE LE TABELLE NEL DATABASE:');
    console.log('='.repeat(80));
    tables.forEach(t => console.log(`  - ${t.name}`));

    // 2. Verifica il portfolio con TUTTI i campi
    db.get("SELECT * FROM portfolio WHERE id = 1", (err, portfolio) => {
        if (err) {
            console.error('Error:', err);
            return;
        }

        console.log('\n💰 PORTFOLIO COMPLETO (TUTTI I CAMPI):');
        console.log('='.repeat(80));
        console.log(JSON.stringify(portfolio, null, 2));

        // 3. Verifica se ci sono altri record nel portfolio
        db.all("SELECT * FROM portfolio", (err, allPortfolios) => {
            if (err) {
                console.error('Error:', err);
                return;
            }

            console.log('\n📊 TUTTI I RECORD PORTFOLIO:');
            console.log('='.repeat(80));
            console.log(`Numero totale di record: ${allPortfolios.length}`);
            allPortfolios.forEach((p, i) => {
                console.log(`\nRecord ${i + 1}:`);
                console.log(JSON.stringify(p, null, 2));
            });

            // 4. Verifica la cronologia delle modifiche al balance
            db.all("PRAGMA table_info(portfolio)", (err, schema) => {
                if (err) {
                    console.error('Error:', err);
                    return;
                }

                console.log('\n📐 SCHEMA TABELLA PORTFOLIO:');
                console.log('='.repeat(80));
                schema.forEach(col => {
                    console.log(`  ${col.name} (${col.type}) - NotNull: ${col.notnull}, Default: ${col.dflt_value}`);
                });

                // 5. Verifica se ci sono trigger o vincoli
                db.all("SELECT * FROM sqlite_master WHERE type='trigger'", (err, triggers) => {
                    if (err) {
                        console.error('Error:', err);
                        return;
                    }

                    console.log('\n⚡ TRIGGER NEL DATABASE:');
                    console.log('='.repeat(80));
                    if (triggers.length === 0) {
                        console.log('❌ Nessun trigger trovato');
                    } else {
                        triggers.forEach(t => {
                            console.log(`\nTrigger: ${t.name}`);
                            console.log(`Table: ${t.tbl_name}`);
                            console.log(`SQL: ${t.sql}`);
                        });
                    }

                    // 6. Verifica quando è stato modificato il file del database
                    const fs = require('fs');
                    const stats = fs.statSync('./backend/crypto.db');

                    console.log('\n📅 INFO FILE DATABASE:');
                    console.log('='.repeat(80));
                    console.log(`Creato: ${stats.birthtime}`);
                    console.log(`Ultima modifica: ${stats.mtime}`);
                    console.log(`Dimensione: ${stats.size} bytes`);

                    // 7. TEORIA: Verifica se il balance è stato impostato manualmente
                    console.log('\n' + '='.repeat(80));
                    console.log('🎯 ANALISI FINALE:');
                    console.log('='.repeat(80));
                    console.log('Balance attuale: €262.50');
                    console.log('Balance atteso: €250.00');
                    console.log('Differenza: +€12.50');
                    console.log('');
                    console.log('POSSIBILI CAUSE:');
                    console.log('1. ✅ Il database è stato creato con balance = 262.50');
                    console.log('2. ✅ Qualcuno ha eseguito: UPDATE portfolio SET balance_usd = 262.50');
                    console.log('3. ✅ Il bot ha eseguito trade che sono stati poi cancellati');
                    console.log('4. ✅ Reset incompleto (ha cancellato trade ma non ha aggiornato balance)');
                    console.log('');
                    console.log('SOLUZIONE:');
                    console.log('Per resettare a €250.00, esegui:');
                    console.log('  node reset_balance_to_250.js');
                    console.log('');
                    console.log('Oppure usa il pulsante "Reset Portfolio" nel dashboard.');

                    db.close();
                });
            });
        });
    });
});
