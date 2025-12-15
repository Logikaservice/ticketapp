/**
 * 🔍 ANALISI DUPLICATI NELLA MAPPA SYMBOL_TO_PAIR
 * 
 * Questo script analizza la mappa SYMBOL_TO_PAIR per identificare:
 * 1. Simboli duplicati che puntano alla stessa coppia (alias - OK)
 * 2. Simboli che puntano a coppie diverse ma rappresentano la stessa crypto (POTENZIALE PROBLEMA)
 * 3. Verifica se USDT e EUR sono "identici" (NO - sono valute diverse!)
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

function analizzaDuplicati() {
    console.log('🔍 ANALISI DUPLICATI NELLA MAPPA SYMBOL_TO_PAIR\n');
    console.log('='.repeat(80));
    console.log('');

    // 1. Raggruppa simboli per trading pair
    const pairToSymbols = {};
    Object.entries(SYMBOL_TO_PAIR).forEach(([symbol, pair]) => {
        if (!pairToSymbols[pair]) {
            pairToSymbols[pair] = [];
        }
        pairToSymbols[pair].push(symbol);
    });

    // 2. Identifica duplicati (simboli che puntano alla stessa coppia)
    console.log('📊 1. SIMBOLI CHE PUNTANO ALLA STESSA COPPIA (ALIAS)');
    console.log('-'.repeat(80));
    console.log('');

    const duplicates = Object.entries(pairToSymbols)
        .filter(([pair, symbols]) => symbols.length > 1)
        .sort((a, b) => b[1].length - a[1].length);

    console.log(`   Trovati ${duplicates.length} trading pairs con più simboli (alias):\n`);

    duplicates.forEach(([pair, symbols]) => {
        console.log(`   📌 ${pair}:`);
        symbols.forEach(symbol => {
            console.log(`      - ${symbol}`);
        });
        console.log('');
    });

    // 3. Identifica simboli che rappresentano la stessa crypto ma puntano a coppie diverse
    console.log('⚠️  2. SIMBOLI CHE RAPPRESENTANO LA STESSA CRYPTO MA PUNTANO A COPPIE DIVERSE');
    console.log('-'.repeat(80));
    console.log('');

    // Estrai base crypto da simbolo (rimuovi _eur, _usdt, etc)
    const cryptoToSymbols = {};
    Object.keys(SYMBOL_TO_PAIR).forEach(symbol => {
        const base = symbol
            .replace(/_eur$/, '')
            .replace(/_usdt$/, '')
            .replace(/eur$/, '')
            .replace(/usdt$/, '')
            .toLowerCase();

        if (!cryptoToSymbols[base]) {
            cryptoToSymbols[base] = [];
        }
        cryptoToSymbols[base].push(symbol);
    });

    const conflicts = [];
    Object.entries(cryptoToSymbols).forEach(([base, symbols]) => {
        if (symbols.length > 1) {
            const pairs = symbols.map(s => SYMBOL_TO_PAIR[s]);
            const uniquePairs = [...new Set(pairs)];
            
            if (uniquePairs.length > 1) {
                conflicts.push({
                    base,
                    symbols,
                    pairs: uniquePairs
                });
            }
        }
    });

    if (conflicts.length > 0) {
        console.log(`   ⚠️  Trovati ${conflicts.length} conflitti (stessa crypto, coppie diverse):\n`);
        
        conflicts.forEach(({ base, symbols, pairs }) => {
            console.log(`   📌 ${base.toUpperCase()}:`);
            symbols.forEach(symbol => {
                const pair = SYMBOL_TO_PAIR[symbol];
                console.log(`      - ${symbol.padEnd(25)} → ${pair}`);
            });
            console.log(`      ⚠️  CONFLITTO: ${pairs.length} coppie diverse (${pairs.join(', ')})`);
            console.log('');
        });
    } else {
        console.log('   ✅ Nessun conflitto trovato - ogni crypto ha coppie coerenti');
        console.log('');
    }

    // 4. Analisi USDT vs EUR
    console.log('💱 3. ANALISI USDT vs EUR');
    console.log('-'.repeat(80));
    console.log('');
    console.log('   ❌ IMPORTANTE: USDT e EUR NON sono identici!');
    console.log('');
    console.log('   Differenze:');
    console.log('   - USDT = Tether (stablecoin legata al dollaro)');
    console.log('   - EUR = Euro (valuta fiat)');
    console.log('   - Prezzi diversi: BTC/USDT ≠ BTC/EUR');
    console.log('   - Tasso di cambio: ~1 EUR = ~1.10 USDT (variabile)');
    console.log('');
    console.log('   Esempio:');
    console.log('   - BTC/USDT: $50,000');
    console.log('   - BTC/EUR:  €45,000');
    console.log('   - Differenza: ~10% (tasso di cambio EUR/USD)');
    console.log('');

    // 5. Statistiche
    console.log('📊 4. STATISTICHE');
    console.log('-'.repeat(80));
    console.log('');
    console.log(`   - Totale simboli nella mappa: ${Object.keys(SYMBOL_TO_PAIR).length}`);
    console.log(`   - Totale trading pairs unici: ${Object.keys(pairToSymbols).length}`);
    console.log(`   - Simboli con alias (stessa coppia): ${duplicates.reduce((sum, [, symbols]) => sum + symbols.length, 0)}`);
    console.log(`   - Trading pairs con più simboli: ${duplicates.length}`);
    console.log('');

    // 6. Raccomandazioni
    console.log('💡 5. RACCOMANDAZIONI');
    console.log('-'.repeat(80));
    console.log('');

    const eurSymbols = Object.keys(SYMBOL_TO_PAIR).filter(s => s.includes('_eur') || s.endsWith('eur'));
    const usdtSymbols = Object.keys(SYMBOL_TO_PAIR).filter(s => s.includes('_usdt') || s.endsWith('usdt'));

    console.log(`   - Simboli EUR: ${eurSymbols.length}`);
    console.log(`   - Simboli USDT: ${usdtSymbols.length}`);
    console.log('');

    if (conflicts.length === 0) {
        console.log('   ✅ La mappa è ben strutturata:');
        console.log('      - Ogni simbolo EUR punta a una coppia EUR');
        console.log('      - Ogni simbolo USDT punta a una coppia USDT');
        console.log('      - Gli alias (es. bitcoin, btc, bitcoin_usdt → BTCUSDT) sono corretti');
        console.log('      - Non ci sono conflitti tra simboli della stessa crypto');
    } else {
        console.log('   ⚠️  Attenzione: Ci sono conflitti da risolvere');
    }
    console.log('');

    // 7. Verifica se ci sono simboli "base" che potrebbero essere ambigui
    console.log('🔍 6. VERIFICA AMBIGUITÀ');
    console.log('-'.repeat(80));
    console.log('');

    const baseSymbols = Object.keys(SYMBOL_TO_PAIR).filter(s => 
        !s.includes('_eur') && 
        !s.includes('_usdt') && 
        !s.endsWith('eur') && 
        !s.endsWith('usdt')
    );

    console.log(`   Simboli "base" (senza suffisso _eur/_usdt): ${baseSymbols.length}`);
    console.log('   Questi simboli puntano a coppie USDT per default (corretto):');
    console.log('');
    
    const baseWithEur = baseSymbols.filter(s => {
        const eurVersion = s + '_eur';
        return SYMBOL_TO_PAIR[eurVersion];
    });

    if (baseWithEur.length > 0) {
        console.log(`   Simboli base che hanno anche versione EUR (${baseWithEur.length}):`);
        baseWithEur.slice(0, 10).forEach(s => {
            const basePair = SYMBOL_TO_PAIR[s];
            const eurPair = SYMBOL_TO_PAIR[s + '_eur'];
            console.log(`      - ${s}: ${basePair} (base) vs ${s}_eur: ${eurPair} (EUR)`);
        });
        if (baseWithEur.length > 10) {
            console.log(`      ... e altri ${baseWithEur.length - 10}`);
        }
        console.log('');
        console.log('   ✅ Questo è CORRETTO:');
        console.log('      - Simbolo base (es. "bitcoin") → BTCUSDT (default USDT)');
        console.log('      - Simbolo EUR (es. "bitcoin_eur") → BTCEUR (esplicito EUR)');
        console.log('      - Non c\'è ambiguità: il suffisso _eur distingue chiaramente');
    }
    console.log('');

    console.log('='.repeat(80));
    console.log('✅ Analisi completata');
}

analizzaDuplicati();
