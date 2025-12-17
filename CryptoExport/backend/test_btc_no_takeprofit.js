/**
 * Test BITCOIN con Backtest AVANZATO - SENZA TAKE PROFIT
 * Verifica se il take profit sta limitando i profitti
 */

const AdvancedBacktestAnalyzer = require('./advanced_backtest_analyzer');
const https = require('https');
const { dbRun } = require('./crypto_db');

function httpsGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function downloadHistoricalData(symbol, dbSymbol, days = 60) {
    console.log(`📥 Verifica dati ${symbol}...`);

    const interval = '15m';
    const limit = 1000;
    const endTime = Date.now();
    const startTime = endTime - (days * 24 * 60 * 60 * 1000);

    let allKlines = [];
    let currentStartTime = startTime;

    while (currentStartTime < endTime) {
        const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${currentStartTime}&limit=${limit}`;

        try {
            const klines = await httpsGet(url);
            if (!klines || klines.length === 0) break;

            allKlines.push(...klines);
            currentStartTime = klines[klines.length - 1][0] + 1;
            await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
            console.error(`   ❌ Errore: ${error.message}`);
            break;
        }
    }

    let inserted = 0;
    for (const k of allKlines) {
        try {
            await dbRun(
                `INSERT INTO klines (symbol, interval, open_time, open_price, high_price, low_price, close_price, volume, close_time)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT (symbol, interval, open_time) DO NOTHING`,
                [dbSymbol, interval, k[0], k[1], k[2], k[3], k[4], k[5], k[6]]
            );
            inserted++;
        } catch (error) { }
    }

    console.log(`   ✅ ${inserted > 0 ? inserted + ' nuove candele' : 'Dati già presenti'}\n`);
    return allKlines.length;
}

async function testBTCNoTakeProfit() {
    try {
        console.log('\n🚀 BACKTEST BITCOIN - SENZA TAKE PROFIT\n');
        console.log('='.repeat(80));
        console.log('🔬 ESPERIMENTO: Verifica impatto del take profit sulle performance\n');
        console.log('✅ Stop Loss ATTIVO (2%)\n');

        // Scarica dati
        await downloadHistoricalData('BTCUSDT', 'bitcoin', 60);

        // Test CON take profit (normale)
        console.log('📊 Test 1: CON Take Profit (configurazione normale)...\n');
        const analyzerWithTP = new AdvancedBacktestAnalyzer('bitcoin', 1000, 100);
        const resultWithTP = await analyzerWithTP.runBacktest(60);

        // Test SENZA take profit
        console.log('\n📊 Test 2: SENZA Take Profit (solo trailing stop)...\n');
        const analyzerNoTP = new AdvancedBacktestAnalyzer('bitcoin', 1000, 100);

        // Disabilita take profit impostando un valore altissimo
        analyzerNoTP.config.takeProfitPercent = 100; // Praticamente disabilitato
        // Mantieni stop loss e trailing stop
        analyzerNoTP.config.stopLossPercent = 2;
        analyzerNoTP.config.trailingStopEnabled = true;
        analyzerNoTP.config.trailingStopPercent = 1.5;

        const resultNoTP = await analyzerNoTP.runBacktest(60);

        // Confronto dettagliato
        console.log('\n' + '='.repeat(80));
        console.log('📊 CONFRONTO: CON vs SENZA Take Profit');
        console.log('='.repeat(80));

        console.log('\n┌─────────────────────────┬──────────────────┬──────────────────┬────────────────┐');
        console.log('│ Metrica                 │ CON Take Profit  │ SENZA Take Profit│ Differenza     │');
        console.log('├─────────────────────────┼──────────────────┼──────────────────┼────────────────┤');

        const metrics = [
            { name: 'Return %', with: resultWithTP.summary.totalReturn, without: resultNoTP.summary.totalReturn, format: 'percent' },
            { name: 'Trade Totali', with: resultWithTP.summary.totalTrades, without: resultNoTP.summary.totalTrades, format: 'number' },
            { name: 'Win Rate %', with: resultWithTP.summary.winRate, without: resultNoTP.summary.winRate, format: 'percent' },
            { name: 'Profit Factor', with: resultWithTP.summary.profitFactor, without: resultNoTP.summary.profitFactor, format: 'decimal' },
            { name: 'Media Vincita $', with: resultWithTP.summary.avgWin, without: resultNoTP.summary.avgWin, format: 'money' },
            { name: 'Media Perdita $', with: resultWithTP.summary.avgLoss, without: resultNoTP.summary.avgLoss, format: 'money' },
            { name: 'Max Drawdown %', with: resultWithTP.summary.maxDrawdown, without: resultNoTP.summary.maxDrawdown, format: 'percent' }
        ];

        metrics.forEach(m => {
            const diff = m.without - m.with;
            const diffStr = m.format === 'percent' ? `${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%` :
                m.format === 'money' ? `${diff >= 0 ? '+' : ''}$${diff.toFixed(2)}` :
                    m.format === 'decimal' ? `${diff >= 0 ? '+' : ''}${diff.toFixed(2)}` :
                        `${diff >= 0 ? '+' : ''}${diff}`;

            const withStr = m.format === 'percent' ? `${m.with.toFixed(2)}%` :
                m.format === 'money' ? `$${m.with.toFixed(2)}` :
                    m.format === 'decimal' ? m.with.toFixed(2) :
                        m.with.toString();

            const withoutStr = m.format === 'percent' ? `${m.without.toFixed(2)}%` :
                m.format === 'money' ? `$${m.without.toFixed(2)}` :
                    m.format === 'decimal' ? m.without.toFixed(2) :
                        m.without.toString();

            console.log(`│ ${m.name.padEnd(23)} │ ${withStr.padStart(16)} │ ${withoutStr.padStart(16)} │ ${diffStr.padStart(14)} │`);
        });

        console.log('└─────────────────────────┴──────────────────┴──────────────────┴────────────────┘');

        // Analisi motivi chiusura
        console.log('\n' + '='.repeat(80));
        console.log('📋 MOTIVI CHIUSURA POSIZIONI');
        console.log('='.repeat(80));

        console.log('\nCON Take Profit:');
        Object.entries(resultWithTP.closureReasons).forEach(([reason, count]) => {
            const pct = (count / resultWithTP.summary.totalTrades * 100).toFixed(1);
            console.log(`   ${reason.padEnd(20)}: ${count.toString().padStart(3)} (${pct.padStart(5)}%)`);
        });

        console.log('\nSENZA Take Profit:');
        Object.entries(resultNoTP.closureReasons).forEach(([reason, count]) => {
            const pct = (count / resultNoTP.summary.totalTrades * 100).toFixed(1);
            console.log(`   ${reason.padEnd(20)}: ${count.toString().padStart(3)} (${pct.padStart(5)}%)`);
        });

        // Analisi trade che sarebbero stati chiusi in TP
        const takeProfitCount = resultWithTP.closureReasons['TAKE_PROFIT'] || 0;
        const takeProfitPct = (takeProfitCount / resultWithTP.summary.totalTrades * 100);

        console.log('\n' + '='.repeat(80));
        console.log('🔍 ANALISI IMPATTO TAKE PROFIT');
        console.log('='.repeat(80));

        console.log(`\n📊 Trade chiusi in TAKE PROFIT: ${takeProfitCount} (${takeProfitPct.toFixed(1)}%)`);

        const returnDiff = resultNoTP.summary.totalReturn - resultWithTP.summary.totalReturn;

        if (returnDiff > 0) {
            console.log(`\n✅ SENZA take profit MIGLIORA le performance di ${returnDiff.toFixed(2)}%`);
            console.log(`   → Il take profit sta "limitando" i profitti chiudendo troppo presto`);
            console.log(`   → Il trailing stop lascia correre i vincenti più a lungo`);
        } else {
            console.log(`\n❌ SENZA take profit PEGGIORA le performance di ${Math.abs(returnDiff).toFixed(2)}%`);
            console.log(`   → Il take profit sta PROTEGGENDO i profitti`);
            console.log(`   → Senza TP, i trade vincenti rischiano di invertire`);
        }

        // Analisi vincite medie
        const avgWinDiff = resultNoTP.summary.avgWin - resultWithTP.summary.avgWin;
        console.log(`\n💰 Media Vincita:`);
        console.log(`   CON TP: $${resultWithTP.summary.avgWin.toFixed(2)}`);
        console.log(`   SENZA TP: $${resultNoTP.summary.avgWin.toFixed(2)}`);
        console.log(`   Differenza: ${avgWinDiff >= 0 ? '+' : ''}$${avgWinDiff.toFixed(2)}`);

        if (avgWinDiff > 0) {
            console.log(`   → Senza TP le vincite sono MAGGIORI (+${((avgWinDiff / resultWithTP.summary.avgWin) * 100).toFixed(1)}%)`);
        }

        // Simulazione con $1080
        console.log('\n' + '='.repeat(80));
        console.log('💰 SIMULAZIONE CON CAPITALE $1,080');
        console.log('='.repeat(80));

        const capital = 1080;
        const profitWithTP = capital * (resultWithTP.summary.totalReturn / 100);
        const profitNoTP = capital * (resultNoTP.summary.totalReturn / 100);

        console.log('\nCON Take Profit:');
        console.log(`   Capitale Finale: $${(capital + profitWithTP).toFixed(2)}`);
        console.log(`   Profitto: ${profitWithTP >= 0 ? '+' : ''}$${profitWithTP.toFixed(2)}`);

        console.log('\nSENZA Take Profit:');
        console.log(`   Capitale Finale: $${(capital + profitNoTP).toFixed(2)}`);
        console.log(`   Profitto: ${profitNoTP >= 0 ? '+' : ''}$${profitNoTP.toFixed(2)}`);

        console.log(`\nDifferenza: ${(profitNoTP - profitWithTP) >= 0 ? '+' : ''}$${(profitNoTP - profitWithTP).toFixed(2)}`);

        // Conclusioni
        console.log('\n' + '='.repeat(80));
        console.log('💡 CONCLUSIONI');
        console.log('='.repeat(80));

        if (returnDiff > 0.5) {
            console.log('\n🎯 RACCOMANDAZIONE: RIMUOVI il take profit fisso');
            console.log(`   → Senza TP guadagni ${returnDiff.toFixed(2)}% in più`);
            console.log(`   → Con $1,080: ${(profitNoTP - profitWithTP) >= 0 ? '+' : ''}$${(profitNoTP - profitWithTP).toFixed(2)} in più`);
            console.log('\n   Strategia consigliata:');
            console.log('   ✅ Usa SOLO trailing stop (lascia correre i vincenti)');
            console.log('   ✅ Mantieni stop loss (protegge dalle perdite)');
            console.log('   ❌ Rimuovi take profit fisso (limita i profitti)');
        } else if (returnDiff < -0.5) {
            console.log('\n🎯 RACCOMANDAZIONE: MANTIENI il take profit');
            console.log(`   → Il take profit protegge i profitti da inversioni`);
            console.log(`   → Senza TP perderesti ${Math.abs(returnDiff).toFixed(2)}% in più`);
            console.log(`   → Con $1,080: ${Math.abs(profitNoTP - profitWithTP).toFixed(2)}$ in meno`);
        } else {
            console.log('\n🎯 RACCOMANDAZIONE: Impatto NEUTRO');
            console.log(`   → La differenza è marginale (${Math.abs(returnDiff).toFixed(2)}%)`);
            console.log('   → Puoi scegliere in base alla tua preferenza:');
            console.log('     • CON TP: Più sicuro, profitti garantiti');
            console.log('     • SENZA TP: Più aggressivo, lascia correre i vincenti');
        }

        // Salva risultati
        const fs = require('fs');
        fs.writeFileSync('./btc_no_takeprofit_test.json', JSON.stringify({
            symbol: 'BTC',
            testType: 'Take Profit Impact Analysis',
            testPeriod: '60 days',
            testDate: new Date().toISOString(),
            withTakeProfit: resultWithTP.summary,
            withoutTakeProfit: resultNoTP.summary,
            difference: {
                return: returnDiff,
                profitWith1080: profitNoTP - profitWithTP,
                avgWinDiff: avgWinDiff
            },
            recommendation: returnDiff > 0.5 ? 'REMOVE take profit - use only trailing stop' :
                returnDiff < -0.5 ? 'KEEP take profit' :
                    'NEUTRAL - personal preference'
        }, null, 2));

        console.log('\n' + '='.repeat(80));
        console.log('✅ Test completato!');
        console.log('📁 Risultati salvati in: btc_no_takeprofit_test.json');
        console.log('='.repeat(80) + '\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Errore:', error);
        process.exit(1);
    }
}

testBTCNoTakeProfit();
