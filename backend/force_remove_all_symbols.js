/**
 * 🔥 RIMOZIONE FORZATA TUTTI I SIMBOLI - Approccio Aggressivo
 * 
 * Rimuove TUTTI i simboli non nella lista da mantenere da TUTTE le tabelle,
 * indipendentemente da dove si trovano o se sono attivi.
 */

const { dbAll, dbGet, dbRun } = require('./crypto_db');

// Lista simboli da mantenere (tutti in lowercase)
const SYMBOLS_TO_KEEP = [
    'aave', 'avax_usdt', 'binance_coin', 'bitcoin', 'bonk',
    'cardano', 'chainlink_usdt', 'ethereum', 'floki', 'gala',
    'imx', 'litecoin', 'mana', 'matic', 'pepe', 'polkadot',
    'pol_polygon', 'ripple', 'sand', 'sei', 'solana', 'uniswap'
].map(s => s.toLowerCase());

async function forceRemoveAll() {
    console.log('🔥 RIMOZIONE FORZATA TUTTI I SIMBOLI\n');
    console.log('='.repeat(80));
    console.log('Strategia: Rimuovi TUTTO tranne i 22 simboli da mantenere');
    console.log('='.repeat(80));
    
    try {
        const tables = [
            { name: 'bot_settings', hasSymbol: true },
            { name: 'bot_parameters', hasSymbol: true },
            { name: 'klines', hasSymbol: true },
            { name: 'market_data', hasSymbol: true },
            { name: 'open_positions', hasSymbol: true }
        ];
        
        const results = {};
        
        for (const table of tables) {
            if (!table.hasSymbol) continue;
            
            console.log(`\n📊 Analisi tabella: ${table.name}...`);
            
            try {
                // Recupera tutti i simboli unici
                const allSymbols = await dbAll(
                    `SELECT DISTINCT symbol, COUNT(*) as count 
                     FROM ${table.name} 
                     WHERE symbol IS NOT NULL 
                     GROUP BY symbol 
                     ORDER BY symbol`
                );
                
                if (allSymbols.length === 0) {
                    console.log(`   ✅ Tabella vuota`);
                    results[table.name] = { total: 0, removed: 0 };
                    continue;
                }
                
                console.log(`   Trovati ${allSymbols.length} simboli unici`);
                
                // Identifica simboli da rimuovere
                const symbolsToRemove = [];
                let totalRecords = 0;
                
                for (const row of allSymbols) {
                    const symbol = row.symbol;
                    const symbolLower = symbol.toLowerCase().trim();
                    const count = parseInt(row.count);
                    totalRecords += count;
                    
                    // Salta se è da mantenere o 'global'
                    if (SYMBOLS_TO_KEEP.includes(symbolLower) || symbolLower === 'global') {
                        continue;
                    }
                    
                    symbolsToRemove.push({ symbol, count });
                }
                
                console.log(`   🗑️  Simboli da rimuovere: ${symbolsToRemove.length}`);
                
                if (symbolsToRemove.length === 0) {
                    console.log(`   ✅ Nessun simbolo da rimuovere`);
                    results[table.name] = { total: totalRecords, removed: 0 };
                    continue;
                }
                
                // Rimuovi simboli
                console.log(`   🧹 Rimozione in corso...`);
                let removedRecords = 0;
                
                for (const { symbol, count } of symbolsToRemove) {
                    try {
                        const result = await dbRun(
                            `DELETE FROM ${table.name} WHERE symbol = $1`,
                            [symbol]
                        );
                        const removed = result.changes || 0;
                        removedRecords += removed;
                        if (removed > 0) {
                            console.log(`     ✅ Rimosso '${symbol}': ${removed} record`);
                        }
                    } catch (error) {
                        console.error(`     ❌ Errore '${symbol}': ${error.message}`);
                    }
                }
                
                results[table.name] = { total: totalRecords, removed: removedRecords };
                console.log(`   ✅ Rimossi ${removedRecords} record totali`);
                
            } catch (error) {
                console.error(`   ❌ Errore analisi ${table.name}: ${error.message}`);
                results[table.name] = { error: error.message };
            }
        }
        
        // Riepilogo finale
        console.log('\n' + '='.repeat(80));
        console.log('📊 RIEPILOGO FINALE\n');
        
        let totalRemoved = 0;
        Object.entries(results).forEach(([table, data]) => {
            if (data.error) {
                console.log(`   ⚠️  ${table}: Errore - ${data.error}`);
            } else {
                console.log(`   ✅ ${table}: ${data.removed} record rimossi (su ${data.total} totali)`);
                totalRemoved += data.removed;
            }
        });
        
        console.log(`\n📊 Totale record rimossi: ${totalRemoved}`);
        
        // Verifica finale
        console.log('\n🔍 Verifica finale klines...\n');
        
        const remainingKlines = await dbAll(
            `SELECT DISTINCT symbol, COUNT(*) as count 
             FROM klines 
             WHERE symbol IS NOT NULL 
             GROUP BY symbol 
             ORDER BY symbol`
        );
        
        const remainingToRemove = remainingKlines.filter(row => {
            const symbolLower = row.symbol.toLowerCase().trim();
            return !SYMBOLS_TO_KEEP.includes(symbolLower) && symbolLower !== 'global';
        });
        
        const remainingToKeep = remainingKlines.filter(row => {
            const symbolLower = row.symbol.toLowerCase().trim();
            return SYMBOLS_TO_KEEP.includes(symbolLower);
        });
        
        console.log(`📊 Simboli rimasti in klines: ${remainingKlines.length}`);
        console.log(`   ✅ Simboli da mantenere: ${remainingToKeep.length}`);
        
        if (remainingToRemove.length > 0) {
            console.log(`\n❌ Simboli ancora presenti (${remainingToRemove.length}):`);
            remainingToRemove.forEach(({ symbol, count }) => {
                console.log(`   - ${symbol} (${count} record)`);
            });
            console.log(`\n💡 Questi simboli vengono probabilmente ricreati dal bot.`);
            console.log(`   Verifica se il bot sta scaricando klines per questi simboli.`);
        } else {
            console.log(`\n✅ PULIZIA COMPLETA! Nessun simbolo rimosso rimasto.`);
        }
        
        console.log('\n✅ Rimozione forzata completata!');
        
    } catch (error) {
        console.error('❌ Errore durante la rimozione:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

forceRemoveAll().catch(console.error);

