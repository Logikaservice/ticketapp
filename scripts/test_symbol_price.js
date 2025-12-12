/**
 * Test script per verificare cosa restituisce getSymbolPrice per polkadot
 */

const https = require('https');

function httpsGet(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Failed to parse JSON: ${e.message}`));
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        req.end();
    });
}

async function testPrice() {
    console.log('🔍 Test recupero prezzo per vari simboli:\n');
    
    const symbols = [
        'polkadot',
        'dot',
        'DOTUSDT',
        'dotusdt'
    ];
    
    for (const symbol of symbols) {
        try {
            // Normalizza come nel codice
            let normalizedSymbol = symbol.toLowerCase()
                .replace(/\//g, '')
                .replace(/_/g, '')
                .replace(/usdt$/, '')
                .replace(/eur$/, '');
            
            const SYMBOL_MAP_FALLBACK = {
                'bitcoin': 'BTCUSDT', 'btc': 'BTCUSDT', 'btcusdt': 'BTCUSDT',
                'ethereum': 'ETHUSDT', 'eth': 'ETHUSDT', 'ethusdt': 'ETHUSDT',
                'solana': 'SOLUSDT', 'sol': 'SOLUSDT', 'solusdt': 'SOLUSDT',
                'cardano': 'ADAUSDT', 'ada': 'ADAUSDT', 'adausdt': 'ADAUSDT',
                'ripple': 'XRPUSDT', 'xrp': 'XRPUSDT', 'xrpusdt': 'XRPUSDT',
                'polkadot': 'DOTUSDT', 'dot': 'DOTUSDT', 'dotusdt': 'DOTUSDT',
                'dogecoin': 'DOGEUSDT', 'doge': 'DOGEUSDT', 'dogeusdt': 'DOGEUSDT',
                'shiba_inu': 'SHIBUSDT', 'shib': 'SHIBUSDT', 'shibusdt': 'SHIBUSDT',
                'avalanche': 'AVAXUSDT', 'avax': 'AVAXUSDT', 'avaxusdt': 'AVAXUSDT',
                'binance_coin': 'BNBUSDT', 'bnb': 'BNBUSDT', 'bnbusdt': 'BNBUSDT',
                'chainlink': 'LINKUSDT', 'link': 'LINKUSDT', 'linkusdt': 'LINKUSDT',
                'litecoin': 'LTCUSDT', 'ltc': 'LTCUSDT', 'ltcusdt': 'LTCUSDT',
                'matic': 'MATICUSDT', 'polygon': 'MATICUSDT', 'maticusdt': 'MATICUSDT',
                'ton': 'TONUSDT', 'toncoin': 'TONUSDT', 'tonusdt': 'TONUSDT',
                'tron': 'TRXUSDT', 'trx': 'TRXUSDT', 'trxusdt': 'TRXUSDT',
                'stellar': 'XLMUSDT', 'xlm': 'XLMUSDT', 'xlmusdt': 'XLMUSDT',
                'monero': 'XMRUSDT', 'xmr': 'XMRUSDT', 'xmrusdt': 'XMRUSDT',
                'cosmos': 'ATOMUSDT', 'atom': 'ATOMUSDT', 'atomusdt': 'ATOMUSDT',
                'uniswap': 'UNIUSDT', 'uni': 'UNIUSDT', 'uniusdt': 'UNIUSDT',
                'icp': 'ICPUSDT', 'icpusdt': 'ICPUSDT'
            };
            
            let tradingPair = SYMBOL_MAP_FALLBACK[normalizedSymbol] || SYMBOL_MAP_FALLBACK[symbol];
            
            if (!tradingPair) {
                tradingPair = 'BTCUSDT';
            }
            
            console.log(`📊 Symbol: "${symbol}"`);
            console.log(`   Normalized: "${normalizedSymbol}"`);
            console.log(`   Trading Pair: "${tradingPair}"`);
            
            const url = `https://api.binance.com/api/v3/ticker/price?symbol=${tradingPair}`;
            const data = await httpsGet(url);
            const price = parseFloat(data.price);
            
            console.log(`   ✅ Prezzo Binance: $${price.toFixed(6)} USDT`);
            console.log('');
            
        } catch (error) {
            console.log(`   ❌ Errore: ${error.message}\n`);
        }
    }
}

testPrice();

