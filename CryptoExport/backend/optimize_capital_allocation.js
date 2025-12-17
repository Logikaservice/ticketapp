/**
 * STRATEGIC CAPITAL ALLOCATION TEST
 * Ipotesi: Con $1080, possiamo allocare più capitale per trade
 * Approccio: Testa diverse dimensioni di posizione
 */

const AdvancedBacktestAnalyzer = require('./advanced_backtest_analyzer');

async function testCapitalAllocation(symbol = 'bitcoin', days = 60) {
    console.log('\n💰 ANALISI STRATEGICA: Allocazione Capitale Ottimale\n');
    console.log('='.repeat(80));
    console.log('🎯 Obiettivo: Massimizzare profitti con capitale $1,080\n');
    console.log('💡 Strategia: Testare diverse dimensioni di posizione\n');

    const initialCapital = 1080;

    // Scenari di allocazione
    const scenarios = [
        { name: 'Conservativo 10%', tradeSize: initialCapital * 0.10, description: '$108 per trade (10% capitale)' },
        { name: 'Moderato 20%', tradeSize: initialCapital * 0.20, description: '$216 per trade (20% capitale)' },
        { name: 'Balanced 30%', tradeSize: initialCapital * 0.30, description: '$324 per trade (30% capitale)' },
        { name: 'Aggressivo 50%', tradeSize: initialCapital * 0.50, description: '$540 per trade (50% capitale)' },
        { name: 'Molto Aggressivo 75%', tradeSize: initialCapital * 0.75, description: '$810 per trade (75% capitale)' },
        { name: 'All-In 100%', tradeSize: initialCapital * 1.00, description: '$1,080 per trade (100% capitale)' }
    ];

    console.log(`📊 Testando ${scenarios.length} strategie di allocazione...\n`);

    const results = [];

    for (const scenario of scenarios) {
        console.log(`[${scenarios.indexOf(scenario) + 1}/${scenarios.length}] ${scenario.name}`);
        console.log(`   ${scenario.description}`);

        try {
            const analyzer = new AdvancedBacktestAnalyzer(symbol, initialCapital, scenario.tradeSize);

            // Configurazione ottimale
            analyzer.config.stopLossPercent = 3;
            analyzer.config.takeProfitPercent = 15;
            analyzer.config.trailingStopPercent = 4;
            analyzer.config.minSignalStrength = 70;

            // Esegui backtest silenzioso
            const originalLog = console.log;
            console.log = () => { };
            const result = await analyzer.runBacktest(days);
            console.log = originalLog;

            results.push({
                scenario: scenario.name,
                tradeSize: scenario.tradeSize,
                tradeSizePercent: (scenario.tradeSize / initialCapital) * 100,
                summary: result.summary
            });

            // Mostra risultato
            const profit = result.summary.finalBalance - initialCapital;
            const returnStr = result.summary.totalReturn >= 0 ? `+${result.summary.totalReturn.toFixed(2)}%` : `${result.summary.totalReturn.toFixed(2)}%`;
            const profitStr = profit >= 0 ? `+$${profit.toFixed(2)}` : `-$${Math.abs(profit).toFixed(2)}`;
            const emoji = profit > 30 ? '🟢' : profit > 10 ? '✅' : profit > 0 ? '⚪' : '❌';

            console.log(`   ${emoji} Profitto: ${profitStr} (${returnStr}) | Win Rate: ${result.summary.winRate.toFixed(1)}%\n`);

        } catch (error) {
            console.log(`   ❌ Errore: ${error.message}\n`);
        }
    }

    // Classifica per profitto assoluto
    const sorted = [...results].sort((a, b) => (b.summary.finalBalance - initialCapital) - (a.summary.finalBalance - initialCapital));

    console.log('\n' + '='.repeat(80));
    console.log('🏆 CLASSIFICA PER PROFITTO ASSOLUTO');
    console.log('='.repeat(80));

    console.log('\n┌────┬─────────────────────────┬──────────────┬──────────────┬──────────────┬──────────┐');
    console.log('│ Pos│ Strategia               │ Size/Trade   │ Profitto     │ Return       │ Win Rate │');
    console.log('├────┼─────────────────────────┼──────────────┼──────────────┼──────────────┼──────────┤');

    sorted.forEach((r, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '  ';
        const profit = r.summary.finalBalance - initialCapital;
        const profitStr = `${profit >= 0 ? '+' : ''}$${profit.toFixed(2)}`;
        const returnStr = `${r.summary.totalReturn >= 0 ? '+' : ''}${r.summary.totalReturn.toFixed(2)}%`;
        const sizeStr = `$${r.tradeSize.toFixed(0)} (${r.tradeSizePercent.toFixed(0)}%)`;

        console.log(`│ ${medal}${(idx + 1).toString().padStart(2)} │ ${r.scenario.padEnd(23)} │ ${sizeStr.padStart(12)} │ ${profitStr.padStart(12)} │ ${returnStr.padStart(12)} │ ${r.summary.winRate.toFixed(1).padStart(8)}% │`);
    });

    console.log('└────┴─────────────────────────┴──────────────┴──────────────┴──────────────┴──────────┘');

    // Analisi rischio/rendimento
    console.log('\n' + '='.repeat(80));
    console.log('📊 ANALISI RISCHIO/RENDIMENTO');
    console.log('='.repeat(80));

    console.log('\n┌─────────────────────────┬──────────────┬──────────────┬──────────────┬──────────┐');
    console.log('│ Strategia               │ Max Drawdown │ Sharpe Ratio │ Profit Factor│ Rischio  │');
    console.log('├─────────────────────────┼──────────────┼──────────────┼──────────────┼──────────┤');

    sorted.forEach(r => {
        const ddStr = `${r.summary.maxDrawdown.toFixed(2)}%`;
        const sharpeStr = r.summary.sharpeRatio.toFixed(2);
        const pfStr = r.summary.profitFactor.toFixed(2);
        const risk = r.summary.maxDrawdown < 5 ? 'Basso' : r.summary.maxDrawdown < 10 ? 'Medio' : 'Alto';

        console.log(`│ ${r.scenario.padEnd(23)} │ ${ddStr.padStart(12)} │ ${sharpeStr.padStart(12)} │ ${pfStr.padStart(12)} │ ${risk.padStart(8)} │`);
    });

    console.log('└─────────────────────────┴──────────────┴──────────────┴──────────────┴──────────┘');

    // Proiezione mensile
    console.log('\n' + '='.repeat(80));
    console.log('💰 PROIEZIONE MENSILE');
    console.log('='.repeat(80));

    console.log('\n┌─────────────────────────┬──────────────┬──────────────┬──────────────┐');
    console.log('│ Strategia               │ Profitto 2M  │ Profitto/Mese│ Profitto/Anno│');
    console.log('├─────────────────────────┼──────────────┼──────────────┼──────────────┤');

    sorted.forEach(r => {
        const profit2m = r.summary.finalBalance - initialCapital;
        const profitMonthly = profit2m / 2;
        const profitYearly = profitMonthly * 12;

        const p2mStr = `${profit2m >= 0 ? '+' : ''}$${profit2m.toFixed(2)}`;
        const pmStr = `${profitMonthly >= 0 ? '+' : ''}$${profitMonthly.toFixed(2)}`;
        const pyStr = `${profitYearly >= 0 ? '+' : ''}$${profitYearly.toFixed(2)}`;

        console.log(`│ ${r.scenario.padEnd(23)} │ ${p2mStr.padStart(12)} │ ${pmStr.padStart(12)} │ ${pyStr.padStart(12)} │`);
    });

    console.log('└─────────────────────────┴──────────────┴──────────────┴──────────────┘');

    // Raccomandazione
    const best = sorted[0];
    const conservative = results.find(r => r.scenario === 'Conservativo 10%');

    console.log('\n' + '='.repeat(80));
    console.log('🎯 RACCOMANDAZIONE STRATEGICA');
    console.log('='.repeat(80));

    const bestProfit = best.summary.finalBalance - initialCapital;
    const conservativeProfit = conservative.summary.finalBalance - initialCapital;
    const improvement = bestProfit - conservativeProfit;

    console.log(`\n🥇 STRATEGIA MIGLIORE: ${best.scenario}`);
    console.log(`   Size per trade: $${best.tradeSize.toFixed(2)} (${best.tradeSizePercent.toFixed(0)}% del capitale)`);
    console.log(`   Profitto 2 mesi: ${bestProfit >= 0 ? '+' : ''}$${bestProfit.toFixed(2)}`);
    console.log(`   Profitto mensile: ${(bestProfit / 2) >= 0 ? '+' : ''}$${(bestProfit / 2).toFixed(2)}`);
    console.log(`   Return: ${best.summary.totalReturn >= 0 ? '+' : ''}${best.summary.totalReturn.toFixed(2)}%`);
    console.log(`   Max Drawdown: ${best.summary.maxDrawdown.toFixed(2)}%`);
    console.log(`   Win Rate: ${best.summary.winRate.toFixed(1)}%`);

    console.log(`\n📊 Miglioramento vs Conservativo:`);
    console.log(`   Profitto extra: ${improvement >= 0 ? '+' : ''}$${improvement.toFixed(2)}`);
    console.log(`   Profitto mensile extra: ${(improvement / 2) >= 0 ? '+' : ''}$${(improvement / 2).toFixed(2)}`);

    if (best.summary.maxDrawdown > 10) {
        console.log(`\n⚠️  ATTENZIONE: Drawdown alto (${best.summary.maxDrawdown.toFixed(2)}%)`);
        console.log(`   Considera una strategia più conservativa se vuoi meno rischio.`);

        const balanced = sorted.find(r => r.summary.maxDrawdown < 5 && r.summary.maxDrawdown > 0);
        if (balanced) {
            const balancedProfit = balanced.summary.finalBalance - initialCapital;
            console.log(`\n💡 ALTERNATIVA BILANCIATA: ${balanced.scenario}`);
            console.log(`   Profitto: ${balancedProfit >= 0 ? '+' : ''}$${balancedProfit.toFixed(2)}/mese`);
            console.log(`   Drawdown: ${balanced.summary.maxDrawdown.toFixed(2)}% (più sicuro)`);
        }
    } else {
        console.log(`\n✅ Rischio accettabile (Drawdown: ${best.summary.maxDrawdown.toFixed(2)}%)`);
        console.log(`   Questa strategia offre il miglior rapporto rischio/rendimento!`);
    }

    // Salva report
    const fs = require('fs');
    fs.writeFileSync('./capital_allocation_report.json', JSON.stringify({
        symbol,
        period: `${days} days`,
        initialCapital,
        testDate: new Date().toISOString(),
        best: {
            strategy: best.scenario,
            tradeSize: best.tradeSize,
            profit: bestProfit,
            monthlyProfit: bestProfit / 2,
            return: best.summary.totalReturn,
            maxDrawdown: best.summary.maxDrawdown
        },
        allResults: results.map(r => ({
            strategy: r.scenario,
            tradeSize: r.tradeSize,
            profit: r.summary.finalBalance - initialCapital,
            return: r.summary.totalReturn,
            winRate: r.summary.winRate,
            maxDrawdown: r.summary.maxDrawdown
        }))
    }, null, 2));

    console.log('\n' + '='.repeat(80));
    console.log('✅ Analisi allocazione capitale completata!');
    console.log('📁 Report salvato in: capital_allocation_report.json');
    console.log('='.repeat(80) + '\n');
}

// Esegui analisi
testCapitalAllocation('bitcoin', 60).then(() => process.exit(0)).catch(err => {
    console.error('❌ Errore:', err);
    process.exit(1);
});
