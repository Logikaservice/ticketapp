/**
 * ADVANCED BACKTEST - Replica ESATTA della logica del bot
 * Include TUTTI i filtri professionali e la logica completa
 */

const { dbAll } = require('./crypto_db');
const signalGenerator = require('./services/BidirectionalSignalGenerator');

class AdvancedBacktestAnalyzer {
    constructor(symbol = 'bitcoin', initialBalance = 1000, tradeSize = 100) {
        this.symbol = symbol;
        this.initialBalance = initialBalance;
        this.balance = initialBalance;
        this.tradeSize = tradeSize;
        this.positions = [];
        this.closedTrades = [];
        this.equityCurve = [];

        // Configurazione identica al bot live
        this.config = {
            stopLossPercent: 2,      // -2% stop loss
            takeProfitPercent: 3,    // +3% take profit
            minSignalStrength: 70,   // Soglia minima forza segnale
            maxPositions: 1,         // Max 1 posizione per volta
            trailingStopEnabled: true,
            trailingStopPercent: 1.5
        };
    }

    async runBacktest(daysBack = 30) {
        console.log(`\n📊 [ADVANCED BACKTEST] Avvio test COMPLETO su ${this.symbol} (ultimi ${daysBack} giorni)...`);

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
            throw new Error(`Dati insufficienti (trovati ${klines?.length || 0} candele)`);
        }

        console.log(`✅ Caricati ${klines.length} candele storiche`);
        console.log(`🔄 Simulazione con logica COMPLETA del bot...\n`);

        // Simula trading candela per candela
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

            // Aggiorna posizioni aperte (trailing stop, stop loss, take profit)
            this.updateOpenPositions(currentCandle, currentTime);

            // Genera segnale con TUTTA la logica del bot
            const signal = signalGenerator.generateSignal(history, this.symbol);

            // Applica filtri professionali (come nel bot live)
            const canTrade = this.applyProfessionalFilters(signal, history, currentPrice);

            // Apri nuova posizione se segnale valido e nessuna posizione aperta
            if (this.positions.length === 0 && canTrade.allowed && signal.direction !== 'NEUTRAL') {
                this.openPosition(signal, currentPrice, currentTime, canTrade.adjustedStrength);
            }

