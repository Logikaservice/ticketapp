/**
 * 🔥 PULIZIA DIRETTA SQL - Query SQL Dirette
 * 
 * Usa query SQL dirette per rimuovere definitivamente i simboli rimossi.
 * Questo script mostra anche i comandi SQL da eseguire manualmente se necessario.
 */

const { dbAll, dbGet, dbRun } = require('./crypto_db');

// Lista simboli da mantenere
const SYMBOLS_TO_KEEP = [
    'aave', 'avax_usdt', 'binance_coin', 'bitcoin', 'bonk',
    'cardano', 'chainlink_usdt', 'ethereum', 'floki', 'gala',
    'imx', 'litecoin', 'mana', 'matic', 'pepe', 'polkadot',
    'pol_polygon', 'ripple', 'sand', 'sei', 'solana', 'uniswap'
].map(s => s.toLowerCase());

async function directSQLCleanup() {
    console.log('🔥 PULIZIA DIRETTA SQL - Query Dirette\n');
    console.log('='.repeat(80));
    
    try {
        // 1. Recupera TUTTI i simboli con il loro valore ESATTO
        console.log('📊 Analisi simboli in klines (valori esatti)...\n');
        const allSymbols = await dbAll(
            `SELECT DISTINCT symbol, COUNT(*) as count 
             FROM klines 
             WHERE symbol IS NOT NULL 
             GROUP BY symbol 
             ORDER BY symbol`
        );
        
        console.log(`Trovati ${allSymbols.length} simboli unici\n`);
        
        // 2. Identifica simboli da rimuovere
        const symbolsToDelete = [];
        
        for (const row of allSymbols) {
            const symbol = row.symbol;
            const symbolLower = symbol.toLowerCase().trim();
            
            // Salta se è da mantenere o 'global'
            if (SYMBOLS_TO_KEEP.includes(symbolLower) || symbolLower === 'global') {
                continue;
            }
            
            symbolsToDelete.push({
                exact: symbol,  // Valore esatto nel database
                lower: symbolLower,
                count: parseInt(row.count)
            });
        }
        
        console.log(`🗑️  Simboli da rimuovere: ${symbolsToDelete.length}\n`);
        
        if (symbolsToDelete.length === 0) {
            console.log('✅ Nessun simbolo da rimuovere - tabella già pulita!');
            return;
        }
        
        // 3. Mostra i simboli e genera comandi SQL
        console.log('📋 Simboli da rimuovere (valore esatto nel DB):');
        symbolsToDelete.forEach(({ exact, count }) => {
            console.log(`   - '${exact}' (${count} record)`);
        });
        console.log();
        
        // 4. Genera comandi SQL per rimozione manuale
        console.log('📝 COMANDI SQL DA ESEGUIRE MANUALMENTE:\n');
        console.log('-- Connettiti al database PostgreSQL e esegui:');
        console.log('\\c crypto_db;');
        console.log();
        
        // Metodo 1: DELETE uno per uno
        console.log('-- Metodo 1: DELETE uno per uno');
        symbolsToDelete.forEach(({ exact }) => {
            // Escape apostrofi nel nome simbolo
            const escaped = exact.replace(/'/g, "''");
            console.log(`DELETE FROM klines WHERE symbol = '${escaped}';`);
        });
        console.log();
        
        // Metodo 2: DELETE con NOT IN (più efficiente)
        console.log('-- Metodo 2: DELETE con NOT IN (più efficiente)');
        const keepList = SYMBOLS_TO_KEEP.map(s => `'${s}'`).join(', ');
        console.log(`DELETE FROM klines WHERE symbol IS NOT NULL AND LOWER(TRIM(symbol)) NOT IN (${keepList}, 'global');`);
        console.log();
        
        // 5. Prova a eseguire automaticamente
        console.log('🧹 Tentativo rimozione automatica...\n');
        let totalRemoved = 0;
        let failed = [];
        
        for (const { exact, count } of symbolsToDelete) {
            try {
                // Usa il valore ESATTO come è nel database
                const result = await dbRun(
                    `DELETE FROM klines WHERE symbol = $1`,
                    [exact]
                );
                
                const removed = result.changes || 0;
                if (removed > 0) {
                    console.log(`   ✅ Rimosso '${exact}': ${removed} record`);
                    totalRemoved += removed;
                } else {
                    console.log(`   ⚠️  '${exact}': Nessun record rimosso (attesi: ${count})`);
                    failed.push(exact);
                }
            } catch (error) {
                console.error(`   ❌ Errore '${exact}': ${error.message}`);
                failed.push(exact);
            }
        }
        
        // 6. Verifica immediata
        console.log('\n' + '='.repeat(80));
        console.log('📊 RIEPILOGO\n');
        console.log(`✅ Record rimossi: ${totalRemoved}`);
        
        if (failed.length > 0) {
            console.log(`\n⚠️  Simboli non rimossi (${failed.length}):`);
            failed.forEach(symbol => {
                console.log(`   - '${symbol}'`);
            });
            console.log('\n💡 Esegui manualmente i comandi SQL sopra per rimuoverli.');
        }
        
        // Verifica finale
        const remainingSymbols = await dbAll(
            `SELECT DISTINCT symbol, COUNT(*) as count 
             FROM klines 
             WHERE symbol IS NOT NULL 
             GROUP BY symbol 
             ORDER BY symbol`
        );
        
        const remainingToRemove = remainingSymbols.filter(row => {
            const symbolLower = row.symbol.toLowerCase().trim();
            return !SYMBOLS_TO_KEEP.includes(symbolLower) && symbolLower !== 'global';
        });
        
        if (remainingToRemove.length > 0) {
            console.log(`\n❌ Simboli rimossi ancora presenti (${remainingToRemove.length}):`);
            remainingToRemove.forEach(({ symbol, count }) => {
                console.log(`   - '${symbol}' (${count} record)`);
            });
            console.log('\n💡 Questi simboli potrebbero essere ricreati automaticamente dal bot.');
            console.log('   Verifica se il bot sta scaricando klines per questi simboli.');
        } else {
            console.log(`\n✅ PULIZIA COMPLETA!`);
        }
        
        console.log('\n✅ Pulizia diretta SQL completata!');
        
    } catch (error) {
        console.error('❌ Errore durante la pulizia:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

directSQLCleanup().catch(console.error);

