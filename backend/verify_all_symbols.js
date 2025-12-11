/**
 * 🔍 Script di Verifica Completa Simboli
 * 
 * Verifica per ogni simbolo:
 * 1. Configurazione bot (bot_settings)
 * 2. Parametri personalizzati (bot_parameters)
 * 3. Klines disponibili
 * 4. Market data (volume 24h)
 * 5. Correttezza scrittura nel database
 */

const { dbAll, dbGet } = require('./crypto_db');

// Simboli comuni da verificare
const COMMON_SYMBOLS = [
    'bitcoin', 'ethereum', 'solana', 'cardano', 'polkadot',
    'ripple', 'chainlink', 'litecoin', 'binance_coin',
    'avax_usdt', 'sand', 'uniswap', 'aave', 'mana', 'bonk'
];

async function verifySymbol(symbol) {
    const issues = [];
    const info = {
        symbol: symbol,
        botConfigured: false,
        botActive: false,
        hasParameters: false,
        klinesCount: 0,
        hasMarketData: false,
        volume24h: 0,
        lastKlineTime: null,
        lastMarketDataTime: null
    };

    try {
        // 1. Verifica bot_settings
        const botSettings = await dbAll(
            "SELECT * FROM bot_settings WHERE symbol = $1 AND strategy_name = $2",
            [symbol, 'RSI_Strategy']
        );

        if (botSettings.length > 0) {
            info.botConfigured = true;
            info.botActive = botSettings[0].is_active === 1;
        } else {
            issues.push('❌ Bot non configurato in bot_settings');
        }

        // 2. Verifica bot_parameters
        try {
            const botParams = await dbGet(
                "SELECT * FROM bot_parameters WHERE symbol = $1",
                [symbol]
            );

            if (botParams) {
                info.hasParameters = true;
                info.minStrength = botParams.min_signal_strength;
                info.minConfirmationsLong = botParams.min_confirmations_long;
                info.minConfirmationsShort = botParams.min_confirmations_short;
            } else {
                issues.push('⚠️ Nessun parametro personalizzato (usa default)');
            }
        } catch (error) {
            if (error.message.includes('does not exist')) {
                issues.push('❌ Tabella bot_parameters non esiste');
            } else {
                issues.push(`⚠️ Errore verifica parametri: ${error.message}`);
            }
        }

        // 3. Verifica klines
        try {
            const klines = await dbAll(
                "SELECT COUNT(*) as count, MAX(open_time) as last_time FROM klines WHERE symbol = $1 AND interval = $2",
                [symbol, '15m']
            );

            if (klines.length > 0) {
                info.klinesCount = parseInt(klines[0].count) || 0;
                info.lastKlineTime = klines[0].last_time;

                if (info.klinesCount < 50) {
                    issues.push(`⚠️ Klines insufficienti: ${info.klinesCount}/50 (minimo richiesto)`);
                } else if (info.klinesCount < 100) {
                    issues.push(`⚠️ Klines limitate: ${info.klinesCount} (consigliato almeno 100)`);
                }
            } else {
                issues.push('❌ Nessuna kline trovata');
            }
        } catch (error) {
            issues.push(`❌ Errore verifica klines: ${error.message}`);
        }

        // 4. Verifica market_data
        try {
            const marketData = await dbGet(
                "SELECT volume_24h, timestamp FROM market_data WHERE symbol = $1 ORDER BY timestamp DESC LIMIT 1",
                [symbol]
            );

            if (marketData) {
                info.hasMarketData = true;
                info.volume24h = parseFloat(marketData.volume_24h) || 0;
                info.lastMarketDataTime = marketData.timestamp;

                if (info.volume24h < 500000) {
                    issues.push(`⚠️ Volume 24h basso: $${info.volume24h.toLocaleString()} (minimo $500,000)`);
                }
            } else {
                issues.push('⚠️ Nessun dato market_data disponibile');
            }
        } catch (error) {
            if (error.message.includes('does not exist')) {
                issues.push('❌ Tabella market_data non esiste');
            } else {
                issues.push(`⚠️ Errore verifica market_data: ${error.message}`);
            }
        }

        // 5. Verifica correttezza scrittura simbolo
        // Controlla se il simbolo appare in altre tabelle con formati diversi
        const symbolVariations = [
            symbol,
            symbol.replace('_usdt', ''),
            symbol.replace('_usdt', '_USDT'),
            symbol.toUpperCase(),
            symbol.toLowerCase()
        ];

        const foundVariations = [];
        for (const variation of symbolVariations) {
            if (variation === symbol) continue;

            const checkKlines = await dbAll(
                "SELECT COUNT(*) as count FROM klines WHERE symbol = $1 LIMIT 1",
                [variation]
            ).catch(() => []);

            if (checkKlines.length > 0 && parseInt(checkKlines[0].count) > 0) {
                foundVariations.push(variation);
            }
        }

        if (foundVariations.length > 0) {
            issues.push(`⚠️ Trovate variazioni del simbolo: ${foundVariations.join(', ')}`);
        }

    } catch (error) {
        issues.push(`❌ Errore generale: ${error.message}`);
    }

    return { info, issues };
}

