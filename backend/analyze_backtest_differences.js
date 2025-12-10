/**
 * ANALISI COMPARATIVA: Backtest Semplice vs Avanzato
 * Identifica le differenze chiave che causano il declino di performance
 */

const { dbAll } = require('./crypto_db');
const signalGenerator = require('./services/BidirectionalSignalGenerator');
const BacktestAnalyzer = require('./backtest_analyzer');
const AdvancedBacktestAnalyzer = require('./advanced_backtest_analyzer');

async function compareBacktests(symbol = 'ethereum', days = 60) {
    console.log('\n🔬 ANALISI COMPARATIVA DETTAGLIATA\n');
    console.log('='.repeat(80));
    console.log(`Simbolo: ${symbol.toUpperCase()}`);
    console.log(`Periodo: ${days} giorni\n`);

    // Esegui entrambi i backtest
    console.log('📊 Esecuzione Backtest SEMPLICE...');
    const simpleAnalyzer = new BacktestAnalyzer(symbol, 1000, 100);
    const simpleResult = await simpleAnalyzer.runBacktest(days);

    console.log('\n📊 Esecuzione Backtest AVANZATO...');
    const advancedAnalyzer = new AdvancedBacktestAnalyzer(symbol, 1000, 100);
    const advancedResult = await advancedAnalyzer.runBacktest(days);

    // Confronto dettagliato
    console.log('\n' + '='.repeat(80));
    console.log('📊 CONFRONTO PERFORMANCE');
    console.log('='.repeat(80));

    const comparison = {
        simple: simpleResult.summary,
        advanced: advancedResult.summary
    };

    console.log('\n┌─────────────────────────┬──────────────────┬──────────────────┬────────────────┐');
    console.log('│ Metrica                 │ Backtest SEMPLICE│ Backtest AVANZATO│ Differenza     │');
    console.log('├─────────────────────────┼──────────────────┼──────────────────┼────────────────┤');

    const metrics = [
        { name: 'Return %', simple: comparison.simple.totalReturn, advanced: comparison.advanced.totalReturn, format: 'percent' },
        { name: 'Trade Totali', simple: comparison.simple.totalTrades, advanced: comparison.advanced.totalTrades, format: 'number' },
        { name: 'Win Rate %', simple: comparison.simple.winRate, advanced: comparison.advanced.winRate, format: 'percent' },
        { name: 'Profit Factor', simple: comparison.simple.profitFactor, advanced: comparison.advanced.profitFactor, format: 'decimal' },
        { name: 'Media Vincita $', simple: comparison.simple.avgWin, advanced: comparison.advanced.avgWin, format: 'money' },
        { name: 'Media Perdita $', simple: comparison.simple.avgLoss, advanced: comparison.advanced.avgLoss, format: 'money' },
        { name: 'Max Drawdown %', simple: comparison.simple.maxDrawdown, advanced: comparison.advanced.maxDrawdown, format: 'percent' }
    ];

    metrics.forEach(m => {
        const diff = m.advanced - m.simple;
        const diffStr = m.format === 'percent' ? `${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%` :
            m.format === 'money' ? `${diff >= 0 ? '+' : ''}$${diff.toFixed(2)}` :
                m.format === 'decimal' ? `${diff >= 0 ? '+' : ''}${diff.toFixed(2)}` :
                    `${diff >= 0 ? '+' : ''}${diff}`;

        const simpleStr = m.format === 'percent' ? `${m.simple.toFixed(2)}%` :
            m.format === 'money' ? `$${m.simple.toFixed(2)}` :
                m.format === 'decimal' ? m.simple.toFixed(2) :
                    m.simple.toString();

        const advStr = m.format === 'percent' ? `${m.advanced.toFixed(2)}%` :
            m.format === 'money' ? `$${m.advanced.toFixed(2)}` :
                m.format === 'decimal' ? m.advanced.toFixed(2) :
                    m.advanced.toString();

        console.log(`│ ${m.name.padEnd(23)} │ ${simpleStr.padStart(16)} │ ${advStr.padStart(16)} │ ${diffStr.padStart(14)} │`);
    });

    console.log('└─────────────────────────┴──────────────────┴──────────────────┴────────────────┘');

    // Analisi motivi chiusura
    console.log('\n' + '='.repeat(80));
    console.log('📋 ANALISI MOTIVI CHIUSURA');
    console.log('='.repeat(80));

    console.log('\nBACKTEST SEMPLICE:');
    const simpleClosure = {};
    simpleResult.trades.forEach(t => {
        simpleClosure[t.reason] = (simpleClosure[t.reason] || 0) + 1;
    });
    Object.entries(simpleClosure).forEach(([reason, count]) => {
        const pct = (count / comparison.simple.totalTrades * 100).toFixed(1);
        console.log(`   ${reason.padEnd(20)}: ${count.toString().padStart(3)} (${pct.padStart(5)}%)`);
    });

    console.log('\nBACKTEST AVANZATO:');
    Object.entries(advancedResult.closureReasons).forEach(([reason, count]) => {
        const pct = (count / comparison.advanced.totalTrades * 100).toFixed(1);
        console.log(`   ${reason.padEnd(20)}: ${count.toString().padStart(3)} (${pct.padStart(5)}%)`);
    });

    // Analisi trade per trade
    console.log('\n' + '='.repeat(80));
    console.log('🔍 DIFFERENZE CHIAVE NEL COMPORTAMENTO');
    console.log('='.repeat(80));

    // 1. Frequenza trade
    const tradeDensitySimple = comparison.simple.totalTrades / days;
    const tradeDensityAdvanced = comparison.advanced.totalTrades / days;

    console.log('\n1️⃣  FREQUENZA TRADING:');
    console.log(`   Semplice: ${tradeDensitySimple.toFixed(2)} trade/giorno`);
    console.log(`   Avanzato: ${tradeDensityAdvanced.toFixed(2)} trade/giorno`);
    console.log(`   → Il backtest avanzato fa ${tradeDensityAdvanced > tradeDensitySimple ? 'PIÙ' : 'MENO'} trade (${Math.abs(tradeDensityAdvanced - tradeDensitySimple).toFixed(2)} trade/giorno di differenza)`);

    // 2. Durata media trade
    const avgDurationSimple = simpleResult.trades.reduce((sum, t) => sum + (t.exitTime - t.openTime), 0) / simpleResult.trades.length / (1000 * 60);
    const avgDurationAdvanced = advancedResult.trades.reduce((sum, t) => sum + (t.exitTime - t.openTime), 0) / advancedResult.trades.length / (1000 * 60);

    console.log('\n2️⃣  DURATA MEDIA TRADE:');
    console.log(`   Semplice: ${avgDurationSimple.toFixed(0)} minuti`);
    console.log(`   Avanzato: ${avgDurationAdvanced.toFixed(0)} minuti`);
    console.log(`   → Il backtest avanzato tiene le posizioni ${avgDurationAdvanced > avgDurationSimple ? 'PIÙ' : 'MENO'} a lungo`);

    // 3. Analisi stop loss
    const stopLossSimple = simpleResult.trades.filter(t => t.reason === 'STOP_LOSS').length;
    const stopLossAdvanced = advancedResult.trades.filter(t => t.reason === 'STOP_LOSS').length;
    const stopLossPctSimple = (stopLossSimple / comparison.simple.totalTrades * 100);
    const stopLossPctAdvanced = (stopLossAdvanced / comparison.advanced.totalTrades * 100);

    console.log('\n3️⃣  STOP LOSS TRIGGERATI:');
    console.log(`   Semplice: ${stopLossSimple} trade (${stopLossPctSimple.toFixed(1)}%)`);
    console.log(`   Avanzato: ${stopLossAdvanced} trade (${stopLossPctAdvanced.toFixed(1)}%)`);
    console.log(`   → Il backtest avanzato triggera ${stopLossPctAdvanced > stopLossPctSimple ? 'PIÙ' : 'MENO'} stop loss`);

    // 4. Analisi take profit
    const takeProfitSimple = simpleResult.trades.filter(t => t.reason === 'TAKE_PROFIT').length;
    const takeProfitAdvanced = advancedResult.trades.filter(t => t.reason === 'TAKE_PROFIT').length;
    const takeProfitPctSimple = (takeProfitSimple / comparison.simple.totalTrades * 100);
    const takeProfitPctAdvanced = (takeProfitAdvanced / comparison.advanced.totalTrades * 100);

    console.log('\n4️⃣  TAKE PROFIT RAGGIUNTI:');
    console.log(`   Semplice: ${takeProfitSimple} trade (${takeProfitPctSimple.toFixed(1)}%)`);
    console.log(`   Avanzato: ${takeProfitAdvanced} trade (${takeProfitPctAdvanced.toFixed(1)}%)`);
    console.log(`   → Il backtest avanzato raggiunge ${takeProfitPctAdvanced > takeProfitPctSimple ? 'PIÙ' : 'MENO'} take profit`);

    // 5. Trailing stop (solo avanzato)
    const trailingStopAdvanced = advancedResult.trades.filter(t => t.reason === 'TRAILING_STOP').length;
    const trailingStopPctAdvanced = (trailingStopAdvanced / comparison.advanced.totalTrades * 100);

    console.log('\n5️⃣  TRAILING STOP (solo avanzato):');
    console.log(`   Avanzato: ${trailingStopAdvanced} trade (${trailingStopPctAdvanced.toFixed(1)}%)`);
    console.log(`   → Questa è una feature AGGIUNTIVA del backtest avanzato`);

    // Conclusioni
    console.log('\n' + '='.repeat(80));
    console.log('💡 CONCLUSIONI - PERCHÉ IL BACKTEST AVANZATO PERFORMA PEGGIO?');
    console.log('='.repeat(80));

    const reasons = [];

    if (tradeDensityAdvanced > tradeDensitySimple * 1.2) {
        reasons.push(`❌ OVERTRADING: Fa ${((tradeDensityAdvanced / tradeDensitySimple - 1) * 100).toFixed(0)}% trade in più → più commissioni e più esposizione al rischio`);
    }

    if (stopLossPctAdvanced > stopLossPctSimple + 10) {
        reasons.push(`❌ TROPPI STOP LOSS: ${stopLossPctAdvanced.toFixed(0)}% dei trade chiusi in perdita (vs ${stopLossPctSimple.toFixed(0)}%)`);
    }

    if (takeProfitPctAdvanced < takeProfitPctSimple - 10) {
        reasons.push(`❌ MENO TAKE PROFIT: Solo ${takeProfitPctAdvanced.toFixed(0)}% raggiunge il target (vs ${takeProfitPctSimple.toFixed(0)}%)`);
    }

    if (comparison.advanced.winRate < comparison.simple.winRate - 5) {
        reasons.push(`❌ WIN RATE INFERIORE: ${comparison.advanced.winRate.toFixed(1)}% vs ${comparison.simple.winRate.toFixed(1)}% → i filtri non selezionano trade migliori`);
    }

    if (comparison.advanced.avgLoss > comparison.simple.avgLoss * 1.1) {
        reasons.push(`❌ PERDITE MAGGIORI: Media perdita $${comparison.advanced.avgLoss.toFixed(2)} vs $${comparison.simple.avgLoss.toFixed(2)}`);
    }

    if (reasons.length === 0) {
        reasons.push('✅ Nessun problema critico identificato - le differenze sono marginali');
    }

    console.log('');
    reasons.forEach((r, idx) => console.log(`${idx + 1}. ${r}`));

    // Raccomandazioni
    console.log('\n' + '='.repeat(80));
    console.log('🎯 RACCOMANDAZIONI PER MIGLIORARE IL BOT');
    console.log('='.repeat(80));

    const recommendations = [];

    if (tradeDensityAdvanced > tradeDensitySimple * 1.2) {
        recommendations.push('📌 Aumenta la soglia MIN_SIGNAL_STRENGTH da 70 a 80-85 per ridurre il numero di trade');
    }

    if (stopLossPctAdvanced > 50) {
        recommendations.push('📌 Rivedi i filtri professionali: troppi trade finiscono in stop loss');
        recommendations.push('📌 Considera di allargare lo stop loss da 2% a 2.5-3%');
    }

    if (comparison.advanced.winRate < 45) {
        recommendations.push('📌 I filtri attuali NON migliorano la qualità dei segnali');
        recommendations.push('📌 Considera di SEMPLIFICARE i filtri invece di aggiungerne altri');
    }

    if (trailingStopPctAdvanced > 20) {
        recommendations.push('📌 Il trailing stop potrebbe essere troppo stretto (1.5%)');
        recommendations.push('📌 Prova ad aumentarlo a 2-2.5% per lasciare respirare i trade vincenti');
    }

    if (recommendations.length === 0) {
        recommendations.push('✅ Il bot è già ottimizzato, le performance sono buone');
    }

    console.log('');
    recommendations.forEach((r, idx) => console.log(`${idx + 1}. ${r}`));

    console.log('\n' + '='.repeat(80));
    console.log('✅ Analisi completata!\n');

    // Salva report
    const fs = require('fs');
    fs.writeFileSync('./comparison_analysis.json', JSON.stringify({
        symbol,
        period: `${days} days`,
        comparison: {
            simple: comparison.simple,
            advanced: comparison.advanced
        },
        differences: {
            tradeDensity: { simple: tradeDensitySimple, advanced: tradeDensityAdvanced },
            avgDuration: { simple: avgDurationSimple, advanced: avgDurationAdvanced },
            stopLoss: { simple: stopLossPctSimple, advanced: stopLossPctAdvanced },
            takeProfit: { simple: takeProfitPctSimple, advanced: takeProfitPctAdvanced },
            trailingStop: trailingStopPctAdvanced
        },
        reasons,
        recommendations
    }, null, 2));

    console.log('📁 Report salvato in: comparison_analysis.json\n');
}

// Esegui analisi
compareBacktests('ethereum', 60).then(() => process.exit(0)).catch(err => {
    console.error('❌ Errore:', err);
    process.exit(1);
});
