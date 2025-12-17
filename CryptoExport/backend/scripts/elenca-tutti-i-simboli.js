/**
 * 📋 ELENCO COMPLETO DI TUTTI I 130 SIMBOLI NELLA MAPPA SYMBOL_TO_PAIR
 * 
 * Questo script elenca TUTTI i simboli (chiavi) presenti nella mappa,
 * raggruppati per tipo e trading pair.
 */

// Mappa SYMBOL_TO_PAIR dal codice
const SYMBOL_TO_PAIR = {
    'bitcoin': 'BTCUSDT', 'btc': 'BTCUSDT', 'bitcoin_usdt': 'BTCUSDT', 'bitcoin_eur': 'BTCEUR', 'btcusdt': 'BTCUSDT',
    'ethereum': 'ETHUSDT', 'eth': 'ETHUSDT', 'ethereum_usdt': 'ETHUSDT', 'ethereum_eur': 'ETHEUR', 'ethusdt': 'ETHUSDT',
    'solana': 'SOLUSDT', 'sol': 'SOLUSDT', 'solana_eur': 'SOLEUR', 'solana_usdt': 'SOLUSDT', 'solusdt': 'SOLUSDT',
    'ripple': 'XRPUSDT', 'xrp': 'XRPUSDT', 'ripple_eur': 'XRPEUR', 'xrp_eur': 'XRPEUR', 'ripple_usdt': 'XRPUSDT', 'xrpusdt': 'XRPUSDT',
    'binance_coin': 'BNBUSDT', 'bnb': 'BNBUSDT', 'binance_coin_eur': 'BNBEUR', 'bnbusdt': 'BNBUSDT',
    'cardano': 'ADAUSDT', 'ada': 'ADAUSDT', 'cardano_usdt': 'ADAUSDT', 'cardano_eur': 'ADAEUR', 'adausdt': 'ADAUSDT',
    'polkadot': 'DOTUSDT', 'dot': 'DOTUSDT', 'polkadot_usdt': 'DOTUSDT', 'polkadot_eur': 'DOTEUR', 'dotusdt': 'DOTUSDT',
    'avalanche': 'AVAXUSDT', 'avax': 'AVAXUSDT', 'avalanche_eur': 'AVAXEUR', 'avax_usdt': 'AVAXUSDT', 'avaxusdt': 'AVAXUSDT',
    'near': 'NEARUSDT', 'near_eur': 'NEAREUR', 'nearusdt': 'NEARUSDT',
    'atom_eur': 'ATOMEUR', 'cosmos': 'ATOMUSDT', 'atom': 'ATOMUSDT',
    'sui_eur': 'SUIEUR',
    'apt': 'APTUSDT',
    'ton': 'TONUSDT',
    'icp': 'ICPUSDT',
    'uniswap': 'UNIUSDT', 'uni': 'UNIUSDT', 'uniswap_eur': 'UNIEUR', 'uniusdt': 'UNIUSDT',
    'chainlink': 'LINKUSDT', 'link': 'LINKUSDT', 'chainlink_usdt': 'LINKUSDT', 'chainlink_eur': 'LINKEUR', 'linkusdt': 'LINKUSDT',
    'crv': 'CRVUSDT',
    'ldo': 'LDOUSDT',
    'mkr': 'MKRUSDT',
    'comp': 'COMPUSDT',
    'snx': 'SNXUSDT',
    'arb': 'ARBUSDT', 'arb_eur': 'ARBEUR', 'arbitrum': 'ARBUSDT', 'arbusdt': 'ARBUSDT',
    'op': 'OPUSDT', 'op_eur': 'OPEUR', 'optimism': 'OPUSDT', 'opusdt': 'OPUSDT',
    'matic': 'POLUSDT', 'matic_eur': 'MATEUR', 'polygon': 'POLUSDT', 'maticusdt': 'POLUSDT', 
    'pol': 'POLUSDT', 'pol_polygon': 'POLUSDT', 'pol_polygon_eur': 'POLEUR', 'polpolygon': 'POLUSDT', 'polusdt': 'POLUSDT',
    'trx_eur': 'TRXEUR',
    'xlm_eur': 'XLMEUR',
    'fet': 'FETUSDT',
    'render': 'RENDERUSDT',
    'grt': 'GRTUSDT',
    'sand': 'SANDUSDT', 'the_sandbox': 'SANDUSDT', 'thesandbox': 'SANDUSDT', 'sandusdt': 'SANDUSDT',
    'mana': 'MANAUSDT', 'decentraland': 'MANAUSDT', 'manausdt': 'MANAUSDT',
    'axs': 'AXSUSDT', 'axie_infinity': 'AXSUSDT', 'axieinfinity': 'AXSUSDT', 'axsusdt': 'AXSUSDT',
    'gala': 'GALAUSDT', 'galausdt': 'GALAUSDT',
    'imx': 'IMXUSDT', 'imxusdt': 'IMXUSDT',
    'enj': 'ENJUSDT', 'enj_eur': 'ENJEUR', 'enjusdt': 'ENJUSDT',
    'theta': 'THETAUSDT', 'theta_network': 'THETAUSDT', 'thetanetwork': 'THETAUSDT', 'thetausdt': 'THETAUSDT',
    'pepe': 'PEPEUSDT', 'pepe_eur': 'PEPEEUR', 'pepeusdt': 'PEPEUSDT',
    'dogecoin': 'DOGEUSDT', 'doge': 'DOGEUSDT', 'dogecoin_eur': 'DOGEEUR', 'dogeusdt': 'DOGEUSDT',
    'shiba_inu': 'SHIBUSDT', 'shib': 'SHIBUSDT', 'shiba_eur': 'SHIBEUR', 'shibusdt': 'SHIBUSDT',
    'floki': 'FLOKIUSDT', 'flokiusdt': 'FLOKIUSDT',
    'bonk': 'BONKUSDT', 'bonkusdt': 'BONKUSDT',
    'fil': 'FILUSDT',
    'ar': 'ARUSDT',
    'sei': 'SEIUSDT',
    'inj': 'INJUSDT',
    'usdc': 'USDCUSDT',
    'flow': 'FLOWUSDT', 'flowusdt': 'FLOWUSDT'
};

