/**
 * Script per contare i simboli validi in SYMBOL_TO_PAIR
 */

const fs = require('fs');
const path = require('path');

// Leggi il file TradingBot.js
const tradingBotPath = path.join(__dirname, '../services/TradingBot.js');
const content = fs.readFileSync(tradingBotPath, 'utf8');

// Estrai SYMBOL_TO_PAIR
const symbolToPairMatch = content.match(/const SYMBOL_TO_PAIR = \{([\s\S]*?)\};/);

if (!symbolToPairMatch) {
    console.error('❌ SYMBOL_TO_PAIR non trovato');
    process.exit(1);
}

const symbolToPairContent = symbolToPairMatch[1];

// Estrai tutti i simboli (chiavi)
const symbolMatches = symbolToPairContent.match(/'([^']+)':/g);

if (!symbolMatches) {
    console.error('❌ Nessun simbolo trovato');
    process.exit(1);
}

// Estrai i nomi dei simboli
const symbols = symbolMatches.map(match => match.match(/'([^']+)':/)[1]);

// Rimuovi duplicati
const uniqueSymbols = [...new Set(symbols)];

console.log('📊 SIMBOLI VALIDI IN SYMBOL_TO_PAIR');
console.log('====================================');
console.log('');
console.log(`Totale simboli (con duplicati): ${symbols.length}`);
console.log(`Simboli unici: ${uniqueSymbols.length}`);
console.log('');
console.log('📋 Lista simboli validi:');
uniqueSymbols.sort().forEach((symbol, index) => {
    console.log(`   ${(index + 1).toString().padStart(3)}. ${symbol}`);
});

console.log('');
console.log('✅ Report completato');
