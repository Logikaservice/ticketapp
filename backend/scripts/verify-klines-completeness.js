/**
 * 🔍 Script per verificare completezza klines
 * 
 * Verifica che tutti i klines siano presenti per i simboli attivi
 * Esegui con: node backend/scripts/verify-klines-completeness.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const KlinesVerificationService = require('../services/KlinesVerificationService');

async function main() {
    console.log('\n' + '='.repeat(70));
    console.log('🔍 VERIFICA COMPLETEZZA KLINES');
    console.log('='.repeat(70) + '\n');

    try {
        const verification = await KlinesVerificationService.verifyKlinesCompleteness();

        // Mostra risultato generale
        console.log('📊 RISULTATO GENERALE:');
        console.log('─'.repeat(70));
        if (verification.healthy) {
            console.log('✅ ' + verification.message);
        } else {
            console.log('❌ ' + verification.message);
        }
        console.log('');

        // Mostra dettagli
        if (verification.details) {
            const { activeSymbols, checkedSymbols, issues, recentKlines, symbolDetails } = verification.details;

            console.log('📈 STATISTICHE:');
            console.log('─'.repeat(70));
            console.log(`   • Simboli attivi: ${activeSymbols}`);
            console.log(`   • Simboli verificati: ${checkedSymbols}`);
            console.log(`   • Simboli con problemi: ${issues.length}`);
            console.log('');

            // Mostra verifica klines recenti
            if (recentKlines) {
                console.log('⏰ KLINES RECENTI (ultima ora):');
                console.log('─'.repeat(70));
                if (recentKlines.healthy) {
                    console.log(`   ✅ ${recentKlines.message}`);
                } else {
                    console.log(`   ❌ ${recentKlines.message}`);
                }
                console.log('');
            }

            // Mostra problemi per simbolo
            if (issues.length > 0) {
                console.log('⚠️  PROBLEMI RILEVATI:');
                console.log('─'.repeat(70));
                issues.forEach((issue, idx) => {
                    console.log(`\n   ${idx + 1}. Simbolo: ${issue.symbol}`);
                    issue.problems.forEach((problem, pIdx) => {
                        console.log(`      ${pIdx + 1}. ${problem.interval}: ${problem.problem}`);
                        if (problem.details) {
                            const d = problem.details;
                            if (d.totalKlines !== undefined) {
                                console.log(`         • Totale klines: ${d.totalKlines}`);
                            }
                            if (d.recentKlines !== undefined) {
                                console.log(`         • Klines recenti (24h): ${d.recentKlines}`);
                            }
                            if (d.gapHours) {
                                console.log(`         • Gap temporale: ${d.gapHours}h`);
                            }
                            if (d.lastKlineTime) {
                                console.log(`         • Ultima kline: ${d.lastKlineTime}`);
                            }
                        }
                    });
                });
                console.log('');
            }

            // Mostra dettagli per ogni simbolo (se richiesto)
            if (process.argv.includes('--verbose') || process.argv.includes('-v')) {
                console.log('📋 DETTAGLI COMPLETI PER SIMBOLO:');
                console.log('─'.repeat(70));
                Object.entries(symbolDetails).forEach(([symbol, details]) => {
                    console.log(`\n   ${symbol}:`);
                    Object.entries(details.intervalDetails).forEach(([interval, intervalInfo]) => {
                        const status = intervalInfo.healthy ? '✅' : '❌';
                        console.log(`      ${status} ${interval}:`);
                        console.log(`         • Totale: ${intervalInfo.totalKlines || 0} klines`);
                        console.log(`         • Recenti (24h): ${intervalInfo.recentKlines || 0}`);
                        if (intervalInfo.gapHours) {
                            console.log(`         • Gap: ${intervalInfo.gapHours}h`);
                        }
                        if (intervalInfo.lastKlineTime) {
                            console.log(`         • Ultima: ${intervalInfo.lastKlineTime}`);
                        }
                        if (intervalInfo.issue) {
                            console.log(`         • Problema: ${intervalInfo.issue}`);
                        }
                    });
                });
                console.log('');
            }
        }

        // Conclusione
        console.log('='.repeat(70));
        if (verification.healthy) {
            console.log('✅ AGGREGATORE KLINES: FUNZIONA CORRETTAMENTE');
        } else {
            console.log('❌ AGGREGATORE KLINES: PROBLEMI RILEVATI');
            console.log('\n💡 Suggerimenti:');
            console.log('   • Verifica che il WebSocket sia attivo');
            console.log('   • Verifica che l\'aggregatore sia avviato');
            console.log('   • Controlla i log del backend per errori');
            console.log('   • Esegui: node backend/scripts/download-missing-klines.js per recuperare dati mancanti');
        }
        console.log('='.repeat(70) + '\n');

        // Exit code
        process.exit(verification.healthy ? 0 : 1);
    } catch (error) {
        console.error('\n❌ ERRORE:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Esegui
main();
