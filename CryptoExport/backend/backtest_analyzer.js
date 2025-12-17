/**
 * Backtest Analyzer - Testa la strategia su dati storici
 * Genera statistiche e grafico equity curve
 */

const { dbAll } = require('./crypto_db');
const signalGenerator = require('./services/BidirectionalSignalGenerator');

class BacktestAnalyzer {
    constructor(symbol = 'bitcoin', initialBalance = 1000, tradeSize = 100) {
        this.symbol = symbol;
        this.initialBalance = initialBalance;
        this.balance = initialBalance;
        this.tradeSize = tradeSize;
        this.positions = [];
        this.closedTrades = [];
        this.equityCurve = [];
    }

    async runBacktest(daysBack = 30) {
        console.log(`\n📊 [BACKTEST] Avvio test su ${this.symbol} (ultimi ${daysBack} giorni)...`);

        // 1. Recupera dati storici
        const endTime = Date.now();
        const startTime = endTime - (daysBack * 24 * 60 * 60 * 1000);

        const klines = await dbAll(
            `SELECT * FROM klines 
             WHERE symbol = ? AND interval = '15m' 
             AND open_time >= ? AND open_time <= ?
             ORDER BY open_time ASC`,
            [this.symbol, startTime, endTime]
        );

        if (!klines || klines.length < 200) {
            throw new Error(`Dati insufficienti per il backtest (trovati ${klines?.length || 0} candele)`);
        }

        console.log(`✅ Caricati ${klines.length} candele storiche`);

        // 2. Simula trading candela per candela
        for (let i = 150; i < klines.length; i++) {
            const history = klines.slice(Math.max(0, i - 150), i).map(k => ({
                timestamp: new Date(Number(k.open_time)).toISOString(),
                open: parseFloat(k.open_price),
                high: parseFloat(k.high_price),
                low: parseFloat(k.low_price),
                close: parseFloat(k.close_price),
                volume: parseFloat(k.volume || 0)
            }));

            const currentCandle = history[history.length - 1];
            const currentPrice = currentCandle.close;
            const currentTime = Number(klines[i].open_time);

            // Genera segnale
            const signal = signalGenerator.generateSignal(history, this.symbol);

            // Gestisci posizioni aperte (check stop loss / take profit)
            this.updateOpenPositions(currentPrice, currentTime);

            // Apri nuova posizione se c'è segnale e non abbiamo già posizioni
            if (this.positions.length === 0 && signal.direction !== 'NEUTRAL') {
                this.openPosition(signal, currentPrice, currentTime);
            }

            // Registra equity
            this.equityCurve.push({
                time: currentTime,
                balance: this.calculateEquity(currentPrice)
            });
        }

        // 3. Chiudi eventuali posizioni rimaste aperte
        const finalPrice = parseFloat(klines[klines.length - 1].close_price);
        this.positions.forEach(pos => {
            this.closePosition(pos, finalPrice, Date.now(), 'BACKTEST_END');
        });

        // 4. Calcola statistiche
        return this.calculateStatistics();
    }

    openPosition(signal, price, time) {
        const position = {
            id: `BT_${Date.now()}_${Math.random()}`,
            type: signal.direction, // LONG o SHORT
            entryPrice: price,
            volume: this.tradeSize / price,
            stopLoss: signal.direction === 'LONG'
                ? price * 0.98  // -2% per LONG
                : price * 1.02, // +2% per SHORT
            takeProfit: signal.direction === 'LONG'
                ? price * 1.03  // +3% per LONG
                : price * 0.97, // -3% per SHORT
            openTime: time,
            signalStrength: signal.score
        };

        this.positions.push(position);
        console.log(`🟢 [${new Date(time).toISOString()}] Apertura ${position.type} @ $${price.toFixed(2)} (Score: ${signal.score})`);
    }

