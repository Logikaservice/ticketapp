/**
 * 🔥 Disattiva e Rimuovi Simboli - Approccio Completo
 * 
 * 1. Disattiva i simboli in bot_settings (per evitare che il bot li ricrei)
 * 2. Rimuove i simboli da tutte le tabelle
 * 
 * Questo previene che il bot ricrei automaticamente i klines per questi simboli.
 */

const { dbAll, dbGet, dbRun } = require('./crypto_db');

// Lista simboli da mantenere
const SYMBOLS_TO_KEEP = [
    'aave', 'avax_usdt', 'binance_coin', 'bitcoin', 'bonk',
    'cardano', 'chainlink_usdt', 'ethereum', 'floki', 'gala',
    'imx', 'litecoin', 'mana', 'matic', 'pepe', 'polkadot',
    'pol_polygon', 'ripple', 'sand', 'sei', 'solana', 'uniswap'
].map(s => s.toLowerCase());

async function disableAndRemove() {
    console.log('🔥 DISATTIVAZIONE E RIMOZIONE SIMBOLI\n');
    console.log('='.repeat(80));
    console.log('Strategia:');
    console.log('  1. Disattiva simboli in bot_settings (previene ricreazione)');
    console.log('  2. Rimuove simboli da tutte le tabelle');
    console.log('='.repeat(80));
    
    try {
        // 1. Recupera tutti i simboli da bot_settings
        console.log('\n📊 Analisi simboli in bot_settings...\n');
        const allBotSettings = await dbAll(
            "SELECT symbol, is_active FROM bot_settings WHERE symbol != 'global' ORDER BY symbol"
        );
        
        console.log(`Trovati ${allBotSettings.length} simboli in bot_settings\n`);
        
        // 2. Identifica simboli da disattivare e rimuovere
        const symbolsToDisable = [];
        const symbolsToRemove = [];
        
        for (const row of allBotSettings) {
            const symbol = row.symbol;
            const symbolLower = symbol.toLowerCase().trim();
            const isActive = parseInt(row.is_active) === 1;
            
            // Salta se è da mantenere
            if (SYMBOLS_TO_KEEP.includes(symbolLower)) {
                continue;
            }
            
            // Se è attivo, disattivalo
            if (isActive) {
                symbolsToDisable.push(symbol);
            }
            
            // Aggiungi alla lista rimozione
            symbolsToRemove.push(symbol);
        }
        
        console.log(`🔴 Simboli da disattivare: ${symbolsToDisable.length}`);
        console.log(`🗑️  Simboli da rimuovere: ${symbolsToRemove.length}\n`);
        
        if (symbolsToRemove.length === 0) {
            console.log('✅ Nessun simbolo da rimuovere - già pulito!');
            return;
        }
        
        // 3. STEP 1: Disattiva simboli in bot_settings
        console.log('🔴 STEP 1: Disattivazione simboli in bot_settings...\n');
        let disabledCount = 0;
        
        for (const symbol of symbolsToDisable) {
            try {
                await dbRun(
                    "UPDATE bot_settings SET is_active = 0 WHERE symbol = $1",
                    [symbol]
                );
                console.log(`   ✅ Disattivato: ${symbol}`);
                disabledCount++;
            } catch (error) {
                console.error(`   ❌ Errore disattivazione ${symbol}: ${error.message}`);
            }
        }
        
        console.log(`\n✅ Disattivati ${disabledCount} simboli\n`);
        
        // 4. STEP 2: Rimuovi da tutte le tabelle
        console.log('🗑️  STEP 2: Rimozione simboli da tutte le tabelle...\n');
        
        const tables = ['bot_settings', 'bot_parameters', 'klines', 'market_data', 'open_positions'];
        const results = {};
        
        for (const table of tables) {
            console.log(`   Pulizia tabella: ${table}...`);
            let removed = 0;
            
            for (const symbol of symbolsToRemove) {
                try {
                    const result = await dbRun(
                        `DELETE FROM ${table} WHERE symbol = $1`,
                        [symbol]
                    );
                    removed += result.changes || 0;
                } catch (error) {
                    // Ignora errori se la colonna symbol non esiste
                    if (!error.message.includes('column') && !error.message.includes('does not exist')) {
                        console.error(`     ⚠️  Errore ${table} per ${symbol}: ${error.message}`);
                    }
                }
            }
            
            results[table] = removed;
            if (removed > 0) {
                console.log(`     ✅ Rimossi ${removed} record`);
            } else {
                console.log(`     ✅ Già pulito`);
            }
        }
        
        // 5. Riepilogo
        console.log('\n' + '='.repeat(80));
        console.log('📊 RIEPILOGO\n');
        console.log(`✅ Simboli disattivati: ${disabledCount}`);
        console.log(`✅ Simboli rimossi: ${symbolsToRemove.length}`);
        console.log(`\n📊 Record rimossi per tabella:`);
        Object.entries(results).forEach(([table, count]) => {
            console.log(`   - ${table}: ${count} record`);
        });
        
        // 6. Verifica finale
        console.log('\n🔍 Verifica finale...\n');
        
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
        
        if (remainingToRemove.length > 0) {
            console.log(`⚠️  Simboli ancora presenti in klines (${remainingToRemove.length}):`);
            remainingToRemove.forEach(({ symbol, count }) => {
                console.log(`   - ${symbol} (${count} record)`);
            });
            console.log('\n💡 Questi simboli potrebbero essere stati ricreati dal bot.');
            console.log('   Verifica che siano disattivati in bot_settings e riprova.');
        } else {
            console.log(`✅ PULIZIA COMPLETA! Nessun simbolo rimosso rimasto.`);
        }
        
        console.log('\n✅ Disattivazione e rimozione completata!');
        
    } catch (error) {
        console.error('❌ Errore durante la disattivazione/rimozione:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

disableAndRemove().catch(console.error);