async function main() {
    console.log('🔍 VERIFICA COMPLETA SIMBOLI NEL DATABASE');
    console.log('='.repeat(80));
    console.log('');

    try {
        // 1. Recupera tutti i simboli da bot_settings
        const allBotSymbols = await dbAll(
            "SELECT DISTINCT symbol FROM bot_settings WHERE strategy_name = $1",
            ['RSI_Strategy']
        );

        // 2. Combina con simboli comuni
        const symbolsToCheck = new Set();
        
        allBotSymbols.forEach(row => symbolsToCheck.add(row.symbol));
        COMMON_SYMBOLS.forEach(s => symbolsToCheck.add(s));

        const symbolsArray = Array.from(symbolsToCheck).sort();

        console.log(`📊 Simboli da verificare: ${symbolsArray.length}`);
        console.log(`   ${symbolsArray.join(', ')}`);
        console.log('');

        const results = [];
        let totalIssues = 0;
        let symbolsWithIssues = 0;

        // 3. Verifica ogni simbolo
        for (const symbol of symbolsArray) {
            console.log(`\n🔍 Verifica ${symbol.toUpperCase()}...`);
            const { info, issues } = await verifySymbol(symbol);

            if (issues.length > 0) {
                symbolsWithIssues++;
                totalIssues += issues.length;
                console.log(`   ❌ Trovati ${issues.length} problemi:`);
                issues.forEach(issue => console.log(`      ${issue}`));
            } else {
                console.log(`   ✅ Tutto OK`);
            }

            // Mostra info
            if (info.botConfigured) {
                console.log(`   📊 Bot: ${info.botActive ? '✅ Attivo' : '⏸️ Inattivo'}`);
            }
            if (info.klinesCount > 0) {
                console.log(`   📈 Klines: ${info.klinesCount}`);
            }
            if (info.hasMarketData && info.volume24h > 0) {
                console.log(`   💰 Volume 24h: $${info.volume24h.toLocaleString()}`);
            }

            results.push({ symbol, info, issues });
        }

        // 4. Report finale
        console.log('\n');
        console.log('='.repeat(80));
        console.log('📋 REPORT FINALE');
        console.log('='.repeat(80));
        console.log(`✅ Simboli verificati: ${symbolsArray.length}`);
        console.log(`⚠️ Simboli con problemi: ${symbolsWithIssues}`);
        console.log(`❌ Problemi totali: ${totalIssues}`);
        console.log('');

        if (symbolsWithIssues > 0) {
            console.log('🔧 SIMBOLI CON PROBLEMI:');
            results
                .filter(r => r.issues.length > 0)
                .forEach(({ symbol, issues }) => {
                    console.log(`\n   ${symbol.toUpperCase()}:`);
                    issues.forEach(issue => console.log(`      ${issue}`));
                });
        }

        // 5. Verifica tabelle database
        console.log('\n');
        console.log('📊 VERIFICA TABELLE DATABASE:');
        
        const tablesToCheck = ['bot_settings', 'bot_parameters', 'klines', 'market_data', 'open_positions'];
        for (const table of tablesToCheck) {
            try {
                const count = await dbAll(`SELECT COUNT(*) as count FROM ${table} LIMIT 1`);
                const tableCount = count.length > 0 ? parseInt(count[0].count) : 0;
                console.log(`   ${table}: ${tableCount > 0 ? '✅' : '⚠️'} ${tableCount} record`);
            } catch (error) {
                if (error.message.includes('does not exist')) {
                    console.log(`   ${table}: ❌ Tabella non esiste`);
                } else {
                    console.log(`   ${table}: ⚠️ Errore: ${error.message}`);
                }
            }
        }

        console.log('\n');
        console.log('💡 SUGGERIMENTI:');
        if (symbolsWithIssues > 0) {
            console.log('1. Esegui: node init_missing_tables.js (per creare tabelle mancanti)');
            console.log('2. Verifica che i simboli siano scritti correttamente nel database');
            console.log('3. Scarica klines mancanti: node download_klines.js all');
        } else {
            console.log('✅ Tutti i simboli sono configurati correttamente!');
        }
        console.log('');

    } catch (error) {
        console.error('❌ Errore durante verifica:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

main().catch(console.error);

