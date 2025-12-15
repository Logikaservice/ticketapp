/**
 * Script per eliminare entry in bot_settings per simboli non validi
 * 
 * Questo previene che il bot cycle processi simboli non validi e ricrei klines.
 * 
 * Uso: node scripts/pulisci-bot-settings-non-validi.js [--confirm]
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
    process.exit(1);
}

// Estrai e valuta il codice in un contesto isolato
let SYMBOL_TO_PAIR = {};
try {
    const symbolMapCode = lines.slice(startLine, endLine + 1).join('\n');
    // Usa Function constructor per creare un contesto isolato
    const func = new Function(symbolMapCode + '; return SYMBOL_TO_PAIR;');
    SYMBOL_TO_PAIR = func();
    
    if (!SYMBOL_TO_PAIR || typeof SYMBOL_TO_PAIR !== 'object' || Object.keys(SYMBOL_TO_PAIR).length === 0) {
        console.error('❌ SYMBOL_TO_PAIR non valido o vuoto');
        process.exit(1);
    }
} catch (error) {
    console.error('❌ Errore durante estrazione SYMBOL_TO_PAIR:', error.message);
    process.exit(1);
}

const VALID_SYMBOLS = new Set(Object.keys(SYMBOL_TO_PAIR));
const CONFIRM = process.argv.includes('--confirm');

async function main() {
    try {
        console.log('🔍 Verifica bot_settings per simboli non validi...\n');

        // Ottieni tutte le entry in bot_settings (escluso 'global')
        const botSettings = await crypto_db.dbAll(
            "SELECT symbol, is_active, strategy_name FROM bot_settings WHERE symbol != 'global' ORDER BY symbol"
        );

        // Identifica simboli non validi
        const invalidEntries = botSettings.filter(b => !VALID_SYMBOLS.has(b.symbol));

        if (invalidEntries.length === 0) {
            console.log('✅ Nessun simbolo non valido trovato in bot_settings');
            return;
        }

        console.log(`⚠️  TROVATI ${invalidEntries.length} simboli NON VALIDI in bot_settings:\n`);
        invalidEntries.forEach(b => {
            console.log(`   - ${b.symbol} (is_active: ${b.is_active}, strategy: ${b.strategy_name})`);
        });

        if (!CONFIRM) {
            console.log('\n⚠️  MODALITÀ DRY-RUN: Nessuna modifica effettuata');
            console.log('💡 Esegui con --confirm per eliminare queste entry:');
            console.log(`   node scripts/pulisci-bot-settings-non-validi.js --confirm`);
            return;
        }

        console.log('\n🗑️  Eliminazione entry non valide...\n');

        let deleted = 0;
        for (const entry of invalidEntries) {
            await crypto_db.dbRun(
                "DELETE FROM bot_settings WHERE symbol = $1 AND strategy_name = $2",
                [entry.symbol, entry.strategy_name]
            );
            console.log(`   ✅ Eliminato: ${entry.symbol} (strategy: ${entry.strategy_name})`);
            deleted++;
        }

        console.log(`\n✅ Eliminati ${deleted} entry da bot_settings`);
        console.log('💡 Il bot cycle non processerà più questi simboli non validi');

    } catch (error) {
        console.error('❌ Errore:', error);
        process.exit(1);
    } finally {
        await crypto_db.close();
    }
}

main();
