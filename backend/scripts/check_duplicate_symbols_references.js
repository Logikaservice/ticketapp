/**
 * 🔍 VERIFICA RIFERIMENTI SIMBOLI DUPLICATI
 * 
 * Questo script verifica se ci sono ancora riferimenti ai simboli duplicati
 * eliminati dal database nel codice.
 */

// Lista simboli duplicati eliminati (senza suffisso)
const DUPLICATE_SYMBOLS = [
    'bitcoin',          // duplicato di bitcoin_usdt
    'ethereum',         // duplicato di ethereum_usdt
    'solana',           // duplicato di solana_eur
    'cardano',          // duplicato di cardano_usdt
    'polkadot',         // duplicato di polkadot_usdt
    'ripple',           // duplicato di ripple_eur
    'binance_coin',     // duplicato di binance_coin_eur
    'pol_polygon',      // duplicato di pol_polygon_eur
    'avalanche',        // duplicato di avalanche_eur
    'uniswap',          // duplicato di uniswap_eur
    'dogecoin',         // duplicato di dogecoin_eur
    'shiba',            // duplicato di shiba_eur
    'near',             // duplicato di near_eur
    'atom',             // duplicato di atom_eur
    'trx',              // duplicato di trx_eur
    'xlm',              // duplicato di xlm_eur
    'arb',              // duplicato di arb_eur
    'op',               // duplicato di op_eur
    'matic',            // duplicato di matic_eur
    'sui',              // duplicato di sui_eur
    'enj',              // duplicato di enj_eur
    'pepe'              // duplicato di pepe_eur
];

const fs = require('fs');
const path = require('path');

// File da controllare
const FILES_TO_CHECK = [
    'backend/routes/cryptoRoutes.js',
    'backend/services/TradingBot.js',
    'backend/scripts/activate-all-symbols.js',
    'backend/scripts/analyze-symbol-issues.js',
    'backend/scripts/test-symbol-normalization.js'
];

function checkFile(filePath) {
    const fullPath = path.join(__dirname, '..', '..', filePath);
    
    if (!fs.existsSync(fullPath)) {
        return { file: filePath, found: [], errors: [`File not found: ${filePath}`] };
    }
    
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');
    const found = [];
    
    DUPLICATE_SYMBOLS.forEach(symbol => {
        // Cerca pattern come 'symbol': o 'symbol'[^_] (senza suffisso)
        const patterns = [
            new RegExp(`['"]${symbol}['"]\\s*:`, 'g'),  // 'symbol': o "symbol":
            new RegExp(`['"]${symbol}['"]\\s*,`, 'g'),   // 'symbol', o "symbol",
            new RegExp(`\\b${symbol}\\b`, 'g')          // word boundary
        ];
        
        patterns.forEach((pattern, idx) => {
            const matches = content.match(pattern);
            if (matches && matches.length > 0) {
                // Trova le righe
                lines.forEach((line, lineNum) => {
                    if (pattern.test(line)) {
                        // Verifica che non sia un commento o una stringa con suffisso
                        if (!line.trim().startsWith('//') && 
                            !line.includes(`${symbol}_usdt`) && 
                            !line.includes(`${symbol}_eur`)) {
                            found.push({
                                symbol: symbol,
                                line: lineNum + 1,
                                content: line.trim().substring(0, 100)
                            });
                        }
                    }
                });
            }
        });
    });
    
    return { file: filePath, found: [...new Set(found.map(f => `${f.symbol}:${f.line}`))].map(f => {
        const [sym, line] = f.split(':');
        return found.find(x => x.symbol === sym && x.line === parseInt(line));
    }).filter(Boolean) };
}

console.log('🔍 VERIFICA RIFERIMENTI SIMBOLI DUPLICATI\n');
console.log('='.repeat(80));
console.log(`\n📊 Simboli duplicati da verificare: ${DUPLICATE_SYMBOLS.length}\n`);

const results = FILES_TO_CHECK.map(checkFile);

let totalFound = 0;
results.forEach(result => {
    if (result.found.length > 0) {
        console.log(`\n📄 ${result.file}:`);
        console.log(`   Trovati ${result.found.length} riferimenti potenziali\n`);
        
        // Raggruppa per simbolo
        const bySymbol = {};
        result.found.forEach(f => {
            if (!bySymbol[f.symbol]) bySymbol[f.symbol] = [];
            bySymbol[f.symbol].push(f);
        });
        
        Object.keys(bySymbol).forEach(symbol => {
            console.log(`   ⚠️  ${symbol}:`);
            bySymbol[symbol].slice(0, 5).forEach(f => {
                console.log(`      Linea ${f.line}: ${f.content}`);
            });
            if (bySymbol[symbol].length > 5) {
                console.log(`      ... e altri ${bySymbol[symbol].length - 5} riferimenti`);
            }
        });
        
        totalFound += result.found.length;
    }
});

console.log('\n' + '='.repeat(80));
console.log(`\n📊 Riepilogo:`);
console.log(`   File controllati: ${FILES_TO_CHECK.length}`);
console.log(`   Riferimenti trovati: ${totalFound}`);

if (totalFound === 0) {
    console.log('\n✅ Nessun riferimento problematico trovato!');
} else {
    console.log('\n⚠️  ATTENZIONE: Trovati riferimenti ai simboli duplicati.');
    console.log('   Alcuni potrebbero essere necessari per la normalizzazione.');
    console.log('   Verifica manualmente se sono problematici.\n');
}

