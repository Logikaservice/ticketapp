/**
 * 🗑️ Script per Rimuovere Simboli EUR Non Disponibili su Binance
 * 
 * Rimuove i simboli EUR che non sono disponibili su Binance dal database:
 * - FLOKIEUR, BONKEUR, SANDEUR, MANAEUR, AAVEEUR, MAKEREUR, COMPEUR
 */

const { dbAll, dbRun, dbGet } = require('./crypto_db');

// Simboli EUR non disponibili su Binance
const UNAVAILABLE_EUR_SYMBOLS = [
    'flokieur',
    'bonkeur',
    'sandeur',
    'manaeur',
    'aaveeur',
    'makereur',
    'compeur'
];

// Varianti possibili (con underscore, maiuscole, ecc.)
const getSymbolVariants = (symbol) => {
    const base = symbol.toLowerCase();
    return [
        base,
        base.toUpperCase(),
        base.replace('eur', '_eur'),
        base.replace('eur', 'EUR'),
        base.replace('eur', '_EUR'),
        // Varianti con underscore all'inizio
        base.replace(/(\w)(eur)/, '$1_eur'),
        base.replace(/(\w)(EUR)/, '$1_EUR'),
    ];
};

async function removeUnavailableEurSymbols() {
    console.log('🗑️ RIMOZIONE SIMBOLI EUR NON DISPONIBILI SU BINANCE');
    console.log('='.repeat(80));
    console.log('');

    try {
        const allSymbolsToRemove = new Set();
        
        // 1. Trova tutte le varianti dei simboli nel database
        console.log('1️⃣ Ricerca simboli da rimuovere nel database...');
        for (const symbol of UNAVAILABLE_EUR_SYMBOLS) {
            const variants = getSymbolVariants(symbol);
            
            for (const variant of variants) {
                // Verifica in bot_settings
                const botSettings = await dbAll(
                    "SELECT symbol FROM bot_settings WHERE LOWER(symbol) = $1",
                    [variant.toLowerCase()]
                );
                
                if (botSettings.length > 0) {
                    botSettings.forEach(row => {
                        allSymbolsToRemove.add(row.symbol);
                        console.log(`   📊 Trovato in bot_settings: ${row.symbol}`);
                    });
                }
                
                // Verifica in klines
                const klines = await dbAll(
                    "SELECT DISTINCT symbol FROM klines WHERE LOWER(symbol) = $1 LIMIT 1",
                    [variant.toLowerCase()]
                );
                
                if (klines.length > 0) {
                    klines.forEach(row => {
                        allSymbolsToRemove.add(row.symbol);
                        console.log(`   📊 Trovato in klines: ${row.symbol}`);
                    });
                }
            }
        }
        
        const symbolsArray = Array.from(allSymbolsToRemove);
        console.log(`   ✅ Trovati ${symbolsArray.length} simboli da rimuovere: ${symbolsArray.join(', ')}`);
        console.log('');

        if (symbolsArray.length === 0) {
            console.log('✅ Nessun simbolo da rimuovere - il database è già pulito!');
            console.log('');
            return;
        }

        // 2. Conferma rimozione
        console.log('2️⃣ Rimozione simboli dalle tabelle...');
        console.log('');

        let totalRemoved = 0;

        for (const symbol of symbolsArray) {
            console.log(`   🗑️ Rimozione ${symbol}...`);
            let removed = 0;

            // Rimuovi da bot_settings
            try {
                const result = await dbRun(
                    "DELETE FROM bot_settings WHERE symbol = $1",
                    [symbol]
                );
                removed++;
                console.log(`      ✅ Rimosso da bot_settings`);
            } catch (error) {
                console.log(`      ⚠️ Errore rimozione da bot_settings: ${error.message}`);
            }

            // Rimuovi da bot_parameters
            try {
                await dbRun(
                    "DELETE FROM bot_parameters WHERE symbol = $1",
                    [symbol]
                );
                removed++;
                console.log(`      ✅ Rimosso da bot_parameters`);
            } catch (error) {
                // Ignora se tabella non esiste o errore
            }

            // Rimuovi da klines
            try {
                const klinesResult = await dbRun(
                    "DELETE FROM klines WHERE symbol = $1",
                    [symbol]
                );
                removed++;
                console.log(`      ✅ Rimosso da klines`);
            } catch (error) {
                console.log(`      ⚠️ Errore rimozione da klines: ${error.message}`);
            }

            // Rimuovi da market_data
            try {
                await dbRun(
                    "DELETE FROM market_data WHERE symbol = $1",
                    [symbol]
                );
                removed++;
                console.log(`      ✅ Rimosso da market_data`);
            } catch (error) {
                // Ignora se tabella non esiste o errore
            }

            // Rimuovi da open_positions (se ci sono posizioni aperte)
            try {
                const openPos = await dbAll(
                    "SELECT COUNT(*) as count FROM open_positions WHERE symbol = $1 AND status = 'open'",
                    [symbol]
                );
                const openCount = parseInt(openPos[0]?.count || 0);
                
                if (openCount > 0) {
                    console.log(`      ⚠️ ATTENZIONE: ${openCount} posizioni aperte per ${symbol} - NON rimosse`);
                    console.log(`      💡 Chiudi manualmente le posizioni prima di rimuovere il simbolo`);
                } else {
                    await dbRun(
                        "DELETE FROM open_positions WHERE symbol = $1",
                        [symbol]
                    );
                    removed++;
                    console.log(`      ✅ Rimosso da open_positions`);
                }
            } catch (error) {
                // Ignora se errore
            }

            totalRemoved += removed;
            console.log('');
        }

        // 3. Report finale
        console.log('='.repeat(80));
        console.log('✅ RIMOZIONE COMPLETATA');
        console.log('='.repeat(80));
        console.log('');
        console.log(`📊 Simboli rimossi: ${symbolsArray.length}`);
        console.log(`📊 Operazioni eseguite: ${totalRemoved}`);
        console.log('');
        console.log('💡 SUGGERIMENTI:');
        console.log('1. Verifica che non ci siano posizioni aperte per questi simboli');
        console.log('2. Esegui: node verify_all_symbols.js per verificare lo stato');
        console.log('3. I simboli EUR disponibili su Binance continueranno a funzionare normalmente');
        console.log('');

    } catch (error) {
        console.error('❌ Errore durante rimozione simboli:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

removeUnavailableEurSymbols().catch(console.error);

