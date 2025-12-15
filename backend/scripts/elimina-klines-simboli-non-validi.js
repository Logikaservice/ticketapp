/**
 * 🗑️ ELIMINA DEFINITIVAMENTE KLINES PER SIMBOLI NON VALIDI
 * 
 * Questo script elimina TUTTE le klines per simboli che NON sono presenti
 * nella mappa SYMBOL_TO_PAIR (i 67 trading pairs unici).
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

// Crea Set di simboli validi (chiavi nella mappa)
const validSymbols = new Set();
const symbolToPairStr = symbolToPairMatch[1];
const symbolMatches = symbolToPairStr.matchAll(/'([^']+)':\s*'[^']+'/g);
for (const match of symbolMatches) {
    validSymbols.add(match[1].toLowerCase().trim());
}

// Ottieni trading pairs unici (valori nella mappa)
const tradingPairs = new Set();
for (const match of symbolMatches) {
    const pairMatch = symbolToPairStr.match(new RegExp(`'${match[1]}':\\s*'([^']+)'`));
    if (pairMatch) {
        tradingPairs.add(pairMatch[1]);
    }
}

console.log('🗑️  ELIMINAZIONE DEFINITIVA KLINES PER SIMBOLI NON VALIDI\n');
console.log('='.repeat(80));
console.log('');
console.log(`✅ Simboli validi nella mappa SYMBOL_TO_PAIR: ${validSymbols.size}`);
console.log(`✅ Trading pairs unici: ${tradingPairs.size}`);
console.log('');

async function eliminaKlinesNonValide() {
    try {
        // 1. Trova tutti i simboli che hanno klines nel database
        console.log('📊 1. RACCOLTA SIMBOLI CON KLINES NEL DATABASE');
        console.log('-'.repeat(80));
        
        const symbolsWithKlines = await dbAll(`
            SELECT DISTINCT symbol, COUNT(*) as klines_count
            FROM klines
            WHERE symbol IS NOT NULL
            GROUP BY symbol
            ORDER BY symbol
        `);
        
        console.log(`   Totale simboli con klines nel database: ${symbolsWithKlines.length}`);
        console.log('');

        // 2. Identifica simboli non validi
        console.log('🔍 2. IDENTIFICAZIONE SIMBOLI NON VALIDI');
        console.log('-'.repeat(80));
        
        const invalidSymbols = [];
        const validSymbolsInDb = [];
        
        symbolsWithKlines.forEach(row => {
            const symbol = row.symbol.toLowerCase().trim();
            const klinesCount = parseInt(row.klines_count);
            
            if (validSymbols.has(symbol)) {
                validSymbolsInDb.push({ symbol, klinesCount });
            } else {
                invalidSymbols.push({ symbol, klinesCount });
            }
        });
        
        console.log(`   ✅ Simboli validi con klines: ${validSymbolsInDb.length}`);
        console.log(`   ❌ Simboli NON validi con klines: ${invalidSymbols.length}`);
        console.log('');

        if (invalidSymbols.length === 0) {
            console.log('✅ Nessun simbolo non valido trovato! Database già pulito.');
            return;
        }

        // 3. Mostra simboli non validi con conteggio klines
        console.log('📋 3. SIMBOLI NON VALIDI DA ELIMINARE');
        console.log('-'.repeat(80));
        console.log('');
        
        let totalKlinesToDelete = 0;
        invalidSymbols.forEach(({ symbol, klinesCount }, i) => {
            totalKlinesToDelete += klinesCount;
            console.log(`   ${(i + 1).toString().padStart(3)}. ${symbol.padEnd(30)} → ${klinesCount.toLocaleString().padStart(8)} klines`);
        });
        
        console.log('');
        console.log(`   📊 TOTALE KLINES DA ELIMINARE: ${totalKlinesToDelete.toLocaleString()}`);
        console.log('');

        // 4. Conferma eliminazione
        console.log('⚠️  4. CONFERMA ELIMINAZIONE');
        console.log('-'.repeat(80));
        console.log('');
        console.log(`   Stai per eliminare ${totalKlinesToDelete.toLocaleString()} klines per ${invalidSymbols.length} simboli non validi.`);
        console.log(`   Questa operazione è IRREVERSIBILE!`);
        console.log('');
        console.log('   Per procedere, esegui lo script con: node elimina-klines-simboli-non-validi.js --confirm');
        console.log('');

        // 5. Se --confirm, procedi con eliminazione
        if (process.argv.includes('--confirm')) {
            console.log('🗑️  5. ELIMINAZIONE IN CORSO...');
            console.log('-'.repeat(80));
            console.log('');

            let totalDeleted = 0;

            for (const { symbol, klinesCount } of invalidSymbols) {
                try {
                    const result = await dbRun('DELETE FROM klines WHERE symbol = $1', [symbol]);
                    const deleted = result.changes || 0;
                    
                    if (deleted > 0) {
                        console.log(`   ✅ ${symbol.padEnd(30)} → ${deleted.toLocaleString().padStart(8)} klines eliminate`);
                        totalDeleted += deleted;
                    }
                } catch (error) {
                    console.error(`   ❌ Errore eliminando ${symbol}:`, error.message);
                }
            }

            console.log('');
            console.log(`✅ Eliminazione completata! ${totalDeleted.toLocaleString()} klines eliminate.`);
            console.log('');
            console.log('💡 PROSSIMI PASSI:');
            console.log('   1. Verificare che i filtri nel codice funzionino');
            console.log('   2. Monitorare che le klines non vengano più create per simboli non validi');
            console.log('   3. Verificare che solo i 67 trading pairs unici abbiano klines');
        } else {
            console.log('💡 Per procedere con l\'eliminazione, esegui:');
            console.log(`   node elimina-klines-simboli-non-validi.js --confirm`);
        }

    } catch (error) {
        console.error('❌ Errore durante eliminazione:', error.message);
        console.error(error.stack);
    }
}

eliminaKlinesNonValide().catch(console.error);
