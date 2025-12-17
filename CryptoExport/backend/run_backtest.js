/**
 * Script di test per eseguire il backtest e generare report
 */

const BacktestAnalyzer = require('./backtest_analyzer');

async function runTest() {
    try {
        console.log('🚀 Avvio Backtest del Crypto Bot...\n');

        const analyzer = new BacktestAnalyzer(
            'bitcoin',  // Simbolo da testare
            1000,       // Capitale iniziale ($)
            100         // Dimensione trade ($)
        );

        const results = await analyzer.runBacktest(30); // Ultimi 30 giorni

        console.log('\n' + '='.repeat(60));
        console.log('📊 RISULTATI BACKTEST');
        console.log('='.repeat(60));
        console.log(`💰 Capitale Iniziale: $${results.summary.initialBalance.toFixed(2)}`);
        console.log(`💵 Capitale Finale: $${results.summary.finalBalance.toFixed(2)}`);
        console.log(`📈 Rendimento Totale: ${results.summary.totalReturn >= 0 ? '+' : ''}${results.summary.totalReturn.toFixed(2)}%`);
        console.log('');
        console.log(`📊 Trade Totali: ${results.summary.totalTrades}`);
        console.log(`✅ Trade Vincenti: ${results.summary.winningTrades} (${results.summary.winRate.toFixed(1)}%)`);
        console.log(`❌ Trade Perdenti: ${results.summary.losingTrades}`);
        console.log('');
        console.log(`💎 Profit Factor: ${results.summary.profitFactor === Infinity ? '∞' : results.summary.profitFactor.toFixed(2)}`);
        console.log(`📊 Media Vincita: $${results.summary.avgWin.toFixed(2)}`);
        console.log(`📉 Media Perdita: $${results.summary.avgLoss.toFixed(2)}`);
        console.log(`⚠️  Max Drawdown: ${results.summary.maxDrawdown.toFixed(2)}%`);
        console.log(`📐 Sharpe Ratio: ${results.summary.sharpeRatio.toFixed(2)}`);
        console.log('='.repeat(60));

        // Salva risultati dettagliati
        const fs = require('fs');
        const reportPath = './backtest_results.json';
        fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
        console.log(`\n✅ Report completo salvato in: ${reportPath}`);

        // Genera dati per grafico (CSV)
        const csvPath = './equity_curve.csv';
        const csvContent = 'Timestamp,Balance\n' +
            results.equityCurve.map(point =>
                `${new Date(point.time).toISOString()},${point.balance.toFixed(2)}`
            ).join('\n');
        fs.writeFileSync(csvPath, csvContent);
        console.log(`📈 Equity Curve salvata in: ${csvPath}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Errore durante il backtest:', error);
        process.exit(1);
    }
}

runTest();
