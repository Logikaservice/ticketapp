/**
 * Test BITCOIN con Backtest AVANZATO
 * Usa la logica COMPLETA del bot (filtri professionali, trailing stop, ecc.)
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

async function testBTCAdvanced() {
    try {
        console.log('\n🚀 BACKTEST AVANZATO BITCOIN - CON LOGICA COMPLETA DEL BOT\n');
        console.log('='.repeat(80));
        console.log('✅ Include: Filtri professionali, trailing stop, risk management\n');

        // Scarica dati
        await downloadHistoricalData('BTCUSDT', 'bitcoin', 60);

        // Esegui backtest AVANZATO
        const analyzer = new AdvancedBacktestAnalyzer('bitcoin', 1000, 100);
        const result = await analyzer.runBacktest(60);

        // Stampa risultati
        console.log('\n' + '='.repeat(80));
        console.log('📊 RISULTATI BITCOIN - BACKTEST AVANZATO (60 GIORNI)');
        console.log('='.repeat(80));
        console.log(`\n💰 Capitale Iniziale: $${result.summary.initialBalance.toFixed(2)}`);
        console.log(`💵 Capitale Finale: $${result.summary.finalBalance.toFixed(2)}`);
        console.log(`📈 Rendimento Totale: ${result.summary.totalReturn >= 0 ? '+' : ''}${result.summary.totalReturn.toFixed(2)}%`);
        console.log('');
        console.log(`📊 Trade Totali: ${result.summary.totalTrades}`);
        console.log(`✅ Trade Vincenti: ${result.summary.winningTrades} (${result.summary.winRate.toFixed(1)}%)`);
        console.log(`❌ Trade Perdenti: ${result.summary.losingTrades}`);
        console.log('');
        console.log(`💎 Profit Factor: ${result.summary.profitFactor === Infinity ? '∞' : result.summary.profitFactor.toFixed(2)}`);
        console.log(`📊 Media Vincita: $${result.summary.avgWin.toFixed(2)}`);
        console.log(`📉 Media Perdita: $${result.summary.avgLoss.toFixed(2)}`);
        console.log(`⚠️  Max Drawdown: ${result.summary.maxDrawdown.toFixed(2)}%`);
        console.log(`📐 Sharpe Ratio: ${result.summary.sharpeRatio.toFixed(2)}`);

        // Analisi motivi chiusura
        console.log('\n' + '─'.repeat(80));
        console.log('📋 MOTIVI CHIUSURA POSIZIONI');
        console.log('─'.repeat(80));
        Object.entries(result.closureReasons).forEach(([reason, count]) => {
            const pct = (count / result.summary.totalTrades * 100).toFixed(1);
            console.log(`   ${reason.padEnd(20)}: ${count.toString().padStart(3)} trade (${pct}%)`);
        });

        // Top/Bottom trades
        const sortedTrades = [...result.trades].sort((a, b) => b.pnl - a.pnl);

        console.log('\n' + '─'.repeat(80));
        console.log('🏆 TOP 5 TRADE MIGLIORI');
        console.log('─'.repeat(80));
        sortedTrades.slice(0, 5).forEach((t, idx) => {
            const duration = ((t.exitTime - t.openTime) / (1000 * 60)).toFixed(0);
            console.log(`   ${idx + 1}. ${t.type} @ $${t.entryPrice.toFixed(2)} → $${t.exitPrice.toFixed(2)} | +$${t.pnl.toFixed(2)} (${t.pnlPct.toFixed(2)}%) | ${duration}min | ${t.reason}`);
        });

        console.log('\n' + '─'.repeat(80));
        console.log('💔 TOP 5 TRADE PEGGIORI');
        console.log('─'.repeat(80));
        sortedTrades.slice(-5).reverse().forEach((t, idx) => {
            const duration = ((t.exitTime - t.openTime) / (1000 * 60)).toFixed(0);
            console.log(`   ${idx + 1}. ${t.type} @ $${t.entryPrice.toFixed(2)} → $${t.exitPrice.toFixed(2)} | -$${Math.abs(t.pnl).toFixed(2)} (${t.pnlPct.toFixed(2)}%) | ${duration}min | ${t.reason}`);
        });

        // Simulazione con $1080
        console.log('\n' + '='.repeat(80));
        console.log('💰 SIMULAZIONE CON CAPITALE $1,080');
        console.log('='.repeat(80));

        const capital1080 = 1080;
        const profit1080 = capital1080 * (result.summary.totalReturn / 100);
        const final1080 = capital1080 + profit1080;

        console.log(`\nCapitale Iniziale: $${capital1080.toFixed(2)}`);
        console.log(`Return: ${result.summary.totalReturn >= 0 ? '+' : ''}${result.summary.totalReturn.toFixed(2)}%`);
        console.log(`Profitto/Perdita: ${profit1080 >= 0 ? '+' : ''}$${profit1080.toFixed(2)}`);
        console.log(`Capitale Finale: $${final1080.toFixed(2)}`);

        const monthlyReturn = result.summary.totalReturn / 2;
        console.log(`\n📅 Rendimento Mensile Medio: ${monthlyReturn >= 0 ? '+' : ''}${monthlyReturn.toFixed(2)}%`);
        console.log(`💵 Profitto Mensile Medio: ${(profit1080 / 2) >= 0 ? '+' : ''}$${(profit1080 / 2).toFixed(2)}`);

        // Confronto con backtest semplice
        console.log('\n' + '='.repeat(80));
        console.log('📊 CONFRONTO: Backtest Semplice vs Avanzato');
        console.log('='.repeat(80));
        console.log('\nBacktest Semplice (60 giorni):');
        console.log('   Return: +0.91%');
        console.log('   Trade: 35');
        console.log('   Win Rate: 45.7%');
        console.log('\nBacktest AVANZATO (60 giorni):');
        console.log(`   Return: ${result.summary.totalReturn >= 0 ? '+' : ''}${result.summary.totalReturn.toFixed(2)}%`);
        console.log(`   Trade: ${result.summary.totalTrades}`);
        console.log(`   Win Rate: ${result.summary.winRate.toFixed(1)}%`);

        const improvement = result.summary.totalReturn - 0.91;
        console.log(`\n${improvement >= 0 ? '📈 MIGLIORAMENTO' : '📉 PEGGIORAMENTO'}: ${improvement >= 0 ? '+' : ''}${improvement.toFixed(2)}%`);

        // Salva risultati
        const fs = require('fs');
        fs.writeFileSync('./btc_advanced_backtest.json', JSON.stringify({
            symbol: 'BTC',
            testType: 'ADVANCED (Full Bot Logic)',
            testPeriod: '60 days',
            testDate: new Date().toISOString(),
            summary: result.summary,
            closureReasons: result.closureReasons,
            topTrades: sortedTrades.slice(0, 10),
            worstTrades: sortedTrades.slice(-10).reverse(),
            capitalSimulation: {
                initial: capital1080,
                final: final1080,
                profit: profit1080,
                monthlyReturn: monthlyReturn
            },
            comparison: {
                simpleBacktest: { return: 0.91, trades: 35, winRate: 45.7 },
                advancedBacktest: { return: result.summary.totalReturn, trades: result.summary.totalTrades, winRate: result.summary.winRate },
                improvement: improvement
            }
        }, null, 2));

        console.log('\n' + '='.repeat(80));
        console.log('✅ Test AVANZATO Bitcoin completato!');
        console.log('📁 Risultati salvati in: btc_advanced_backtest.json');
        console.log('='.repeat(80) + '\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Errore:', error);
        process.exit(1);
    }
}

testBTCAdvanced();
