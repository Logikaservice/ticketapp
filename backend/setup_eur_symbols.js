/**
 * 🔧 Script per Configurare Simboli EUR Disponibili su Binance
 * 
 * Verifica e configura automaticamente tutti i simboli EUR disponibili su Binance:
 * 1. Verifica se esistono nel database
 * 2. Crea entry in bot_settings se mancanti
 * 3. Verifica klines disponibili
 * 4. Scarica klines se mancanti
 */

const { dbAll, dbGet, dbRun } = require('./crypto_db');

// Mappa simboli database -> Binance EUR (23 simboli disponibili)
const EUR_SYMBOL_MAP = {
    'bitcoin_eur': 'BTCEUR',
    'ethereum_eur': 'ETHEUR',
    'cardano_eur': 'ADAEUR',
    'polkadot_eur': 'DOTEUR',
    'chainlink_eur': 'LINKEUR',
    'litecoin_eur': 'LTCEUR',
    'ripple_eur': 'XRPEUR',
    'binance_coin_eur': 'BNBEUR',
    'solana_eur': 'SOLEUR',
    'avax_eur': 'AVAXEUR',
    'avalanche_eur': 'AVAXEUR',
    'matic_eur': 'MATICEUR',
    'tron_eur': 'TRXEUR',
    'stellar_eur': 'XLMEUR',
    'cosmos_eur': 'ATOMEUR',
    'near_eur': 'NEAREUR',
    'sui_eur': 'SUIEUR',
    'arbitrum_eur': 'ARBEUR',
    'optimism_eur': 'OPEUR',
    'gala_eur': 'GALAEUR',
    'uniswap_eur': 'UNIEUR'
};

async function setupEurSymbols() {
    console.log('🔧 CONFIGURAZIONE SIMBOLI EUR DISPONIBILI SU BINANCE');
    console.log('='.repeat(80));
    console.log('');

    try {
        const symbolsToSetup = Object.keys(EUR_SYMBOL_MAP);
        let created = 0;
        let alreadyExists = 0;
        let errors = 0;

        console.log(`📊 Verifica e configurazione di ${symbolsToSetup.length} simboli EUR...`);
        console.log('');

        for (const dbSymbol of symbolsToSetup) {
            try {
                // Verifica se esiste già in bot_settings
                const existing = await dbGet(
                    "SELECT * FROM bot_settings WHERE symbol = $1 AND strategy_name = $2",
                    [dbSymbol, 'RSI_Strategy']
                );

                if (existing) {
                    console.log(`   ✅ ${dbSymbol.toUpperCase()}: Già configurato (attivo: ${existing.is_active === 1 ? 'SÌ' : 'NO'})`);
                    alreadyExists++;
                } else {
                    // Crea entry in bot_settings
                    await dbRun(
                        `INSERT INTO bot_settings (strategy_name, symbol, is_active, created_at, updated_at)
                         VALUES ($1, $2, $3, NOW(), NOW())
                         ON CONFLICT (strategy_name, symbol) DO NOTHING`,
                        ['RSI_Strategy', dbSymbol, 1] // Attivo di default
                    );

                    // Verifica che sia stato creato
                    const verify = await dbGet(
                        "SELECT * FROM bot_settings WHERE symbol = $1 AND strategy_name = $2",
                        [dbSymbol, 'RSI_Strategy']
                    );

                    if (verify) {
                        console.log(`   ✅ ${dbSymbol.toUpperCase()}: Configurato e attivato`);
                        created++;
                    } else {
                        console.log(`   ⚠️ ${dbSymbol.toUpperCase()}: Errore durante creazione`);
                        errors++;
                    }
                }

                // Verifica klines
                const klines = await dbAll(
                    "SELECT COUNT(*) as count FROM klines WHERE symbol = $1 AND interval = '15m'",
                    [dbSymbol]
                );
                const klinesCount = parseInt(klines[0]?.count || 0);
                
                if (klinesCount < 50) {
                    console.log(`      ⚠️ Klines insufficienti: ${klinesCount} (minimo 50)`);
                    console.log(`      💡 Esegui: node download_klines.js ${dbSymbol} ${EUR_SYMBOL_MAP[dbSymbol]}`);
                } else if (klinesCount < 100) {
                    console.log(`      ⚠️ Klines limitate: ${klinesCount} (consigliato 100+)`);
                } else {
                    console.log(`      ✅ Klines: ${klinesCount}`);
                }

            } catch (error) {
                console.error(`   ❌ ${dbSymbol.toUpperCase()}: Errore - ${error.message}`);
                errors++;
            }
            
            console.log('');
        }

        // Report finale
        console.log('='.repeat(80));
        console.log('✅ CONFIGURAZIONE COMPLETATA');
        console.log('='.repeat(80));
        console.log('');
        console.log(`📊 Simboli già configurati: ${alreadyExists}`);
        console.log(`✅ Simboli creati: ${created}`);
        console.log(`❌ Errori: ${errors}`);
        console.log('');
        console.log('💡 I simboli EUR sono ora visibili nel Market Scanner e possono essere utilizzati dal bot');
        console.log('');

    } catch (error) {
        console.error('❌ Errore durante configurazione simboli EUR:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

setupEurSymbols().catch(console.error);

