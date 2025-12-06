// Script per verificare quali simboli sono disponibili su Binance
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

async function checkSymbols() {
    const symbolsToCheck = [
        { symbol: 'eos_eur', pair: 'EOSEUR', display: 'EOS/EUR' },
        { symbol: 'near_eur', pair: 'NEAREUR', display: 'NEAR/EUR' },
        { symbol: 'arb_eur', pair: 'ARBEUR', display: 'ARB/EUR' },
        { symbol: 'trx_eur', pair: 'TRXEUR', display: 'TRX/EUR' },
        { symbol: 'op_eur', pair: 'OPEUR', display: 'OP/EUR' },
        { symbol: 'xlm_eur', pair: 'XLMEUR', display: 'XLM/EUR' },
        { symbol: 'fil_eur', pair: 'FILEUR', display: 'FIL/EUR' },
        { symbol: 'sand_eur', pair: 'SANDEUR', display: 'SAND/EUR' },
        { symbol: 'aave_eur', pair: 'AAVEEUR', display: 'AAVE/EUR' },
        { symbol: 'atom_eur', pair: 'ATOMEUR', display: 'ATOM/EUR' },
        { symbol: 'shiba_eur', pair: 'SHIBEUR', display: 'SHIB/EUR' },
        { symbol: 'dogecoin_eur', pair: 'DOGEEUR', display: 'DOGE/EUR' },
        { symbol: 'uniswap_eur', pair: 'UNIEUR', display: 'UNI/EUR' },
        { symbol: 'avalanche_eur', pair: 'AVAXEUR', display: 'AVAX/EUR' },
        { symbol: 'pol_polygon_eur', pair: 'POLEUR', display: 'POL/EUR' },
        { symbol: 'binance_coin_eur', pair: 'BNBEUR', display: 'BNB/EUR' },
        { symbol: 'ripple_eur', pair: 'XRPEUR', display: 'XRP/EUR' },
        { symbol: 'litecoin', pair: 'LTCEUR', display: 'LTC/EUR' },
        { symbol: 'chainlink', pair: 'LINKEUR', display: 'LINK/EUR' },
        { symbol: 'polkadot', pair: 'DOTEUR', display: 'DOT/EUR' },
        { symbol: 'cardano', pair: 'ADAEUR', display: 'ADA/EUR' },
        { symbol: 'solana_eur', pair: 'SOLEUR', display: 'SOL/EUR' },
        { symbol: 'ethereum', pair: 'ETHEUR', display: 'ETH/EUR' },
        { symbol: 'bitcoin', pair: 'BTCEUR', display: 'BTC/EUR' },
        { symbol: 'crv_eur', pair: 'CRVEUR', display: 'CRV/EUR' },
        { symbol: 'ldo_eur', pair: 'LDOEUR', display: 'LDO/EUR' },
        { symbol: 'mana_eur', pair: 'MANAEUR', display: 'MANA/EUR' },
        { symbol: 'axs_eur', pair: 'AXSEUR', display: 'AXS/EUR' },
        { symbol: 'matic_eur', pair: 'MATICEUR', display: 'MATIC/EUR' }
    ];

    console.log('🔍 Controllo simboli su Binance...\n');

    try {
        // Ottieni tutti i simboli disponibili su Binance
        const exchangeInfo = await httpsGet('https://api.binance.com/api/v3/exchangeInfo');
        const availableSymbols = new Set(exchangeInfo.symbols.map(s => s.symbol));

        console.log(`📊 Totale simboli su Binance: ${availableSymbols.size}\n`);

        const valid = [];
        const invalid = [];

        for (const s of symbolsToCheck) {
            if (availableSymbols.has(s.pair)) {
                valid.push(s);
                console.log(`✅ ${s.display.padEnd(15)} - ${s.pair.padEnd(10)} - VALIDO`);
            } else {
                invalid.push(s);
                console.log(`❌ ${s.display.padEnd(15)} - ${s.pair.padEnd(10)} - NON TROVATO`);
            }
        }

        console.log(`\n📊 Riepilogo:`);
        console.log(`   ✅ Validi: ${valid.length}`);
        console.log(`   ❌ Non validi: ${invalid.length}`);

        if (invalid.length > 0) {
            console.log(`\n❌ Simboli da rimuovere o sostituire:`);
            invalid.forEach(s => {
                console.log(`   - ${s.symbol} (${s.pair})`);
            });
        }

    } catch (error) {
        console.error('❌ Errore:', error.message);
    }
}

checkSymbols();
