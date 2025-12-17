/**
 * OPTIMIZER - Trova la configurazione ottimale del bot
 * Testa diverse combinazioni di Stop Loss, Take Profit e Trailing Stop
 */

const AdvancedBacktestAnalyzer = require('./advanced_backtest_analyzer');
const { dbAll } = require('./crypto_db');

async function optimizeStrategy(symbol = 'bitcoin', days = 60) {
    console.log('\n🔬 STRATEGY OPTIMIZER - Ricerca configurazione ottimale\n');
    console.log('='.repeat(80));
    console.log(`Simbolo: ${symbol.toUpperCase()}`);
    console.log(`Periodo: ${days} giorni\n`);

    // Definisci le varianti da testare
    const configurations = [
        // Configurazione ATTUALE (baseline)
        { name: 'ATTUALE', stopLoss: 2, takeProfit: 3, trailing: 1.5 },

        // Varianti CONSERVATIVE (stop loss stretto, take profit piccolo)
        { name: 'Conservative 1', stopLoss: 1.5, takeProfit: 2, trailing: 1.0 },
        { name: 'Conservative 2', stopLoss: 2, takeProfit: 2.5, trailing: 1.5 },

        // Varianti BALANCED (equilibrio rischio/rendimento)
        { name: 'Balanced 1', stopLoss: 2.5, takeProfit: 3.5, trailing: 2.0 },
        { name: 'Balanced 2', stopLoss: 3, takeProfit: 4, trailing: 2.0 },
        { name: 'Balanced 3', stopLoss: 2.5, takeProfit: 4, trailing: 2.5 },

        // Varianti AGGRESSIVE (stop loss largo, take profit alto)
        { name: 'Aggressive 1', stopLoss: 3, takeProfit: 5, trailing: 2.5 },
        { name: 'Aggressive 2', stopLoss: 4, takeProfit: 6, trailing: 3.0 },
        { name: 'Aggressive 3', stopLoss: 5, takeProfit: 7, trailing: 3.5 },

        // Varianti TRAILING FOCUS (trailing stop dominante)
        { name: 'Trailing Focus 1', stopLoss: 2, takeProfit: 10, trailing: 3.0 },
        { name: 'Trailing Focus 2', stopLoss: 3, takeProfit: 15, trailing: 4.0 },

        // Varianti TIGHT (stop loss molto stretto)
        { name: 'Tight 1', stopLoss: 1, takeProfit: 1.5, trailing: 0.8 },
        { name: 'Tight 2', stopLoss: 1.5, takeProfit: 2.5, trailing: 1.2 },

        // Varianti WIDE (stop loss molto largo)
        { name: 'Wide 1', stopLoss: 6, takeProfit: 8, trailing: 4.0 },
        { name: 'Wide 2', stopLoss: 8, takeProfit: 10, trailing: 5.0 }
    ];

    console.log(`📊 Testando ${configurations.length} configurazioni diverse...\n`);

    const results = [];
    let testCount = 0;

    for (const config of configurations) {
        testCount++;
        console.log(`[${testCount}/${configurations.length}] Testing: ${config.name} (SL:${config.stopLoss}% TP:${config.takeProfit}% TS:${config.trailing}%)`);

        try {
            const analyzer = new AdvancedBacktestAnalyzer(symbol, 1000, 100);

            // Applica configurazione
            analyzer.config.stopLossPercent = config.stopLoss;
            analyzer.config.takeProfitPercent = config.takeProfit;
            analyzer.config.trailingStopPercent = config.trailing;

            // Esegui backtest (silenzioso)
            const originalLog = console.log;
            console.log = () => { }; // Silenzia output

            const result = await analyzer.runBacktest(days);

            console.log = originalLog; // Ripristina output

            // Salva risultati
            results.push({
                config: config,
                summary: result.summary,
                closureReasons: result.closureReasons
            });

            // Mostra risultato rapido
            const returnStr = result.summary.totalReturn >= 0 ? `+${result.summary.totalReturn.toFixed(2)}%` : `${result.summary.totalReturn.toFixed(2)}%`;
            const emoji = result.summary.totalReturn > 0 ? '✅' : result.summary.totalReturn < 0 ? '❌' : '⚪';
            console.log(`   ${emoji} Return: ${returnStr} | Win Rate: ${result.summary.winRate.toFixed(1)}% | PF: ${result.summary.profitFactor.toFixed(2)}\n`);

        } catch (error) {
            console.log(`   ❌ Errore: ${error.message}\n`);
        }
    }

    // Ordina per rendimento
    results.sort((a, b) => b.summary.totalReturn - a.summary.totalReturn);

    // Report finale
    console.log('\n' + '='.repeat(80));
    console.log('🏆 CLASSIFICA CONFIGURAZIONI (ordinate per Return)');
    console.log('='.repeat(80));

    console.log('\n┌────┬─────────────────────┬────────────────────────┬─────────┬──────────┬────────┐');
    console.log('│ Pos│ Nome                │ SL / TP / TS           │ Return  │ Win Rate │ Profit │');
    console.log('├────┼─────────────────────┼────────────────────────┼─────────┼──────────┼────────┤');

    results.forEach((r, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '  ';
        const configStr = `${r.config.stopLoss}% / ${r.config.takeProfit}% / ${r.config.trailing}%`;
        const returnStr = `${r.summary.totalReturn >= 0 ? '+' : ''}${r.summary.totalReturn.toFixed(2)}%`;
        const winRateStr = `${r.summary.winRate.toFixed(1)}%`;
        const pfStr = r.summary.profitFactor.toFixed(2);

        console.log(`│ ${medal}${(idx + 1).toString().padStart(2)} │ ${r.config.name.padEnd(19)} │ ${configStr.padEnd(22)} │ ${returnStr.padStart(7)} │ ${winRateStr.padStart(8)} │ ${pfStr.padStart(6)} │`);
    });

    console.log('└────┴─────────────────────┴────────────────────────┴─────────┴──────────┴────────┘');

    // Top 3 dettagliato
    console.log('\n' + '='.repeat(80));
    console.log('🏆 TOP 3 CONFIGURAZIONI - ANALISI DETTAGLIATA');
    console.log('='.repeat(80));

    results.slice(0, 3).forEach((r, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';

        console.log(`\n${medal} ${idx + 1}. ${r.config.name.toUpperCase()}`);
        console.log('─'.repeat(80));
        console.log(`Parametri: SL ${r.config.stopLoss}% | TP ${r.config.takeProfit}% | Trailing ${r.config.trailing}%`);
        console.log(`\nPerformance:`);
        console.log(`   Return: ${r.summary.totalReturn >= 0 ? '+' : ''}${r.summary.totalReturn.toFixed(2)}%`);
        console.log(`   Win Rate: ${r.summary.winRate.toFixed(1)}%`);
        console.log(`   Profit Factor: ${r.summary.profitFactor.toFixed(2)}`);
        console.log(`   Max Drawdown: ${r.summary.maxDrawdown.toFixed(2)}%`);
        console.log(`   Sharpe Ratio: ${r.summary.sharpeRatio.toFixed(2)}`);
        console.log(`   Trade Totali: ${r.summary.totalTrades}`);

        console.log(`\nMotivi Chiusura:`);
        Object.entries(r.closureReasons).forEach(([reason, count]) => {
            const pct = (count / r.summary.totalTrades * 100).toFixed(1);
            console.log(`   ${reason}: ${count} (${pct}%)`);
        });

        // Simulazione con $1080
        const profit1080 = 1080 * (r.summary.totalReturn / 100);
        console.log(`\nCon $1,080: ${profit1080 >= 0 ? '+' : ''}$${profit1080.toFixed(2)} → $${(1080 + profit1080).toFixed(2)}`);
    });

    // Confronto con configurazione attuale
    const currentConfig = results.find(r => r.config.name === 'ATTUALE');
    const bestConfig = results[0];

    console.log('\n' + '='.repeat(80));
    console.log('📊 CONFRONTO: ATTUALE vs MIGLIORE');
    console.log('='.repeat(80));

    if (currentConfig && bestConfig.config.name !== 'ATTUALE') {
        const improvement = bestConfig.summary.totalReturn - currentConfig.summary.totalReturn;
        const profit1080Current = 1080 * (currentConfig.summary.totalReturn / 100);
        const profit1080Best = 1080 * (bestConfig.summary.totalReturn / 100);
        const profitDiff = profit1080Best - profit1080Current;

        console.log(`\nCONFIGURAZIONE ATTUALE:`);
        console.log(`   SL ${currentConfig.config.stopLoss}% | TP ${currentConfig.config.takeProfit}% | Trailing ${currentConfig.config.trailing}%`);
        console.log(`   Return: ${currentConfig.summary.totalReturn >= 0 ? '+' : ''}${currentConfig.summary.totalReturn.toFixed(2)}%`);
        console.log(`   Con $1,080: ${profit1080Current >= 0 ? '+' : ''}$${profit1080Current.toFixed(2)}`);

        console.log(`\nCONFIGURAZIONE MIGLIORE: ${bestConfig.config.name}`);
        console.log(`   SL ${bestConfig.config.stopLoss}% | TP ${bestConfig.config.takeProfit}% | Trailing ${bestConfig.config.trailing}%`);
        console.log(`   Return: ${bestConfig.summary.totalReturn >= 0 ? '+' : ''}${bestConfig.summary.totalReturn.toFixed(2)}%`);
        console.log(`   Con $1,080: ${profit1080Best >= 0 ? '+' : ''}$${profit1080Best.toFixed(2)}`);

        console.log(`\n📈 MIGLIORAMENTO POTENZIALE:`);
        console.log(`   Return: ${improvement >= 0 ? '+' : ''}${improvement.toFixed(2)}%`);
        console.log(`   Profitto con $1,080: ${profitDiff >= 0 ? '+' : ''}$${profitDiff.toFixed(2)}`);
        console.log(`   Profitto mensile: ${profitDiff >= 0 ? '+' : ''}$${(profitDiff / 2).toFixed(2)}/mese`);

        if (improvement > 0.5) {
            console.log(`\n🎯 RACCOMANDAZIONE: CAMBIA configurazione!`);
            console.log(`   Adotta la configurazione "${bestConfig.config.name}" per migliorare le performance`);
        } else {
            console.log(`\n✅ La configurazione attuale è già ottima!`);
            console.log(`   Il miglioramento potenziale è marginale (${improvement.toFixed(2)}%)`);
        }
    } else if (bestConfig.config.name === 'ATTUALE') {
        console.log(`\n🎉 CONGRATULAZIONI!`);
        console.log(`   La tua configurazione ATTUALE è già la MIGLIORE!`);
        console.log(`   Non serve modificare nulla.`);
    }

    // Salva report
    const fs = require('fs');
    fs.writeFileSync('./optimization_report.json', JSON.stringify({
        symbol,
        period: `${days} days`,
        testDate: new Date().toISOString(),
        configurationsTest: configurations.length,
        results: results.map(r => ({
            name: r.config.name,
            stopLoss: r.config.stopLoss,
            takeProfit: r.config.takeProfit,
            trailing: r.config.trailing,
            return: r.summary.totalReturn,
            winRate: r.summary.winRate,
            profitFactor: r.summary.profitFactor,
            maxDrawdown: r.summary.maxDrawdown
        })),
        top3: results.slice(0, 3).map(r => r.config),
        currentConfig: currentConfig ? currentConfig.config : null,
        bestConfig: bestConfig.config,
        improvement: currentConfig ? bestConfig.summary.totalReturn - currentConfig.summary.totalReturn : null
    }, null, 2));

    console.log('\n' + '='.repeat(80));
    console.log('✅ Ottimizzazione completata!');
    console.log('📁 Report salvato in: optimization_report.json');
    console.log('='.repeat(80) + '\n');
}

// Esegui ottimizzazione
optimizeStrategy('bitcoin', 60).then(() => process.exit(0)).catch(err => {
    console.error('❌ Errore:', err);
    process.exit(1);
});
