/**
 * Backtest ICP (Internet Computer) - 60 Giorni
 * Test dopo fix normalizzazione simboli e prezzi
 */

const BacktestAnalyzer = require('./backtest_analyzer');
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
    console.log(`📥 Scaricamento dati ${symbol}...`);

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

    console.log(`   ✅ ${allKlines.length} candele scaricate`);

    // Inserisci nel DB
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
        } catch (error) {
            // Ignora duplicati
        }
    }

    console.log(`   💾 ${inserted} candele inserite nel DB\n`);
    return allKlines.length;
}

async function testICP() {
    try {
        console.log('\n🚀 BACKTEST ICP (Internet Computer) - 60 GIORNI\n');
        console.log('='.repeat(80));
        console.log('📝 Test dopo fix normalizzazione simboli e recupero prezzi\n');

        // Scarica dati ICP
        await downloadHistoricalData('ICPUSDT', 'icp', 60);

        // Esegui backtest
        console.log('🔄 Esecuzione backtest 60 giorni su ICP...\n');
        const analyzer = new BacktestAnalyzer('icp', 1000, 100);
        const result = await analyzer.runBacktest(60);

        // Stampa risultati dettagliati
        console.log('\n' + '='.repeat(80));
        console.log('📊 RISULTATI ICP (60 GIORNI)');
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

        // Analisi trade
        console.log('\n' + '─'.repeat(80));
        console.log('📋 DETTAGLIO TRADE');
        console.log('─'.repeat(80));

        const winningTrades = result.trades.filter(t => t.pnl > 0);
        const losingTrades = result.trades.filter(t => t.pnl < 0);

        console.log(`\n🟢 TRADE VINCENTI (${winningTrades.length}):`);
        winningTrades.slice(0, 5).forEach((t, idx) => {
            console.log(`   ${idx + 1}. ${t.type} @ $${t.entryPrice.toFixed(4)} → $${t.exitPrice.toFixed(4)} | P&L: +$${t.pnl.toFixed(2)} (${t.pnlPct.toFixed(2)}%) - ${t.reason}`);
        });
        if (winningTrades.length > 5) {
            console.log(`   ... e altri ${winningTrades.length - 5} trade vincenti`);
        }

        console.log(`\n🔴 TRADE PERDENTI (${losingTrades.length}):`);
        losingTrades.slice(0, 5).forEach((t, idx) => {
            console.log(`   ${idx + 1}. ${t.type} @ $${t.entryPrice.toFixed(4)} → $${t.exitPrice.toFixed(4)} | P&L: -$${Math.abs(t.pnl).toFixed(2)} (${t.pnlPct.toFixed(2)}%) - ${t.reason}`);
        });
        if (losingTrades.length > 5) {
            console.log(`   ... e altri ${losingTrades.length - 5} trade perdenti`);
        }

        // Confronto con capitale $1080
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

        // Proiezione mensile
        const monthlyReturn = result.summary.totalReturn / 2;
        console.log(`\n📅 Rendimento Mensile Medio: ${monthlyReturn >= 0 ? '+' : ''}${monthlyReturn.toFixed(2)}%`);
        console.log(`💵 Profitto Mensile Medio: ${(profit1080 / 2) >= 0 ? '+' : ''}$${(profit1080 / 2).toFixed(2)}`);

        // Salva risultati
        const fs = require('fs');
        fs.writeFileSync('./icp_backtest_results.json', JSON.stringify({
            symbol: 'ICP',
            testPeriod: '60 days',
            testDate: new Date().toISOString(),
            summary: result.summary,
            trades: result.trades,
            capitalSimulation: {
                initial: capital1080,
                final: final1080,
                profit: profit1080,
                monthlyReturn: monthlyReturn
            }
        }, null, 2));

        console.log('\n' + '='.repeat(80));
        console.log('✅ Test ICP completato!');
        console.log('📁 Risultati salvati in: icp_backtest_results.json');
        console.log('='.repeat(80) + '\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Errore:', error);
        process.exit(1);
    }
}

testICP();
