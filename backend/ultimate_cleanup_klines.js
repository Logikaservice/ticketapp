/**
 * 🔥 PULIZIA ULTIMATIVA KLINES - Approccio Inverso
 * 
 * Invece di rimuovere i simboli da rimuovere, mantiene SOLO quelli da mantenere.
 * Questo è più sicuro e garantisce che tutto il resto venga rimosso.
 */

const { dbAll, dbGet, dbRun } = require('./crypto_db');

// Lista simboli da mantenere (tutti in lowercase per confronto)
const SYMBOLS_TO_KEEP = [
    'aave', 'avax_usdt', 'binance_coin', 'bitcoin', 'bonk',
    'cardano', 'chainlink_usdt', 'ethereum', 'floki', 'gala',
    'imx', 'litecoin', 'mana', 'matic', 'pepe', 'polkadot',
    'pol_polygon', 'ripple', 'sand', 'sei', 'solana', 'uniswap'
].map(s => s.toLowerCase());

async function ultimateCleanup() {
    console.log('🔥 PULIZIA ULTIMATIVA TABELLA KLINES\n');
    console.log('='.repeat(80));
    console.log('Strategia: Mantieni SOLO i simboli da mantenere, rimuovi TUTTO il resto');
    console.log('='.repeat(80));
    
    try {
        // 1. Recupera TUTTI i simboli presenti
        console.log('\n📊 Analisi simboli in klines...\n');
        const allSymbols = await dbAll(
            `SELECT DISTINCT symbol, COUNT(*) as count 
             FROM klines 
             WHERE symbol IS NOT NULL 
             GROUP BY symbol 
             ORDER BY symbol`
        );
        
        console.log(`Trovati ${allSymbols.length} simboli unici\n`);
        
        // 2. Identifica simboli da mantenere (case-insensitive)
        const symbolsToKeep = [];
        const symbolsToDelete = [];
        
        for (const row of allSymbols) {
            const symbol = row.symbol;
            const symbolLower = symbol.toLowerCase().trim();
            
            // Salta 'global'
            if (symbolLower === 'global') {
                continue;
            }
            
            // Verifica se è da mantenere
            if (SYMBOLS_TO_KEEP.includes(symbolLower)) {
                symbolsToKeep.push({ symbol, count: parseInt(row.count) });
            } else {
                symbolsToDelete.push({ symbol, count: parseInt(row.count) });
            }
        }
        
        console.log(`✅ Simboli da mantenere: ${symbolsToKeep.length}`);
        console.log(`🗑️  Simboli da rimuovere: ${symbolsToDelete.length}\n`);
        
        if (symbolsToDelete.length === 0) {
            console.log('✅ Nessun simbolo da rimuovere - tabella già pulita!');
            return;
        }
        
        // 3. Mostra lista simboli da rimuovere
        console.log('📋 Simboli che verranno rimossi:');
        symbolsToDelete.forEach(({ symbol, count }) => {
            console.log(`   - ${symbol.padEnd(25)} ${count} record`);
        });
        console.log();
        
        // 4. APPROCCIO ULTIMATIVO: DELETE con NOT IN
        // Rimuovi TUTTI i simboli che NON sono nella lista da mantenere
        console.log('🧹 Rimozione simboli (approccio inverso)...\n');
        
        // Crea lista valori per NOT IN (case-insensitive)
        const keepValues = SYMBOLS_TO_KEEP.map(s => `'${s}'`);
        const keepValuesUpper = SYMBOLS_TO_KEEP.map(s => `'${s.toUpperCase()}'`);
        
        // Query 1: Rimuovi simboli che non corrispondono (case-insensitive)
        try {
            // Usa una query che confronta LOWER(symbol) con la lista
            const deleteQuery = `
                DELETE FROM klines 
                WHERE symbol IS NOT NULL 
                AND LOWER(TRIM(symbol)) NOT IN (${SYMBOLS_TO_KEEP.map(s => `'${s}'`).join(', ')})
                AND LOWER(TRIM(symbol)) != 'global'
            `;
            
            console.log('   Esecuzione DELETE con NOT IN...');
            const result = await dbRun(deleteQuery);
            const removed = result.changes || 0;
            console.log(`   ✅ Record rimossi: ${removed}\n`);
            
        } catch (error) {
            console.error(`   ❌ Errore query NOT IN: ${error.message}`);
            console.log('   → Fallback: rimozione simbolo per simbolo...\n');
            
            // Fallback: rimuovi uno per uno
            let totalRemoved = 0;
            for (const { symbol, count } of symbolsToDelete) {
                try {
                    const result = await dbRun(
                        `DELETE FROM klines WHERE symbol = $1`,
                        [symbol]
                    );
                    const removed = result.changes || 0;
                    if (removed > 0) {
                        console.log(`   ✅ Rimosso ${symbol.padEnd(25)} ${removed} record`);
                        totalRemoved += removed;
                    }
                } catch (err) {
                    console.error(`   ❌ Errore rimozione ${symbol}: ${err.message}`);
                }
            }
            console.log(`\n   📊 Totale record rimossi: ${totalRemoved}`);
        }
        
        // 5. Verifica finale
        console.log('\n' + '='.repeat(80));
        console.log('📊 VERIFICA FINALE\n');
        
        const remainingSymbols = await dbAll(
            `SELECT DISTINCT symbol, COUNT(*) as count 
             FROM klines 
             WHERE symbol IS NOT NULL 
             GROUP BY symbol 
             ORDER BY symbol`
        );
        
        console.log(`📊 Simboli rimasti in klines: ${remainingSymbols.length}`);
        
        const remainingToKeep = [];
        const remainingToRemove = [];
        
        for (const row of remainingSymbols) {
            const symbolLower = row.symbol.toLowerCase().trim();
            if (SYMBOLS_TO_KEEP.includes(symbolLower) || symbolLower === 'global') {
                remainingToKeep.push({ symbol: row.symbol, count: parseInt(row.count) });
            } else {
                remainingToRemove.push({ symbol: row.symbol, count: parseInt(row.count) });
            }
        }
        
        if (remainingToKeep.length >= SYMBOLS_TO_KEEP.length) {
            console.log(`✅ Simboli da mantenere trovati: ${remainingToKeep.length}`);
            remainingToKeep.forEach(({ symbol, count }) => {
                console.log(`   ✅ ${symbol.padEnd(25)} ${count} record`);
            });
        }
        
        if (remainingToRemove.length > 0) {
            console.log(`\n❌ Simboli rimossi ancora presenti (${remainingToRemove.length}):`);
            remainingToRemove.forEach(({ symbol, count }) => {
                console.log(`   - ${symbol.padEnd(25)} ${count} record`);
            });
            console.log(`\n💡 Prova a eseguire manualmente:`);
            remainingToRemove.forEach(({ symbol }) => {
                console.log(`   DELETE FROM klines WHERE symbol = '${symbol}';`);
            });
        } else {
            console.log(`\n✅ PULIZIA COMPLETA! Nessun simbolo rimosso rimasto.`);
        }
        
        console.log('\n✅ Pulizia ultimativa completata!');
        
    } catch (error) {
        console.error('❌ Errore durante la pulizia:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

ultimateCleanup().catch(console.error);

