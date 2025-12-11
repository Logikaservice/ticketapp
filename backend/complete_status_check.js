/**
 * 🔍 CHECK COMPLETO STATO SISTEMA
 * 
 * Verifica:
 * 1. Klines per tutti i simboli
 * 2. Bot attivo/disattivo per ogni simbolo
 * 3. Integrità database
 * 4. Parametri mancanti
 * 5. Problemi di configurazione
 */

const { dbAll, dbGet } = require('./crypto_db');

async function completeStatusCheck() {
    console.log('🔍 CHECK COMPLETO STATO SISTEMA');
    console.log('='.repeat(80));
    console.log('');

    const summary = {
        totalSymbols: 0,
        symbolsWithKlines: 0,
        symbolsWithoutKlines: [],
        activeBots: 0,
        inactiveBots: 0,
        symbolsWithoutBot: [],
        symbolsWithIssues: [],
        criticalIssues: [],
        warnings: []
    };

    try {
        // 1. Recupera tutti i simboli da bot_settings
        console.log('📊 Recupero simboli configurati...');
        const allBotSymbols = await dbAll(
            "SELECT DISTINCT symbol, is_active FROM bot_settings WHERE strategy_name = $1",
            ['RSI_Strategy']
        );

        summary.totalSymbols = allBotSymbols.length;
        console.log(`   ✅ Trovati ${allBotSymbols.length} simboli configurati`);
        console.log('');

        // 2. Verifica klines per ogni simbolo
        console.log('📈 Verifica klines per ogni simbolo...');
        const klinesCheck = await dbAll(
            `SELECT 
                symbol, 
                COUNT(*) as count,
                MAX(open_time) as last_time,
                MIN(open_time) as first_time
             FROM klines 
             WHERE interval = $1
             GROUP BY symbol
             ORDER BY symbol`,
            ['15m']
        );

        const klinesMap = new Map();
        klinesCheck.forEach(row => {
            klinesMap.set(row.symbol.toLowerCase(), {
                count: parseInt(row.count),
                lastTime: row.last_time,
                firstTime: row.first_time
            });
        });

        summary.symbolsWithKlines = klinesMap.size;
        console.log(`   ✅ Trovati ${klinesMap.size} simboli con klines`);
        console.log('');

        // 3. Verifica bot attivo/inattivo e klines
        console.log('🤖 Verifica stato bot e klines per simbolo...');
        console.log('');

        const symbolReports = [];

        for (const botRow of allBotSymbols) {
            const symbol = botRow.symbol;
            const isActive = botRow.is_active === 1;
            const symbolLower = symbol.toLowerCase();
            
            const report = {
                symbol: symbol,
                botActive: isActive,
                botConfigured: true,
                hasKlines: false,
                klinesCount: 0,
                klinesSufficient: false,
                hasParameters: false,
                hasMarketData: false,
                volume24h: 0,
                issues: [],
                warnings: []
            };

            // Conta bot attivi/inattivi
            if (isActive) {
                summary.activeBots++;
            } else {
                summary.inactiveBots++;
                report.warnings.push('⚠️ Bot disattivato');
            }

            // Verifica klines
            const klinesInfo = klinesMap.get(symbolLower);
            if (klinesInfo) {
                report.hasKlines = true;
                report.klinesCount = klinesInfo.count;
                report.klinesSufficient = klinesInfo.count >= 50;

                if (klinesInfo.count < 50) {
                    report.issues.push(`❌ Klines insufficienti: ${klinesInfo.count}/50`);
                } else if (klinesInfo.count < 100) {
                    report.warnings.push(`⚠️ Klines limitate: ${klinesInfo.count} (consigliato 100+)`);
                }
            } else {
                report.issues.push('❌ Nessuna kline trovata');
                summary.symbolsWithoutKlines.push(symbol);
            }

            // Verifica parametri personalizzati
            try {
                const botParams = await dbGet(
                    "SELECT * FROM bot_parameters WHERE symbol = $1",
                    [symbol]
                );
                if (botParams) {
                    report.hasParameters = true;
                }
            } catch (error) {
                // Non critico
            }

            // Verifica market_data
            try {
                const marketData = await dbGet(
                    "SELECT volume_24h FROM market_data WHERE symbol = $1 ORDER BY timestamp DESC LIMIT 1",
                    [symbol]
                );
                if (marketData) {
                    report.hasMarketData = true;
                    report.volume24h = parseFloat(marketData.volume_24h) || 0;
                    if (report.volume24h < 500000) {
                        report.warnings.push(`⚠️ Volume 24h basso: $${report.volume24h.toLocaleString()}`);
                    }
                }
            } catch (error) {
                // Non critico
            }

            // Aggiungi a summary se ha problemi
            if (report.issues.length > 0) {
                summary.symbolsWithIssues.push(symbol);
                summary.criticalIssues.push(`${symbol}: ${report.issues.join(', ')}`);
            }
            if (report.warnings.length > 0) {
                summary.warnings.push(`${symbol}: ${report.warnings.join(', ')}`);
            }

            symbolReports.push(report);
        }

        // 4. Verifica simboli con klines ma senza bot
        console.log('🔍 Verifica simboli orfani (klines senza bot)...');
        const orphanSymbols = [];
        klinesMap.forEach((info, symbol) => {
            const hasBot = allBotSymbols.some(b => b.symbol.toLowerCase() === symbol);
            if (!hasBot) {
                orphanSymbols.push(symbol);
            }
        });

        if (orphanSymbols.length > 0) {
            summary.warnings.push(`⚠️ ${orphanSymbols.length} simboli con klines ma senza bot configurato: ${orphanSymbols.slice(0, 10).join(', ')}${orphanSymbols.length > 10 ? '...' : ''}`);
        }
        console.log('');

        // 5. Report dettagliato per simbolo
        console.log('='.repeat(80));
        console.log('📋 REPORT DETTAGLIATO PER SIMBOLO');
        console.log('='.repeat(80));
        console.log('');

        // Ordina: prima quelli con problemi, poi per nome
        symbolReports.sort((a, b) => {
            if (a.issues.length !== b.issues.length) {
                return b.issues.length - a.issues.length;
            }
            return a.symbol.localeCompare(b.symbol);
        });

        for (const report of symbolReports) {
            const statusIcon = report.issues.length > 0 ? '❌' : report.warnings.length > 0 ? '⚠️' : '✅';
            console.log(`${statusIcon} ${report.symbol.toUpperCase()}`);
            
            // Stato bot
            console.log(`   Bot: ${report.botActive ? '✅ ATTIVO' : '⏸️ DISATTIVATO'}`);
            
            // Klines
            if (report.hasKlines) {
                console.log(`   Klines: ${report.klinesCount} ${report.klinesSufficient ? '✅' : '❌'}`);
            } else {
                console.log(`   Klines: ❌ Nessuna`);
            }
            
            // Parametri
            if (report.hasParameters) {
                console.log(`   Parametri: ✅ Personalizzati`);
            }
            
            // Market data
            if (report.hasMarketData) {
                console.log(`   Volume 24h: $${report.volume24h.toLocaleString()}`);
            }
            
            // Problemi
            if (report.issues.length > 0) {
                report.issues.forEach(issue => console.log(`   ${issue}`));
            }
            if (report.warnings.length > 0) {
                report.warnings.forEach(warning => console.log(`   ${warning}`));
            }
            
            console.log('');
        }

        // 6. Report riepilogativo
        console.log('='.repeat(80));
        console.log('📊 REPORT RIEPILOGATIVO');
        console.log('='.repeat(80));
        console.log('');
        console.log(`📈 Simboli totali configurati: ${summary.totalSymbols}`);
        console.log(`✅ Bot attivi: ${summary.activeBots}`);
        console.log(`⏸️ Bot disattivati: ${summary.inactiveBots}`);
        console.log(`📊 Simboli con klines: ${summary.symbolsWithKlines}`);
        console.log(`❌ Simboli senza klines: ${summary.symbolsWithoutKlines.length}`);
        if (summary.symbolsWithoutKlines.length > 0) {
            console.log(`   ${summary.symbolsWithoutKlines.join(', ')}`);
        }
        console.log(`⚠️ Simboli con problemi: ${summary.symbolsWithIssues.length}`);
        console.log('');

        // 7. Problemi critici
        if (summary.criticalIssues.length > 0) {
            console.log('❌ PROBLEMI CRITICI:');
            summary.criticalIssues.forEach(issue => console.log(`   ${issue}`));
            console.log('');
        }

        // 8. Avvisi
        if (summary.warnings.length > 0) {
            console.log('⚠️ AVVISI:');
            summary.warnings.slice(0, 20).forEach(warning => console.log(`   ${warning}`));
            if (summary.warnings.length > 20) {
                console.log(`   ... e altri ${summary.warnings.length - 20} avvisi`);
            }
            console.log('');
        }

        // 9. Verifica tabelle database
        console.log('📊 VERIFICA TABELLE DATABASE:');
        const tablesToCheck = ['bot_settings', 'bot_parameters', 'klines', 'market_data', 'open_positions'];
        for (const table of tablesToCheck) {
            try {
                const count = await dbAll(`SELECT COUNT(*) as count FROM ${table}`);
                const tableCount = count.length > 0 ? parseInt(count[0].count) : 0;
                console.log(`   ${table}: ${tableCount > 0 ? '✅' : '⚠️'} ${tableCount.toLocaleString()} record`);
            } catch (error) {
                if (error.message.includes('does not exist')) {
                    console.log(`   ${table}: ❌ Tabella non esiste`);
                    summary.criticalIssues.push(`Tabella ${table} non esiste`);
                } else {
                    console.log(`   ${table}: ⚠️ Errore: ${error.message}`);
                }
            }
        }
        console.log('');

        // 10. Statistiche klines
        if (klinesCheck.length > 0) {
            console.log('📈 TOP 10 SIMBOLI PER KLINE:');
            klinesCheck
                .sort((a, b) => parseInt(b.count) - parseInt(a.count))
                .slice(0, 10)
                .forEach((row, idx) => {
                    console.log(`   ${idx + 1}. ${row.symbol}: ${parseInt(row.count).toLocaleString()} klines`);
                });
            console.log('');
        }

        // 11. Suggerimenti
        console.log('💡 SUGGERIMENTI:');
        if (summary.symbolsWithoutKlines.length > 0) {
            console.log(`1. Scarica klines mancanti: node download_klines.js <symbol>`);
            console.log(`   Simboli da scaricare: ${summary.symbolsWithoutKlines.join(', ')}`);
        }
        if (summary.inactiveBots > 0) {
            console.log(`2. ${summary.inactiveBots} bot disattivati - Attivali se necessario`);
        }
        if (summary.criticalIssues.some(i => i.includes('non esiste'))) {
            console.log('3. Esegui: node init_missing_tables.js');
        }
        if (summary.criticalIssues.length === 0 && summary.warnings.length === 0) {
            console.log('✅ Sistema configurato correttamente!');
        }
        console.log('');

    } catch (error) {
        console.error('❌ Errore durante check completo:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

completeStatusCheck().catch(console.error);

