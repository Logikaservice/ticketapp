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

// Estrai SYMBOL_TO_PAIR usando regex (non-greedy fino alla chiusura })
// Cerca dalla dichiarazione fino alla prima }; che chiude l'oggetto
const symbolMapMatch = cryptoRoutesContent.match(/const SYMBOL_TO_PAIR\s*=\s*\{([\s\S]*?)\n\};\n/);
if (!symbolMapMatch) {
    // Fallback: cerca con pattern più semplice
    const lines = cryptoRoutesContent.split('\n');
    let startLine = -1;
    let endLine = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('const SYMBOL_TO_PAIR') && lines[i].includes('=')) {
            startLine = i;
        }
        if (startLine >= 0 && lines[i].trim() === '};') {
            endLine = i;
            break;
        }
    }
    if (startLine >= 0 && endLine >= 0) {
        const symbolMapCode = lines.slice(startLine, endLine + 1).join('\n');
        eval(symbolMapCode);
    } else {
        console.error('❌ Impossibile trovare SYMBOL_TO_PAIR in cryptoRoutes.js');
        process.exit(1);
    }
} else {
    // Eval per ottenere l'oggetto (sicuro perché è codice del progetto stesso)
    const symbolMapCode = `const SYMBOL_TO_PAIR = {${symbolMapMatch[1]}};`;
    eval(symbolMapCode);
}

const VALID_SYMBOLS = new Set(Object.keys(SYMBOL_TO_PAIR));

async function main() {
    try {
        console.log('🔍 Verifica klines ricreate per simboli non validi...\n');

        // 1. Verifica simboli non validi in bot_settings
        console.log('📋 1. Verifica bot_settings...');
        const botSettings = await crypto_db.dbAll(
            "SELECT symbol, is_active, strategy_name FROM bot_settings WHERE symbol != 'global' ORDER BY symbol"
        );

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
        const allKlinesSymbols = await crypto_db.dbAll(
            "SELECT DISTINCT symbol FROM klines ORDER BY symbol"
        );

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
