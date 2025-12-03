/**
 * BIDIRECTIONAL SIGNAL GENERATOR
 * Genera segnali LONG e SHORT basati su indicatori multipli
 * Non solo RSI, ma anche trend, volume, volatilità
 */

class BidirectionalSignalGenerator {
    constructor() {
        // Soglia minima forza segnale (0-100)
        this.MIN_SIGNAL_STRENGTH = 50;
    }

    /**
     * Calcola RSI
     */
    calculateRSI(prices, period = 14) {
        if (prices.length < period + 1) return null;

        const changes = [];
        for (let i = 1; i < prices.length; i++) {
            changes.push(prices[i] - prices[i - 1]);
        }

        const gains = changes.map(c => c > 0 ? c : 0);
        const losses = changes.map(c => c < 0 ? -c : 0);

        let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
        let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

        for (let i = period; i < changes.length; i++) {
            avgGain = (avgGain * (period - 1) + gains[i]) / period;
            avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
        }

        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    /**
     * Rileva trend (SMA)
     */
    detectTrend(prices, shortPeriod = 10, longPeriod = 20) {
        if (prices.length < longPeriod) return 'neutral';

        const shortSMA = prices.slice(-shortPeriod).reduce((a, b) => a + b, 0) / shortPeriod;
        const longSMA = prices.slice(-longPeriod).reduce((a, b) => a + b, 0) / longPeriod;

        if (shortSMA > longSMA * 1.01) return 'bullish';
        if (shortSMA < longSMA * 0.99) return 'bearish';
        return 'neutral';
    }

    /**
     * Calcola ATR (Average True Range) per volatilità
     */
    calculateATR(highs, lows, closes, period = 14) {
        if (highs.length < period + 1) return null;

        const trueRanges = [];
        for (let i = 1; i < highs.length; i++) {
            const tr = Math.max(
                highs[i] - lows[i],
                Math.abs(highs[i] - closes[i - 1]),
                Math.abs(lows[i] - closes[i - 1])
            );
            trueRanges.push(tr);
        }

        if (trueRanges.length < period) return null;
        return trueRanges.slice(-period).reduce((a, b) => a + b, 0) / period;
    }

    /**
     * Analizza volume (semplificato - usa variazione prezzo come proxy)
     */
    analyzeVolume(prices) {
        if (prices.length < 20) return { isHigh: false, ratio: 1.0 };

        const recent = prices.slice(-5);
        const older = prices.slice(-20, -5);
        
        const recentVolatility = this.calculateVolatility(recent);
        const olderVolatility = this.calculateVolatility(older);
        
        const ratio = olderVolatility > 0 ? recentVolatility / olderVolatility : 1.0;
        
        return {
            isHigh: ratio > 1.5,
            ratio: ratio
        };
    }

    /**
     * Calcola volatilità (deviazione standard)
     */
    calculateVolatility(prices) {
        if (prices.length < 2) return 0;
        const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
        const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
        return Math.sqrt(variance);
    }

    /**
     * Genera segnale bidirezionale
     * @param {Array} priceHistory - Array di {price, timestamp}
     * @returns {Object} { direction: 'LONG'|'SHORT'|'NEUTRAL', strength: 0-100, reasons: [] }
     */
    generateSignal(priceHistory) {
        if (!priceHistory || priceHistory.length < 20) {
            return {
                direction: 'NEUTRAL',
                strength: 0,
                reasons: ['Insufficient data']
            };
        }

        // Estrai prezzi, high, low, close (se disponibili)
        const prices = priceHistory.map(h => h.price || h.close || h);
        const highs = priceHistory.map(h => h.high || h.price || h);
        const lows = priceHistory.map(h => h.low || h.price || h);
        const closes = prices;

        // 1. Calcola indicatori
        const rsi = this.calculateRSI(prices, 14);
        const trend = this.detectTrend(prices);
        const volume = this.analyzeVolume(prices);
        const atr = this.calculateATR(highs, lows, closes);
        const currentPrice = prices[prices.length - 1];
        const avgPrice = prices.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, prices.length);
        const volatility = atr ? atr / currentPrice : 0.02; // Default 2%
        const avgVolatility = this.calculateVolatility(prices.slice(-30)) / avgPrice || 0.02;

        // 2. LONG SIGNAL (compra)
        const longSignal = {
            strength: 0,
            reasons: []
        };

        // RSI oversold + uptrend
        if (rsi !== null && rsi < 30 && trend === 'bullish') {
            longSignal.strength += 40;
            longSignal.reasons.push(`RSI oversold (${rsi.toFixed(1)}) + uptrend`);
        }

        // RSI fortemente oversold
        if (rsi !== null && rsi < 25) {
            longSignal.strength += 30;
            longSignal.reasons.push(`RSI strongly oversold (${rsi.toFixed(1)})`);
        }

        // Volume alto (movimento forte)
        if (volume.isHigh) {
            longSignal.strength += 20;
            longSignal.reasons.push(`High volume (${volume.ratio.toFixed(2)}x)`);
        }

        // Bassa volatilità (entrata più sicura)
        if (volatility < avgVolatility * 0.7) {
            longSignal.strength += 10;
            longSignal.reasons.push(`Low volatility (safer entry)`);
        }

        // Prezzo sotto media (opportunità)
        if (currentPrice < avgPrice * 0.98) {
            longSignal.strength += 10;
            longSignal.reasons.push(`Price below average (${((avgPrice - currentPrice) / avgPrice * 100).toFixed(2)}%)`);
        }

        // 3. SHORT SIGNAL (vendi)
        const shortSignal = {
            strength: 0,
            reasons: []
        };

        // RSI overbought + downtrend
        if (rsi !== null && rsi > 70 && trend === 'bearish') {
            shortSignal.strength += 40;
            shortSignal.reasons.push(`RSI overbought (${rsi.toFixed(1)}) + downtrend`);
        }

        // RSI fortemente overbought
        if (rsi !== null && rsi > 75) {
            shortSignal.strength += 30;
            shortSignal.reasons.push(`RSI strongly overbought (${rsi.toFixed(1)})`);
        }

        // Volume alto (movimento forte)
        if (volume.isHigh) {
            shortSignal.strength += 20;
            shortSignal.reasons.push(`High volume (${volume.ratio.toFixed(2)}x)`);
        }

        // Prezzo sopra media (possibile correzione)
        if (currentPrice > avgPrice * 1.02) {
            shortSignal.strength += 10;
            shortSignal.reasons.push(`Price above average (${((currentPrice - avgPrice) / avgPrice * 100).toFixed(2)}%)`);
        }

        // 4. DECISIONE
        if (longSignal.strength >= this.MIN_SIGNAL_STRENGTH) {
            return {
                direction: 'LONG',
                strength: longSignal.strength,
                reasons: longSignal.reasons,
                rsi: rsi,
                trend: trend,
                volume: volume
            };
        }

        if (shortSignal.strength >= this.MIN_SIGNAL_STRENGTH) {
            return {
                direction: 'SHORT',
                strength: shortSignal.strength,
                reasons: shortSignal.reasons,
                rsi: rsi,
                trend: trend,
                volume: volume
            };
        }

        return {
            direction: 'NEUTRAL',
            strength: Math.max(longSignal.strength, shortSignal.strength),
            reasons: ['Signal strength below threshold'],
            rsi: rsi,
            trend: trend,
            volume: volume
        };
    }
}

// Singleton instance
const signalGenerator = new BidirectionalSignalGenerator();

module.exports = signalGenerator;

