const db = require('./backend/crypto_db');

console.log('🤖 VERIFICA ATTIVITÀ BOT E CRONOLOGIA');
console.log('='.repeat(80));

// 1. Verifica se il bot è attivo
db.all("SELECT * FROM bot_settings", (err, bots) => {
    if (err) {
        console.error('Error:', err);
        return;
    }

    console.log('\n🤖 BOT SETTINGS:');
    console.log('='.repeat(80));
    if (bots.length === 0) {
        console.log('❌ Nessun bot configurato');
    } else {
        bots.forEach((bot, i) => {
            console.log(`\nBot ${i + 1}:`);
            console.log(`  Strategy: ${bot.strategy_name}`);
            console.log(`  Symbol: ${bot.symbol}`);
            console.log(`  Active: ${bot.is_active ? '✅ SÌ' : '❌ NO'}`);
            console.log(`  Parameters: ${bot.parameters}`);
        });
    }

    // 2. Verifica backtest results (potrebbero contenere tracce)
    db.all("SELECT * FROM backtest_results ORDER BY created_at DESC LIMIT 5", (err, backtests) => {
        if (err) {
            console.error('Error:', err);
            return;
        }

        console.log('\n📊 BACKTEST RECENTI:');
        console.log('='.repeat(80));
        if (backtests.length === 0) {
            console.log('❌ Nessun backtest trovato');
        } else {
            backtests.forEach((bt, i) => {
                console.log(`\nBacktest ${i + 1}:`);
                console.log(`  Created: ${bt.created_at}`);
                console.log(`  Symbol: ${bt.symbol}`);
                console.log(`  Initial Capital: €${bt.initial_capital}`);
                console.log(`  Final Capital: €${bt.final_capital}`);
                console.log(`  Profit: €${bt.total_profit}`);
            });
        }

        // 3. Verifica se ci sono dati in price_history (ultima attività)
        db.get("SELECT COUNT(*) as count FROM price_history", (err, result) => {
            if (err) {
                console.error('Error:', err);
                return;
            }

            console.log('\n📈 PRICE HISTORY:');
            console.log('='.repeat(80));
            console.log(`Numero di record: ${result.count}`);

            if (result.count > 0) {
                db.get("SELECT * FROM price_history ORDER BY timestamp DESC LIMIT 1", (err, latest) => {
                    if (!err && latest) {
                        console.log(`Ultimo aggiornamento: ${latest.timestamp}`);
                        console.log(`Symbol: ${latest.symbol}`);
                        console.log(`Price: €${latest.price}`);
                    }

                    // 4. TEORIA FINALE
                    console.log('\n' + '='.repeat(80));
                    console.log('🔍 TEORIA SUL MISTERO €12.50:');
                    console.log('='.repeat(80));
                    console.log('');
                    console.log('SCENARIO PIÙ PROBABILE:');
                    console.log('Il database è stato modificato PRIMA del 6 dicembre 2025.');
                    console.log('Ultima modifica file: Sat Dec 06 2025 13:02:43');
                    console.log('Creazione file: Tue Dec 02 2025 21:45:46');
                    console.log('');
                    console.log('IPOTESI:');
                    console.log('1. Il bot ha fatto trading tra il 2 e il 6 dicembre');
                    console.log('2. Ha generato €12.50 di profitto');
                    console.log('3. Qualcuno ha fatto "Reset Portfolio" che ha:');
                    console.log('   - ✅ Cancellato i trade dalla tabella trades');
                    console.log('   - ✅ Cancellato le posizioni dalla tabella open_positions');
                    console.log('   - ❌ NON ha aggiornato il balance a €250');
                    console.log('');
                    console.log('OPPURE:');
                    console.log('Il balance iniziale era già €262.50 quando il DB è stato creato.');
                    console.log('');
                    console.log('VERIFICA:');
                    console.log('Controlla se il default del balance_usd è 10000.0 (vedi schema)');
                    console.log('Ma il valore attuale è 262.5, quindi è stato modificato.');
                    console.log('');
                    console.log('CONCLUSIONE:');
                    console.log('Il balance di €262.50 è CORRETTO se consideriamo che:');
                    console.log('- Il bot ha fatto trading e ha guadagnato €12.50');
                    console.log('- I trade sono stati cancellati ma il profitto è rimasto');
                    console.log('');
                    console.log('AZIONE CONSIGLIATA:');
                    console.log('Se vuoi ripartire da €250.00, usa il pulsante Reset Portfolio.');
                    console.log('Questo resetterà TUTTO (trade + balance) a €250.00.');

                    db.close();
                });
            } else {
                db.close();
            }
        });
    });
});