function elencaSimboli() {
    console.log('📋 ELENCO COMPLETO DEI 130 SIMBOLI NELLA MAPPA SYMBOL_TO_PAIR\n');
    console.log('='.repeat(80));
    console.log('');

    const allSymbols = Object.keys(SYMBOL_TO_PAIR);
    console.log(`✅ TOTALE SIMBOLI (chiavi nella mappa): ${allSymbols.length}`);
    console.log('');

    // Raggruppa per tipo
    const baseSymbols = [];
    const eurSymbols = [];
    const usdtSymbols = [];
    const aliasSymbols = [];

    allSymbols.forEach(symbol => {
        if (symbol.includes('_eur') || symbol.endsWith('eur')) {
            eurSymbols.push(symbol);
        } else if (symbol.includes('_usdt') || symbol.endsWith('usdt')) {
            usdtSymbols.push(symbol);
        } else if (symbol.length <= 4 || symbol === 'render' || symbol === 'theta_network' || symbol === 'axie_infinity' || symbol === 'the_sandbox' || symbol === 'shiba_inu' || symbol === 'binance_coin') {
            // Probabilmente alias o simboli base corti
            aliasSymbols.push(symbol);
        } else {
            baseSymbols.push(symbol);
        }
    });

    // Raggruppa per trading pair
    const pairToSymbols = {};
    allSymbols.forEach(symbol => {
        const pair = SYMBOL_TO_PAIR[symbol];
        if (!pairToSymbols[pair]) {
            pairToSymbols[pair] = [];
        }
        pairToSymbols[pair].push(symbol);
    });

    console.log('📊 BREAKDOWN PER TIPO');
    console.log('-'.repeat(80));
    console.log(`   - Simboli BASE: ${baseSymbols.length}`);
    console.log(`   - Simboli EUR (_eur): ${eurSymbols.length}`);
    console.log(`   - Simboli USDT (_usdt): ${usdtSymbols.length}`);
    console.log(`   - Alias/Varianti: ${aliasSymbols.length}`);
    console.log(`   - TOTALE: ${baseSymbols.length + eurSymbols.length + usdtSymbols.length + aliasSymbols.length}`);
    console.log('');

    console.log('📋 ELENCO COMPLETO (ordinato alfabeticamente)');
    console.log('-'.repeat(80));
    console.log('');

    allSymbols.sort().forEach((symbol, index) => {
        const pair = SYMBOL_TO_PAIR[symbol];
        const type = symbol.includes('_eur') ? 'EUR' : 
                    symbol.includes('_usdt') ? 'USDT' : 
                    symbol.length <= 4 ? 'ALIAS' : 'BASE';
        console.log(`${(index + 1).toString().padStart(3)}. ${symbol.padEnd(30)} → ${pair.padEnd(10)} (${type})`);
    });

    console.log('');
    console.log('📊 RAGGRUPPAMENTO PER TRADING PAIR');
    console.log('-'.repeat(80));
    console.log('');

    const pairsSorted = Object.keys(pairToSymbols).sort();
    pairsSorted.forEach((pair, index) => {
        const symbols = pairToSymbols[pair];
        console.log(`${(index + 1).toString().padStart(2)}. ${pair.padEnd(10)} → ${symbols.length} simboli:`);
        symbols.forEach(symbol => {
            console.log(`      - ${symbol}`);
        });
        console.log('');
    });

    console.log('='.repeat(80));
    console.log(`✅ Totale: ${allSymbols.length} simboli → ${pairsSorted.length} trading pairs unici`);
}

elencaSimboli();
