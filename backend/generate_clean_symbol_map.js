/**
 * 🔧 AGGIORNAMENTO SYMBOL_TO_PAIR - Rimozione Duplicati
 * 
 * Questo script genera il nuovo SYMBOL_TO_PAIR senza duplicati
 * da copiare in cryptoRoutes.js
 */

// Mappa ATTUALE con duplicati
const SYMBOL_TO_PAIR_OLD = {
    'bitcoin': 'BTCUSDT',
    'bitcoin_usdt': 'BTCUSDT',
    'solana': 'SOLUSDT',
    'solana_eur': 'SOLUSDT',
    'ethereum': 'ETHUSDT',
    'ethereum_usdt': 'ETHUSDT',
    'cardano': 'ADAUSDT',
    'cardano_usdt': 'ADAUSDT',
    'polkadot': 'DOTUSDT',
    'polkadot_usdt': 'DOTUSDT',
    'chainlink': 'LINKEUR',
    'chainlink_usdt': 'LINKUSDT',
    'litecoin': 'LTCUSDT',
    'litecoin_usdt': 'LTCUSDT',
    'ripple': 'XRPUSDT',
    'ripple_eur': 'XRPUSDT',
    'binance_coin': 'BNBUSDT',
    'binance_coin_eur': 'BNBUSDT',
    'pol_polygon': 'POLUSDT',
    'pol_polygon_eur': 'POLUSDT',
    'avalanche': 'AVAXUSDT',
    'avalanche_eur': 'AVAXUSDT',
    'uniswap': 'UNIUSDT',
    'uniswap_eur': 'UNIUSDT',
    'dogecoin': 'DOGEUSDT',
    'dogecoin_eur': 'DOGEUSDT',
    'shiba': 'SHIBUSDT',
    'shiba_eur': 'SHIBUSDT',
    'near': 'NEARUSDT',
    'near_eur': 'NEARUSDT',
    'atom': 'ATOMUSDT',
    'atom_eur': 'ATOMUSDT',
    'aave': 'AAVEUSDT',
    'sand': 'SANDUSDT',
    'fil': 'FILUSDT',
    'trx': 'TRXUSDT',
    'trx_eur': 'TRXUSDT',
    'xlm': 'XLMUSDT',
    'xlm_eur': 'XLMUSDT',
    'arb': 'ARBUSDT',
    'arb_eur': 'ARBUSDT',
    'op': 'OPUSDT',
    'op_eur': 'OPUSDT',
    'matic': 'MATICUSDT',
    'matic_eur': 'MATICUSDT',
    'crv': 'CRVUSDT',
    'ldo': 'LDOUSDT',
    'mana': 'MANAUSDT',
    'axs': 'AXSUSDT',
    'usdc': 'USDCUSDT',
    'sui': 'SUIUSDT',
    'sui_eur': 'SUIUSDT',
    'apt': 'APTUSDT',
    'sei': 'SEIUSDT',
    'ton': 'TONUSDT',
    'inj': 'INJUSDT',
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

// Funzione per rimuovere duplicati
function removeDuplicates() {
    const pairToSymbols = {};

    // Raggruppa simboli per trading pair
    Object.entries(SYMBOL_TO_PAIR_OLD).forEach(([symbol, pair]) => {
        if (!pairToSymbols[pair]) {
            pairToSymbols[pair] = [];
        }
        pairToSymbols[pair].push(symbol);
    });

    const newMap = {};
    const removed = [];

    // Per ogni trading pair, scegli quale tenere
    Object.entries(pairToSymbols).forEach(([pair, symbols]) => {
        if (symbols.length > 1) {
            // Priorità: _usdt > _eur > nome base
            const sorted = symbols.sort((a, b) => {
                if (a.endsWith('_usdt')) return -1;
                if (b.endsWith('_usdt')) return 1;
                if (a.endsWith('_eur')) return -1;
                if (b.endsWith('_eur')) return 1;
                return a.localeCompare(b);
            });

            newMap[sorted[0]] = pair;
            removed.push(...sorted.slice(1));
        } else {
            newMap[symbols[0]] = pair;
        }
    });

    return { newMap, removed, pairToSymbols };
}

// Genera nuovo SYMBOL_TO_PAIR
const { newMap, removed, pairToSymbols } = removeDuplicates();

console.log('🔧 AGGIORNAMENTO SYMBOL_TO_PAIR\n');
console.log('='.repeat(80));
console.log('');

console.log(`📊 STATISTICHE:`);
console.log(`   Simboli PRIMA: ${Object.keys(SYMBOL_TO_PAIR_OLD).length}`);
console.log(`   Simboli DOPO:  ${Object.keys(newMap).length}`);
console.log(`   Rimossi:       ${removed.length}`);
console.log(`   Trading pairs: ${Object.keys(pairToSymbols).length}`);
console.log('');

console.log('❌ SIMBOLI RIMOSSI (duplicati):');
console.log('');
removed.forEach(sym => {
    const pair = SYMBOL_TO_PAIR_OLD[sym];
    console.log(`   '${sym}': '${pair}',  // ❌ RIMOSSO (duplicato)`);
});

console.log('\n\n' + '='.repeat(80));
console.log('📝 NUOVO SYMBOL_TO_PAIR (da copiare in cryptoRoutes.js):\n');
console.log('='.repeat(80));
console.log('\n');

// Genera codice formattato
console.log('const SYMBOL_TO_PAIR = {');

// Raggruppa per categoria
const categories = {
    'Top Cryptocurrencies': ['bitcoin_usdt', 'ethereum_usdt', 'solana', 'ripple_eur', 'binance_coin'],
    'Layer 1 Alternatives': ['cardano', 'polkadot', 'avalanche_eur', 'near_eur', 'atom_eur', 'sui_eur', 'apt', 'ton', 'icp'],
    'DeFi Blue Chips': ['aave', 'uniswap_eur', 'chainlink_usdt', 'crv', 'ldo', 'mkr', 'comp', 'snx'],
    'Layer 2 / Scaling': ['arb_eur', 'op_eur', 'matic_eur', 'pol_polygon'],
    'Payments & Old School': ['trx_eur', 'xlm_eur'],
    'AI/Data Sector': ['fet', 'render', 'grt'],
    'Gaming/Metaverse': ['sand', 'mana', 'axs', 'gala', 'imx', 'enj_eur'],
    'Meme Coins': ['pepe_eur', 'dogecoin_eur', 'shiba_eur', 'floki', 'bonk'],
    'Storage/Infrastructure': ['fil', 'ar'],
    'Others': ['sei', 'inj', 'usdc']
};

Object.entries(categories).forEach(([category, symbols]) => {
    console.log(`    // ${category}`);
    symbols.forEach(sym => {
        if (newMap[sym]) {
            const pair = newMap[sym];
            console.log(`    '${sym}': '${pair}',`);
        }
    });
    console.log('');
});

console.log('};');

console.log('\n\n' + '='.repeat(80));
console.log('✅ COMPLETATO!\n');
console.log('📝 PROSSIMI STEP:');
console.log('   1. Copia il codice sopra');
console.log('   2. Sostituisci SYMBOL_TO_PAIR in backend/routes/cryptoRoutes.js');
console.log('   3. Commit e push su GitHub');
console.log('   4. Deploy su VPS: git pull && pm2 restart crypto-bot');
console.log('');
