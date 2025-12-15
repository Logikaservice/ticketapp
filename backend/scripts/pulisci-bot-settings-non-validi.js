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
