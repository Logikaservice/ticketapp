/**
 * Test BITCOIN con Backtest AVANZATO - SENZA STOP LOSS
 * Verifica se lo stop loss sta limitando le performance
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

async function testBTCNoStopLoss() {
    try {
        console.log('\n🚀 BACKTEST BITCOIN - SENZA STOP LOSS\n');
        console.log('='.repeat(80));
        console.log('🔬 ESPERIMENTO: Verifica impatto dello stop loss sulle performance\n');

        // Scarica dati
        await downloadHistoricalData('BTCUSDT', 'bitcoin', 60);

        // Test CON stop loss (normale)
        console.log('📊 Test 1: CON Stop Loss (configurazione normale)...\n');
        const analyzerWithSL = new AdvancedBacktestAnalyzer('bitcoin', 1000, 100);
        const resultWithSL = await analyzerWithSL.runBacktest(60);

        // Test SENZA stop loss
        console.log('\n📊 Test 2: SENZA Stop Loss...\n');
        const analyzerNoSL = new AdvancedBacktestAnalyzer('bitcoin', 1000, 100);

        // Disabilita stop loss impostando un valore altissimo
        analyzerNoSL.config.stopLossPercent = 100; // Praticamente disabilitato
        analyzerNoSL.config.trailingStopEnabled = false; // Disabilita anche trailing

        const resultNoSL = await analyzerNoSL.runBacktest(60);

        // Confronto dettagliato
        console.log('\n' + '='.repeat(80));
        console.log('📊 CONFRONTO: CON vs SENZA Stop Loss');
        console.log('='.repeat(80));

        console.log('\n┌─────────────────────────┬──────────────────┬──────────────────┬────────────────┐');
        console.log('│ Metrica                 │ CON Stop Loss    │ SENZA Stop Loss  │ Differenza     │');
        console.log('├─────────────────────────┼──────────────────┼──────────────────┼────────────────┤');

        const metrics = [
            { name: 'Return %', with: resultWithSL.summary.totalReturn, without: resultNoSL.summary.totalReturn, format: 'percent' },
            { name: 'Trade Totali', with: resultWithSL.summary.totalTrades, without: resultNoSL.summary.totalTrades, format: 'number' },
            { name: 'Win Rate %', with: resultWithSL.summary.winRate, without: resultNoSL.summary.winRate, format: 'percent' },
            { name: 'Profit Factor', with: resultWithSL.summary.profitFactor, without: resultNoSL.summary.profitFactor, format: 'decimal' },
            { name: 'Media Vincita $', with: resultWithSL.summary.avgWin, without: resultNoSL.summary.avgWin, format: 'money' },
            { name: 'Media Perdita $', with: resultWithSL.summary.avgLoss, without: resultNoSL.summary.avgLoss, format: 'money' },
            { name: 'Max Drawdown %', with: resultWithSL.summary.maxDrawdown, without: resultNoSL.summary.maxDrawdown, format: 'percent' }
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

        console.log('\nCON Stop Loss:');
        Object.entries(resultWithSL.closureReasons).forEach(([reason, count]) => {
            const pct = (count / resultWithSL.summary.totalTrades * 100).toFixed(1);
            console.log(`   ${reason.padEnd(20)}: ${count.toString().padStart(3)} (${pct.padStart(5)}%)`);
        });

        console.log('\nSENZA Stop Loss:');
        Object.entries(resultNoSL.closureReasons).forEach(([reason, count]) => {
            const pct = (count / resultNoSL.summary.totalTrades * 100).toFixed(1);
            console.log(`   ${reason.padEnd(20)}: ${count.toString().padStart(3)} (${pct.padStart(5)}%)`);
        });

        // Analisi trade che sarebbero stati chiusi in SL
        const stopLossCount = resultWithSL.closureReasons['STOP_LOSS'] || 0;
        const stopLossPct = (stopLossCount / resultWithSL.summary.totalTrades * 100);

        console.log('\n' + '='.repeat(80));
        console.log('🔍 ANALISI IMPATTO STOP LOSS');
        console.log('='.repeat(80));

        console.log(`\n📊 Trade chiusi in STOP LOSS: ${stopLossCount} (${stopLossPct.toFixed(1)}%)`);

        const returnDiff = resultNoSL.summary.totalReturn - resultWithSL.summary.totalReturn;

        if (returnDiff > 0) {
            console.log(`\n✅ SENZA stop loss MIGLIORA le performance di ${returnDiff.toFixed(2)}%`);
            console.log(`   → Lo stop loss sta "tagliando" trade che potrebbero recuperare`);
        } else {
            console.log(`\n❌ SENZA stop loss PEGGIORA le performance di ${Math.abs(returnDiff).toFixed(2)}%`);
            console.log(`   → Lo stop loss sta PROTEGGENDO da perdite maggiori`);
        }

        // Simulazione con $1080
        console.log('\n' + '='.repeat(80));
        console.log('💰 SIMULAZIONE CON CAPITALE $1,080');
        console.log('='.repeat(80));

        const capital = 1080;
        const profitWithSL = capital * (resultWithSL.summary.totalReturn / 100);
        const profitNoSL = capital * (resultNoSL.summary.totalReturn / 100);

        console.log('\nCON Stop Loss:');
        console.log(`   Capitale Finale: $${(capital + profitWithSL).toFixed(2)}`);
        console.log(`   Profitto: ${profitWithSL >= 0 ? '+' : ''}$${profitWithSL.toFixed(2)}`);

        console.log('\nSENZA Stop Loss:');
        console.log(`   Capitale Finale: $${(capital + profitNoSL).toFixed(2)}`);
        console.log(`   Profitto: ${profitNoSL >= 0 ? '+' : ''}$${profitNoSL.toFixed(2)}`);

        console.log(`\nDifferenza: ${(profitNoSL - profitWithSL) >= 0 ? '+' : ''}$${(profitNoSL - profitWithSL).toFixed(2)}`);

        // Conclusioni
        console.log('\n' + '='.repeat(80));
        console.log('💡 CONCLUSIONI');
        console.log('='.repeat(80));

        if (returnDiff > 1) {
            console.log('\n🎯 RACCOMANDAZIONE: RIMUOVI o ALLARGA lo stop loss');
            console.log(`   → Senza SL guadagni ${returnDiff.toFixed(2)}% in più`);
            console.log(`   → Con $1,080: ${(profitNoSL - profitWithSL) >= 0 ? '+' : ''}$${(profitNoSL - profitWithSL).toFixed(2)} in più`);
            console.log('\n   Opzioni:');
            console.log('   1. Rimuovi completamente lo stop loss');
            console.log('   2. Allarga lo stop loss da 2% a 5-10%');
            console.log('   3. Usa solo trailing stop (senza stop loss fisso)');
        } else if (returnDiff < -1) {
            console.log('\n🎯 RACCOMANDAZIONE: MANTIENI lo stop loss');
            console.log(`   → Lo stop loss ti protegge da perdite maggiori`);
            console.log(`   → Senza SL perderesti ${Math.abs(returnDiff).toFixed(2)}% in più`);
            console.log(`   → Con $1,080: ${Math.abs(profitNoSL - profitWithSL).toFixed(2)}$ in meno`);
        } else {
            console.log('\n🎯 RACCOMANDAZIONE: Impatto NEUTRO');
            console.log(`   → La differenza è marginale (${Math.abs(returnDiff).toFixed(2)}%)`);
            console.log('   → Mantieni lo stop loss per sicurezza');
        }

        // Salva risultati
        const fs = require('fs');
        fs.writeFileSync('./btc_no_stoploss_test.json', JSON.stringify({
            symbol: 'BTC',
            testType: 'Stop Loss Impact Analysis',
            testPeriod: '60 days',
            testDate: new Date().toISOString(),
            withStopLoss: resultWithSL.summary,
            withoutStopLoss: resultNoSL.summary,
            difference: {
                return: returnDiff,
                profitWith1080: profitNoSL - profitWithSL
            },
            recommendation: returnDiff > 1 ? 'REMOVE or WIDEN stop loss' :
                returnDiff < -1 ? 'KEEP stop loss' :
                    'NEUTRAL - keep for safety'
        }, null, 2));

        console.log('\n' + '='.repeat(80));
        console.log('✅ Test completato!');
        console.log('📁 Risultati salvati in: btc_no_stoploss_test.json');
        console.log('='.repeat(80) + '\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Errore:', error);
        process.exit(1);
    }
}

testBTCNoStopLoss();
