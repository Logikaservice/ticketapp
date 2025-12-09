/**
 * Script per analizzare quali simboli potrebbero avere problemi
 * di normalizzazione e recupero prezzi
 */

// Mappa SYMBOL_TO_PAIR completa (copiata da cryptoRoutes.js)
const SYMBOL_TO_PAIR = {
    'bitcoin': 'BTCUSDT',
    'bitcoin_usdt': 'BTCUSDT',
    'ethereum': 'ETHUSDT',
    'ethereum_usdt': 'ETHUSDT',
    'solana': 'SOLUSDT',
    'solana_eur': 'SOLUSDT',
    'cardano': 'ADAUSDT',
    'cardano_usdt': 'ADAUSDT',
    'polkadot': 'DOTUSDT',
    'polkadot_usdt': 'DOTUSDT',
    'chainlink': 'LINKUSDT',
    'chainlink_usdt': 'LINKUSDT',
    'litecoin': 'LTCUSDT',
    'litecoin_usdt': 'LTCUSDT',
    'ripple': 'XRPUSDT',
    'ripple_eur': 'XRPUSDT',
    'binance_coin': 'BNBUSDT',
    'binance_coin_eur': 'BNBUSDT',
    'avalanche': 'AVAXUSDT',
    'avalanche_eur': 'AVAXUSDT',
    'uniswap': 'UNIUSDT',
    'uniswap_eur': 'UNIUSDT',
    'dogecoin': 'DOGEUSDT',
    'dogecoin_eur': 'DOGEUSDT',
    'shiba': 'SHIBUSDT',
    'shiba_eur': 'SHIBUSDT',
    'pol_polygon': 'POLUSDT',
    'pol_polygon_eur': 'POLUSDT',
    'near': 'NEARUSDT',
    'near_eur': 'NEARUSDT',
    'atom': 'ATOMUSDT',
    'atom_eur': 'ATOMUSDT',
    'arb': 'ARBUSDT',
    'arb_eur': 'ARBUSDT',
    'op': 'OPUSDT',
    'op_eur': 'OPUSDT',
    'matic': 'MATICUSDT',
    'matic_eur': 'MATICUSDT',
    'trx': 'TRXUSDT',
    'trx_eur': 'TRXUSDT',
    'xlm': 'XLMUSDT',
    'xlm_eur': 'XLMUSDT',
    'aave': 'AAVEUSDT',
    'crv': 'CRVUSDT',
    'ldo': 'LDOUSDT',
    'sand': 'SANDUSDT',
    'mana': 'MANAUSDT',
    'axs': 'AXSUSDT',
    'fil': 'FILUSDT',
    'usdc': 'USDCUSDT',
    'sui': 'SUIUSDT',
    'sui_eur': 'SUIUSDT',
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
    'enj_eur': 'ENJUSDT',
    'pepe': 'PEPEUSDT',
    'pepe_eur': 'PEPEUSDT',
    'floki': 'FLOKIUSDT',
    'bonk': 'BONKUSDT',
    'ar': 'ARUSDT'
};

// Mappa symbolVariants (dal codice - AGGIORNATA)
const symbolVariants = {
    'xrp': 'ripple',
    'xrpusdt': 'ripple',
    'bnb': 'binance_coin',
    'bnbusdt': 'binance_coin',
    'btc': 'bitcoin',
    'btcusdt': 'bitcoin',
    'eth': 'ethereum',
    'ethusdt': 'ethereum',
    'sol': 'solana',
    'solusdt': 'solana',
    'ada': 'cardano',
    'adausdt': 'cardano',
    'dot': 'polkadot',
    'dotusdt': 'polkadot',
    'link': 'chainlink',
    'linkusdt': 'chainlink',
    'ltc': 'litecoin',
    'ltcusdt': 'litecoin',
    'shib': 'shiba',
    'shibusdt': 'shiba',
    'doge': 'dogecoin',
    'dogeusdt': 'dogecoin',
    'floki': 'floki',
    'fet': 'fet',
    'ton': 'ton',
    'tonusdt': 'ton',
    // ✅ FIX: Simboli che richiedono conversione
    'avax': 'avalanche',
    'avaxusdt': 'avalanche',
    'uni': 'uniswap',
    'uniusdt': 'uniswap',
    'pol': 'pol_polygon',
    'polusdt': 'pol_polygon',
    // Varianti comuni
    'icp': 'icp',
    'icpusdt': 'icp',
    'atom': 'atom',
    'atomusdt': 'atom',
    'sui': 'sui',
    'suiusdt': 'sui',
    'near': 'near',
    'nearusdt': 'near',
    'apt': 'apt',
    'aptusdt': 'apt',
    'inj': 'inj',
    'injusdt': 'inj',
    'algo': 'algo',
    'algousdt': 'algo',
    'vet': 'vet',
    'vetusdt': 'vet'
};

