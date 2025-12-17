/**
 * Script per configurare il bot per AVAX_USDT
 * 
 * Uso: node setup_avax_bot.js
 */

const { dbRun, dbGet } = require('./crypto_db');

async function setupAvaxBot() {
    try {
        console.log('🔧 Configurazione bot per AVAX_USDT...\n');

        // Verifica se esiste già
        const existing = await dbGet(
            "SELECT * FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = $1",
            ['avax_usdt']
        );

        if (existing) {
            console.log('✅ Bot già configurato per avax_usdt');
            console.log(`   Status: ${existing.is_active === 1 ? 'Attivo' : 'Inattivo'}`);
            
            // Attiva se inattivo
            if (existing.is_active !== 1) {
                await dbRun(
                    "UPDATE bot_settings SET is_active = 1 WHERE strategy_name = 'RSI_Strategy' AND symbol = $1",
                    ['avax_usdt']
                );
                console.log('   ✅ Bot attivato');
            }
        } else {
            // Crea nuova configurazione
            const defaultParams = {
                rsi_period: 14,
                rsi_oversold: 30,
                rsi_overbought: 70,
                stop_loss_pct: 2.5,
                take_profit_pct: 4.0,
                trade_size_usdt: 50,
                trailing_stop_enabled: false,
                trailing_stop_distance_pct: 1.0,
                partial_close_enabled: true,
                take_profit_1_pct: 2.5,
                take_profit_2_pct: 5.0,
                min_signal_strength: 70,
                min_confirmations_long: 3,
                min_confirmations_short: 4,
                market_scanner_min_strength: 30
            };

            await dbRun(
                `INSERT INTO bot_settings (strategy_name, symbol, is_active, parameters)
                 VALUES ('RSI_Strategy', 'avax_usdt', 1, $1)`,
                [JSON.stringify(defaultParams)]
            );

            console.log('✅ Bot configurato e attivato per avax_usdt');
        }

        console.log('\n✅ Configurazione completata!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Errore:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

setupAvaxBot();

