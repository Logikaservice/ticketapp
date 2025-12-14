/**
 * 🧪 TEST NORMALIZZAZIONE SIMBOLI DOPO RIMOZIONE DUPLICATI
 * 
 * Questo script testa se la normalizzazione funziona correttamente
 * dopo la rimozione dei simboli duplicati.
 */

// Simula SYMBOL_TO_PAIR (senza duplicati)
const SYMBOL_TO_PAIR = {
    'bitcoin_usdt': 'BTCUSDT',
    'ethereum_usdt': 'ETHUSDT',
    'solana_eur': 'SOLUSDT',
    'cardano_usdt': 'ADAUSDT',
    'polkadot_usdt': 'DOTUSDT',
    'ripple_eur': 'XRPUSDT',
    'binance_coin_eur': 'BNBUSDT',
    'avalanche_eur': 'AVAXUSDT',
    'uniswap_eur': 'UNIUSDT',
    'dogecoin_eur': 'DOGEUSDT',
    'shiba_eur': 'SHIBUSDT',
    'near_eur': 'NEARUSDT',
    'atom_eur': 'ATOMUSDT',
    'trx_eur': 'TRXUSDT',
    'xlm_eur': 'XLMUSDT',
    'arb_eur': 'ARBUSDT',
    'op_eur': 'OPUSDT',
    'matic_eur': 'MATICUSDT',
    'sui_eur': 'SUIUSDT',
    'enj_eur': 'ENJUSDT',
    'pepe_eur': 'PEPEUSDT'
};

// Simula symbolVariants (convertiti ai simboli corretti)
const symbolVariants = {
    'btc': 'bitcoin_usdt',
    'btcusdt': 'bitcoin_usdt',
    'bitcoin': 'bitcoin_usdt',
    'eth': 'ethereum_usdt',
    'ethusdt': 'ethereum_usdt',
    'ethereum': 'ethereum_usdt',
    'sol': 'solana_eur',
    'solusdt': 'solana_eur',
    'solana': 'solana_eur',
    'ada': 'cardano_usdt',
    'adausdt': 'cardano_usdt',
    'cardano': 'cardano_usdt',
    'xrp': 'ripple_eur',
    'xrpusdt': 'ripple_eur',
    'ripple': 'ripple_eur',
    'bnb': 'binance_coin_eur',
    'bnbusdt': 'binance_coin_eur',
    'binance_coin': 'binance_coin_eur'
};

function normalizeSymbol(symbol) {
    return symbol.toLowerCase()
        .replace(/\//g, '')
        .replace(/_/g, '')
        .replace(/usdt$/, '')
        .replace(/eur$/, '');
}

function testSymbolResolution(symbol) {
    let normalizedSymbol = normalizeSymbol(symbol);
    
    // Applica symbolVariants
    if (symbolVariants[normalizedSymbol]) {
        normalizedSymbol = symbolVariants[normalizedSymbol];
    }
    
    // Cerca in SYMBOL_TO_PAIR
    const tradingPair = SYMBOL_TO_PAIR[normalizedSymbol];
    
    return {
        input: symbol,
        normalized: normalizedSymbol,
        found: !!tradingPair,
        tradingPair: tradingPair || null
    };
}

console.log('🧪 TEST NORMALIZZAZIONE SIMBOLI DOPO RIMOZIONE DUPLICATI\n');
console.log('='.repeat(80));

const testCases = [
    // Simboli duplicati (dovrebbero essere convertiti)
    'bitcoin',
    'ethereum',
    'solana',
    'cardano',
    'ripple',
    'binance_coin',
    // Varianti comuni
    'btc',
    'eth',
    'sol',
    'ada',
    'xrp',
    'bnb',
    // Simboli corretti (dovrebbero funzionare)
    'bitcoin_usdt',
    'ethereum_usdt',
    'solana_eur',
    'ripple_eur',
    'binance_coin_eur'
];

let passed = 0;
let failed = 0;

testCases.forEach(testSymbol => {
    const result = testSymbolResolution(testSymbol);
    const status = result.found ? '✅' : '❌';
    
    if (result.found) {
        passed++;
    } else {
        failed++;
    }
    
    console.log(`${status} ${testSymbol.padEnd(20)} → ${result.normalized.padEnd(20)} → ${result.tradingPair || 'NOT FOUND'}`);
});

console.log('\n' + '='.repeat(80));
console.log(`\n📊 Risultati:`);
console.log(`   ✅ Passati: ${passed}/${testCases.length}`);
console.log(`   ❌ Falliti: ${failed}/${testCases.length}`);

if (failed === 0) {
    console.log('\n✅ PERFETTO! Tutti i test sono passati.');
    console.log('   La normalizzazione funziona correttamente dopo la rimozione dei duplicati.\n');
} else {
    console.log('\n⚠️  ATTENZIONE: Alcuni test sono falliti.');
    console.log('   Verifica la normalizzazione dei simboli.\n');
}