function normalizeSymbol(symbol) {
    return symbol.toLowerCase()
        .replace(/\//g, '')
        .replace(/_/g, '')
        .replace(/usdt$/, '')
        .replace(/eur$/, '');
}

function testSymbolResolution(symbol) {
    let symbolBase = normalizeSymbol(symbol);
    let normalizedSymbol = symbolBase;
    
    // Applica symbolVariants
    if (symbolVariants[normalizedSymbol]) {
        normalizedSymbol = symbolVariants[normalizedSymbol];
    }
    
    // Controlla se è nella mappa
    const found = SYMBOL_TO_PAIR[normalizedSymbol] !== undefined;
    
    // Prova varianti se non trovato
    let foundViaVariant = false;
    let variantUsed = null;
    
    if (!found) {
        const variants = [
            symbolBase,
            symbol.toLowerCase().replace(/_/g, '').replace(/\//g, ''),
            symbol.toLowerCase().replace(/_/g, ''),
            symbol.toLowerCase(),
            symbol
        ];
        
        for (const variant of variants) {
            if (SYMBOL_TO_PAIR[variant]) {
                foundViaVariant = true;
                variantUsed = variant;
                break;
            }
        }
    }
    
    return {
        symbol,
        normalized: normalizedSymbol,
        found: found,
        foundViaVariant: foundViaVariant,
        variantUsed: variantUsed,
        tradingPair: found ? SYMBOL_TO_PAIR[normalizedSymbol] : (foundViaVariant ? SYMBOL_TO_PAIR[variantUsed] : null),
        needsVariantConversion: symbolVariants[normalizedSymbol] !== undefined && !found
    };
}

// Testa vari formati comuni che potrebbero essere nel database
const testSymbols = [
    // Formati diretti
    'ICP', 'ICPUSDT', 'icp_usdt', 'icp/usdt', 'icp',
    'BTC', 'BTCUSDT', 'btc_usdt', 'btc', 'bitcoin',
    'ETH', 'ETHUSDT', 'eth_usdt', 'eth', 'ethereum',
    'SOL', 'SOLUSDT', 'sol_eur', 'sol', 'solana',
    'ADA', 'ADAUSDT', 'ada', 'cardano',
    'XRP', 'XRPUSDT', 'xrp', 'ripple',
    'DOT', 'DOTUSDT', 'dot', 'polkadot',
    'ATOM', 'ATOMUSDT', 'atom_eur', 'atom',
    'SUI', 'SUIUSDT', 'sui_eur', 'sui',
    'TON', 'TONUSDT', 'ton',
    'NEAR', 'NEARUSDT', 'near_eur', 'near',
    'APT', 'APTUSDT', 'apt',
    'INJ', 'INJUSDT', 'inj',
    'ALGO', 'ALGOUSDT', 'algo',
    'VET', 'VETUSDT', 'vet',
    'LINK', 'LINKUSDT', 'link', 'chainlink',
    'BNB', 'BNBUSDT', 'bnb', 'binance_coin',
    'DOGE', 'DOGEUSDT', 'doge', 'dogecoin',
    'SHIB', 'SHIBUSDT', 'shib', 'shiba',
    'AVAX', 'AVAXUSDT', 'avax', 'avalanche',
    'UNI', 'UNIUSDT', 'uni', 'uniswap',
    'MATIC', 'MATICUSDT', 'matic',
    'TRX', 'TRXUSDT', 'trx',
    'XLM', 'XLMUSDT', 'xlm',
    'AAVE', 'AAVEUSDT', 'aave',
    'CRV', 'CRVUSDT', 'crv',
    'LDO', 'LDOUSDT', 'ldo',
    'SAND', 'SANDUSDT', 'sand',
    'MANA', 'MANAUSDT', 'mana',
    'AXS', 'AXSUSDT', 'axs',
    'FIL', 'FILUSDT', 'fil',
    'USDC', 'USDCUSDT', 'usdc',
    'MKR', 'MKRUSDT', 'mkr',
    'COMP', 'COMPUSDT', 'comp',
    'SNX', 'SNXUSDT', 'snx',
    'FET', 'FETUSDT', 'fet',
    'RENDER', 'RENDERUSDT', 'render',
    'GRT', 'GRTUSDT', 'grt',
    'IMX', 'IMXUSDT', 'imx',
    'GALA', 'GALAUSDT', 'gala',
    'ENJ', 'ENJUSDT', 'enj',
    'PEPE', 'PEPEUSDT', 'pepe',
    'FLOKI', 'FLOKIUSDT', 'floki',
    'BONK', 'BONKUSDT', 'bonk',
    'AR', 'ARUSDT', 'ar',
    'SEI', 'SEIUSDT', 'sei',
    'POL', 'POLUSDT', 'pol_polygon'
];

console.log('🔍 Analisi completa dei simboli e loro risoluzione\n');
console.log('='.repeat(100));

const results = testSymbols.map(testSymbolResolution);

// Categorizza i risultati
const working = results.filter(r => r.found || r.foundViaVariant);
const problematic = results.filter(r => !r.found && !r.foundViaVariant);
const needsConversion = results.filter(r => r.needsVariantConversion);

console.log(`\n📊 STATISTICHE:\n`);
console.log(`   ✅ Simboli funzionanti: ${working.length}`);
console.log(`   ⚠️  Simboli che richiedono conversione (symbolVariants): ${needsConversion.length}`);
console.log(`   ❌ Simboli problematici: ${problematic.length}`);

if (problematic.length > 0) {
    console.log(`\n${'='.repeat(100)}`);
    console.log(`\n❌ SIMBOLI PROBLEMATICI (non trovati nella mappa):\n`);
    
    const uniqueProblems = [...new Set(problematic.map(p => p.symbol))];
    uniqueProblems.forEach(symbol => {
        const result = problematic.find(r => r.symbol === symbol);
        console.log(`   - ${symbol.padEnd(20)} → normalizzato: "${result.normalized}" → NON TROVATO`);
        console.log(`     Varianti provate: ${result.foundViaVariant ? 'Trovato tramite variante' : 'Nessuna variante funzionante'}`);
    });
}

if (needsConversion.length > 0) {
    console.log(`\n${'='.repeat(100)}`);
    console.log(`\n⚠️  SIMBOLI CHE RICHIEDONO CONVERSIONE (tramite symbolVariants):\n`);
    console.log(`   Questi simboli funzionano, ma richiedono una conversione intermedia.\n`);
    
    const uniqueConversions = {};
    needsConversion.forEach(r => {
        if (!uniqueConversions[r.normalized]) {
            uniqueConversions[r.normalized] = [];
        }
        uniqueConversions[r.normalized].push(r.symbol);
    });
    
    Object.entries(uniqueConversions).forEach(([normalized, symbols]) => {
        const converted = symbolVariants[normalized];
        const tradingPair = SYMBOL_TO_PAIR[converted];
        console.log(`   ${symbols.join(', ').padEnd(40)} → "${normalized}" → "${converted}" → ${tradingPair}`);
    });
}

// Mostra alcuni esempi di simboli funzionanti
console.log(`\n${'='.repeat(100)}`);
console.log(`\n✅ ESEMPI DI SIMBOLI FUNZIONANTI (formati diversi):\n`);

const examples = [
    { name: 'ICP', symbols: ['ICP', 'ICPUSDT', 'icp_usdt', 'icp'] },
    { name: 'ATOM', symbols: ['ATOM', 'ATOMUSDT', 'atom_eur', 'atom'] },
    { name: 'SUI', symbols: ['SUI', 'SUIUSDT', 'sui_eur', 'sui'] },
    { name: 'TON', symbols: ['TON', 'TONUSDT', 'ton'] },
    { name: 'NEAR', symbols: ['NEAR', 'NEARUSDT', 'near_eur', 'near'] }
];

examples.forEach(example => {
    console.log(`\n   ${example.name}:`);
    example.symbols.forEach(symbol => {
        const result = results.find(r => r.symbol === symbol);
        if (result) {
            const status = result.found || result.foundViaVariant ? '✅' : '❌';
            const method = result.found ? 'Diretto' : result.foundViaVariant ? 'Variante' : 'NON TROVATO';
            console.log(`      ${status} ${symbol.padEnd(15)} → ${result.tradingPair || 'N/A'} (${method})`);
        }
    });
});

console.log(`\n${'='.repeat(100)}\n`);