            // Registra equity
            this.equityCurve.push({
                time: currentTime,
                balance: this.calculateEquity(currentPrice)
            });
        }

        // Chiudi posizioni rimaste aperte
        const finalPrice = parseFloat(klines[klines.length - 1].close_price);
        this.positions.forEach(pos => {
            this.closePosition(pos, finalPrice, Date.now(), 'BACKTEST_END');
        });

        return this.calculateStatistics();
    }

    /**
     * Applica TUTTI i filtri professionali del bot
     * Replica esattamente la logica di cryptoRoutes.js
     */
    applyProfessionalFilters(signal, history, currentPrice) {
        let allowed = true;
        let strengthReduction = 0;
        const reasons = [];

        // 1. Verifica forza segnale minima
        if (signal.score < this.config.minSignalStrength) {
            allowed = false;
            reasons.push(`Score troppo basso (${signal.score} < ${this.config.minSignalStrength})`);
        }

        // 2. Verifica trend multi-timeframe
        const prices = history.map(h => h.close);
        const priceChange1h = prices.length >= 4 ? ((prices[prices.length - 1] - prices[prices.length - 4]) / prices[prices.length - 4] * 100) : 0;
        const priceChange4h = prices.length >= 16 ? ((prices[prices.length - 1] - prices[prices.length - 16]) / prices[prices.length - 16] * 100) : 0;

        // LONG: non entrare se trend 4h è ribassista
        if (signal.direction === 'LONG' && priceChange4h < -2) {
            strengthReduction += 30;
            reasons.push('Trend 4h ribassista');
        }

        // SHORT: non entrare se trend 4h è rialzista
        if (signal.direction === 'SHORT' && priceChange4h > 2) {
            strengthReduction += 30;
            reasons.push('Trend 4h rialzista');
        }

        // 3. Verifica volatilità (ATR)
        if (signal.indicators.atr && currentPrice > 0) {
            const atrPercent = (signal.indicators.atr / currentPrice) * 100;
            if (atrPercent > 3) {
                strengthReduction += 20;
                reasons.push('Volatilità troppo alta');
            }
        }

        // 4. Verifica Risk/Reward ratio
        const stopLossDistance = this.config.stopLossPercent;
        const takeProfitDistance = this.config.takeProfitPercent;
        const rrRatio = takeProfitDistance / stopLossDistance;

        if (rrRatio < 1.3) {
            strengthReduction += 20;
            reasons.push(`R/R scarso (1:${rrRatio.toFixed(2)})`);
        }

        // 5. Verifica supporti/resistenze (Bollinger Bands)
        if (signal.indicators.bollinger) {
            const distanceToUpper = ((signal.indicators.bollinger.upper - currentPrice) / currentPrice) * 100;
            const distanceToLower = ((currentPrice - signal.indicators.bollinger.lower) / currentPrice) * 100;

            // LONG vicino a resistenza
            if (signal.direction === 'LONG' && distanceToUpper < 1) {
                strengthReduction += 30;
                reasons.push('Vicino a resistenza');
            }

            // SHORT vicino a supporto
            if (signal.direction === 'SHORT' && distanceToLower < 1) {
                strengthReduction += 30;
                reasons.push('Vicino a supporto');
            }
        }

        // 6. Verifica divergenze RSI
        if (signal.indicators.rsi > 75 && signal.direction === 'LONG') {
            strengthReduction += 25;
            reasons.push('RSI ipercomprato');
        }

        if (signal.indicators.rsi < 25 && signal.direction === 'SHORT') {
            strengthReduction += 25;
            reasons.push('RSI ipervenduto');
        }

        // Calcola forza finale
        const adjustedStrength = Math.max(0, signal.score - strengthReduction);

        // Se la forza scende sotto la soglia minima, blocca
        if (adjustedStrength < this.config.minSignalStrength) {
            allowed = false;
        }

        return {
            allowed,
            adjustedStrength,
            originalStrength: signal.score,
            strengthReduction,
            reasons
        };
    }

    openPosition(signal, price, time, adjustedStrength) {
        const position = {
            id: `BT_${Date.now()}_${Math.random()}`,
            type: signal.direction,
            entryPrice: price,
            volume: this.tradeSize / price,
            stopLoss: signal.direction === 'LONG'
                ? price * (1 - this.config.stopLossPercent / 100)
                : price * (1 + this.config.stopLossPercent / 100),
            takeProfit: signal.direction === 'LONG'
                ? price * (1 + this.config.takeProfitPercent / 100)
                : price * (1 - this.config.takeProfitPercent / 100),
            trailingStop: null,
            highestPrice: price,
            lowestPrice: price,
            openTime: time,
            signalStrength: adjustedStrength
        };

        this.positions.push(position);
        console.log(`🟢 [${new Date(time).toISOString().substr(11, 8)}] ${position.type} @ $${price.toFixed(4)} (Strength: ${adjustedStrength})`);
    }

    updateOpenPositions(candle, currentTime) {
        this.positions.forEach(pos => {
            if (pos.closed) return;

            const currentPrice = candle.close;
            const high = candle.high;
            const low = candle.low;

            // Aggiorna highest/lowest per trailing stop
            if (pos.type === 'LONG') {
                if (high > pos.highestPrice) {
                    pos.highestPrice = high;

                    // Attiva trailing stop se in profitto
                    if (this.config.trailingStopEnabled) {
                        const profitPercent = ((high - pos.entryPrice) / pos.entryPrice) * 100;
                        if (profitPercent > 1) {
                            pos.trailingStop = high * (1 - this.config.trailingStopPercent / 100);
                        }
                    }
                }

                // Check trailing stop
                if (pos.trailingStop && low <= pos.trailingStop) {
                    this.closePosition(pos, pos.trailingStop, currentTime, 'TRAILING_STOP');
                    return;
                }

                // Check stop loss
                if (low <= pos.stopLoss) {
                    this.closePosition(pos, pos.stopLoss, currentTime, 'STOP_LOSS');
                    return;
                }

                // Check take profit
                if (high >= pos.takeProfit) {
                    this.closePosition(pos, pos.takeProfit, currentTime, 'TAKE_PROFIT');
                    return;
                }
            } else { // SHORT
                if (low < pos.lowestPrice) {
                    pos.lowestPrice = low;

                    // Attiva trailing stop se in profitto
                    if (this.config.trailingStopEnabled) {
                        const profitPercent = ((pos.entryPrice - low) / pos.entryPrice) * 100;
                        if (profitPercent > 1) {
                            pos.trailingStop = low * (1 + this.config.trailingStopPercent / 100);
                        }
                    }
                }

                // Check trailing stop
                if (pos.trailingStop && high >= pos.trailingStop) {
                    this.closePosition(pos, pos.trailingStop, currentTime, 'TRAILING_STOP');
                    return;
                }

                // Check stop loss
                if (high >= pos.stopLoss) {
                    this.closePosition(pos, pos.stopLoss, currentTime, 'STOP_LOSS');
                    return;
                }

                // Check take profit
                if (low <= pos.takeProfit) {
                    this.closePosition(pos, pos.takeProfit, currentTime, 'TAKE_PROFIT');
                    return;
                }
            }
        });

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
        const duration = ((exitTime - position.openTime) / (1000 * 60)).toFixed(0);
        console.log(`${emoji} [${new Date(exitTime).toISOString().substr(11, 8)}] ${position.type} @ $${exitPrice.toFixed(4)} | P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${pnlPct.toFixed(2)}%) | ${duration}min | ${reason}`);
    }

    calculateEquity(currentPrice) {
        let equity = this.balance;

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

        // Sharpe Ratio
        const returns = this.closedTrades.map(t => t.pnlPct);
        const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
        const stdDev = returns.length > 1
            ? Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length)
            : 0;
        const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) : 0;

        const finalBalance = this.balance;
        const totalReturn = ((finalBalance - this.initialBalance) / this.initialBalance) * 100;

        // Analisi motivi chiusura
        const closureReasons = {};
        this.closedTrades.forEach(t => {
            closureReasons[t.reason] = (closureReasons[t.reason] || 0) + 1;
        });

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
            equityCurve: this.equityCurve,
            closureReasons
        };
    }
}

module.exports = AdvancedBacktestAnalyzer;
