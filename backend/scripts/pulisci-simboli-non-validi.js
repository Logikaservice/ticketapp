/**
 * 🧹 PULISCI SIMBOLI NON VALIDI DAL DATABASE
 * 
 * Questo script elimina TUTTI i simboli che NON sono presenti
 * nella mappa SYMBOL_TO_PAIR, mantenendo solo quelli validi.
 * 
 * Database: PostgreSQL
 */

const { dbAll, dbRun } = require('../crypto_db');
const fs = require('fs');
const path = require('path');

// Carica SYMBOL_TO_PAIR da cryptoRoutes.js
const cryptoRoutesPath = path.join(__dirname, '../routes/cryptoRoutes.js');
const cryptoRoutesContent = fs.readFileSync(cryptoRoutesPath, 'utf8');

// Estrai SYMBOL_TO_PAIR
const symbolToPairMatch = cryptoRoutesContent.match(/const SYMBOL_TO_PAIR = \{([\s\S]*?)\};/);
if (!symbolToPairMatch) {
    console.error('❌ Non riesco a trovare SYMBOL_TO_PAIR nel codice');
    process.exit(1);
}

// Crea Set di simboli validi
const validSymbols = new Set();
const symbolToPairStr = symbolToPairMatch[1];
const symbolMatches = symbolToPairStr.matchAll(/'([^']+)':\s*'[^']+'/g);
for (const match of symbolMatches) {
    validSymbols.add(match[1].toLowerCase().trim());
}

console.log('🧹 PULIZIA SIMBOLI NON VALIDI DAL DATABASE\n');
console.log('='.repeat(80));
console.log('');
console.log(`✅ Simboli validi nella mappa SYMBOL_TO_PAIR: ${validSymbols.size}`);
console.log('');

