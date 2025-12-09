/**
 * Script per testare il bot su multipli simboli
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
    console.log(`\n📥 Scaricamento dati per ${symbol}...`);

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
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            console.error(`❌ Errore: ${error.message}`);
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

    console.log(`   💾 ${inserted} candele inserite nel DB`);
    return inserted;
}

async function runMultiSymbolBacktest() {
    try {
        console.log('🚀 BACKTEST MULTI-SIMBOLO\n');
        console.log('='.repeat(70));

        const symbols = [
            { binance: 'ETHUSDT', db: 'ethereum', name: 'Ethereum' },
            { binance: 'SOLUSDT', db: 'solana', name: 'Solana' }
        ];

        const results = [];

        for (const sym of symbols) {
            console.log(`\n${'='.repeat(70)}`);
            console.log(`📊 TESTING: ${sym.name} (${sym.binance})`);
            console.log('='.repeat(70));

            // Scarica dati se necessari
            await downloadHistoricalData(sym.binance, sym.db, 60);

            // Esegui backtest
            const analyzer = new BacktestAnalyzer(sym.db, 1000, 100);
            const result = await analyzer.runBacktest(30);

            results.push({
                symbol: sym.name,
                ...result.summary
            });

            // Stampa risultati
            console.log('\n' + '─'.repeat(70));
            console.log(`📊 RISULTATI ${sym.name.toUpperCase()}`);
            console.log('─'.repeat(70));
            console.log(`💰 Capitale Iniziale: $${result.summary.initialBalance.toFixed(2)}`);
            console.log(`💵 Capitale Finale: $${result.summary.finalBalance.toFixed(2)}`);
            console.log(`📈 Rendimento: ${result.summary.totalReturn >= 0 ? '+' : ''}${result.summary.totalReturn.toFixed(2)}%`);
            console.log(`📊 Trade: ${result.summary.totalTrades} (✅ ${result.summary.winningTrades} | ❌ ${result.summary.losingTrades})`);
            console.log(`🎯 Win Rate: ${result.summary.winRate.toFixed(1)}%`);
            console.log(`💎 Profit Factor: ${result.summary.profitFactor === Infinity ? '∞' : result.summary.profitFactor.toFixed(2)}`);
            console.log(`⚠️  Max Drawdown: ${result.summary.maxDrawdown.toFixed(2)}%`);
            console.log(`📐 Sharpe Ratio: ${result.summary.sharpeRatio.toFixed(2)}`);
        }

        // Riepilogo comparativo
        console.log('\n\n' + '='.repeat(70));
        console.log('📊 RIEPILOGO COMPARATIVO');
        console.log('='.repeat(70));
        console.log('\nSimbolo       | Return  | Win Rate | Profit Factor | Max DD | Sharpe');
        console.log('-'.repeat(70));

        results.forEach(r => {
            const returnStr = (r.totalReturn >= 0 ? '+' : '') + r.totalReturn.toFixed(2) + '%';
            const pfStr = r.profitFactor === Infinity ? '∞' : r.profitFactor.toFixed(2);
            console.log(
                `${r.symbol.padEnd(13)} | ${returnStr.padStart(7)} | ${r.winRate.toFixed(1).padStart(8)}% | ${pfStr.padStart(13)} | ${r.maxDrawdown.toFixed(2).padStart(6)}% | ${r.sharpeRatio.toFixed(2).padStart(6)}`
            );
        });

        console.log('='.repeat(70));

        // Trova il migliore
        const best = results.reduce((prev, curr) =>
            curr.totalReturn > prev.totalReturn ? curr : prev
        );

        console.log(`\n🏆 MIGLIOR PERFORMER: ${best.symbol} (${best.totalReturn >= 0 ? '+' : ''}${best.totalReturn.toFixed(2)}%)`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Errore:', error);
        process.exit(1);
    }
}

runMultiSymbolBacktest();
