/**
 * 🔥 PULIZIA FINALE DEFINITIVA KLINES
 * 
 * Script ultra-aggressivo che rimuove TUTTI i simboli rimossi usando
 * query case-insensitive e gestendo tutte le varianti possibili.
 */

const { dbAll, dbGet, dbRun } = require('./crypto_db');

// Lista simboli da mantenere (tutti in lowercase)
const SYMBOLS_TO_KEEP_LOWER = [
    'aave', 'avax_usdt', 'binance_coin', 'bitcoin', 'bonk',
    'cardano', 'chainlink_usdt', 'ethereum', 'floki', 'gala',
    'imx', 'litecoin', 'mana', 'matic', 'pepe', 'polkadot',
    'pol_polygon', 'ripple', 'sand', 'sei', 'solana', 'uniswap'
].map(s => s.toLowerCase());

// Lista simboli da rimuovere (tutti in lowercase)
const SYMBOLS_TO_REMOVE_LOWER = [
    'algo', 'apt', 'ar', 'arb', 'arb_eur', 'atom', 'atom_eur',
    'avalanche', 'avalanche_eur', 'axs', 'binance_coin_eur',
    'bitcoin_usdt', 'cardano_usdt', 'chainlink', 'comp', 'crv',
    'dogecoin', 'dogecoin_eur', 'enj', 'enj_eur', 'eos',
    'ethereum_usdt', 'fet', 'fil', 'grt', 'icp', 'inj', 'ldo',
    'litecoin_usdt', 'matic_eur', 'mkr', 'near', 'near_eur',
    'op', 'op_eur', 'pepe_eur', 'polkadot_usdt', 'pol_polygon_eur',
    'render', 'ripple_eur', 'shiba', 'shiba_eur', 'snx',
    'solana_eur', 'sui', 'sui_eur', 'ton', 'trx', 'trx_eur',
    'uniswap_eur', 'usdc', 'vet', 'xlm', 'xlm_eur'
].map(s => s.toLowerCase());

// Varianti da rimuovere
const VARIANT_SYMBOLS_LOWER = [
    'avalancheeur',
    'binancecoin_eur',
    'dogecoineur',
    'polpolygon',
    'rippleeur',
    'solanaeur',
    'stellar',
    'trxeur',
    'usdcoin'
].map(s => s.toLowerCase());

async function finalCleanup() {
    console.log('🔥 PULIZIA FINALE DEFINITIVA TABELLA KLINES\n');
    console.log('='.repeat(80));
    
    try {
        // 1. Recupera TUTTI i simboli presenti (case-insensitive)
        console.log('📊 Analisi completa simboli in klines...\n');
        const allSymbols = await dbAll(
            `SELECT DISTINCT symbol, COUNT(*) as count 
             FROM klines 
             WHERE symbol IS NOT NULL 
             GROUP BY symbol 
             ORDER BY symbol`
        );
        
        console.log(`Trovati ${allSymbols.length} simboli unici\n`);
        
        // 2. Identifica simboli da rimuovere (case-insensitive)
        const symbolsToDelete = [];
        
        for (const row of allSymbols) {
            const symbol = row.symbol;
            const symbolLower = symbol.toLowerCase().trim();
            
            // Salta se è da mantenere
            if (SYMBOLS_TO_KEEP_LOWER.includes(symbolLower)) {
                continue;
            }
            
            // Salta se è 'global'
            if (symbolLower === 'global') {
                continue;
            }
            
            // Se è da rimuovere o è una variante, aggiungi alla lista
            if (SYMBOLS_TO_REMOVE_LOWER.includes(symbolLower) || 
                VARIANT_SYMBOLS_LOWER.includes(symbolLower)) {
                symbolsToDelete.push({
                    original: symbol,
                    lower: symbolLower,
                    count: parseInt(row.count)
                });
            } else {
                // Simbolo sconosciuto - chiedi conferma o rimuovi comunque
                console.log(`   ⚠️  Simbolo sconosciuto: ${symbol} (${row.count} record)`);
                symbolsToDelete.push({
                    original: symbol,
                    lower: symbolLower,
                    count: parseInt(row.count),
                    unknown: true
                });
            }
        }
        
        console.log(`\n🗑️  Simboli da rimuovere: ${symbolsToDelete.length}\n`);
        
        if (symbolsToDelete.length === 0) {
            console.log('✅ Nessun simbolo da rimuovere - tabella già pulita!');
            return;
        }
        
        // 3. Rimuovi usando DELETE con LOWER() per case-insensitive
        console.log('🧹 Rimozione simboli (case-insensitive)...\n');
        let totalRemoved = 0;
        
        for (const { original, lower, count, unknown } of symbolsToDelete) {
            try {
                // Usa DELETE con LOWER() per essere sicuri di rimuovere tutte le varianti
                const result = await dbRun(
                    `DELETE FROM klines WHERE LOWER(TRIM(symbol)) = $1`,
                    [lower]
                );
                
                const removed = result.changes || 0;
                if (removed > 0) {
                    const label = unknown ? '(sconosciuto)' : '';
                    console.log(`   ✅ Rimosso ${original.padEnd(25)} ${removed} record ${label}`);
                    totalRemoved += removed;
                } else {
                    console.log(`   ⚠️  ${original.padEnd(25)} Nessun record rimosso (attesi: ${count})`);
                }
            } catch (error) {
                console.error(`   ❌ Errore rimozione ${original}: ${error.message}`);
            }
        }
        
        // 4. Verifica finale immediata
        console.log('\n' + '='.repeat(80));
        console.log('📊 RIEPILOGO PULIZIA\n');
        console.log(`✅ Record rimossi: ${totalRemoved}`);
        
        // Verifica cosa è rimasto
        const remainingSymbols = await dbAll(
            `SELECT DISTINCT symbol, COUNT(*) as count 
             FROM klines 
             WHERE symbol IS NOT NULL 
             GROUP BY symbol 
             ORDER BY symbol`
        );
        
        console.log(`\n📊 Simboli rimasti in klines: ${remainingSymbols.length}`);
        
        const remainingToKeep = [];
        const remainingToRemove = [];
        
        for (const row of remainingSymbols) {
            const symbolLower = row.symbol.toLowerCase().trim();
            if (SYMBOLS_TO_KEEP_LOWER.includes(symbolLower)) {
                remainingToKeep.push(row.symbol);
            } else if (row.symbol.toLowerCase() !== 'global') {
                remainingToRemove.push({ symbol: row.symbol, count: parseInt(row.count) });
            }
        }
        
        if (remainingToKeep.length === SYMBOLS_TO_KEEP_LOWER.length) {
            console.log(`✅ Tutti i ${remainingToKeep.length} simboli da mantenere sono presenti`);
        } else {
            console.log(`⚠️  Simboli da mantenere trovati: ${remainingToKeep.length}/${SYMBOLS_TO_KEEP_LOWER.length}`);
        }
        
        if (remainingToRemove.length > 0) {
            console.log(`\n❌ Simboli rimossi ancora presenti (${remainingToRemove.length}):`);
            remainingToRemove.forEach(({ symbol, count }) => {
                console.log(`   - ${symbol.padEnd(25)} ${count} record`);
            });
            console.log(`\n💡 Questi simboli potrebbero avere caratteri speciali o formattazione diversa.`);
        } else {
            console.log(`\n✅ Nessun simbolo rimosso rimasto - PULIZIA COMPLETA!`);
        }
        
        console.log('\n✅ Pulizia finale completata!');
        
    } catch (error) {
        console.error('❌ Errore durante la pulizia:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

finalCleanup().catch(console.error);