async function pulisciSimboliNonValidi() {
    try {
        // 1. Trova tutti i simboli nel database
        console.log('📊 1. RACCOLTA SIMBOLI DAL DATABASE');
        console.log('-'.repeat(80));
        
        const allSymbolsQuery = `
            SELECT DISTINCT symbol 
            FROM (
                SELECT symbol FROM klines WHERE symbol IS NOT NULL
                UNION
                SELECT symbol FROM price_history WHERE symbol IS NOT NULL
                UNION
                SELECT symbol FROM open_positions WHERE symbol IS NOT NULL
                UNION
                SELECT symbol FROM bot_settings WHERE symbol IS NOT NULL AND symbol != 'global'
                UNION
                SELECT symbol FROM symbol_volumes_24h WHERE symbol IS NOT NULL
                UNION
                SELECT symbol FROM trades WHERE symbol IS NOT NULL
            ) AS all_symbols
            ORDER BY symbol
        `;
        
        const allSymbols = await dbAll(allSymbolsQuery);
        const allSymbolsSet = new Set(allSymbols.map(r => r.symbol.toLowerCase().trim()));
        
        console.log(`   Totale simboli nel database: ${allSymbolsSet.size}`);
        console.log('');

        // 2. Identifica simboli non validi
        console.log('🔍 2. IDENTIFICAZIONE SIMBOLI NON VALIDI');
        console.log('-'.repeat(80));
        
        const invalidSymbols = Array.from(allSymbolsSet).filter(s => !validSymbols.has(s));
        const validSymbolsInDb = Array.from(allSymbolsSet).filter(s => validSymbols.has(s));
        
        console.log(`   ✅ Simboli validi nel database: ${validSymbolsInDb.length}`);
        console.log(`   ❌ Simboli NON validi nel database: ${invalidSymbols.length}`);
        console.log('');

        if (invalidSymbols.length === 0) {
            console.log('✅ Nessun simbolo non valido trovato! Database già pulito.');
            return;
        }

        // 3. Mostra simboli non validi
        console.log('📋 3. SIMBOLI NON VALIDI DA ELIMINARE');
        console.log('-'.repeat(80));
        invalidSymbols.forEach((symbol, i) => {
            console.log(`   ${(i + 1).toString().padStart(3)}. ${symbol}`);
        });
        console.log('');

        // 4. Conta record per simbolo non valido
        console.log('📊 4. CONTEggio RECORD DA ELIMINARE');
        console.log('-'.repeat(80));
        
        for (const symbol of invalidSymbols.slice(0, 10)) { // Limita a 10 per performance
            const counts = await dbAll(`
                SELECT 
                    (SELECT COUNT(*) FROM klines WHERE symbol = $1) as klines_count,
                    (SELECT COUNT(*) FROM price_history WHERE symbol = $1) as price_history_count,
                    (SELECT COUNT(*) FROM open_positions WHERE symbol = $1) as open_positions_count,
                    (SELECT COUNT(*) FROM bot_settings WHERE symbol = $1) as bot_settings_count,
                    (SELECT COUNT(*) FROM symbol_volumes_24h WHERE symbol = $1) as volumes_count,
                    (SELECT COUNT(*) FROM trades WHERE symbol = $1) as trades_count
            `, [symbol]);
            
            const count = counts[0];
            const total = parseInt(count.klines_count) + 
                         parseInt(count.price_history_count) + 
                         parseInt(count.open_positions_count) + 
                         parseInt(count.bot_settings_count) + 
                         parseInt(count.volumes_count) + 
                         parseInt(count.trades_count);
            
            if (total > 0) {
                console.log(`   ${symbol.padEnd(30)} → ${total.toString().padStart(6)} record totali`);
                console.log(`      klines: ${count.klines_count}, price_history: ${count.price_history_count}, open_positions: ${count.open_positions_count}`);
            }
        }
        if (invalidSymbols.length > 10) {
            console.log(`   ... e altri ${invalidSymbols.length - 10} simboli`);
        }
        console.log('');

        // 5. Conferma eliminazione
        console.log('⚠️  5. CONFERMA ELIMINAZIONE');
        console.log('-'.repeat(80));
        console.log('');
        console.log(`   Stai per eliminare ${invalidSymbols.length} simboli non validi dal database.`);
        console.log(`   Questa operazione è IRREVERSIBILE!`);
        console.log('');
        console.log('   Per procedere, esegui lo script con: node pulisci-simboli-non-validi.js --confirm');
        console.log('');

        // 6. Se --confirm, procedi con eliminazione
        if (process.argv.includes('--confirm')) {
            console.log('🗑️  6. ELIMINAZIONE IN CORSO...');
            console.log('-'.repeat(80));
            console.log('');

            let totalDeleted = 0;

            for (const symbol of invalidSymbols) {
                try {
                    const klinesDeleted = await dbRun('DELETE FROM klines WHERE symbol = $1', [symbol]);
                    const priceHistoryDeleted = await dbRun('DELETE FROM price_history WHERE symbol = $1', [symbol]);
                    const openPositionsDeleted = await dbRun('DELETE FROM open_positions WHERE symbol = $1', [symbol]);
                    const botSettingsDeleted = await dbRun('DELETE FROM bot_settings WHERE symbol = $1', [symbol]);
                    const volumesDeleted = await dbRun('DELETE FROM symbol_volumes_24h WHERE symbol = $1', [symbol]);
                    const tradesDeleted = await dbRun('DELETE FROM trades WHERE symbol = $1', [symbol]);

                    const deleted = klinesDeleted.changes + 
                                   priceHistoryDeleted.changes + 
                                   openPositionsDeleted.changes + 
                                   botSettingsDeleted.changes + 
                                   volumesDeleted.changes + 
                                   tradesDeleted.changes;

                    if (deleted > 0) {
                        console.log(`   ✅ ${symbol.padEnd(30)} → ${deleted.toString().padStart(6)} record eliminati`);
                        totalDeleted += deleted;
                    }
                } catch (error) {
                    console.error(`   ❌ Errore eliminando ${symbol}:`, error.message);
                }
            }

            console.log('');
            console.log(`✅ Pulizia completata! ${totalDeleted} record eliminati.`);
            console.log('');
            console.log('💡 PROSSIMI PASSI:');
            console.log('   1. Verificare che i filtri nel codice funzionino');
            console.log('   2. Monitorare che i simboli non validi non vengano più creati');
        } else {
            console.log('💡 Per procedere con l\'eliminazione, esegui:');
            console.log(`   node pulisci-simboli-non-validi.js --confirm`);
        }

    } catch (error) {
        console.error('❌ Errore durante pulizia:', error.message);
        console.error(error.stack);
    }
}

pulisciSimboliNonValidi().catch(console.error);
