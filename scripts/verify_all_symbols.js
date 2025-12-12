const https = require('https');

// Conta i simboli totali nel bot
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
    'axs': 'AXSUSDT',

    // NEW ADDITIONS
    'usdc': 'USDCUSDT',
    'sui': 'SUIUSDT',
    'sui_eur': 'SUIEUR',
    'apt': 'APTUSDT',
    'sei': 'SEIUSDT',
    'ton': 'TONUSDT',
    'inj': 'INJUSDT',
    'algo': 'ALGOUSDT',
    'vet': 'VETUSDT',
    'icp': 'ICPUSDT',
    'mkr': 'MKRUSDT',
    'comp': 'COMPUSDT',
    'snx': 'SNXUSDT',
    'fet': 'FETUSDT',
    'render': 'RENDERUSDT',
    'grt': 'GRTUSDT',
    'imx': 'IMXUSDT',
    'gala': 'GALAUSDT',
    'enj': 'ENJUSDT',
    'enj_eur': 'ENJEUR',
    'pepe': 'PEPEUSDT',
    'pepe_eur': 'PEPEEUR',
    'floki': 'FLOKIUSDT',
    'bonk': 'BONKUSDT',
    'ar': 'ARUSDT'
};

const checkSymbol = (symbol) => {
    return new Promise((resolve) => {
        const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`;

        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.symbol && parsed.lastPrice) {
                        resolve({ symbol, available: true, price: parseFloat(parsed.lastPrice) });
                    } else {
                        resolve({ symbol, available: false });
                    }
                } catch (e) {
                    resolve({ symbol, available: false });
                }
            });
        }).on('error', () => {
            resolve({ symbol, available: false });
        });
    });
};

const verifyAll = async () => {
    console.log('🔍 Verifying ALL symbols in the bot...\n');
    console.log('='.repeat(80));

    const totalSymbols = Object.keys(SYMBOL_TO_PAIR).length;
    console.log(`📊 Total symbols configured: ${totalSymbols}`);
    console.log('='.repeat(80) + '\n');

    let available = 0;
    let notAvailable = 0;
    const failedSymbols = [];

    for (const [key, symbol] of Object.entries(SYMBOL_TO_PAIR)) {
        const result = await checkSymbol(symbol);
        await new Promise(resolve => setTimeout(resolve, 100)); // Rate limiting

        if (result.available) {
            available++;
            console.log(`✅ ${symbol.padEnd(15)} (${key.padEnd(20)}) - €${result.price.toFixed(6)}`);
        } else {
            notAvailable++;
            failedSymbols.push({ key, symbol });
            console.log(`❌ ${symbol.padEnd(15)} (${key.padEnd(20)}) - FAILED`);
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 FINAL SUMMARY:');
    console.log('='.repeat(80));
    console.log(`✅ Available: ${available}/${totalSymbols} (${((available / totalSymbols) * 100).toFixed(1)}%)`);
    console.log(`❌ Not Available: ${notAvailable}/${totalSymbols}`);

    if (failedSymbols.length > 0) {
        console.log('\n⚠️  FAILED SYMBOLS:');
        failedSymbols.forEach(f => console.log(`   - ${f.symbol} (${f.key})`));
    } else {
        console.log('\n🎉 ALL SYMBOLS VERIFIED SUCCESSFULLY!');
    }

    console.log('\n' + '='.repeat(80));
    console.log('📈 EXPANSION STATS:');
    console.log('='.repeat(80));
    console.log(`Previous count: ~50 symbols`);
    console.log(`Current count: ${totalSymbols} symbols`);
    console.log(`New additions: ${totalSymbols - 50} symbols`);
    console.log(`Increase: +${(((totalSymbols - 50) / 50) * 100).toFixed(0)}%`);
};

verifyAll().catch(console.error);
