/**
 * Test formato prezzi per tutti i simboli per verificare che corrisponda a TradingView
 */

const { formatPrice, formatPriceWithSymbol } = require('./frontend/src/utils/priceFormatter');

// Simula i prezzi reali di varie crypto
const testPrices = [
    { symbol: 'BTC', price: 43250.25, expected: '43250.25' }, // >= 100: 2 decimali
    { symbol: 'ETH', price: 2650.50, expected: '2650.50' }, // >= 100: 2 decimali
    { symbol: 'BNB', price: 315.75, expected: '315.75' }, // >= 100: 2 decimali
    { symbol: 'SOL', price: 98.45, expected: '98.45' }, // 10-100: 2 decimali
    { symbol: 'DOT', price: 2.165, expected: '2.165' }, // 1-10: 3 decimali ✅
    { symbol: 'ADA', price: 0.485, expected: '0.48500' }, // < 1: 5 decimali
    { symbol: 'MATIC', price: 0.823, expected: '0.82300' }, // < 1: 5 decimali
    { symbol: 'DOGE', price: 0.082, expected: '0.08200' }, // < 1: 5 decimali
    { symbol: 'SHIB', price: 0.00001234, expected: '0.00001234' }, // < 0.01: 6 decimali
    { symbol: 'PEPE', price: 0.00000856, expected: '0.00000856' }, // < 0.01: 6 decimali
    { symbol: 'XRP', price: 0.623, expected: '0.62300' }, // < 1: 5 decimali
    { symbol: 'LINK', price: 14.85, expected: '14.85' }, // 10-100: 2 decimali
    { symbol: 'AVAX', price: 36.92, expected: '36.92' }, // 10-100: 2 decimali
    { symbol: 'ATOM', price: 9.876, expected: '9.876' }, // 1-10: 3 decimali ✅
];

console.log('🔍 Test formato prezzi per tutti i simboli:\n');
console.log('Formato atteso: corrispondente a TradingView\n');

testPrices.forEach(({ symbol, price, expected }) => {
    const formatted = formatPrice(price);
    const formattedWithSymbol = formatPriceWithSymbol(price);
    const decimals = formatted.split('.')[1]?.length || 0;
    
    // Determina il range
    let range = '';
    if (price < 0.0001) range = '< 0.0001 (8 decimali)';
    else if (price < 0.01) range = '< 0.01 (6 decimali)';
    else if (price < 1) range = '< 1 (5 decimali)';
    else if (price < 10) range = '1-10 (3 decimali)';
    else if (price < 100) range = '10-100 (2 decimali)';
    else range = '>= 100 (2 decimali)';
    
    const match = formatted === expected;
    const status = match ? '✅' : '⚠️';
    
    console.log(`${status} ${symbol.padEnd(6)} | Prezzo: $${price.toString().padEnd(12)} | Formattato: ${formattedWithSymbol.padEnd(15)} | ${decimals} decimali | ${range}`);
    
    if (!match) {
        console.log(`   ⚠️  Atteso: $${expected} ma ottenuto: ${formattedWithSymbol}`);
    }
});

console.log('\n📊 Riepilogo:');
const ranges = {
    '< 0.0001': testPrices.filter(p => p.price < 0.0001).length,
    '< 0.01': testPrices.filter(p => p.price >= 0.0001 && p.price < 0.01).length,
    '< 1': testPrices.filter(p => p.price >= 0.01 && p.price < 1).length,
    '1-10': testPrices.filter(p => p.price >= 1 && p.price < 10).length,
    '10-100': testPrices.filter(p => p.price >= 10 && p.price < 100).length,
    '>= 100': testPrices.filter(p => p.price >= 100).length,
};

Object.entries(ranges).forEach(([range, count]) => {
    if (count > 0) {
        console.log(`   ${range}: ${count} simboli`);
    }
});

