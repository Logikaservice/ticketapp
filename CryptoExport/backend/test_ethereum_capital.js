/**
 * CAPITAL ALLOCATION TEST - ETHEREUM
 * Verifica se la strategia All-In funziona anche su ETH
 */

const AdvancedBacktestAnalyzer = require('./advanced_backtest_analyzer');

async function testEthereumCapitalAllocation(days = 60) {
    console.log('\n💰 ANALISI ETHEREUM: Allocazione Capitale Ottimale\n');
    console.log('='.repeat(80));
    console.log('🎯 Verifica se strategia All-In funziona su Ethereum\n');

    const initialCapital = 1080;

    // Scenari di allocazione (stessi di Bitcoin)
    const scenarios = [
        { name: 'Conservativo 10%', tradeSize: initialCapital * 0.10 },
        { name: 'Moderato 20%', tradeSize: initialCapital * 0.20 },
        { name: 'Balanced 30%', tradeSize: initialCapital * 0.30 },
        { name: 'Aggressivo 50%', tradeSize: initialCapital * 0.50 },
        { name: 'Molto Aggressivo 75%', tradeSize: initialCapital * 0.75 },
        { name: 'All-In 100%', tradeSize: initialCapital * 1.00 }
    ];

    console.log(`📊 Testando ${scenarios.length} strategie su ETHEREUM...\n`);

    const results = [];

    for (const scenario of scenarios) {
        console.log(`[${scenarios.indexOf(scenario) + 1}/${scenarios.length}] ${scenario.name} ($${scenario.tradeSize.toFixed(0)}/trade)`);

        try {
            const analyzer = new AdvancedBacktestAnalyzer('ethereum', initialCapital, scenario.tradeSize);

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

            console.log(`   ${emoji} Profitto: ${profitStr} (${returnStr}) | Win Rate: ${result.summary.winRate.toFixed(1)}% | Trades: ${result.summary.totalTrades}\n`);

        } catch (error) {
            console.log(`   ❌ Errore: ${error.message}\n`);
        }
    }

    // Classifica
    const sorted = [...results].sort((a, b) => (b.summary.finalBalance - initialCapital) - (a.summary.finalBalance - initialCapital));

    console.log('\n' + '='.repeat(80));
    console.log('🏆 ETHEREUM - CLASSIFICA PER PROFITTO');
    console.log('='.repeat(80));

    console.log('\n┌────┬─────────────────────────┬──────────────┬──────────────┬──────────────┬──────────┐');
    console.log('│ Pos│ Strategia               │ Size/Trade   │ Profitto 2M  │ Return       │ Win Rate │');
    console.log('├────┼─────────────────────────┼──────────────┼──────────────┼──────────────┼──────────┤');

    sorted.forEach((r, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '  ';
        const profit = r.summary.finalBalance - initialCapital;
        const profitStr = `${profit >= 0 ? '+' : ''}$${profit.toFixed(2)}`;
        const returnStr = `${r.summary.totalReturn >= 0 ? '+' : ''}${r.summary.totalReturn.toFixed(2)}%`;
        const sizeStr = `$${r.tradeSize.toFixed(0)}`;

        console.log(`│ ${medal}${(idx + 1).toString().padStart(2)} │ ${r.scenario.padEnd(23)} │ ${sizeStr.padStart(12)} │ ${profitStr.padStart(12)} │ ${returnStr.padStart(12)} │ ${r.summary.winRate.toFixed(1).padStart(8)}% │`);
    });

    console.log('└────┴─────────────────────────┴──────────────┴──────────────┴──────────────┴──────────┘');

    // Confronto con Bitcoin
    console.log('\n' + '='.repeat(80));
    console.log('📊 CONFRONTO: ETHEREUM vs BITCOIN (Strategia All-In 100%)');
    console.log('='.repeat(80));

    const ethAllIn = results.find(r => r.scenario === 'All-In 100%');
    const ethProfit = ethAllIn.summary.finalBalance - initialCapital;
    const ethMonthly = ethProfit / 2;

    // Dati Bitcoin (dal test precedente)
    const btcProfit = 215.76;
    const btcMonthly = 107.88;
    const btcReturn = 19.98;
    const btcDrawdown = 9.49;

    console.log('\n┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────┐');
    console.log('│ Asset        │ Profitto 2M  │ Profitto/Mese│ Return       │ Max Drawdown │ Trades   │');
    console.log('├──────────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────┤');

    console.log(`│ Bitcoin      │ +$${btcProfit.toFixed(2).padStart(11)} │ +$${btcMonthly.toFixed(2).padStart(11)} │ +${btcReturn.toFixed(2).padStart(11)}% │ ${btcDrawdown.toFixed(2).padStart(11)}% │ ${17 .toString().padStart(8)} │`);
    console.log(`│ Ethereum     │ ${(ethProfit >= 0 ? '+' : '')}$${ethProfit.toFixed(2).padStart(11)} │ ${(ethMonthly >= 0 ? '+' : '')}$${ethMonthly.toFixed(2).padStart(11)} │ ${(ethAllIn.summary.totalReturn >= 0 ? '+' : '')}${ethAllIn.summary.totalReturn.toFixed(2).padStart(11)}% │ ${ethAllIn.summary.maxDrawdown.toFixed(2).padStart(11)}% │ ${ethAllIn.summary.totalTrades.toString().padStart(8)} │`);

    console.log('└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┴──────────┘');

    // Analisi comparativa
    const profitDiff = ethProfit - btcProfit;
    const returnDiff = ethAllIn.summary.totalReturn - btcReturn;

    console.log('\n' + '='.repeat(80));
    console.log('🎯 ANALISI COMPARATIVA');
    console.log('='.repeat(80));

    if (ethProfit > btcProfit) {
        console.log(`\n🟢 ETHEREUM VINCE!`);
        console.log(`   Profitto extra: +$${profitDiff.toFixed(2)}`);
        console.log(`   Profitto mensile extra: +$${(profitDiff / 2).toFixed(2)}`);
        console.log(`   Return extra: +${returnDiff.toFixed(2)}%`);
    } else if (ethProfit < btcProfit) {
        console.log(`\n🔵 BITCOIN VINCE!`);
        console.log(`   Profitto extra: +$${Math.abs(profitDiff).toFixed(2)}`);
        console.log(`   Profitto mensile extra: +$${(Math.abs(profitDiff) / 2).toFixed(2)}`);
        console.log(`   Return extra: +${Math.abs(returnDiff).toFixed(2)}%`);
    } else {
        console.log(`\n⚪ PAREGGIO!`);
        console.log(`   Entrambi gli asset hanno performance simili.`);
    }

    // Raccomandazione finale
    console.log('\n' + '='.repeat(80));
    console.log('🎯 RACCOMANDAZIONE FINALE');
    console.log('='.repeat(80));

    const best = sorted[0];
    const bestProfit = best.summary.finalBalance - initialCapital;

    console.log(`\n🥇 ETHEREUM - Strategia Migliore: ${best.scenario}`);
    console.log(`   Profitto 2 mesi: ${bestProfit >= 0 ? '+' : ''}$${bestProfit.toFixed(2)}`);
    console.log(`   Profitto mensile: ${(bestProfit / 2) >= 0 ? '+' : ''}$${(bestProfit / 2).toFixed(2)}`);
    console.log(`   Return: ${best.summary.totalReturn >= 0 ? '+' : ''}${best.summary.totalReturn.toFixed(2)}%`);
    console.log(`   Max Drawdown: ${best.summary.maxDrawdown.toFixed(2)}%`);
    console.log(`   Win Rate: ${best.summary.winRate.toFixed(1)}%`);
    console.log(`   Trade: ${best.summary.totalTrades}`);

    if (bestProfit > 0) {
        console.log(`\n✅ ETHEREUM è PROFITTEVOLE con strategia All-In!`);

        if (ethProfit > btcProfit) {
            console.log(`\n💡 RACCOMANDAZIONE: Usa ETHEREUM invece di Bitcoin`);
            console.log(`   Profitto superiore di $${profitDiff.toFixed(2)} in 2 mesi`);
        } else {
            console.log(`\n💡 RACCOMANDAZIONE: Bitcoin rimane migliore`);
            console.log(`   Ma Ethereum è comunque profittevole (+$${bestProfit.toFixed(2)}/2 mesi)`);
        }
    } else {
        console.log(`\n❌ ETHEREUM rimane PERDENTE anche con All-In`);
        console.log(`   Perdita: ${bestProfit.toFixed(2)} in 2 mesi`);
        console.log(`\n💡 RACCOMANDAZIONE: Usa SOLO Bitcoin`);
    }

    // Portfolio diversificato
    console.log('\n' + '='.repeat(80));
    console.log('💼 OPZIONE: PORTFOLIO DIVERSIFICATO');
    console.log('='.repeat(80));

    const btcAllocation = 0.5;
    const ethAllocation = 0.5;
    const portfolioProfit = (btcProfit * btcAllocation) + (ethProfit * ethAllocation);
    const portfolioMonthly = portfolioProfit / 2;

    console.log(`\n📊 50% Bitcoin + 50% Ethereum:`);
    console.log(`   Bitcoin ($540): +$${(btcProfit * btcAllocation).toFixed(2)}`);
    console.log(`   Ethereum ($540): ${(ethProfit * ethAllocation) >= 0 ? '+' : ''}$${(ethProfit * ethAllocation).toFixed(2)}`);
    console.log(`   TOTALE: ${portfolioProfit >= 0 ? '+' : ''}$${portfolioProfit.toFixed(2)} in 2 mesi`);
    console.log(`   Mensile: ${portfolioMonthly >= 0 ? '+' : ''}$${portfolioMonthly.toFixed(2)}`);

    if (portfolioProfit > btcProfit && portfolioProfit > ethProfit) {
        console.log(`\n🎯 PORTFOLIO DIVERSIFICATO VINCE!`);
    } else if (btcProfit > portfolioProfit && btcProfit > ethProfit) {
        console.log(`\n🎯 100% BITCOIN è la scelta migliore!`);
    } else {
        console.log(`\n🎯 100% ETHEREUM è la scelta migliore!`);
    }

    // Salva report
    const fs = require('fs');
    fs.writeFileSync('./ethereum_capital_allocation.json', JSON.stringify({
        asset: 'Ethereum',
        period: `${days} days`,
        initialCapital,
        testDate: new Date().toISOString(),
        best: {
            strategy: best.scenario,
            profit: bestProfit,
            monthlyProfit: bestProfit / 2,
            return: best.summary.totalReturn,
            maxDrawdown: best.summary.maxDrawdown,
            trades: best.summary.totalTrades
        },
        comparison: {
            bitcoin: { profit: btcProfit, monthly: btcMonthly, return: btcReturn },
            ethereum: { profit: ethProfit, monthly: ethMonthly, return: ethAllIn.summary.totalReturn },
            winner: ethProfit > btcProfit ? 'Ethereum' : 'Bitcoin',
            difference: Math.abs(profitDiff)
        },
        portfolio: {
            allocation: '50% BTC + 50% ETH',
            profit: portfolioProfit,
            monthly: portfolioMonthly
        }
    }, null, 2));

    console.log('\n' + '='.repeat(80));
    console.log('✅ Analisi Ethereum completata!');
    console.log('📁 Report salvato in: ethereum_capital_allocation.json');
    console.log('='.repeat(80) + '\n');
}

// Esegui analisi
testEthereumCapitalAllocation(60).then(() => process.exit(0)).catch(err => {
    console.error('❌ Errore:', err);
    process.exit(1);
});
