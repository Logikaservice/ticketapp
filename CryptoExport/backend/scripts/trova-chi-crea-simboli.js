/**
 * 🔍 TROVA CHI CREA SIMBOLI NEL DATABASE
 * 
 * Questo script analizza il codice per identificare TUTTI i punti
 * dove vengono inseriti simboli nel database, così possiamo capire
 * chi ricrea i simboli che vengono cancellati.
 */

const fs = require('fs');
const path = require('path');

// Leggi la mappa SYMBOL_TO_PAIR dal codice
const cryptoRoutesPath = path.join(__dirname, '../routes/cryptoRoutes.js');
const cryptoRoutesContent = fs.readFileSync(cryptoRoutesPath, 'utf8');

// Estrai SYMBOL_TO_PAIR
const symbolToPairMatch = cryptoRoutesContent.match(/const SYMBOL_TO_PAIR = \{([\s\S]*?)\};/);
if (!symbolToPairMatch) {
    console.error('❌ Non riesco a trovare SYMBOL_TO_PAIR nel codice');
    process.exit(1);
}

// Simboli validi dalla mappa
const validSymbols = new Set();
const symbolToPairStr = symbolToPairMatch[1];
const symbolMatches = symbolToPairStr.matchAll(/'([^']+)':\s*'[^']+'/g);
for (const match of symbolMatches) {
    validSymbols.add(match[1]);
}

console.log('🔍 ANALISI: CHI CREA SIMBOLI NEL DATABASE\n');
console.log('='.repeat(80));
console.log('');
console.log(`✅ Simboli validi nella mappa SYMBOL_TO_PAIR: ${validSymbols.size}`);
console.log('');

// Cerca tutti i file che inseriscono simboli
const backendDir = path.join(__dirname, '..');
const filesToCheck = [
    'services/BinanceWebSocket.js',
    'services/PriceWebSocketService.js',
    'services/DataIntegrityService.js',
    'services/KlinesAggregatorService.js',
    'routes/cryptoRoutes.js',
    'update_stale_klines.js'
];

console.log('📋 PUNTI DOVE VENGONO INSERITI SIMBOLI:\n');
console.log('-'.repeat(80));
console.log('');

filesToCheck.forEach(file => {
    const filePath = path.join(backendDir, file);
    if (!fs.existsSync(filePath)) {
        return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    
    // Cerca INSERT con symbol
    const insertPatterns = [
        /INSERT\s+INTO\s+(\w+)\s*\([^)]*symbol[^)]*\)/gi,
        /INSERT\s+INTO\s+(\w+).*VALUES.*symbol/gi,
        /dbRun\s*\([^)]*INSERT[^)]*symbol/gi,
        /\.query\s*\([^)]*INSERT[^)]*symbol/gi
    ];

    const foundInserts = [];
    
    insertPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            const lineNum = content.substring(0, match.index).split('\n').length;
            foundInserts.push({
                line: lineNum,
                match: match[0].substring(0, 100)
            });
        }
    });

    // Cerca anche chiamate a funzioni che potrebbero inserire
    const functionPatterns = [
        /updatePriceHistory\s*\(/gi,
        /insertPriceHistory\s*\(/gi,
        /savePrice\s*\(/gi,
        /updatePrice\s*\(/gi,
        /processTicker\s*\(/gi,
        /handleTicker\s*\(/gi
    ];

    const foundFunctions = [];
    functionPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            const lineNum = content.substring(0, match.index).split('\n').length;
            const context = content.substring(Math.max(0, match.index - 50), match.index + 100);
            foundFunctions.push({
                line: lineNum,
                context: context.replace(/\n/g, ' ').substring(0, 150)
            });
        }
    });

    if (foundInserts.length > 0 || foundFunctions.length > 0) {
        console.log(`📄 ${file}:`);
        
        if (foundInserts.length > 0) {
            console.log('   INSERT trovati:');
            foundInserts.forEach(({ line, match }) => {
                console.log(`      Linea ${line}: ${match}`);
            });
        }
        
        if (foundFunctions.length > 0) {
            console.log('   Funzioni che potrebbero inserire:');
            foundFunctions.forEach(({ line, context }) => {
                console.log(`      Linea ${line}: ${context}`);
            });
        }
        console.log('');
    }
});

console.log('='.repeat(80));
console.log('✅ Analisi completata');
console.log('');
console.log('💡 PROSSIMI PASSI:');
console.log('   1. Verificare questi file per vedere se filtrano i simboli validi');
console.log('   2. Aggiungere filtri per inserire SOLO simboli validi dalla mappa');
console.log('   3. Creare constraint nel database per bloccare simboli non validi');
