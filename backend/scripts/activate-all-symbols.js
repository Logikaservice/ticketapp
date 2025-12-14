/**
 * Script per attivare il bot per tutti i simboli disponibili
 * Crea entry in bot_settings per ogni simbolo in SYMBOL_TO_PAIR
 */

const db = require('../crypto_db');

// Lista completa dei simboli (copiata da cryptoRoutes.js)
const ALL_SYMBOLS = [
    'bitcoin', 'bitcoin_usdt',
    'solana', 'solana_eur',
    'ethereum', 'ethereum_usdt',
    'cardano', 'cardano_usdt',
    'polkadot', 'polkadot_usdt',
    'chainlink', 'chainlink_usdt',
    'ripple', 'ripple_eur',
    'binance_coin', 'binance_coin_eur',
    'pol_polygon', 'pol_polygon_eur',
    'avalanche', 'avalanche_eur',
    'uniswap', 'uniswap_eur',
    'dogecoin', 'dogecoin_eur',
    'shiba', 'shiba_eur',
    'near', 'near_eur',
    'atom', 'atom_eur',
    'aave',
    'sand',
    'fil',
    'trx', 'trx_eur',
    'xlm', 'xlm_eur',
    'arb', 'arb_eur',
    'op', 'op_eur',
    'matic', 'matic_eur',
    'crv',
    'ldo',
    'mana',
    'axs',
    'usdc',
    'sui', 'sui_eur',
    'apt',
    'sei',
    'ton',
    'inj',
    'icp',
    'mkr',
    'comp',
    'snx',
    'fet',
    'render',
    'grt',
    'imx',
    'gala',
    'enj', 'enj_eur',
    'pepe', 'pepe_eur',
    'floki',
    'bonk',
    'ar'
];

async function activateAllSymbols() {
    try {
        console.log('🚀 Attivazione bot per tutti i simboli...\n');

        // Controlla simboli già presenti
        const existingBots = await new Promise((resolve, reject) => {
            db.all("SELECT symbol, is_active FROM bot_settings WHERE strategy_name = 'RSI_Strategy'", (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        const existingSymbols = new Set(existingBots.map(b => b.symbol));
        console.log(`📊 Simboli già configurati: ${existingSymbols.size}`);

        let added = 0;
        let updated = 0;
        let skipped = 0;

        for (const symbol of ALL_SYMBOLS) {
            if (existingSymbols.has(symbol)) {
                // Simbolo già presente - verifica se è attivo
                const bot = existingBots.find(b => b.symbol === symbol);
                if (bot.is_active === 0) {
                    // Attiva il bot
                    await new Promise((resolve, reject) => {
                        db.run(
                            "UPDATE bot_settings SET is_active = 1 WHERE symbol = ? AND strategy_name = 'RSI_Strategy'",
                            [symbol],
                            (err) => {
                                if (err) reject(err);
                                else resolve();
                            }
                        );
                    });
                    console.log(`✅ Attivato: ${symbol}`);
                    updated++;
                } else {
                    console.log(`⏭️  Già attivo: ${symbol}`);
                    skipped++;
                }
            } else {
                // Simbolo non presente - crea entry
                await new Promise((resolve, reject) => {
                    db.run(
                        `INSERT INTO bot_settings (symbol, strategy_name, is_active, parameters) 
                         VALUES (?, 'RSI_Strategy', 1, '{"rsi_period":14,"rsi_oversold":30,"rsi_overbought":70,"trade_size_eur":50}')`,
                        [symbol],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
                console.log(`➕ Aggiunto: ${symbol}`);
                added++;
            }
        }

        console.log(`\n📊 Riepilogo:`);
        console.log(`   ➕ Aggiunti: ${added}`);
        console.log(`   ✅ Attivati: ${updated}`);
        console.log(`   ⏭️  Già attivi: ${skipped}`);
        console.log(`   📈 Totale simboli attivi: ${added + updated + skipped}`);

        console.log(`\n✅ Tutti i ${ALL_SYMBOLS.length} simboli sono ora attivi!`);
        console.log(`   → Il bot analizzerà tutti i simboli disponibili`);
        console.log(`   → Il Market Scanner mostrerà segnali per tutti i simboli`);

    } catch (err) {
        console.error('❌ Errore:', err.message);
    } finally {
        db.close();
    }
}

activateAllSymbols();
