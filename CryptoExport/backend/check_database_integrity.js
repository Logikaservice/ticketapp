/**
 * 🔍 Script di Verifica Integrità Database
 * 
 * Verifica:
 * 1. Simboli duplicati con formati diversi
 * 2. Inconsistenze tra tabelle
 * 3. Simboli orfani (presenti in una tabella ma non in altre)
 * 4. Formati simboli non standard
 */

const { dbAll } = require('./crypto_db');

async function checkDatabaseIntegrity() {
    console.log('🔍 VERIFICA INTEGRITÀ DATABASE');
    console.log('='.repeat(80));
    console.log('');

    const issues = [];
    const warnings = [];

    try {
        // 1. Verifica simboli in bot_settings
        console.log('📊 Verifica bot_settings...');
        const botSettings = await dbAll(
            "SELECT symbol, is_active, strategy_name FROM bot_settings WHERE strategy_name = $1",
            ['RSI_Strategy']
        );

        const botSymbols = new Set();
        const botSymbolsMap = new Map();

        botSettings.forEach(row => {
            const symbol = row.symbol.toLowerCase();
            botSymbols.add(symbol);
            
            if (!botSymbolsMap.has(symbol)) {
                botSymbolsMap.set(symbol, []);
            }
            botSymbolsMap.get(symbol).push({
                original: row.symbol,
                is_active: row.is_active,
                strategy: row.strategy_name
            });
        });

        // Verifica duplicati con formati diversi
        botSymbolsMap.forEach((entries, normalizedSymbol) => {
            if (entries.length > 1) {
                const formats = entries.map(e => e.original);
                warnings.push(`⚠️ Simbolo ${normalizedSymbol} ha formati diversi in bot_settings: ${formats.join(', ')}`);
            }
        });

        console.log(`   ✅ Trovati ${botSettings.length} bot configurati per ${botSymbols.size} simboli unici`);
        console.log('');

        // 2. Verifica simboli in klines
        console.log('📊 Verifica klines...');
        const klinesSymbols = await dbAll(
            "SELECT DISTINCT symbol, COUNT(*) as count FROM klines GROUP BY symbol ORDER BY symbol"
        );

        const klinesSymbolsSet = new Set();
        const klinesCountMap = new Map();

        klinesSymbols.forEach(row => {
            const symbol = row.symbol.toLowerCase();
            klinesSymbolsSet.add(symbol);
            klinesCountMap.set(symbol, {
                original: row.symbol,
                count: parseInt(row.count)
            });
        });

        console.log(`   ✅ Trovati ${klinesSymbols.length} simboli con klines`);
        console.log('');

        // 3. Verifica simboli in market_data
        console.log('📊 Verifica market_data...');
        let marketDataSymbols = [];
        try {
            marketDataSymbols = await dbAll(
                "SELECT DISTINCT symbol, COUNT(*) as count FROM market_data GROUP BY symbol ORDER BY symbol"
            );
        } catch (error) {
            if (error.message.includes('does not exist')) {
                issues.push('❌ Tabella market_data non esiste');
            } else {
                warnings.push(`⚠️ Errore verifica market_data: ${error.message}`);
            }
        }

        const marketDataSymbolsSet = new Set();
        marketDataSymbols.forEach(row => {
            marketDataSymbolsSet.add(row.symbol.toLowerCase());
        });

        if (marketDataSymbols.length > 0) {
            console.log(`   ✅ Trovati ${marketDataSymbols.length} simboli con market_data`);
        } else {
            console.log(`   ⚠️ Nessun dato market_data trovato`);
        }
        console.log('');

        // 4. Verifica simboli in bot_parameters
        console.log('📊 Verifica bot_parameters...');
        let botParamsSymbols = [];
        try {
            botParamsSymbols = await dbAll(
                "SELECT DISTINCT symbol FROM bot_parameters ORDER BY symbol"
            );
        } catch (error) {
            if (error.message.includes('does not exist')) {
                issues.push('❌ Tabella bot_parameters non esiste');
            } else {
                warnings.push(`⚠️ Errore verifica bot_parameters: ${error.message}`);
            }
        }

        const botParamsSymbolsSet = new Set();
        botParamsSymbols.forEach(row => {
            botParamsSymbolsSet.add(row.symbol.toLowerCase());
        });

        if (botParamsSymbols.length > 0) {
            console.log(`   ✅ Trovati ${botParamsSymbols.length} simboli con parametri personalizzati`);
        } else {
            console.log(`   ⚠️ Nessun parametro personalizzato trovato`);
        }
        console.log('');

        // 5. Verifica simboli in open_positions
        console.log('📊 Verifica open_positions...');
        const openPositions = await dbAll(
            "SELECT DISTINCT symbol, COUNT(*) as count FROM open_positions WHERE status = 'open' GROUP BY symbol"
        );

        const openPositionsSymbolsSet = new Set();
        openPositions.forEach(row => {
            openPositionsSymbolsSet.add(row.symbol.toLowerCase());
        });

        console.log(`   ✅ Trovati ${openPositions.length} simboli con posizioni aperte`);
        console.log('');

        // 6. Analisi incrociata - Simboli orfani
        console.log('🔍 Analisi incrociata...');
        console.log('');

        // Simboli in bot_settings ma senza klines
        const botWithoutKlines = Array.from(botSymbols).filter(s => !klinesSymbolsSet.has(s));
        if (botWithoutKlines.length > 0) {
            issues.push(`❌ ${botWithoutKlines.length} simboli in bot_settings senza klines: ${botWithoutKlines.join(', ')}`);
        }

        // Simboli con klines ma senza bot_settings
        const klinesWithoutBot = Array.from(klinesSymbolsSet).filter(s => !botSymbols.has(s));
        if (klinesWithoutBot.length > 0) {
            warnings.push(`⚠️ ${klinesWithoutBot.length} simboli con klines ma senza bot_settings: ${klinesWithoutBot.slice(0, 10).join(', ')}${klinesWithoutBot.length > 10 ? '...' : ''}`);
        }

        // Simboli con klines ma senza market_data
        const klinesWithoutMarketData = Array.from(klinesSymbolsSet).filter(s => !marketDataSymbolsSet.has(s));
        if (klinesWithoutMarketData.length > 0 && marketDataSymbols.length > 0) {
            warnings.push(`⚠️ ${klinesWithoutMarketData.length} simboli con klines ma senza market_data: ${klinesWithoutMarketData.slice(0, 10).join(', ')}${klinesWithoutMarketData.length > 10 ? '...' : ''}`);
        }

        // 7. Verifica formati simboli non standard
        console.log('🔍 Verifica formati simboli...');
        const allSymbols = new Set([...botSymbols, ...klinesSymbolsSet, ...marketDataSymbolsSet, ...botParamsSymbolsSet]);
        
        const formatIssues = [];
        allSymbols.forEach(symbol => {
            // Verifica se il simbolo ha formati diversi nelle varie tabelle
            const formats = new Set();
            
            // Formato in bot_settings
            botSettings.forEach(row => {
                if (row.symbol.toLowerCase() === symbol) {
                    formats.add(row.symbol);
                }
            });
            
            // Formato in klines
            klinesSymbols.forEach(row => {
                if (row.symbol.toLowerCase() === symbol) {
                    formats.add(row.symbol);
                }
            });
            
            // Formato in market_data
            marketDataSymbols.forEach(row => {
                if (row.symbol.toLowerCase() === symbol) {
                    formats.add(row.symbol);
                }
            });
            
            if (formats.size > 1) {
                formatIssues.push({
                    symbol: symbol,
                    formats: Array.from(formats)
                });
            }
        });

        if (formatIssues.length > 0) {
            issues.push(`❌ ${formatIssues.length} simboli con formati inconsistenti:`);
            formatIssues.slice(0, 10).forEach(({ symbol, formats }) => {
                issues.push(`   - ${symbol}: ${formats.join(', ')}`);
            });
            if (formatIssues.length > 10) {
                issues.push(`   ... e altri ${formatIssues.length - 10} simboli`);
            }
        }

        // 8. Report finale
        console.log('='.repeat(80));
        console.log('📋 REPORT INTEGRITÀ DATABASE');
        console.log('='.repeat(80));
        console.log('');

        if (issues.length === 0 && warnings.length === 0) {
            console.log('✅ Database integro - Nessun problema trovato!');
        } else {
            if (issues.length > 0) {
                console.log(`❌ PROBLEMI CRITICI (${issues.length}):`);
                issues.forEach(issue => console.log(`   ${issue}`));
                console.log('');
            }

            if (warnings.length > 0) {
                console.log(`⚠️ AVVISI (${warnings.length}):`);
                warnings.forEach(warning => console.log(`   ${warning}`));
                console.log('');
            }
        }

        // Statistiche
        console.log('📊 STATISTICHE:');
        console.log(`   Bot configurati: ${botSettings.length}`);
        console.log(`   Simboli con klines: ${klinesSymbols.length}`);
        console.log(`   Simboli con market_data: ${marketDataSymbols.length}`);
        console.log(`   Simboli con parametri: ${botParamsSymbols.length}`);
        console.log(`   Simboli con posizioni aperte: ${openPositions.length}`);
        console.log('');

        // Top simboli per klines
        if (klinesSymbols.length > 0) {
            console.log('📈 TOP 10 SIMBOLI PER KLINE:');
            klinesSymbols
                .sort((a, b) => parseInt(b.count) - parseInt(a.count))
                .slice(0, 10)
                .forEach((row, idx) => {
                    console.log(`   ${idx + 1}. ${row.symbol}: ${parseInt(row.count).toLocaleString()} klines`);
                });
            console.log('');
        }

        // Suggerimenti
        if (issues.length > 0 || warnings.length > 0) {
            console.log('💡 SUGGERIMENTI:');
            if (issues.some(i => i.includes('non esiste'))) {
                console.log('1. Esegui: node init_missing_tables.js');
            }
            if (botWithoutKlines.length > 0) {
                console.log('2. Scarica klines mancanti: node download_klines.js <symbol>');
            }
            if (formatIssues.length > 0) {
                console.log('3. Normalizza formati simboli nel database');
            }
            console.log('');
        }

    } catch (error) {
        console.error('❌ Errore durante verifica integrità:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

checkDatabaseIntegrity().catch(console.error);