    updateOpenPositions(currentPrice, currentTime) {
        this.positions.forEach(pos => {
            let shouldClose = false;
            let reason = '';

            if (pos.type === 'LONG') {
                if (currentPrice <= pos.stopLoss) {
                    shouldClose = true;
                    reason = 'STOP_LOSS';
                } else if (currentPrice >= pos.takeProfit) {
                    shouldClose = true;
                    reason = 'TAKE_PROFIT';
                }
            } else { // SHORT
                if (currentPrice >= pos.stopLoss) {
                    shouldClose = true;
                    reason = 'STOP_LOSS';
                } else if (currentPrice <= pos.takeProfit) {
                    shouldClose = true;
                    reason = 'TAKE_PROFIT';
                }
            }

            if (shouldClose) {
                this.closePosition(pos, currentPrice, currentTime, reason);
            }
        });

        // Rimuovi posizioni chiuse
        this.positions = this.positions.filter(p => !p.closed);
    }

    closePosition(position, exitPrice, exitTime, reason) {
        const pnl = position.type === 'LONG'
            ? (exitPrice - position.entryPrice) * position.volume
            : (position.entryPrice - exitPrice) * position.volume;

        const pnlPct = position.type === 'LONG'
            ? ((exitPrice - position.entryPrice) / position.entryPrice) * 100
            : ((position.entryPrice - exitPrice) / position.entryPrice) * 100;

        this.balance += pnl;

        const trade = {
            ...position,
            exitPrice,
            exitTime,
            pnl,
            pnlPct,
            reason,
            closed: true
        };

        this.closedTrades.push(trade);
        position.closed = true;

        const emoji = pnl > 0 ? '✅' : '❌';
        console.log(`${emoji} [${new Date(exitTime).toISOString()}] Chiusura ${position.type} @ $${exitPrice.toFixed(2)} | P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${pnlPct.toFixed(2)}%) - ${reason}`);
    }

    calculateEquity(currentPrice) {
        let equity = this.balance;

        // Aggiungi P&L non realizzato delle posizioni aperte
        this.positions.forEach(pos => {
            if (!pos.closed) {
                const unrealizedPnl = pos.type === 'LONG'
                    ? (currentPrice - pos.entryPrice) * pos.volume
                    : (pos.entryPrice - currentPrice) * pos.volume;
                equity += unrealizedPnl;
            }
        });

        return equity;
    }

    calculateStatistics() {
        const totalTrades = this.closedTrades.length;
        const winningTrades = this.closedTrades.filter(t => t.pnl > 0);
        const losingTrades = this.closedTrades.filter(t => t.pnl < 0);

        const totalProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
        const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));

        const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;
        const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;

        const avgWin = winningTrades.length > 0 ? totalProfit / winningTrades.length : 0;
        const avgLoss = losingTrades.length > 0 ? totalLoss / losingTrades.length : 0;

        // Max Drawdown
        let peak = this.initialBalance;
        let maxDrawdown = 0;
        this.equityCurve.forEach(point => {
            if (point.balance > peak) peak = point.balance;
            const drawdown = ((peak - point.balance) / peak) * 100;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        });

        // Sharpe Ratio (semplificato)
        const returns = this.closedTrades.map(t => t.pnlPct);
        const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
        const stdDev = returns.length > 1
            ? Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length)
            : 0;
        const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) : 0;

        const finalBalance = this.balance;
        const totalReturn = ((finalBalance - this.initialBalance) / this.initialBalance) * 100;

        return {
            summary: {
                initialBalance: this.initialBalance,
                finalBalance,
                totalReturn,
                totalTrades,
                winningTrades: winningTrades.length,
                losingTrades: losingTrades.length,
                winRate,
                profitFactor,
                avgWin,
                avgLoss,
                maxDrawdown,
                sharpeRatio
            },
            trades: this.closedTrades,
            equityCurve: this.equityCurve
        };
    }
}

module.exports = BacktestAnalyzer;
