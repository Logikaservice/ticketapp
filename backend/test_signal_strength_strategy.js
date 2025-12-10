/**
 * STRATEGIC TEST: MIN_SIGNAL_STRENGTH Optimization
 * Ipotesi: Alzare la soglia migliora drasticamente le performance
 * Approccio: Test scientifico con analisi statistica
 */

const AdvancedBacktestAnalyzer = require('./advanced_backtest_analyzer');
const signalGenerator = require('./services/BidirectionalSignalGenerator');

async function testSignalStrengthImpact(symbol = 'bitcoin', days = 60) {
    console.log('\n🎯 STRATEGIC TEST: MIN_SIGNAL_STRENGTH Optimization\n');
    console.log('='.repeat(80));
    console.log('💡 IPOTESI: Alzare la soglia di forza segnale migliora qualità trade\n');
    console.log('📊 Approccio: Test scientifico con 6 livelli di soglia\n');

    // Test con diverse soglie di signal strength
    const thresholds = [
        { value: 65, name: 'Molto Basso' },
        { value: 70, name: 'ATTUALE' },
        { value: 75, name: 'Medio-Alto' },
        { value: 80, name: 'Alto' },
        { value: 85, name: 'Molto Alto' },
        { value: 90, name: 'Estremo' }
    ];

    console.log('🔬 Testing soglie:', thresholds.map(t => `${t.value}%`).join(', '));
    console.log('');

    const results = [];

    for (const threshold of thresholds) {
        console.log(`[${thresholds.indexOf(threshold) + 1}/${thresholds.length}] Testing MIN_SIGNAL_STRENGTH = ${threshold.value}% (${threshold.name})`);

        try {
            const analyzer = new AdvancedBacktestAnalyzer(symbol, 1000, 100);

            // Modifica SOLO la soglia di signal strength
            analyzer.config.minSignalStrength = threshold.value;

            // Usa configurazione OTTIMALE per gli altri parametri
            analyzer.config.stopLossPercent = 3;
            analyzer.config.takeProfitPercent = 15;
            analyzer.config.trailingStopPercent = 4;

            // Esegui backtest silenzioso
            const originalLog = console.log;
            console.log = () => { };

            const result = await analyzer.runBacktest(days);

            console.log = originalLog;

            // Salva risultati
            results.push({
                threshold: threshold.value,
                name: threshold.name,
                summary: result.summary,
                closureReasons: result.closureReasons
            });

            // Mostra risultato rapido
            const returnStr = result.summary.totalReturn >= 0 ? `+${result.summary.totalReturn.toFixed(2)}%` : `${result.summary.totalReturn.toFixed(2)}%`;
            const emoji = result.summary.totalReturn > 1 ? '🟢' : result.summary.totalReturn > 0 ? '✅' : result.summary.totalReturn < 0 ? '❌' : '⚪';

            console.log(`   ${emoji} Return: ${returnStr} | Trades: ${result.summary.totalTrades} | Win Rate: ${result.summary.winRate.toFixed(1)}% | PF: ${result.summary.profitFactor.toFixed(2)}\n`);

        } catch (error) {
            console.log(`   ❌ Errore: ${error.message}\n`);
        }
    }

    // Analisi risultati
    console.log('\n' + '='.repeat(80));
    console.log('📊 ANALISI COMPARATIVA - Impatto MIN_SIGNAL_STRENGTH');
    console.log('='.repeat(80));

    console.log('\n┌──────────┬─────────────────┬─────────┬────────┬──────────┬────────┬──────────┐');
    console.log('│ Soglia % │ Nome            │ Return  │ Trades │ Win Rate │ Profit │ Sharpe   │');
    console.log('├──────────┼─────────────────┼─────────┼────────┼──────────┼────────┼──────────┤');

    results.forEach(r => {
        const returnStr = `${r.summary.totalReturn >= 0 ? '+' : ''}${r.summary.totalReturn.toFixed(2)}%`;
        const winRateStr = `${r.summary.winRate.toFixed(1)}%`;
        const pfStr = r.summary.profitFactor.toFixed(2);
        const sharpeStr = r.summary.sharpeRatio.toFixed(2);
        const isCurrent = r.name === 'ATTUALE' ? '→' : ' ';

        console.log(`│ ${isCurrent}${r.threshold.toString().padStart(7)} │ ${r.name.padEnd(15)} │ ${returnStr.padStart(7)} │ ${r.summary.totalTrades.toString().padStart(6)} │ ${winRateStr.padStart(8)} │ ${pfStr.padStart(6)} │ ${sharpeStr.padStart(8)} │`);
    });

    console.log('└──────────┴─────────────────┴─────────┴────────┴──────────┴────────┴──────────┘');

    // Trova ottimale
    const bestByReturn = [...results].sort((a, b) => b.summary.totalReturn - a.summary.totalReturn)[0];
    const bestBySharpe = [...results].sort((a, b) => b.summary.sharpeRatio - a.summary.sharpeRatio)[0];
    const bestByWinRate = [...results].sort((a, b) => b.summary.winRate - a.summary.winRate)[0];

    console.log('\n' + '='.repeat(80));
    console.log('🏆 MIGLIORI CONFIGURAZIONI');
    console.log('='.repeat(80));

    console.log(`\n🥇 Miglior Return: ${bestByReturn.threshold}% (${bestByReturn.name})`);
    console.log(`   Return: ${bestByReturn.summary.totalReturn >= 0 ? '+' : ''}${bestByReturn.summary.totalReturn.toFixed(2)}%`);
    console.log(`   Trade: ${bestByReturn.summary.totalTrades}`);
    console.log(`   Win Rate: ${bestByReturn.summary.winRate.toFixed(1)}%`);

    console.log(`\n📊 Miglior Sharpe Ratio: ${bestBySharpe.threshold}% (${bestBySharpe.name})`);
    console.log(`   Sharpe: ${bestBySharpe.summary.sharpeRatio.toFixed(2)}`);
    console.log(`   Return: ${bestBySharpe.summary.totalReturn >= 0 ? '+' : ''}${bestBySharpe.summary.totalReturn.toFixed(2)}%`);

    console.log(`\n🎯 Miglior Win Rate: ${bestByWinRate.threshold}% (${bestByWinRate.name})`);
    console.log(`   Win Rate: ${bestByWinRate.summary.winRate.toFixed(1)}%`);
    console.log(`   Return: ${bestByWinRate.summary.totalReturn >= 0 ? '+' : ''}${bestByWinRate.summary.totalReturn.toFixed(2)}%`);

    // Analisi correlazione
    console.log('\n' + '='.repeat(80));
    console.log('🔍 ANALISI CORRELAZIONE: Soglia vs Performance');
    console.log('='.repeat(80));

    console.log('\n📈 Relazione Soglia → Numero Trade:');
    results.forEach(r => {
        const bar = '█'.repeat(Math.max(1, Math.floor(r.summary.totalTrades / 5)));
        console.log(`   ${r.threshold}%: ${bar} ${r.summary.totalTrades} trade`);
    });

    console.log('\n💰 Relazione Soglia → Return:');
    results.forEach(r => {
        const barLength = Math.max(1, Math.floor(Math.abs(r.summary.totalReturn) * 10));
        const bar = r.summary.totalReturn >= 0 ? '█'.repeat(barLength) : '▓'.repeat(barLength);
        const color = r.summary.totalReturn >= 0 ? '' : '';
        console.log(`   ${r.threshold}%: ${bar} ${r.summary.totalReturn >= 0 ? '+' : ''}${r.summary.totalReturn.toFixed(2)}%`);
    });

    console.log('\n🎯 Relazione Soglia → Win Rate:');
    results.forEach(r => {
        const bar = '█'.repeat(Math.max(1, Math.floor(r.summary.winRate / 5)));
        console.log(`   ${r.threshold}%: ${bar} ${r.summary.winRate.toFixed(1)}%`);
    });

    // Simulazione con $1080
    console.log('\n' + '='.repeat(80));
    console.log('💰 SIMULAZIONE CON CAPITALE $1,080');
    console.log('='.repeat(80));

    const current = results.find(r => r.name === 'ATTUALE');
    const optimal = bestByReturn;

    console.log('\n┌─────────────────┬──────────────┬──────────────┬──────────────┐');
    console.log('│ Soglia          │ Return       │ Profitto     │ Mensile      │');
    console.log('├─────────────────┼──────────────┼──────────────┼──────────────┤');

    results.forEach(r => {
        const profit = 1080 * (r.summary.totalReturn / 100);
        const monthly = profit / 2;
        const returnStr = `${r.summary.totalReturn >= 0 ? '+' : ''}${r.summary.totalReturn.toFixed(2)}%`;
        const profitStr = `${profit >= 0 ? '+' : ''}$${profit.toFixed(2)}`;
        const monthlyStr = `${monthly >= 0 ? '+' : ''}$${monthly.toFixed(2)}`;
        const marker = r.name === 'ATTUALE' ? '→' : ' ';

        console.log(`│ ${marker}${r.threshold}% ${r.name.padEnd(11)} │ ${returnStr.padStart(12)} │ ${profitStr.padStart(12)} │ ${monthlyStr.padStart(12)} │`);
    });

    console.log('└─────────────────┴──────────────┴──────────────┴──────────────┘');

    // Raccomandazione strategica
    console.log('\n' + '='.repeat(80));
    console.log('🎯 RACCOMANDAZIONE STRATEGICA');
    console.log('='.repeat(80));

    const improvement = optimal.summary.totalReturn - current.summary.totalReturn;
    const profitImprovement = 1080 * (improvement / 100);

    if (optimal.threshold !== current.threshold) {
        console.log(`\n💡 CAMBIA MIN_SIGNAL_STRENGTH da ${current.threshold}% a ${optimal.threshold}%\n`);
        console.log(`📈 Miglioramento atteso:`);
        console.log(`   Return: ${improvement >= 0 ? '+' : ''}${improvement.toFixed(2)}%`);
        console.log(`   Profitto (2 mesi): ${profitImprovement >= 0 ? '+' : ''}$${profitImprovement.toFixed(2)}`);
        console.log(`   Profitto mensile: ${profitImprovement >= 0 ? '+' : ''}$${(profitImprovement / 2).toFixed(2)}`);
        console.log(`   Trade: ${optimal.summary.totalTrades} (vs ${current.summary.totalTrades})`);
        console.log(`   Win Rate: ${optimal.summary.winRate.toFixed(1)}% (vs ${current.summary.winRate.toFixed(1)}%)`);

        console.log(`\n🔧 Implementazione:`);
        console.log(`   1. Modifica MIN_SIGNAL_STRENGTH da ${current.threshold} a ${optimal.threshold}`);
        console.log(`   2. Mantieni configurazione ottimale (SL:3%, TP:15%, TS:4%)`);
        console.log(`   3. Testa per 1-2 settimane`);
        console.log(`   4. Monitora win rate e numero trade`);
    } else {
        console.log(`\n✅ La soglia attuale (${current.threshold}%) è già OTTIMALE!`);
        console.log(`   Non serve modificare MIN_SIGNAL_STRENGTH`);
    }

    // Insight finale
    console.log('\n' + '='.repeat(80));
    console.log('💎 INSIGHT STRATEGICO');
    console.log('='.repeat(80));

    // Calcola trend
    const lowThreshold = results.slice(0, 2);
    const highThreshold = results.slice(-2);
    const avgReturnLow = lowThreshold.reduce((sum, r) => sum + r.summary.totalReturn, 0) / lowThreshold.length;
    const avgReturnHigh = highThreshold.reduce((sum, r) => sum + r.summary.totalReturn, 0) / highThreshold.length;

    if (avgReturnHigh > avgReturnLow) {
        console.log(`\n📊 Pattern identificato: "Qualità > Quantità"`);
        console.log(`   Soglie ALTE (${highThreshold.map(r => r.threshold).join(', ')}%) performano meglio`);
        console.log(`   Return medio: ${avgReturnHigh.toFixed(2)}% vs ${avgReturnLow.toFixed(2)}%`);
        console.log(`   → Il bot è più profittevole quando è SELETTIVO`);
    } else {
        console.log(`\n📊 Pattern identificato: "Opportunità > Selezione"`);
        console.log(`   Soglie BASSE (${lowThreshold.map(r => r.threshold).join(', ')}%) performano meglio`);
        console.log(`   Return medio: ${avgReturnLow.toFixed(2)}% vs ${avgReturnHigh.toFixed(2)}%`);
        console.log(`   → Il bot beneficia di più opportunità di trading`);
    }

    // Salva report
    const fs = require('fs');
    fs.writeFileSync('./signal_strength_optimization.json', JSON.stringify({
        symbol,
        period: `${days} days`,
        testDate: new Date().toISOString(),
        results: results.map(r => ({
            threshold: r.threshold,
            name: r.name,
            return: r.summary.totalReturn,
            trades: r.summary.totalTrades,
            winRate: r.summary.winRate,
            profitFactor: r.summary.profitFactor,
            sharpeRatio: r.summary.sharpeRatio
        })),
        optimal: {
            threshold: optimal.threshold,
            name: optimal.name,
            improvement: improvement,
            profitImprovement: profitImprovement
        },
        recommendation: optimal.threshold !== current.threshold ?
            `Change from ${current.threshold}% to ${optimal.threshold}%` :
            `Keep current ${current.threshold}%`
    }, null, 2));

    console.log('\n' + '='.repeat(80));
    console.log('✅ Test strategico completato!');
    console.log('📁 Report salvato in: signal_strength_optimization.json');
    console.log('='.repeat(80) + '\n');
}

// Esegui test strategico
testSignalStrengthImpact('bitcoin', 60).then(() => process.exit(0)).catch(err => {
    console.error('❌ Errore:', err);
    process.exit(1);
});
