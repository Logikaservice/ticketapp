/**
 * Script per pulire prezzi anomali dal database
 * Rimuove prezzi > $100k o < $0.000001 da:
 * - price_history
 * - klines (high_price, low_price, close_price, open_price)
 */

const cryptoDb = require('../crypto_db');
const { dbAll, dbRun } = cryptoDb;

// ✅ Funzione helper per validare un prezzo
function isValidPrice(price, symbol = 'unknown') {
    if (!price || price <= 0) return false;
    if (price > 100000) return false; // Prezzo troppo alto
    if (price < 0.000001) return false; // Prezzo troppo basso
    return true;
}

async function cleanAnomalousPrices() {
    console.log('🔧 Pulizia prezzi anomali dal database...');
    console.log('');
    
    try {
        // 1. Pulisci price_history
        console.log('1️⃣ Pulizia tabella price_history...');
        const anomalousPrices = await dbAll(`
            SELECT id, symbol, price, timestamp 
            FROM price_history 
            WHERE price > 100000 OR price < 0.000001 OR price IS NULL
            ORDER BY timestamp DESC
        `);
        
        console.log(`   📊 Trovati ${anomalousPrices.length} prezzi anomali in price_history`);
        
        if (anomalousPrices.length > 0) {
            // Mostra alcuni esempi
            console.log('\n   🔍 Esempi di prezzi anomali:');
            anomalousPrices.slice(0, 10).forEach(p => {
                console.log(`      ${p.symbol}: $${p.price} (${p.timestamp})`);
            });
            
            // Rimuovi prezzi anomali
            const result = await dbRun(`
                DELETE FROM price_history 
                WHERE price > 100000 OR price < 0.000001 OR price IS NULL
            `);
            
            console.log(`   ✅ Rimossi ${result.changes} prezzi anomali da price_history`);
        } else {
            console.log('   ✅ Nessun prezzo anomalo in price_history');
        }
        
        // 2. Pulisci klines (high_price, low_price, close_price, open_price)
        console.log('\n2️⃣ Pulizia tabella klines...');
        const anomalousKlines = await dbAll(`
            SELECT id, symbol, interval, open_time, open_price, high_price, low_price, close_price
            FROM klines 
            WHERE high_price > 100000 OR high_price < 0.000001 
               OR low_price > 100000 OR low_price < 0.000001
               OR close_price > 100000 OR close_price < 0.000001
               OR open_price > 100000 OR open_price < 0.000001
               OR high_price IS NULL OR low_price IS NULL OR close_price IS NULL OR open_price IS NULL
            ORDER BY open_time DESC
        `);
        
        console.log(`   📊 Trovate ${anomalousKlines.length} klines anomale`);
        
        if (anomalousKlines.length > 0) {
            // Mostra alcuni esempi
            console.log('\n   🔍 Esempi di klines anomale:');
            anomalousKlines.slice(0, 10).forEach(k => {
                console.log(`      ${k.symbol} (${k.interval}): O=$${k.open_price} H=$${k.high_price} L=$${k.low_price} C=$${k.close_price} (${new Date(parseInt(k.open_time)).toISOString()})`);
            });
            
            // Rimuovi klines anomale
            const resultKlines = await dbRun(`
                DELETE FROM klines 
                WHERE high_price > 100000 OR high_price < 0.000001 
                   OR low_price > 100000 OR low_price < 0.000001
                   OR close_price > 100000 OR close_price < 0.000001
                   OR open_price > 100000 OR open_price < 0.000001
                   OR high_price IS NULL OR low_price IS NULL OR close_price IS NULL OR open_price IS NULL
            `);
            
            console.log(`   ✅ Rimosse ${resultKlines.changes} klines anomale`);
        } else {
            console.log('   ✅ Nessuna kline anomala trovata');
        }
        
        // 3. Statistiche finali
        console.log('\n📊 STATISTICHE FINALI:');
        if (anomalousPrices.length > 0) {
            const bySymbol = {};
            anomalousPrices.forEach(p => {
                bySymbol[p.symbol] = (bySymbol[p.symbol] || 0) + 1;
            });
            
            console.log('\n   Prezzi rimossi da price_history per simbolo:');
            Object.entries(bySymbol)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 20)
                .forEach(([symbol, count]) => {
                    console.log(`      ${symbol}: ${count}`);
                });
        }
        
        if (anomalousKlines.length > 0) {
            const bySymbolKlines = {};
            anomalousKlines.forEach(k => {
                bySymbolKlines[k.symbol] = (bySymbolKlines[k.symbol] || 0) + 1;
            });
            
            console.log('\n   Klines rimosse per simbolo:');
            Object.entries(bySymbolKlines)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 20)
                .forEach(([symbol, count]) => {
                    console.log(`      ${symbol}: ${count}`);
                });
        }
            
    } catch (error) {
        console.error('❌ Errore durante la pulizia:', error.message);
        console.error('❌ Stack:', error.stack);
        throw error;
    }
}

// Esegui se chiamato direttamente
if (require.main === module) {
    cleanAnomalousPrices()
        .then(() => {
            console.log('\n✅ Pulizia completata!');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Errore:', error);
            process.exit(1);
        });
}

module.exports = cleanAnomalousPrices;

