/**
 * 📊 CONTA SIMBOLI E VARIABILI (TRADING PAIRS) NELLA MAPPA SYMBOL_TO_PAIR
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

function contaSimboliEVariabili() {
    console.log('📊 CONTA SIMBOLI E VARIABILI (TRADING PAIRS)\n');
    console.log('='.repeat(80));
    console.log('');

    // 1. Conta simboli totali
    const totaleSimboli = Object.keys(SYMBOL_TO_PAIR).length;

    // 2. Conta trading pairs unici (variabili)
    const tradingPairsUnici = new Set(Object.values(SYMBOL_TO_PAIR));
    const totaleVariabili = tradingPairsUnici.size;

    // 3. Raggruppa per tipo
    const simboliEUR = Object.keys(SYMBOL_TO_PAIR).filter(s => s.includes('_eur') || s.endsWith('eur'));
    const simboliUSDT = Object.keys(SYMBOL_TO_PAIR).filter(s => 
        (s.includes('_usdt') || s.endsWith('usdt')) && !s.includes('_eur')
    );
    const simboliBase = Object.keys(SYMBOL_TO_PAIR).filter(s => 
        !s.includes('_eur') && !s.includes('_usdt') && !s.endsWith('eur') && !s.endsWith('usdt')
    );

    // 4. Conta trading pairs per tipo
    const pairsEUR = new Set();
    const pairsUSDT = new Set();
    const pairsAltri = new Set();

    Object.entries(SYMBOL_TO_PAIR).forEach(([symbol, pair]) => {
        if (pair.endsWith('EUR')) {
            pairsEUR.add(pair);
        } else if (pair.endsWith('USDT')) {
            pairsUSDT.add(pair);
        } else {
            pairsAltri.add(pair);
        }
    });

    // 5. Statistiche dettagliate
    console.log('📈 RISULTATI');
    console.log('-'.repeat(80));
    console.log('');
    console.log(`   ✅ TOTALE SIMBOLI: ${totaleSimboli}`);
    console.log(`   ✅ TOTALE VARIABILI (Trading Pairs Unici): ${totaleVariabili}`);
    console.log('');

    console.log('📊 BREAKDOWN PER TIPO SIMBOLO');
    console.log('-'.repeat(80));
    console.log('');
    console.log(`   - Simboli BASE (senza suffisso): ${simboliBase.length}`);
    console.log(`   - Simboli EUR (_eur o eur): ${simboliEUR.length}`);
    console.log(`   - Simboli USDT (_usdt o usdt): ${simboliUSDT.length}`);
    console.log(`   - TOTALE: ${simboliBase.length + simboliEUR.length + simboliUSDT.length}`);
    console.log('');

    console.log('💱 BREAKDOWN PER TIPO TRADING PAIR');
    console.log('-'.repeat(80));
    console.log('');
    console.log(`   - Trading Pairs EUR: ${pairsEUR.size}`);
    console.log(`   - Trading Pairs USDT: ${pairsUSDT.size}`);
    console.log(`   - Trading Pairs Altri: ${pairsAltri.size}`);
    console.log(`   - TOTALE: ${pairsEUR.size + pairsUSDT.size + pairsAltri.size}`);
    console.log('');

    // 6. Lista trading pairs EUR
    if (pairsEUR.size > 0) {
        console.log('📋 TRADING PAIRS EUR:');
        console.log('-'.repeat(80));
        Array.from(pairsEUR).sort().forEach((pair, i) => {
            const symbols = Object.keys(SYMBOL_TO_PAIR).filter(s => SYMBOL_TO_PAIR[s] === pair);
            console.log(`   ${(i + 1).toString().padStart(2)}. ${pair.padEnd(10)} → ${symbols.length} simboli: ${symbols.join(', ')}`);
        });
        console.log('');
    }

    // 7. Lista trading pairs USDT (prime 20)
    if (pairsUSDT.size > 0) {
        console.log('📋 TRADING PAIRS USDT (prime 20):');
        console.log('-'.repeat(80));
        Array.from(pairsUSDT).sort().slice(0, 20).forEach((pair, i) => {
            const symbols = Object.keys(SYMBOL_TO_PAIR).filter(s => SYMBOL_TO_PAIR[s] === pair);
            console.log(`   ${(i + 1).toString().padStart(2)}. ${pair.padEnd(10)} → ${symbols.length} simboli: ${symbols.slice(0, 3).join(', ')}${symbols.length > 3 ? '...' : ''}`);
        });
        if (pairsUSDT.size > 20) {
            console.log(`   ... e altri ${pairsUSDT.size - 20} trading pairs USDT`);
        }
        console.log('');
    }

    // 8. Riepilogo
    console.log('📊 RIEPILOGO FINALE');
    console.log('-'.repeat(80));
    console.log('');
    console.log(`   🎯 SIMBOLI TOTALI: ${totaleSimboli}`);
    console.log(`   🎯 VARIABILI TOTALI (Trading Pairs): ${totaleVariabili}`);
    console.log('');
    console.log(`   📈 Ratio: ${(totaleSimboli / totaleVariabili).toFixed(2)} simboli per trading pair`);
    console.log('');

    console.log('='.repeat(80));
    console.log('✅ Analisi completata');
}

contaSimboliEVariabili();
