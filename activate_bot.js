const db = require('./backend/crypto_db');

console.log('🤖 VERIFICA STATUS BOT');
console.log('='.repeat(80));

db.all("SELECT * FROM bot_settings", (err, bots) => {
    if (err) {
        console.error('Error:', err);
        db.close();
        return;
    }

    console.log('\n📊 BOT SETTINGS ATTUALI:');
    console.log('='.repeat(80));

    if (bots.length === 0) {
        console.log('❌ Nessun bot configurato nel database!');
        console.log('\nCREO UN BOT ATTIVO...');

        // Crea un bot attivo
        db.run(
            `INSERT INTO bot_settings (strategy_name, symbol, is_active, parameters) 
             VALUES (?, ?, ?, ?)`,
            ['RSI_Strategy', 'bitcoin', 1, JSON.stringify({ period: 14, buy_threshold: 30, sell_threshold: 70 })],
            function (err) {
                if (err) {
                    console.error('Errore nella creazione:', err);
                } else {
                    console.log('✅ Bot creato e ATTIVATO!');
                    console.log(`   ID: ${this.lastID}`);
                    console.log('   Strategy: RSI_Strategy');
                    console.log('   Symbol: bitcoin');
                    console.log('   Status: ✅ ACTIVE');
                }
                db.close();
            }
        );
    } else {
        bots.forEach((bot, i) => {
            console.log(`\nBot ${i + 1}:`);
            console.log(`  ID: ${bot.id}`);
            console.log(`  Strategy: ${bot.strategy_name}`);
            console.log(`  Symbol: ${bot.symbol}`);
            console.log(`  Active: ${bot.is_active ? '✅ SÌ' : '❌ NO'}`);
            console.log(`  Parameters: ${bot.parameters}`);

            if (bot.is_active === 0) {
                console.log('\n⚠️  Bot DISATTIVATO! Attivazione in corso...');

                db.run(
                    'UPDATE bot_settings SET is_active = 1 WHERE id = ?',
                    [bot.id],
                    function (err) {
                        if (err) {
                            console.error('Errore nell\'attivazione:', err);
                        } else {
                            console.log(`✅ Bot ${bot.id} ATTIVATO con successo!`);
                        }

                        if (i === bots.length - 1) {
                            db.close();
                        }
                    }
                );
            } else {
                console.log('✅ Bot già attivo!');
                if (i === bots.length - 1) {
                    db.close();
                }
            }
        });
    }
});
