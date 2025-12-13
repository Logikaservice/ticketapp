/**
 * Script per pulire prezzi anomali dal database
 * Rimuove prezzi > $100k o < $0.000001 dalla tabella price_history
 */

const cryptoDb = require('../crypto_db');
const { dbAll, dbRun } = cryptoDb;

async function cleanAnomalousPrices() {
    console.log('🔧 Pulizia prezzi anomali dal database...');
    
    try {
        // Trova tutti i prezzi anomali
        const anomalousPrices = await dbAll(`
            SELECT id, symbol, price, timestamp 
            FROM price_history 
            WHERE price > 100000 OR price < 0.000001 OR price IS NULL
            ORDER BY timestamp DESC
        `);
        
        console.log(`📊 Trovati ${anomalousPrices.length} prezzi anomali da rimuovere`);
        
        if (anomalousPrices.length === 0) {
            console.log('✅ Nessun prezzo anomalo trovato!');
            return;
        }
        
        // Mostra alcuni esempi
        console.log('\n🔍 Esempi di prezzi anomali:');
        anomalousPrices.slice(0, 10).forEach(p => {
            console.log(`   ${p.symbol}: $${p.price} (${p.timestamp})`);
        });
        
        // Rimuovi prezzi anomali
        const result = await dbRun(`
            DELETE FROM price_history 
            WHERE price > 100000 OR price < 0.000001 OR price IS NULL
        `);
        
        console.log(`✅ Rimossi ${result.changes} prezzi anomali dal database`);
        
        // Mostra statistiche per simbolo
        const bySymbol = {};
        anomalousPrices.forEach(p => {
            bySymbol[p.symbol] = (bySymbol[p.symbol] || 0) + 1;
        });
        
        console.log('\n📊 Prezzi rimossi per simbolo:');
        Object.entries(bySymbol)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .forEach(([symbol, count]) => {
                console.log(`   ${symbol}: ${count}`);
            });
            
    } catch (error) {
        console.error('❌ Errore durante la pulizia:', error.message);
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

