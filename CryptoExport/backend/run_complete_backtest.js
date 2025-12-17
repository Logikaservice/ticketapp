/**
 * Script per testare TUTTI i simboli supportati dal progetto
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
    console.log(`   📥 Scaricamento ${symbol}...`);

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
            await new Promise(resolve => setTimeout(resolve, 300)); // Ridotto delay
        } catch (error) {
            console.error(`      ❌ Errore: ${error.message}`);
            break;
        }
    }

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

    console.log(`      ✅ ${inserted} candele inserite`);
    return inserted;
}

async function runCompleteBacktest() {
    try {
        console.log('\n🚀 BACKTEST COMPLETO - TUTTI I SIMBOLI\n');
        console.log('='.repeat(80));

        // Tutti i simboli supportati dal progetto
        const symbols = [
            { binance: 'BTCUSDT', db: 'bitcoin', name: 'Bitcoin', emoji: '₿' },
            { binance: 'ETHUSDT', db: 'ethereum', name: 'Ethereum', emoji: 'Ξ' },
            { binance: 'SOLUSDT', db: 'solana', name: 'Solana', emoji: '◎' },
            { binance: 'ADAUSDT', db: 'cardano', name: 'Cardano', emoji: '₳' },
            { binance: 'XRPUSDT', db: 'ripple', name: 'XRP', emoji: '✕' },
            { binance: 'DOTUSDT', db: 'polkadot', name: 'Polkadot', emoji: '●' },
            { binance: 'DOGEUSDT', db: 'dogecoin', name: 'Dogecoin', emoji: 'Ð' },
            { binance: 'LINKUSDT', db: 'chainlink', name: 'Chainlink', emoji: '⬡' },
            { binance: 'LTCUSDT', db: 'litecoin', name: 'Litecoin', emoji: 'Ł' }
        ];

        const results = [];
        let completedTests = 0;

        for (const sym of symbols) {
            try {
                console.log(`\n[${completedTests + 1}/${symbols.length}] ${sym.emoji} ${sym.name.toUpperCase()}`);
                console.log('─'.repeat(80));

                // Scarica dati
                await downloadHistoricalData(sym.binance, sym.db, 60);

                // Esegui backtest
                console.log(`   🔄 Esecuzione backtest...`);
                const analyzer = new BacktestAnalyzer(sym.db, 1000, 100);
                const result = await analyzer.runBacktest(30);

                results.push({
                    symbol: sym.name,
                    emoji: sym.emoji,
                    ...result.summary
                });

                // Stampa risultato rapido
                const returnColor = result.summary.totalReturn > 0 ? '🟢' : result.summary.totalReturn < 0 ? '🔴' : '⚪';
                console.log(`   ${returnColor} Return: ${result.summary.totalReturn >= 0 ? '+' : ''}${result.summary.totalReturn.toFixed(2)}% | Win Rate: ${result.summary.winRate.toFixed(1)}% | PF: ${result.summary.profitFactor.toFixed(2)}`);

                completedTests++;
            } catch (error) {
                console.error(`   ❌ Errore su ${sym.name}: ${error.message}`);
            }
        }

        // Ordina per rendimento
        results.sort((a, b) => b.totalReturn - a.totalReturn);

        // Report finale
        console.log('\n\n' + '='.repeat(80));
        console.log('📊 CLASSIFICA FINALE - PERFORMANCE RANKING');
        console.log('='.repeat(80));
        console.log('\nPos | Simbolo       | Return  | Win Rate | Profit F. | Max DD | Sharpe | Trades');
        console.log('-'.repeat(80));

        results.forEach((r, idx) => {
            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '  ';
            const returnStr = (r.totalReturn >= 0 ? '+' : '') + r.totalReturn.toFixed(2) + '%';
            const pfStr = r.profitFactor === Infinity ? '∞' : r.profitFactor.toFixed(2);

            console.log(
                `${medal} ${(idx + 1).toString().padStart(2)} | ${(r.emoji + ' ' + r.symbol).padEnd(13)} | ${returnStr.padStart(7)} | ${r.winRate.toFixed(1).padStart(8)}% | ${pfStr.padStart(9)} | ${r.maxDrawdown.toFixed(2).padStart(6)}% | ${r.sharpeRatio.toFixed(2).padStart(6)} | ${r.totalTrades.toString().padStart(6)}`
            );
        });

        console.log('='.repeat(80));

        // Statistiche aggregate
        const avgReturn = results.reduce((sum, r) => sum + r.totalReturn, 0) / results.length;
        const avgWinRate = results.reduce((sum, r) => sum + r.winRate, 0) / results.length;
        const avgPF = results.reduce((sum, r) => sum + (r.profitFactor === Infinity ? 0 : r.profitFactor), 0) / results.length;
        const profitable = results.filter(r => r.totalReturn > 0).length;

        console.log('\n📈 STATISTICHE AGGREGATE');
        console.log('─'.repeat(80));
        console.log(`   Rendimento Medio: ${avgReturn >= 0 ? '+' : ''}${avgReturn.toFixed(2)}%`);
        console.log(`   Win Rate Medio: ${avgWinRate.toFixed(1)}%`);
        console.log(`   Profit Factor Medio: ${avgPF.toFixed(2)}`);
        console.log(`   Asset Profittevoli: ${profitable}/${results.length} (${(profitable / results.length * 100).toFixed(1)}%)`);

        // Top 3 e Bottom 3
        console.log('\n🏆 TOP 3 PERFORMERS');
        results.slice(0, 3).forEach((r, idx) => {
            console.log(`   ${idx + 1}. ${r.emoji} ${r.symbol}: ${r.totalReturn >= 0 ? '+' : ''}${r.totalReturn.toFixed(2)}%`);
        });

        console.log('\n⚠️  BOTTOM 3 PERFORMERS');
        results.slice(-3).reverse().forEach((r, idx) => {
            console.log(`   ${results.length - idx}. ${r.emoji} ${r.symbol}: ${r.totalReturn >= 0 ? '+' : ''}${r.totalReturn.toFixed(2)}%`);
        });

        console.log('\n' + '='.repeat(80));
        console.log('✅ Test completato con successo!');
        console.log('='.repeat(80) + '\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Errore:', error);
        process.exit(1);
    }
}

runCompleteBacktest();
