/**
 * Script per estrarre i simboli validi da TradingBot.js e generare la lista SQL
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

// Rimuovi duplicati e ordina
const uniqueSymbols = [...new Set(symbols)].sort();

// Rimuovi uniswap_eur se presente (non disponibile su Binance)
const filteredSymbols = uniqueSymbols.filter(s => s !== 'uniswap_eur');

// Genera lista SQL per IN clause
const validSymbolsSQL = filteredSymbols.map(s => `'${s}'`).join(',');

console.log('-- Simboli validi estratti da SYMBOL_TO_PAIR');
console.log(`-- Totale: ${filteredSymbols.length} simboli`);
console.log(`-- (Rimosso: uniswap_eur - non disponibile su Binance)`);
console.log('');
console.log(validSymbolsSQL);
