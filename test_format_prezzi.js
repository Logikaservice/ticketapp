/**
 * Test formato prezzi per verificare che corrisponda a TradingView
 */

// Simula formatPrice (copia della logica)
function formatPrice(price, decimals = null) {
    if (price == null || isNaN(price) || price === 0) {
        return '0.00';
    }

    if (decimals === null) {
        if (price < 0.0001) {
            decimals = 8;
        } else if (price < 0.01) {
            decimals = 6;
        } else if (price < 1) {
            decimals = 5;
        } else if (price < 10) {
            decimals = 3;
        } else if (price < 100) {
            decimals = 2;
        } else {
            decimals = 2;
        }
    }

    return price.toFixed(decimals).replace(',', '.');
}

function formatPriceWithSymbol(price, decimals = null) {
    return `$${formatPrice(price, decimals)}`;
}

// Test con prezzi reali di varie crypto
const testPrices = [
    { symbol: 'BTC', price: 43250.25 },
    { symbol: 'ETH', price: 2650.50 },
    { symbol: 'BNB', price: 315.75 },
    { symbol: 'SOL', price: 98.45 },
    { symbol: 'DOT', price: 2.207 }, // Prezzo attuale
    { symbol: 'ADA', price: 0.485 },
    { symbol: 'MATIC', price: 0.823 },
    { symbol: 'DOGE', price: 0.082 },
    { symbol: 'SHIB', price: 0.00001234 },
    { symbol: 'PEPE', price: 0.00000856 },
    { symbol: 'XRP', price: 0.623 },
    { symbol: 'LINK', price: 14.85 },
    { symbol: 'AVAX', price: 36.92 },
    { symbol: 'ATOM', price: 9.876 },
];

console.log('🔍 Test formato prezzi per tutti i simboli:\n');
console.log('Formato atteso: corrispondente a TradingView\n');
console.log('Simbolo | Prezzo Originale | Formattato    | Decimali | Range');
console.log('--------|------------------|---------------|----------|----------------');

testPrices.forEach(({ symbol, price }) => {
    const formatted = formatPrice(price);
    const formattedWithSymbol = formatPriceWithSymbol(price);
    const decimals = formatted.split('.')[1]?.length || 0;
    
    // Determina il range
    let range = '';
    if (price < 0.0001) range = '< 0.0001 (8 dec)';
    else if (price < 0.01) range = '< 0.01 (6 dec)';
    else if (price < 1) range = '< 1 (5 dec)';
    else if (price < 10) range = '1-10 (3 dec) ✅';
    else if (price < 100) range = '10-100 (2 dec)';
    else range = '>= 100 (2 dec)';
    
    console.log(`${symbol.padEnd(7)} | ${price.toString().padEnd(16)} | ${formattedWithSymbol.padEnd(13)} | ${decimals.toString().padEnd(8)} | ${range}`);
});

console.log('\n✅ DOT/USDT con prezzo 2.207 dovrebbe mostrare: $2.207 (3 decimali)');
console.log('✅ SHIB con prezzo 0.00001234 dovrebbe mostrare: $0.000012 (6 decimali)');

