/**
 * Script per verificare se klines sono state ricreate per simboli non validi
 * 
 * Verifica:
 * 1. Simboli non validi presenti in bot_settings
 * 2. Klines esistenti per simboli non validi
 * 3. Timestamp delle ultime klines create
 */

const path = require('path');
const crypto_db = require('../crypto_db');

// Carica SYMBOL_TO_PAIR da cryptoRoutes
const cryptoRoutesPath = path.join(__dirname, '../routes/cryptoRoutes.js');
const fs = require('fs');
const cryptoRoutesContent = fs.readFileSync(cryptoRoutesPath, 'utf8');

// Estrai SYMBOL_TO_PAIR analizzando le righe
const lines = cryptoRoutesContent.split('\n');
let startLine = -1;
let endLine = -1;

// Trova la riga di inizio (const SYMBOL_TO_PAIR = {)
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const SYMBOL_TO_PAIR') && lines[i].includes('=')) {
        startLine = i;
        break;
    }
}

// Trova la riga di fine (};)
if (startLine >= 0) {
    for (let i = startLine + 1; i < lines.length; i++) {
        if (lines[i].trim() === '};') {
            endLine = i;
            break;
        }
    }
}

if (startLine < 0 || endLine < 0) {
    console.error('❌ Impossibile trovare SYMBOL_TO_PAIR in cryptoRoutes.js');
    console.error(`   Start: ${startLine}, End: ${endLine}`);
    process.exit(1);
}

// Estrai e valuta il codice in un contesto isolato
let SYMBOL_TO_PAIR = {};
try {
    const symbolMapCode = lines.slice(startLine, endLine + 1).join('\n');
    // Usa Function constructor per creare un contesto isolato
    const func = new Function(symbolMapCode + '; return SYMBOL_TO_PAIR;');
    SYMBOL_TO_PAIR = func();
    
    // Verifica che SYMBOL_TO_PAIR sia stato creato
    if (!SYMBOL_TO_PAIR || typeof SYMBOL_TO_PAIR !== 'object') {
        console.error('❌ SYMBOL_TO_PAIR non definito o non valido dopo estrazione');
        process.exit(1);
    }
    
    const symbolCount = Object.keys(SYMBOL_TO_PAIR).length;
    if (symbolCount === 0) {
        console.error('❌ SYMBOL_TO_PAIR è vuoto');
        process.exit(1);
    }
    
    console.log(`✅ SYMBOL_TO_PAIR caricato: ${symbolCount} simboli`);
} catch (error) {
    console.error('❌ Errore durante estrazione SYMBOL_TO_PAIR:', error.message);
    console.error('   Stack:', error.stack);
    console.error('   Start line:', startLine + 1, 'End line:', endLine + 1);
    process.exit(1);
}

const VALID_SYMBOLS = new Set(Object.keys(SYMBOL_TO_PAIR));

async function main() {
    try {
        console.log('🔍 Verifica klines ricreate per simboli non validi...\n');

        // 1. Verifica simboli non validi in bot_settings
        console.log('📋 1. Verifica bot_settings...');
        let botSettings = [];
        try {
            botSettings = await crypto_db.dbAll(
                "SELECT symbol, is_active, strategy_name FROM bot_settings WHERE symbol != 'global' ORDER BY symbol"
            );
        } catch (error) {
            console.error('❌ Errore query bot_settings:', error.message);
            throw error;
        }

        const invalidInBotSettings = botSettings.filter(b => !VALID_SYMBOLS.has(b.symbol));
        
        if (invalidInBotSettings.length > 0) {
            console.log(`⚠️  TROVATI ${invalidInBotSettings.length} simboli NON VALIDI in bot_settings:`);
            invalidInBotSettings.forEach(b => {
                console.log(`   - ${b.symbol} (is_active: ${b.is_active}, strategy: ${b.strategy_name})`);
            });
        } else {
            console.log('✅ Nessun simbolo non valido in bot_settings');
        }

        // 2. Verifica klines per simboli non validi
        console.log('\n📊 2. Verifica klines esistenti...');
        let allKlinesSymbols = [];
        try {
            allKlinesSymbols = await crypto_db.dbAll(
                "SELECT DISTINCT symbol FROM klines ORDER BY symbol"
            );
        } catch (error) {
            console.error('❌ Errore query klines:', error.message);
            throw error;
        }

        const invalidKlinesSymbols = allKlinesSymbols
            .map(r => r.symbol)
            .filter(s => !VALID_SYMBOLS.has(s));

        if (invalidKlinesSymbols.length > 0) {
            console.log(`🚨 TROVATI ${invalidKlinesSymbols.length} simboli NON VALIDI con klines:`);
            
            for (const symbol of invalidKlinesSymbols) {
                // Conta klines
                const count = await crypto_db.dbGet(
                    "SELECT COUNT(*) as count FROM klines WHERE symbol = $1",
                    [symbol]
                );
                
                // Ultima kline creata
                const lastKline = await crypto_db.dbGet(
                    "SELECT open_time, close_time, interval FROM klines WHERE symbol = $1 ORDER BY close_time DESC LIMIT 1",
                    [symbol]
                );

                const lastUpdate = lastKline 
                    ? new Date(parseInt(lastKline.close_time)).toISOString()
                    : 'N/A';

                console.log(`\n   📌 ${symbol}:`);
                console.log(`      - Klines totali: ${count.count}`);
                console.log(`      - Ultimo aggiornamento: ${lastUpdate}`);
                
                // Verifica se è in bot_settings
                const inBotSettings = botSettings.find(b => b.symbol === symbol);
                if (inBotSettings) {
                    console.log(`      - ⚠️  PRESENTE in bot_settings (is_active: ${inBotSettings.is_active})`);
                }
            }
        } else {
            console.log('✅ Nessuna kline per simboli non validi');
        }

        // 3. Statistiche generali
        console.log('\n📈 3. Statistiche:');
        console.log(`   - Simboli validi nella mappa: ${VALID_SYMBOLS.size}`);
        console.log(`   - Simboli in bot_settings: ${botSettings.length}`);
        console.log(`   - Simboli con klines: ${allKlinesSymbols.length}`);
        console.log(`   - Simboli non validi con klines: ${invalidKlinesSymbols.length}`);

        // 4. Verifica timestamp recenti (ultime 24 ore)
        if (invalidKlinesSymbols.length > 0) {
            console.log('\n⏰ 4. Verifica klines create nelle ultime 24 ore...');
            const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
            
            for (const symbol of invalidKlinesSymbols) {
                const recentKlines = await crypto_db.dbGet(
                    "SELECT COUNT(*) as count FROM klines WHERE symbol = $1 AND close_time >= $2",
                    [symbol, oneDayAgo]
                );
                
                if (recentKlines.count > 0) {
                    console.log(`   🚨 ${symbol}: ${recentKlines.count} klines create nelle ultime 24 ore!`);
                }
            }
        }

        console.log('\n✅ Verifica completata');

    } catch (error) {
        console.error('❌ Errore:', error);
        process.exit(1);
    } finally {
        await crypto_db.close();
    }
}

main();
