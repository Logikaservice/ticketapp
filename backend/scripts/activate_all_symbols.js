/**
 * Script per attivare il bot su TUTTI i simboli disponibili
 * Esegue: node backend/scripts/activate_all_symbols.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { dbGet, dbAll, dbRun } = require('../crypto_db');

const SYMBOL_TO_PAIR = {
    'bitcoin': 'BTCUSDT',
    'ethereum': 'ETHUSDT',
    'cardano': 'ADAUSDT',
    'solana': 'SOLUSDT',
    'xrp': 'XRPUSDT',
    'polkadot': 'DOTUSDT',
    'dogecoin': 'DOGEUSDT',
    'shiba': 'SHIBUSDT',
    'matic': 'MATICUSDT',
    'avalanche': 'AVAXUSDT',
    'chainlink': 'LINKUSDT',
    'mana': 'MANAUSDT',
    'sandbox': 'SANDUSDT',
    'enjin': 'ENJUSDT',
};

const DEFAULT_PARAMS = {
    rsi_period: 14,
    rsi_oversold: 30,
    rsi_overbought: 70,
    stop_loss_pct: 2.5,
    take_profit_pct: 4.0,
    trade_size_usdt: 100,
    trailing_stop_enabled: false,
    trailing_stop_distance_pct: 1.0,
    partial_close_enabled: false,
    take_profit_1_pct: 1.5,
    take_profit_2_pct: 3.0,
    min_atr_pct: 0.2,
    max_atr_pct: 5.0,
    min_volume_24h: 500000,
    max_daily_loss_pct: 5.0,
    max_exposure_pct: 40.0,
    max_positions: 10,
    analysis_timeframe: '15m',
    min_signal_strength: 70,
    min_confirmations_long: 3,
    min_confirmations_short: 4,
    market_scanner_min_strength: 30
};

async function activateAllSymbols() {
    console.log('\n🤖 Attivazione bot su TUTTI i simboli disponibili...\n');

    try {
        const symbols = Object.keys(SYMBOL_TO_PAIR);
        let activated = 0;
        let updated = 0;
        let skipped = 0;

        for (const symbol of symbols) {
            try {
                // Verifica se esiste già
                const existing = await dbGet(
                    "SELECT * FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = $1",
                    [symbol]
                );

                if (existing) {
                    // Aggiorna a attivo se non lo è già
                    if (Number(existing.is_active) !== 1) {
                        await dbRun(
                            "UPDATE bot_settings SET is_active = 1 WHERE strategy_name = 'RSI_Strategy' AND symbol = $1",
                            [symbol]
                        );
                        console.log(`✅ ATTIVATO: ${symbol} (era disattivo)`);
                        updated++;
                    } else {
                        console.log(`⏭️  GIÀ ATTIVO: ${symbol}`);
                        skipped++;
                    }
                } else {
                    // Crea nuova entry con bot ATTIVO
                    await dbRun(
                        "INSERT INTO bot_settings (strategy_name, symbol, is_active, parameters) VALUES ($1, $2, 1, $3)",
                        ['RSI_Strategy', symbol, JSON.stringify(DEFAULT_PARAMS)]
                    );
                    console.log(`✅ CREATO E ATTIVATO: ${symbol}`);
                    activated++;
                }
            } catch (err) {
                console.error(`❌ Errore per ${symbol}:`, err.message);
            }
        }

        console.log(`\n📊 RISULTATO:`);
        console.log(`   ✅ Attivati: ${activated}`);
        console.log(`   🔄 Aggiornati: ${updated}`);
        console.log(`   ⏭️  Già attivi: ${skipped}`);
        console.log(`   📝 Totale simboli: ${symbols.length}\n`);

    } catch (error) {
        console.error('❌ Errore:', error.message);
        process.exit(1);
    }
}

activateAllSymbols()
    .then(() => {
        console.log('✅ Completato!');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Errore:', error);
        process.exit(1);
    });

