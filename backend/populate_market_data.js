/**
 * 📊 Script per Popolare market_data
 * 
 * Scarica volume 24h e prezzi da Binance e li salva in market_data
 */

const { dbAll, dbGet, dbRun } = require('./crypto_db');
const https = require('https');

// Mappa simboli a coppie Binance
const SYMBOL_TO_PAIR = {
    'bitcoin': 'BTCEUR',
    'bitcoin_usdt': 'BTCUSDT',
    'ethereum': 'ETHEUR',
    'ethereum_usdt': 'ETHUSDT',
    'solana': 'SOLUSDT',
    'solana_eur': 'SOLEUR',
    'cardano': 'ADAUSDT',
    'cardano_usdt': 'ADAUSDT',
    'polkadot': 'DOTUSDT',
    'polkadot_usdt': 'DOTUSDT',
    'chainlink': 'LINKEUR',
    'chainlink_usdt': 'LINKUSDT',
    'litecoin': 'LTCEUR',
    'litecoin_usdt': 'LTCUSDT',
    'ripple': 'XRPUSDT',
    'ripple_eur': 'XRPEUR',
    'binance_coin': 'BNBEUR',
    'binance_coin_eur': 'BNBEUR',
    'avax_usdt': 'AVAXUSDT',
    'sand': 'SANDUSDT',
    'uniswap': 'UNIUSDT',
    'aave': 'AAVEUSDT',
    'mana': 'MANAUSDT',
    'bonk': 'BONKUSDT'
};

async function getBinanceTicker24h(pair) {
    return new Promise((resolve, reject) => {
        const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`;
        
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({
                        volume24h: parseFloat(json.quoteVolume) || 0,
                        price: parseFloat(json.lastPrice) || 0,
                        priceChange24h: parseFloat(json.priceChangePercent) || 0
                    });
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function normalizeSymbol(symbol) {
    // Normalizza simbolo per Binance
    let pair = symbol.toLowerCase();
    
    // Rimuovi _usdt e aggiungi USDT
    if (pair.includes('_usdt')) {
        pair = pair.replace('_usdt', '') + 'usdt';
    } else if (pair.includes('_eur')) {
        pair = pair.replace('_eur', '') + 'eur';
    } else if (!pair.endsWith('usdt') && !pair.endsWith('eur')) {
        pair = pair + 'usdt';
    }
    
    // Converti in uppercase per Binance
    pair = pair.toUpperCase();
    
    // Mapping speciali
    const specialMap = {
        'ETHEREUM': 'ETHUSDT',
        'BITCOIN': 'BTCUSDT',
        'AVAX_USDT': 'AVAXUSDT',
        'SAND': 'SANDUSDT',
        'UNISWAP': 'UNIUSDT',
        'AAVE': 'AAVEUSDT',
        'MANA': 'MANAUSDT',
        'BONK': 'BONKUSDT'
    };
    
    if (specialMap[symbol.toUpperCase()]) {
        pair = specialMap[symbol.toUpperCase()];
    }
    
    return pair;
}

async function populateMarketDataForSymbol(symbol) {
    try {
        // Prova prima con la mappa
        let pair = SYMBOL_TO_PAIR[symbol] || await normalizeSymbol(symbol);
        
        const ticker = await getBinanceTicker24h(pair);
        
        if (ticker.volume24h === 0 && ticker.price === 0) {
            console.log(`   ⚠️ ${symbol}: Dati non disponibili per ${pair}`);
            return false;
        }
        
        // Salva in market_data
        await dbRun(
            `INSERT INTO market_data (symbol, volume_24h, price_usd, price_change_24h, timestamp)
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
             ON CONFLICT (symbol, timestamp) DO UPDATE SET
             volume_24h = EXCLUDED.volume_24h,
             price_usd = EXCLUDED.price_usd,
             price_change_24h = EXCLUDED.price_change_24h`,
            [symbol, ticker.volume24h, ticker.price, ticker.priceChange24h]
        );
        
        console.log(`   ✅ ${symbol}: Volume $${ticker.volume24h.toLocaleString()}, Prezzo $${ticker.price.toFixed(2)}`);
        return true;
        
    } catch (error) {
        if (error.message.includes('Invalid symbol')) {
            console.log(`   ⚠️ ${symbol}: Simbolo non valido su Binance`);
        } else {
            console.log(`   ❌ ${symbol}: Errore - ${error.message}`);
        }
        return false;
    }
}

async function main() {
    console.log('📊 POPOLAZIONE MARKET_DATA');
    console.log('='.repeat(80));
    console.log('');

    try {
        // 1. Recupera tutti i simboli da bot_settings
        const botSymbols = await dbAll(
            "SELECT DISTINCT symbol FROM bot_settings WHERE strategy_name = $1",
            ['RSI_Strategy']
        );

        // 2. Recupera anche simboli con klines
        const klinesSymbols = await dbAll(
            "SELECT DISTINCT symbol FROM klines WHERE interval = '15m'"
        );

        // 3. Combina e rimuovi duplicati
        const allSymbols = new Set();
        botSymbols.forEach(row => allSymbols.add(row.symbol));
        klinesSymbols.forEach(row => allSymbols.add(row.symbol));

        const symbolsArray = Array.from(allSymbols).sort();

        console.log(`📊 Simboli da processare: ${symbolsArray.length}`);
        console.log('');

        let successCount = 0;
        let failCount = 0;

        // 4. Popola market_data per ogni simbolo
        for (const symbol of symbolsArray) {
            const success = await populateMarketDataForSymbol(symbol);
            if (success) {
                successCount++;
            } else {
                failCount++;
            }
            
            // Pausa per non sovraccaricare Binance API
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log('');
        console.log('='.repeat(80));
        console.log('📋 REPORT FINALE');
        console.log('='.repeat(80));
        console.log(`✅ Simboli processati con successo: ${successCount}`);
        console.log(`⚠️ Simboli falliti: ${failCount}`);
        console.log(`📊 Totale: ${symbolsArray.length}`);
        console.log('');

        // 5. Verifica risultati
        const marketDataCount = await dbAll(
            "SELECT COUNT(DISTINCT symbol) as count FROM market_data"
        );
        
        const totalRecords = await dbAll(
            "SELECT COUNT(*) as count FROM market_data"
        );

        console.log(`📊 Dati salvati in market_data:`);
        console.log(`   Simboli unici: ${marketDataCount[0]?.count || 0}`);
        console.log(`   Record totali: ${totalRecords[0]?.count || 0}`);
        console.log('');

    } catch (error) {
        console.error('❌ Errore durante popolamento:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

main().catch(console.error);

