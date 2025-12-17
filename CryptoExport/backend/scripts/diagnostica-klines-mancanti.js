/**
 * Script di diagnostica per verificare perché mancano klines per simboli validi
 * 
 * Verifica:
 * 1. Simboli validi senza klines nel database
 * 2. Mapping simboli (SYMBOL_TO_PAIR)
 * 3. Normalizzazione simboli
 * 4. Presenza in bot_settings
 * 5. Ultime klines create
 * 6. Problemi di normalizzazione
 */

const path = require('path');
const crypto_db = require('../crypto_db');

// Carica SYMBOL_TO_PAIR da cryptoRoutes
const cryptoRoutesPath = path.join(__dirname, '../routes/cryptoRoutes.js');
const fs = require('fs');
const cryptoRoutesContent = fs.readFileSync(cryptoRoutesPath, 'utf8');

// Estrai SYMBOL_TO_PAIR
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

if (startLine < 0 || endLine < 0) {
    console.error('❌ Impossibile trovare SYMBOL_TO_PAIR');
    process.exit(1);
}

const symbolMapCode = lines.slice(startLine, endLine + 1).join('\n');
eval(symbolMapCode);

const VALID_SYMBOLS = new Set(Object.keys(SYMBOL_TO_PAIR));

// Simboli da verificare (quelli con problemi nel output.txt)
const SYMBOLS_TO_CHECK = [
    'bitcoin', 'ethereum', 'binancecoin', 'polkadot', 'polygon', 
    'chainlink', 'litecoin', 'stellar', 'monero', 'tron', 
    'cosmos', 'algorand', 'vechain', 'filecoin', 'tezos', 
    'near', 'ape', 'ftm', 'uni', 'matic', 'link', 'ada', 'op'
];

