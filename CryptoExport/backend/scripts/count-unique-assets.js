/**
 * Script per contare gli asset UNICI (non le varianti)
 * Conta i trading pairs unici invece delle chiavi
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

// Estrai tutte le coppie chiave-valore
const pairs = symbolToPairContent.match(/'([^']+)':\s*'([^']+)'/g);

if (!pairs) {
    console.error('❌ Nessuna coppia trovata');
    process.exit(1);
}

// Estrai i trading pairs unici (valori)
const tradingPairs = new Set();
const symbolToPairMap = {};

pairs.forEach(pair => {
    const match = pair.match(/'([^']+)':\s*'([^']+)'/);
    if (match) {
        const symbol = match[1];
        const tradingPair = match[2];
        tradingPairs.add(tradingPair);
        symbolToPairMap[symbol] = tradingPair;
    }
});

// Raggruppa simboli per trading pair
const symbolsByPair = {};
Object.keys(symbolToPairMap).forEach(symbol => {
    const pair = symbolToPairMap[symbol];
    if (!symbolsByPair[pair]) {
        symbolsByPair[pair] = [];
    }
    symbolsByPair[pair].push(symbol);
});

console.log('📊 ASSET UNICI (Trading Pairs)');
console.log('================================');
console.log('');
console.log(`Totale trading pairs unici: ${tradingPairs.size}`);
console.log(`Totale varianti/alias: ${Object.keys(symbolToPairMap).length}`);
console.log('');

// Mostra asset unici con le loro varianti
const sortedPairs = Array.from(tradingPairs).sort();
console.log('📋 Asset unici e loro varianti:');
sortedPairs.forEach((pair, index) => {
    const variants = symbolsByPair[pair].sort();
    console.log(`   ${(index + 1).toString().padStart(3)}. ${pair.padEnd(12)} → ${variants.length} varianti: ${variants.join(', ')}`);
});

console.log('');
console.log('✅ Report completato');

