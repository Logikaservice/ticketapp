/**
 * Script per analizzare PERCHÉ ci sono simboli non validi nel database
 * 
 * Verifica:
 * 1. Quali simboli non validi ci sono e dove (klines, bot_settings, price_history, ecc.)
 * 2. Quando sono stati creati (timestamp)
 * 3. Da dove potrebbero provenire (analisi pattern)
 * 4. Se sono presenti in altre tabelle
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

let SYMBOL_TO_PAIR = {};
try {
    const symbolMapCode = lines.slice(startLine, endLine + 1).join('\n');
    const func = new Function(symbolMapCode + '; return SYMBOL_TO_PAIR;');
    SYMBOL_TO_PAIR = func();
    
    if (!SYMBOL_TO_PAIR || typeof SYMBOL_TO_PAIR !== 'object' || Object.keys(SYMBOL_TO_PAIR).length === 0) {
        console.error('❌ SYMBOL_TO_PAIR non valido');
        process.exit(1);
    }
    
    console.log(`✅ SYMBOL_TO_PAIR caricato: ${Object.keys(SYMBOL_TO_PAIR).length} simboli`);
} catch (error) {
    console.error('❌ Errore estrazione SYMBOL_TO_PAIR:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
}

const VALID_SYMBOLS = new Set(Object.keys(SYMBOL_TO_PAIR));

async function main() {
    try {
        console.log('🔍 ANALISI APPROFONDITA: Simboli Non Validi nel Database\n');
        console.log('='.repeat(80));

        // 1. Trova tutti i simboli non validi in tutte le tabelle
        console.log('\n📊 1. RACCOLTA SIMBOLI DA TUTTE LE TABELLE...\n');

        // Klines
        const klinesSymbols = await crypto_db.dbAll(
            "SELECT DISTINCT symbol FROM klines ORDER BY symbol"
        );
        const klinesSet = new Set(klinesSymbols.map(r => r.symbol));

        // bot_settings
        const botSettingsSymbols = await crypto_db.dbAll(
            "SELECT DISTINCT symbol FROM bot_settings WHERE symbol != 'global' ORDER BY symbol"
        );
        const botSettingsSet = new Set(botSettingsSymbols.map(r => r.symbol));

        // price_history
        const priceHistorySymbols = await crypto_db.dbAll(
            "SELECT DISTINCT symbol FROM price_history ORDER BY symbol"
        );
        const priceHistorySet = new Set(priceHistorySymbols.map(r => r.symbol));

        // open_positions
        const positionsSymbols = await crypto_db.dbAll(
            "SELECT DISTINCT symbol FROM open_positions ORDER BY symbol"
        );
        const positionsSet = new Set(positionsSymbols.map(r => r.symbol));

        // symbol_volumes_24h
        const volumesSymbols = await crypto_db.dbAll(
            "SELECT DISTINCT symbol FROM symbol_volumes_24h ORDER BY symbol"
        );
        const volumesSet = new Set(volumesSymbols.map(r => r.symbol));

        // trades
        const tradesSymbols = await crypto_db.dbAll(
            "SELECT DISTINCT symbol FROM trades ORDER BY symbol"
        );
        const tradesSet = new Set(tradesSymbols.map(r => r.symbol));

        // 2. Identifica simboli non validi
        console.log('🔍 2. IDENTIFICAZIONE SIMBOLI NON VALIDI...\n');

        const allSymbols = new Set([
            ...klinesSet,
            ...botSettingsSet,
            ...priceHistorySet,
            ...positionsSet,
            ...volumesSet,
            ...tradesSet
        ]);

        const invalidSymbols = Array.from(allSymbols).filter(s => !VALID_SYMBOLS.has(s));

        if (invalidSymbols.length === 0) {
            console.log('✅ Nessun simbolo non valido trovato nel database!');
            return;
        }

        console.log(`🚨 TROVATI ${invalidSymbols.length} SIMBOLI NON VALIDI:\n`);
        console.log(invalidSymbols.join(', '));

        // 3. Analisi dettagliata per ogni simbolo
        console.log('\n\n📋 3. ANALISI DETTAGLIATA PER SIMBOLO...\n');
        console.log('='.repeat(80));

        for (const symbol of invalidSymbols) {
            console.log(`\n📌 ${symbol.toUpperCase()}`);
            console.log('-'.repeat(80));

            // Dove è presente
            const presentIn = [];
            if (klinesSet.has(symbol)) presentIn.push('klines');
            if (botSettingsSet.has(symbol)) presentIn.push('bot_settings');
            if (priceHistorySet.has(symbol)) presentIn.push('price_history');
            if (positionsSet.has(symbol)) presentIn.push('open_positions');
            if (volumesSet.has(symbol)) presentIn.push('symbol_volumes_24h');
            if (tradesSet.has(symbol)) presentIn.push('trades');

            console.log(`   📍 Presente in: ${presentIn.join(', ') || 'Nessuna tabella'}`);

            // Dettagli per tabella
            if (klinesSet.has(symbol)) {
                const count = await crypto_db.dbGet(
                    "SELECT COUNT(*) as count FROM klines WHERE symbol = $1",
                    [symbol]
                );
                const first = await crypto_db.dbGet(
                    "SELECT open_time, close_time FROM klines WHERE symbol = $1 ORDER BY open_time ASC LIMIT 1",
                    [symbol]
                );
                const last = await crypto_db.dbGet(
                    "SELECT open_time, close_time FROM klines WHERE symbol = $1 ORDER BY close_time DESC LIMIT 1",
                    [symbol]
                );

                console.log(`   📊 Klines: ${count.count} totali`);
                if (first) {
                    console.log(`      - Prima kline: ${new Date(parseInt(first.open_time)).toISOString()}`);
                }
                if (last) {
                    console.log(`      - Ultima kline: ${new Date(parseInt(last.close_time)).toISOString()}`);
                }
            }

            if (botSettingsSet.has(symbol)) {
                const settings = await crypto_db.dbGet(
                    "SELECT is_active, strategy_name, created_at FROM bot_settings WHERE symbol = $1",
                    [symbol]
                );
                console.log(`   ⚙️  bot_settings: is_active=${settings.is_active}, strategy=${settings.strategy_name}`);
                if (settings.created_at) {
                    console.log(`      - Creato: ${new Date(settings.created_at).toISOString()}`);
                }
            }

            if (priceHistorySet.has(symbol)) {
                const count = await crypto_db.dbGet(
                    "SELECT COUNT(*) as count FROM price_history WHERE symbol = $1",
                    [symbol]
                );
                const last = await crypto_db.dbGet(
                    "SELECT timestamp FROM price_history WHERE symbol = $1 ORDER BY timestamp DESC LIMIT 1",
                    [symbol]
                );
                console.log(`   💰 price_history: ${count.count} record`);
                if (last) {
                    console.log(`      - Ultimo aggiornamento: ${new Date(last.timestamp).toISOString()}`);
                }
            }

            if (positionsSet.has(symbol)) {
                const count = await crypto_db.dbGet(
                    "SELECT COUNT(*) as count FROM open_positions WHERE symbol = $1",
                    [symbol]
                );
                console.log(`   📈 open_positions: ${count.count} posizioni`);
            }

            // Analisi pattern del nome
            console.log(`   🔍 Analisi pattern:`);
            if (symbol.includes('_')) {
                const parts = symbol.split('_');
                console.log(`      - Contiene underscore: ${parts.join(' / ')}`);
                
                // Verifica se esiste una variante valida
                const variants = [
                    parts.join(''),
                    parts[0],
                    parts.join('_'),
                    symbol.toUpperCase(),
                    symbol.toLowerCase()
                ];
                
                const validVariants = variants.filter(v => VALID_SYMBOLS.has(v));
                if (validVariants.length > 0) {
                    console.log(`      - ⚠️  Varianti VALIDE trovate: ${validVariants.join(', ')}`);
                }
            }

            if (symbol.endsWith('usdt') || symbol.endsWith('eur')) {
                const base = symbol.replace(/_(usdt|eur)$/, '').replace(/(usdt|eur)$/, '');
                console.log(`      - Base symbol: ${base}`);
                if (VALID_SYMBOLS.has(base)) {
                    console.log(`      - ⚠️  Simbolo base "${base}" è VALIDO!`);
                }
            }

            // Verifica se è un alias comune
            const commonAliases = {
                'btc': 'bitcoin',
                'eth': 'ethereum',
                'sol': 'solana',
                'xrp': 'ripple',
                'bnb': 'binance_coin',
                'ada': 'cardano',
                'dot': 'polkadot',
                'avax': 'avalanche',
                'link': 'chainlink',
                'uni': 'uniswap',
                'doge': 'dogecoin',
                'shib': 'shiba_inu',
                'matic': 'polygon',
                'op': 'optimism',
                'arb': 'arbitrum'
            };

            if (commonAliases[symbol.toLowerCase()]) {
                const validName = commonAliases[symbol.toLowerCase()];
                console.log(`      - ⚠️  È un alias comune! Dovrebbe essere: "${validName}"`);
                if (VALID_SYMBOLS.has(validName)) {
                    console.log(`      - ✅ "${validName}" è presente in SYMBOL_TO_PAIR`);
                }
            }
        }

        // 4. Statistiche generali
        console.log('\n\n📈 4. STATISTICHE GENERALI\n');
        console.log('='.repeat(80));
        console.log(`   Simboli validi nella mappa: ${VALID_SYMBOLS.size}`);
        console.log(`   Simboli totali nel database: ${allSymbols.size}`);
        console.log(`   Simboli non validi: ${invalidSymbols.length}`);
        console.log(`\n   Distribuzione per tabella:`);
        console.log(`   - klines: ${klinesSymbols.length} simboli (${Array.from(klinesSet).filter(s => !VALID_SYMBOLS.has(s)).length} non validi)`);
        console.log(`   - bot_settings: ${botSettingsSymbols.length} simboli (${Array.from(botSettingsSet).filter(s => !VALID_SYMBOLS.has(s)).length} non validi)`);
        console.log(`   - price_history: ${priceHistorySymbols.length} simboli (${Array.from(priceHistorySet).filter(s => !VALID_SYMBOLS.has(s)).length} non validi)`);
        console.log(`   - open_positions: ${positionsSymbols.length} simboli (${Array.from(positionsSet).filter(s => !VALID_SYMBOLS.has(s)).length} non validi)`);
        console.log(`   - symbol_volumes_24h: ${volumesSymbols.length} simboli (${Array.from(volumesSet).filter(s => !VALID_SYMBOLS.has(s)).length} non validi)`);
        console.log(`   - trades: ${tradesSymbols.length} simboli (${Array.from(tradesSet).filter(s => !VALID_SYMBOLS.has(s)).length} non validi)`);

        // 5. Possibili cause
        console.log('\n\n🔍 5. POSSIBILI CAUSE\n');
        console.log('='.repeat(80));

        const causes = [];

        // Simboli con underscore che potrebbero essere normalizzati male
        const underscoreSymbols = invalidSymbols.filter(s => s.includes('_'));
        if (underscoreSymbols.length > 0) {
            causes.push(`- ${underscoreSymbols.length} simboli con underscore (potrebbero essere normalizzati male)`);
        }

        // Simboli che sono alias comuni
        const aliasSymbols = invalidSymbols.filter(s => commonAliases[s.toLowerCase()]);
        if (aliasSymbols.length > 0) {
            causes.push(`- ${aliasSymbols.length} simboli sono alias comuni (btc, eth, ecc.)`);
        }

        // Simboli in bot_settings (questi vengono processati dal bot)
        const inBotSettings = invalidSymbols.filter(s => botSettingsSet.has(s));
        if (inBotSettings.length > 0) {
            causes.push(`- ${inBotSettings.length} simboli in bot_settings (vengono processati dal bot cycle e possono creare klines)`);
        }

        // Simboli solo in klines (potrebbero essere stati creati da fonti esterne)
        const onlyInKlines = invalidSymbols.filter(s => klinesSet.has(s) && !botSettingsSet.has(s));
        if (onlyInKlines.length > 0) {
            causes.push(`- ${onlyInKlines.length} simboli solo in klines (potrebbero provenire da update_stale_klines.js o endpoint API)`);
        }

        if (causes.length > 0) {
            causes.forEach(c => console.log(`   ${c}`));
        } else {
            console.log('   Nessuna causa evidente identificata');
        }

        console.log('\n✅ Analisi completata');

    } catch (error) {
        console.error('❌ Errore:', error);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await crypto_db.close();
    }
}

main();
