/**
 * Script per correggere current_price di tutte le posizioni aperte
 * Ricalcola current_price usando getSymbolPrice (che ora converte correttamente EUR→USDT)
 */

const cryptoDb = require('../crypto_db');

// Mappa simboli (copiata da cryptoRoutes.js)
const SYMBOL_TO_PAIR = {
    'bitcoin': 'BTCEUR',
    'bitcoin_usdt': 'BTCUSDT',
    'solana': 'SOLUSDT',
    'solana_eur': 'SOLEUR',
    'ethereum': 'ETHEUR',
    'ethereum_usdt': 'ETHUSDT',
    'cardano': 'ADAEUR',
    'cardano_usdt': 'ADAUSDT',
    'polkadot': 'DOTEUR',
    'polkadot_usdt': 'DOTUSDT',
    'chainlink': 'LINKEUR',
    'chainlink_usdt': 'LINKUSDT',
    'litecoin': 'LTCEUR',
    'litecoin_usdt': 'LTCUSDT',
    'ripple': 'XRPUSDT',
    'ripple_eur': 'XRPEUR',
    'binance_coin': 'BNBUSDT',
    'binance_coin_eur': 'BNBEUR',
    'dogecoin': 'DOGEUSDT',
    'dogecoin_eur': 'DOGEEUR',
    'pol_polygon': 'POLUSDT',
    'pol_polygon_eur': 'POLEUR',
    'avalanche': 'AVAXUSDT',
    'avalanche_eur': 'AVAXEUR',
    'uniswap': 'UNIUSDT',
    'uniswap_eur': 'UNIEUR',
    'stellar': 'XLMUSDT',
    'stellar_eur': 'XLMEUR',
    'fetch': 'FETUSDT',
    'fetch_eur': 'FETEUR',
};

// Simula getSymbolPrice (versione semplificata per lo script)
async function getSymbolPrice(symbol) {
    const https = require('https');
    
    return new Promise((resolve, reject) => {
        const tradingPair = SYMBOL_TO_PAIR[symbol] || 'BTCEUR';
        const isEURPair = tradingPair.endsWith('EUR');
        const EUR_TO_USDT_RATE = 1.08;
        
        const url = `https://api.binance.com/api/v3/ticker/price?symbol=${tradingPair}`;
        
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json && json.price) {
                        let price = parseFloat(json.price);
                        if (isEURPair) {
                            price = price * EUR_TO_USDT_RATE;
                            console.log(`   💱 ${symbol} (${tradingPair}): €${(price / EUR_TO_USDT_RATE).toFixed(6)} EUR → $${price.toFixed(6)} USDT`);
                        }
                        resolve(price);
                    } else {
                        reject(new Error('Invalid response'));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function fixAllCurrentPrices() {
    try {
        console.log('🔍 Correzione current_price per tutte le posizioni aperte...\n');

        // Recupera tutte le posizioni aperte
        const positions = await cryptoDb.dbAll(
            "SELECT ticket_id, symbol, entry_price, current_price, opened_at FROM open_positions WHERE status = 'open' ORDER BY opened_at DESC"
        );

        if (!positions || positions.length === 0) {
            console.log('✅ Nessuna posizione aperta trovata');
            return;
        }

        console.log(`📊 Trovate ${positions.length} posizioni aperte\n`);

        let fixedCount = 0;
        let errorCount = 0;

        for (const pos of positions) {
            const symbol = pos.symbol;
            const oldCurrentPrice = parseFloat(pos.current_price);
            
            console.log(`\n${fixedCount + errorCount + 1}. ${symbol.toUpperCase()} (${pos.ticket_id})`);
            console.log(`   Current Price attuale: $${oldCurrentPrice.toFixed(6)}`);

            try {
                // Ottieni prezzo corretto (già convertito a USDT se necessario)
                const correctPrice = await getSymbolPrice(symbol);
                
                if (correctPrice > 0) {
                    const priceDiff = Math.abs(correctPrice - oldCurrentPrice);
                    const priceDiffPct = oldCurrentPrice > 0 ? (priceDiff / oldCurrentPrice) * 100 : 0;
                    
                    console.log(`   Prezzo corretto: $${correctPrice.toFixed(6)}`);
                    console.log(`   Differenza: $${priceDiff.toFixed(6)} (${priceDiffPct.toFixed(2)}%)`);
                    
                    if (priceDiffPct > 5) { // Se differenza > 5%, aggiorna
                        // Aggiorna nel database
                        await cryptoDb.dbRun(
                            "UPDATE open_positions SET current_price = ? WHERE ticket_id = ?",
                            [correctPrice, pos.ticket_id]
                        );
                        console.log(`   ✅ Aggiornato nel database`);
                        fixedCount++;
                    } else {
                        console.log(`   ✓ Prezzo già corretto (differenza < 5%)`);
                    }
                } else {
                    console.log(`   ⚠️  Impossibile ottenere prezzo corretto`);
                    errorCount++;
                }
            } catch (err) {
                console.error(`   ❌ Errore: ${err.message}`);
                errorCount++;
            }
        }

        console.log(`\n\n📊 Riepilogo:`);
        console.log(`   Posizioni verificate: ${positions.length}`);
        console.log(`   Posizioni corrette: ${fixedCount}`);
        console.log(`   Posizioni già corrette: ${positions.length - fixedCount - errorCount}`);
        console.log(`   Errori: ${errorCount}`);

    } catch (err) {
        console.error('❌ Errore:', err.message);
        console.error(err.stack);
        process.exit(1);
    }
}

// Esegui
fixAllCurrentPrices()
    .then(() => {
        console.log('\n✅ Script completato');
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ Errore fatale:', err);
        process.exit(1);
    });

