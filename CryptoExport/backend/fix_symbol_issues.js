/**
 * 🔧 Script per Risolvere Problemi Simboli
 * 
 * Risolve:
 * 1. Simboli senza bot configurato (crea entry in bot_settings)
 * 2. Simboli con klines insufficienti (suggerisce download)
 * 3. Volume 24h basso (non critico, ma segnala)
 */

const { dbAll, dbGet, dbRun } = require('./crypto_db');

async function fixSymbolIssues() {
    console.log('🔧 RISOLUZIONE PROBLEMI SIMBOLI');
    console.log('='.repeat(80));
    console.log('');

    try {
        // 1. Trova simboli senza bot configurato ma con klines
        console.log('📊 Verifica simboli senza bot configurato...');
        const klinesSymbols = await dbAll(
            "SELECT DISTINCT symbol, COUNT(*) as count FROM klines WHERE interval = '15m' GROUP BY symbol HAVING COUNT(*) >= 50"
        );

        const botSymbols = await dbAll(
            "SELECT DISTINCT symbol FROM bot_settings WHERE strategy_name = $1",
            ['RSI_Strategy']
        );

        const botSymbolsSet = new Set(botSymbols.map(row => row.symbol.toLowerCase()));

        const symbolsWithoutBot = klinesSymbols.filter(row => 
            !botSymbolsSet.has(row.symbol.toLowerCase())
        );

        if (symbolsWithoutBot.length > 0) {
            console.log(`   Trovati ${symbolsWithoutBot.length} simboli senza bot configurato:`);
            for (const row of symbolsWithoutBot) {
                console.log(`   - ${row.symbol} (${row.count} klines)`);
                
                // Crea entry in bot_settings
                try {
                    await dbRun(
                        `INSERT INTO bot_settings (strategy_name, symbol, is_active, parameters)
                         VALUES ($1, $2, $3, $4)
                         ON CONFLICT (strategy_name, symbol) DO NOTHING`,
                        [
                            'RSI_Strategy',
                            row.symbol,
                            0, // Inattivo di default (l'utente può attivarlo)
                            JSON.stringify({
                                rsi_period: 14,
                                rsi_oversold: 30,
                                rsi_overbought: 70,
                                stop_loss_pct: 2.5,
                                take_profit_pct: 4.0
                            })
                        ]
                    );
                    console.log(`     ✅ Bot configurato per ${row.symbol} (inattivo di default)`);
                } catch (error) {
                    console.log(`     ❌ Errore creazione bot per ${row.symbol}: ${error.message}`);
                }
            }
        } else {
            console.log('   ✅ Tutti i simboli con klines hanno bot configurato');
        }
        console.log('');

        // 2. Trova simboli con klines insufficienti
        console.log('📊 Verifica simboli con klines insufficienti...');
        const symbolsWithLowKlines = await dbAll(
            "SELECT symbol, COUNT(*) as count FROM klines WHERE interval = '15m' GROUP BY symbol HAVING COUNT(*) < 50"
        );

        if (symbolsWithLowKlines.length > 0) {
            console.log(`   Trovati ${symbolsWithLowKlines.length} simboli con klines insufficienti (< 50):`);
            symbolsWithLowKlines.forEach(row => {
                console.log(`   - ${row.symbol}: ${row.count} klines (minimo 50 richiesto)`);
            });
            console.log('');
            console.log('   💡 Suggerimento: Esegui per scaricare klines mancanti:');
            console.log(`      node download_klines.js ${symbolsWithLowKlines.map(r => r.symbol).join(' ')}`);
        } else {
            console.log('   ✅ Tutti i simboli hanno klines sufficienti');
        }
        console.log('');

        // 3. Trova simboli con volume 24h basso (non critico, ma segnala)
        console.log('📊 Verifica simboli con volume 24h basso...');
        try {
            const lowVolumeSymbols = await dbAll(
                "SELECT symbol, volume_24h FROM market_data WHERE volume_24h < 500000 ORDER BY volume_24h DESC"
            );

            if (lowVolumeSymbols.length > 0) {
                console.log(`   Trovati ${lowVolumeSymbols.length} simboli con volume < $500,000:`);
                lowVolumeSymbols.slice(0, 10).forEach(row => {
                    console.log(`   - ${row.symbol}: $${parseFloat(row.volume_24h).toLocaleString()}`);
                });
                if (lowVolumeSymbols.length > 10) {
                    console.log(`   ... e altri ${lowVolumeSymbols.length - 10} simboli`);
                }
                console.log('');
                console.log('   ⚠️ Nota: Volume basso non è critico, ma il bot potrebbe non aprire posizioni');
                console.log('      (il bot richiede minimo $500,000 volume 24h)');
            } else {
                console.log('   ✅ Tutti i simboli hanno volume 24h sufficiente');
            }
        } catch (error) {
            if (error.message.includes('does not exist')) {
                console.log('   ⚠️ Tabella market_data non esiste - Esegui: node populate_market_data.js');
            } else {
                console.log(`   ⚠️ Errore verifica volume: ${error.message}`);
            }
        }
        console.log('');

        // 4. Report finale
        console.log('='.repeat(80));
        console.log('📋 REPORT FINALE');
        console.log('='.repeat(80));
        console.log(`✅ Simboli con bot configurato: ${botSymbols.length}`);
        console.log(`📊 Simboli con klines: ${klinesSymbols.length}`);
        console.log(`🔧 Bot creati: ${symbolsWithoutBot.length}`);
        console.log('');

        if (symbolsWithoutBot.length > 0 || symbolsWithLowKlines.length > 0) {
            console.log('💡 PROSSIMI PASSI:');
            if (symbolsWithoutBot.length > 0) {
                console.log('1. Attiva i bot per i simboli che vuoi monitorare:');
                console.log('   UPDATE bot_settings SET is_active = 1 WHERE symbol IN (...);');
            }
            if (symbolsWithLowKlines.length > 0) {
                console.log('2. Scarica klines mancanti:');
                console.log(`   node download_klines.js ${symbolsWithLowKlines.map(r => r.symbol).join(' ')}`);
            }
        } else {
            console.log('✅ Tutti i problemi critici sono stati risolti!');
        }
        console.log('');

    } catch (error) {
        console.error('❌ Errore durante risoluzione problemi:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

fixSymbolIssues().catch(console.error);