async function main() {
    try {
        console.log('🔍 DIAGNOSTICA: Klines Mancanti per Simboli Validi\n');
        console.log('='.repeat(80));

        // 1. Verifica klines esistenti per simboli validi
        console.log('\n📊 1. Verifica klines nel database...\n');
        
        const allKlinesSymbols = await crypto_db.dbAll(
            "SELECT DISTINCT symbol, COUNT(*) as count FROM klines GROUP BY symbol ORDER BY symbol"
        );
        const klinesMap = new Map();
        allKlinesSymbols.forEach(row => {
            klinesMap.set(row.symbol, parseInt(row.count));
        });

        const symbolsWithoutKlines = [];
        const symbolsWithKlines = [];

        for (const symbol of SYMBOLS_TO_CHECK) {
            // Verifica tutte le varianti del simbolo
            const variants = [symbol, `${symbol}_usdt`, `${symbol}_eur`, symbol.toUpperCase()];
            let found = false;
            let foundSymbol = null;
            let count = 0;

            for (const variant of variants) {
                if (klinesMap.has(variant)) {
                    found = true;
                    foundSymbol = variant;
                    count = klinesMap.get(variant);
                    break;
                }
            }

            if (found) {
                symbolsWithKlines.push({ symbol, foundSymbol, count });
            } else {
                symbolsWithoutKlines.push(symbol);
            }
        }

        console.log(`✅ Simboli CON klines: ${symbolsWithKlines.length}`);
        symbolsWithKlines.forEach(s => {
            console.log(`   - ${s.symbol.padEnd(20)} → ${s.foundSymbol.padEnd(20)} (${s.count} klines)`);
        });

        console.log(`\n❌ Simboli SENZA klines: ${symbolsWithoutKlines.length}`);
        if (symbolsWithoutKlines.length > 0) {
            symbolsWithoutKlines.forEach(s => console.log(`   - ${s}`));
        }

        // 2. Verifica mapping SYMBOL_TO_PAIR
        console.log('\n\n🗺️  2. Verifica mapping SYMBOL_TO_PAIR...\n');
        
        for (const symbol of symbolsWithoutKlines) {
            const mapping = SYMBOL_TO_PAIR[symbol];
            const variants = [
                symbol,
                `${symbol}_usdt`,
                `${symbol}_eur`,
                symbol.toUpperCase(),
                symbol.replace('_', '')
            ];
            
            let foundMapping = null;
            let foundVariant = null;
            
            for (const variant of variants) {
                if (SYMBOL_TO_PAIR[variant]) {
                    foundMapping = SYMBOL_TO_PAIR[variant];
                    foundVariant = variant;
                    break;
                }
            }

            if (foundMapping) {
                console.log(`   ✅ ${symbol.padEnd(20)} → Mappato come "${foundVariant}" → ${foundMapping}`);
            } else {
                console.log(`   ❌ ${symbol.padEnd(20)} → NON TROVATO nella mappa`);
            }
        }

        // 3. Verifica normalizzazione (come viene salvato nel DB)
        console.log('\n\n🔧 3. Verifica normalizzazione simboli nel database...\n');
        
        // Cerca varianti nei klines
        for (const symbol of symbolsWithoutKlines) {
            const variants = [
                symbol.toLowerCase(),
                symbol.toLowerCase() + '_usdt',
                symbol.toLowerCase() + '_eur',
                symbol.toUpperCase(),
                symbol.replace('_', '').toLowerCase()
            ];

            const foundVariants = [];
            for (const variant of variants) {
                if (klinesMap.has(variant)) {
                    foundVariants.push({ variant, count: klinesMap.get(variant) });
                }
            }

            if (foundVariants.length > 0) {
                console.log(`   ⚠️  ${symbol.padEnd(20)} → Trovato come: ${foundVariants.map(f => `${f.variant} (${f.count})`).join(', ')}`);
            } else {
                console.log(`   ❌ ${symbol.padEnd(20)} → Nessuna variante trovata nel database`);
            }
        }

        // 4. Verifica bot_settings
        console.log('\n\n⚙️  4. Verifica bot_settings...\n');
        
        const botSettings = await crypto_db.dbAll(
            "SELECT symbol, is_active FROM bot_settings WHERE symbol != 'global' ORDER BY symbol"
        );
        const botSettingsMap = new Map();
        botSettings.forEach(b => botSettingsMap.set(b.symbol, b.is_active));

        for (const symbol of symbolsWithoutKlines) {
            const variants = [symbol, `${symbol}_usdt`, `${symbol}_eur`];
            let found = false;
            
            for (const variant of variants) {
                if (botSettingsMap.has(variant)) {
                    const isActive = botSettingsMap.get(variant);
                    console.log(`   ${isActive ? '🟢' : '🔴'} ${symbol.padEnd(20)} → Presente come "${variant}" (is_active: ${isActive})`);
                    found = true;
                    break;
                }
            }
            
            if (!found) {
                console.log(`   ⚪ ${symbol.padEnd(20)} → Non presente in bot_settings`);
            }
        }

        // 5. Verifica ultime klines create (per vedere se il bot sta creando klines)
        console.log('\n\n⏰ 5. Verifica ultime klines create (ultime 24 ore)...\n');
        
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        const recentKlines = await crypto_db.dbAll(
            "SELECT DISTINCT symbol, COUNT(*) as count FROM klines WHERE close_time >= $1 GROUP BY symbol ORDER BY count DESC",
            [oneDayAgo]
        );

        if (recentKlines.length > 0) {
            console.log(`   📊 Simboli con klines create nelle ultime 24 ore:`);
            recentKlines.slice(0, 20).forEach(row => {
                console.log(`      - ${row.symbol.padEnd(30)} (${row.count} klines)`);
            });
        } else {
            console.log('   ⚠️  Nessuna kline creata nelle ultime 24 ore');
        }

        // 6. Verifica simboli con più klines (per confronto)
        console.log('\n\n📈 6. Top 10 simboli con più klines (per confronto)...\n');
        
        const topKlines = await crypto_db.dbAll(
            "SELECT symbol, COUNT(*) as count FROM klines GROUP BY symbol ORDER BY count DESC LIMIT 10"
        );

        topKlines.forEach((row, idx) => {
            console.log(`   ${(idx + 1).toString().padStart(2)}. ${row.symbol.padEnd(30)} (${row.count} klines)`);
        });

        // 7. Riepilogo e raccomandazioni
        console.log('\n\n' + '='.repeat(80));
        console.log('📋 RIEPILOGO E RACCOMANDAZIONI\n');

        if (symbolsWithoutKlines.length > 0) {
            console.log(`❌ PROBLEMA: ${symbolsWithoutKlines.length} simboli validi senza klines nel database`);
            console.log('\n💡 POSSIBILI CAUSE:');
            console.log('   1. Simboli non normalizzati correttamente (es: "bitcoin" vs "bitcoin_usdt")');
            console.log('   2. Bot cycle non sta creando klines per questi simboli');
            console.log('   3. Simboli non presenti in bot_settings (quindi non processati)');
            console.log('   4. Errori durante la creazione delle klines');
            
            console.log('\n🔧 SOLUZIONI:');
            console.log('   1. Verificare normalizzazione simboli (come vengono salvati nel DB)');
            console.log('   2. Aggiungere entry in bot_settings per simboli mancanti');
            console.log('   3. Eseguire update_stale_klines.js per scaricare klines storiche');
            console.log('   4. Verificare log del bot per errori durante creazione klines');
        } else {
            console.log('✅ Tutti i simboli verificati hanno klines nel database');
        }

        console.log('\n✅ Diagnostica completata');

    } catch (error) {
        console.error('❌ Errore:', error);
        console.error(error.stack);
        process.exit(1);
    } finally {
        // Chiudi pool PostgreSQL se disponibile
        if (crypto_db.pool && typeof crypto_db.pool.end === 'function') {
            await crypto_db.pool.end();
        }
    }
}

main();
