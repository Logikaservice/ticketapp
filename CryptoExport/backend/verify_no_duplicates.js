// Verifica rapida che non ci siano duplicati in SYMBOL_TO_PAIR
const fs = require('fs');
const path = require('path');

// Leggi il file cryptoRoutes.js
const filePath = path.join(__dirname, 'routes', 'cryptoRoutes.js');
const content = fs.readFileSync(filePath, 'utf8');

// Estrai SYMBOL_TO_PAIR con regex
const match = content.match(/const SYMBOL_TO_PAIR = \{([^}]+)\}/s);
if (!match) {
    console.log('❌ SYMBOL_TO_PAIR non trovato!');
    process.exit(1);
}

// Conta simboli e trading pairs
const lines = match[1].split('\n').filter(line => line.includes(':'));
const symbols = [];
const pairs = [];

lines.forEach(line => {
    const m = line.match(/'([^']+)':\s*'([^']+)'/);
    if (m) {
        symbols.push(m[1]);
        pairs.push(m[2]);
    }
});

const uniquePairs = new Set(pairs);
const hasDuplicates = symbols.length !== uniquePairs.size;

console.log('🔍 VERIFICA FINALE PULIZIA DUPLICATI\n');
console.log('='.repeat(60));
console.log('\n📊 STATISTICHE:');
console.log(`   Simboli totali: ${symbols.length}`);
console.log(`   Trading pairs unici: ${uniquePairs.size}`);
console.log(`   Duplicati: ${symbols.length - uniquePairs.size}`);
console.log('');

if (hasDuplicates) {
    console.log('❌ ATTENZIONE: Ci sono ancora duplicati!\n');
    const pairCount = {};
    symbols.forEach((sym, i) => {
        const pair = pairs[i];
        if (!pairCount[pair]) pairCount[pair] = [];
        pairCount[pair].push(sym);
    });
    Object.entries(pairCount).filter(([pair, syms]) => syms.length > 1).forEach(([pair, syms]) => {
        console.log(`   ${pair}: ${syms.join(', ')}`);
    });
} else {
    console.log('✅ PERFETTO! Nessun duplicato trovato!');
    console.log('');
    console.log(`📋 Lista simboli unici (${symbols.length}):`);
    symbols.sort().forEach(sym => console.log(`   - ${sym}`));
}

console.log('\n' + '='.repeat(60));
console.log('\n✅ Verifica completata!');
