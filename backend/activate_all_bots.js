/**
 * 🤖 Script per Attivare Tutti i Bot Disattivati
 * 
 * Trova e attiva tutti i bot disattivati (tranne quelli esplicitamente esclusi)
 */

const { dbAll, dbRun } = require('./crypto_db');

async function activateAllBots() {
    console.log('🤖 ATTIVAZIONE BOT DISATTIVATI');
    console.log('='.repeat(80));
    console.log('');

    try {
        // Trova bot disattivati
        const inactiveBots = await dbAll(
            "SELECT symbol, strategy_name FROM bot_settings WHERE is_active = 0 AND strategy_name = $1",
            ['RSI_Strategy']
        );

        if (inactiveBots.length === 0) {
            console.log('✅ Tutti i bot sono già attivi');
            console.log('');
            return;
        }

        console.log(`📊 Trovati ${inactiveBots.length} bot disattivati:`);
        inactiveBots.forEach(bot => {
            console.log(`   - ${bot.symbol}`);
        });
        console.log('');

        // Chiedi conferma (in automatico, attiva tutti)
        console.log('🔄 Attivazione bot...');
        console.log('');

        let activated = 0;
        for (const bot of inactiveBots) {
            try {
                // Escludi 'global' se esiste ancora
                if (bot.symbol.toLowerCase() === 'global') {
                    console.log(`   ⏭️ Saltato: ${bot.symbol} (simbolo invalido)`);
                    continue;
                }

                await dbRun(
                    "UPDATE bot_settings SET is_active = 1 WHERE symbol = $1 AND strategy_name = $2",
                    [bot.symbol, bot.strategy_name]
                );
                console.log(`   ✅ Attivato: ${bot.symbol}`);
                activated++;
            } catch (error) {
                console.log(`   ❌ Errore attivazione ${bot.symbol}: ${error.message}`);
            }
        }

        console.log('');
        console.log('='.repeat(80));
        console.log(`✅ ATTIVATI ${activated} BOT`);
        console.log('='.repeat(80));
        console.log('');

    } catch (error) {
        console.error('❌ Errore durante attivazione bot:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

activateAllBots().catch(console.error);

