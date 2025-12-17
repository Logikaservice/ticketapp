/**
 * 🔥 Pulizia Forzata Klines - Rimuove TUTTI i simboli rimossi
 * 
 * Script più aggressivo che rimuove tutti i simboli rimossi dalla tabella klines,
 * inclusi quelli che potrebbero avere problemi di case sensitivity o varianti.
 */

const { dbAll, dbGet, dbRun } = require('./crypto_db');

// Lista simboli da mantenere (case-insensitive)
const SYMBOLS_TO_KEEP = [
    'aave', 'avax_usdt', 'binance_coin', 'bitcoin', 'bonk',
    'cardano', 'chainlink_usdt', 'ethereum', 'floki', 'gala',
    'imx', 'litecoin', 'mana', 'matic', 'pepe', 'polkadot',
    'pol_polygon', 'ripple', 'sand', 'sei', 'solana', 'uniswap'
];

// Lista simboli da rimuovere (case-insensitive)
const SYMBOLS_TO_REMOVE = [
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
];

// Varianti e nomi alternativi
const VARIANT_SYMBOLS = [
    'avalancheeur',
    'binancecoin_eur',
    'dogecoineur',
    'polpolygon',
    'rippleeur',
    'solanaeur',
    'stellar',
    'trxeur',
    'usdcoin'
];

async function forceCleanupKlines() {
    console.log('🔥 PULIZIA FORZATA TABELLA KLINES\n');
    console.log('='.repeat(80));
    
    try {
        // 1. Prima, verifica cosa c'è nella tabella
        console.log('📊 Verifica simboli presenti in klines...\n');
        const allSymbols = await dbAll(
            `SELECT DISTINCT symbol, COUNT(*) as count 
             FROM klines 
             WHERE symbol IS NOT NULL 
             GROUP BY symbol 
             ORDER BY symbol`
        );
        
        console.log(`Trovati ${allSymbols.length} simboli unici in klines\n`);
        
        // 2. Identifica simboli da rimuovere (case-insensitive)
        const symbolsToRemove = [];
        const symbolsToKeep = [];
        const unknownSymbols = [];
        
        for (const row of allSymbols) {
            const symbol = row.symbol;
            const symbolLower = symbol.toLowerCase();
            
            const isToKeep = SYMBOLS_TO_KEEP.some(s => s.toLowerCase() === symbolLower);
            const isToRemove = SYMBOLS_TO_REMOVE.some(s => s.toLowerCase() === symbolLower);
            const isVariant = VARIANT_SYMBOLS.some(s => s.toLowerCase() === symbolLower);
            
            if (isToKeep) {
                symbolsToKeep.push({ symbol, count: parseInt(row.count) });
            } else if (isToRemove || isVariant) {
                symbolsToRemove.push({ symbol, count: parseInt(row.count) });
            } else if (symbol !== 'global') {
                unknownSymbols.push({ symbol, count: parseInt(row.count) });
            }
        }
        
        console.log(`✅ Simboli da mantenere: ${symbolsToKeep.length}`);
        console.log(`🗑️  Simboli da rimuovere: ${symbolsToRemove.length}`);
        console.log(`⚠️  Simboli sconosciuti: ${unknownSymbols.length}\n`);
        
        if (symbolsToRemove.length === 0 && unknownSymbols.length === 0) {
            console.log('✅ Nessun simbolo da rimuovere - tabella già pulita!');
            return;
        }
        
        // 3. Rimuovi simboli uno per uno (case-sensitive exact match)
        console.log('🧹 Inizio rimozione simboli...\n');
        let totalRemoved = 0;
        
        for (const { symbol, count } of symbolsToRemove) {
            try {
                const result = await dbRun(
                    `DELETE FROM klines WHERE symbol = $1`,
                    [symbol]
                );
                const removed = result.changes || 0;
                if (removed > 0) {
                    console.log(`   ✅ Rimosso ${symbol.padEnd(25)} ${removed} record (attesi: ${count})`);
                    totalRemoved += removed;
                } else {
                    console.log(`   ⚠️  ${symbol.padEnd(25)} Nessun record rimosso (attesi: ${count})`);
                }
            } catch (error) {
                console.error(`   ❌ Errore rimozione ${symbol}: ${error.message}`);
            }
        }
        
        // 4. Rimuovi simboli sconosciuti (se non sono da mantenere)
        if (unknownSymbols.length > 0) {
            console.log('\n🧹 Rimozione simboli sconosciuti...\n');
            for (const { symbol, count } of unknownSymbols) {
                try {
                    const result = await dbRun(
                        `DELETE FROM klines WHERE symbol = $1`,
                        [symbol]
                    );
                    const removed = result.changes || 0;
                    if (removed > 0) {
                        console.log(`   ✅ Rimosso ${symbol.padEnd(25)} ${removed} record (sconosciuto)`);
                        totalRemoved += removed;
                    }
                } catch (error) {
                    console.error(`   ❌ Errore rimozione ${symbol}: ${error.message}`);
                }
            }
        }
        
        // 5. Verifica finale
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
        
        const remainingToKeep = remainingSymbols.filter(s => 
            SYMBOLS_TO_KEEP.some(k => k.toLowerCase() === s.symbol.toLowerCase())
        );
        const remainingUnknown = remainingSymbols.filter(s => 
            !SYMBOLS_TO_KEEP.some(k => k.toLowerCase() === s.symbol.toLowerCase()) &&
            s.symbol !== 'global'
        );
        
        if (remainingToKeep.length === SYMBOLS_TO_KEEP.length) {
            console.log(`✅ Tutti i ${remainingToKeep.length} simboli da mantenere sono presenti`);
        } else {
            console.log(`⚠️  Simboli da mantenere trovati: ${remainingToKeep.length}/${SYMBOLS_TO_KEEP.length}`);
        }
        
        if (remainingUnknown.length > 0) {
            console.log(`\n⚠️  Simboli sconosciuti ancora presenti (${remainingUnknown.length}):`);
            remainingUnknown.forEach(({ symbol, count }) => {
                console.log(`   - ${symbol.padEnd(25)} ${count} record`);
            });
        } else {
            console.log(`\n✅ Nessun simbolo sconosciuto rimasto`);
        }
        
        console.log('\n✅ Pulizia forzata completata!');
        
    } catch (error) {
        console.error('❌ Errore durante la pulizia:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

forceCleanupKlines().catch(console.error);

