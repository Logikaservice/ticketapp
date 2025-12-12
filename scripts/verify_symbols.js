// Script per verificare i simboli dopo le modifiche
const https = require('https');

function httpsGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

// Importa il mapping dal file cryptoRoutes
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
    'pol_polygon': 'POLUSDT',
    'pol_polygon_eur': 'POLEUR',
    'avalanche': 'AVAXUSDT',
    'avalanche_eur': 'AVAXEUR',
    'uniswap': 'UNIUSDT',
    'uniswap_eur': 'UNIEUR',
    'dogecoin': 'DOGEUSDT',
    'dogecoin_eur': 'DOGEEUR',
    'shiba': 'SHIBUSDT',
    'shiba_eur': 'SHIBEUR',
    'near': 'NEARUSDT',
    'near_eur': 'NEAREUR',
    'atom': 'ATOMUSDT',
    'atom_eur': 'ATOMEUR',
    'aave': 'AAVEUSDT',
    'sand': 'SANDUSDT',
    'fil': 'FILUSDT',
    'trx': 'TRXUSDT',
    'trx_eur': 'TRXEUR',
    'xlm': 'XLMUSDT',
    'xlm_eur': 'XLMEUR',
    'eos': 'EOSUSDT',
    'eos_eur': 'EOSEUR',
    'arb': 'ARBUSDT',
    'arb_eur': 'ARBEUR',
    'op': 'OPUSDT',
    'op_eur': 'OPEUR',
    'matic': 'MATICUSDT',
    'matic_eur': 'MATICEUR',
    'crv': 'CRVUSDT',
    'ldo': 'LDOUSDT',
    'mana': 'MANAUSDT',
    'axs': 'AXSUSDT'
};

async function verifySymbols() {
    console.log('🔍 Verifica finale dei simboli...\n');

    try {
        const exchangeInfo = await httpsGet('https://api.binance.com/api/v3/exchangeInfo');
        const availableSymbols = new Set(exchangeInfo.symbols.map(s => s.symbol));

        let allValid = true;
        let totalSymbols = 0;

        for (const [symbol, pair] of Object.entries(SYMBOL_TO_PAIR)) {
            totalSymbols++;
            if (availableSymbols.has(pair)) {
                console.log(`✅ ${symbol.padEnd(20)} -> ${pair.padEnd(10)} VALIDO`);
            } else {
                console.log(`❌ ${symbol.padEnd(20)} -> ${pair.padEnd(10)} NON TROVATO`);
                allValid = false;
            }
        }

        console.log(`\n📊 Totale simboli configurati: ${totalSymbols}`);

        if (allValid) {
            console.log('\n✅ TUTTI I SIMBOLI SONO VALIDI! 🎉');
        } else {
            console.log('\n❌ Ci sono ancora simboli non validi da correggere');
        }

    } catch (error) {
        console.error('❌ Errore:', error.message);
    }
}

verifySymbols();
