/**
 * BIDIRECTIONAL SIGNAL GENERATOR - PROFESSIONAL VERSION
 * Genera segnali LONG e SHORT basati su indicatori multipli professionali
 * 
 * INDICATORI IMPLEMENTATI:
 * - RSI (Relative Strength Index)
 * - MACD (Moving Average Convergence Divergence) - completo con Signal Line e Histogram
 * - Bollinger Bands (con %B e Band Width)
 * - EMA multiple (10, 20, 50, 200) per trend analysis
 * - Trend detection (short/long term)
 * - Volume analysis
 * - ATR (Average True Range)
 * 
 * SISTEMA MULTI-CONFERMA:
 * - LONG: Richiede minimo 3 conferme + strength >= 50
 * - SHORT: Richiede minimo 4 conferme + strength >= 60 (più rigoroso)
 * - MAI aprire SHORT se prezzo sta ancora salendo
 * - Validazione trend su multiple timeframe
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
     * Calcola EMA (Exponential Moving Average)
     */
    calculateEMA(prices, period) {
        if (prices.length < period) return null;
        
        const multiplier = 2 / (period + 1);
        let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
        
        for (let i = period; i < prices.length; i++) {
            ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
        }
        
        return ema;
    }

    /**
     * Calcola SMA (Simple Moving Average)
     */
    calculateSMA(prices, period) {
        if (prices.length < period) return null;
        return prices.slice(-period).reduce((a, b) => a + b, 0) / period;
    }

    /**
     * Calcola Standard Deviation
     */
    calculateStdDev(prices, period) {
        if (prices.length < period) return null;
        
        const sma = this.calculateSMA(prices, period);
        const slice = prices.slice(-period);
        const variance = slice.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
        
        return Math.sqrt(variance);
    }

    /**
     * Rileva trend (SMA/EMA) - migliorato
     */
    detectTrend(prices, shortPeriod = 10, longPeriod = 20) {
        if (prices.length < longPeriod) return 'neutral';

        const shortEMA = this.calculateEMA(prices, shortPeriod);
        const longEMA = this.calculateEMA(prices, longPeriod);
        
        if (!shortEMA || !longEMA) {
            // Fallback a SMA se EMA non disponibile
            const shortSMA = this.calculateSMA(prices, shortPeriod);
            const longSMA = this.calculateSMA(prices, longPeriod);
            if (!shortSMA || !longSMA) return 'neutral';
            
            if (shortSMA > longSMA * 1.01) return 'bullish';
            if (shortSMA < longSMA * 0.99) return 'bearish';
            return 'neutral';
        }

        if (shortEMA > longEMA * 1.01) return 'bullish';
        if (shortEMA < longEMA * 0.99) return 'bearish';
        return 'neutral';
    }
    
    /**
     * Rileva trend su multiple timeframe (EMA 50/200 per Golden/Death Cross)
     */
    detectMajorTrend(prices) {
        if (prices.length < 200) return 'neutral';
        
        const ema50 = this.calculateEMA(prices, 50);
        const ema200 = this.calculateEMA(prices, 200);
        
        if (!ema50 || !ema200) return 'neutral';
        
        if (ema50 > ema200 * 1.01) return 'bullish'; // Golden Cross
        if (ema50 < ema200 * 0.99) return 'bearish'; // Death Cross
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
     * Calcola MACD (Moving Average Convergence Divergence) completo
     * @param {Array} prices - Array di prezzi
     * @param {number} fastPeriod - Periodo EMA veloce (default 12)
     * @param {number} slowPeriod - Periodo EMA lento (default 26)
     * @param {number} signalPeriod - Periodo Signal Line (default 9)
     * @returns {Object} { macdLine, signalLine, histogram, values: [] }
     */
    calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
        if (prices.length < slowPeriod + signalPeriod) return null;
        
        // Calcola EMA veloce e lenta per ogni punto
        const fastEMAs = [];
        const slowEMAs = [];
        const macdLine = [];
        
        for (let i = slowPeriod; i <= prices.length; i++) {
            const priceSlice = prices.slice(0, i);
            const fastEMA = this.calculateEMA(priceSlice, fastPeriod);
            const slowEMA = this.calculateEMA(priceSlice, slowPeriod);
            
            if (fastEMA && slowEMA) {
                fastEMAs.push(fastEMA);
                slowEMAs.push(slowEMA);
                macdLine.push(fastEMA - slowEMA);
            }
        }
        
        if (macdLine.length < signalPeriod) return null;
        
        // Calcola Signal Line (EMA di MACD Line)
        const signalLine = this.calculateEMA(macdLine, signalPeriod);
        if (!signalLine) return null;
        
        const currentMACD = macdLine[macdLine.length - 1];
        const histogram = currentMACD - signalLine;
        
        // Calcola valori storici per trend analysis
        const prevMACD = macdLine.length > 1 ? macdLine[macdLine.length - 2] : null;
        const prevSignal = macdLine.length > signalPeriod ? 
            this.calculateEMA(macdLine.slice(0, -1), signalPeriod) : null;
        
        return {
            macdLine: currentMACD,
            signalLine: signalLine,
            histogram: histogram,
            macdAboveSignal: currentMACD > signalLine,
            macdAboveZero: currentMACD > 0,
            histogramGrowing: prevMACD && prevSignal ? 
                (histogram > (prevMACD - prevSignal)) : false,
            values: {
                current: currentMACD,
                previous: prevMACD,
                signal: signalLine,
                histogram: histogram
            }
        };
    }

    /**
     * Calcola Bollinger Bands
     * @param {Array} prices - Array di prezzi
     * @param {number} period - Periodo SMA (default 20)
     * @param {number} stdDev - Moltiplicatore deviazione standard (default 2)
     * @returns {Object} { upper, middle, lower, width, percentB }
     */
    calculateBollingerBands(prices, period = 20, stdDev = 2) {
        if (prices.length < period) return null;
        
        const sma = this.calculateSMA(prices, period);
        if (!sma) return null;
        
        const std = this.calculateStdDev(prices, period);
        if (!std) return null;
        
        const upper = sma + (stdDev * std);
        const middle = sma;
        const lower = sma - (stdDev * std);
        const width = (stdDev * std * 2) / sma; // Bollinger Band Width (%)
        
        const currentPrice = prices[prices.length - 1];
        const percentB = (currentPrice - lower) / (upper - lower); // %B (0-1)
        
        return {
            upper: upper,
            middle: middle,
            lower: lower,
            width: width,
            percentB: percentB,
            priceAtUpper: currentPrice >= upper * 0.99, // Prezzo tocca upper band
            priceAtLower: currentPrice <= lower * 1.01  // Prezzo tocca lower band
        };
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

        // 1. Calcola indicatori BASE
        const rsi = this.calculateRSI(prices, 14);
        const trend = this.detectTrend(prices);
        const majorTrend = this.detectMajorTrend(prices); // EMA 50/200
        const volume = this.analyzeVolume(prices);
        const atr = this.calculateATR(highs, lows, closes);
        const currentPrice = prices[prices.length - 1];
        const avgPrice = prices.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, prices.length);
        const volatility = atr ? atr / currentPrice : 0.02; // Default 2%
        const avgVolatility = this.calculateVolatility(prices.slice(-30)) / avgPrice || 0.02;
        
        // 2. Calcola indicatori PROFESSIONALI
        const macd = this.calculateMACD(prices, 12, 26, 9);
        const bollinger = this.calculateBollingerBands(prices, 20, 2);
        
        // 3. Calcola EMA multiple per trend analysis
        const ema10 = this.calculateEMA(prices, 10);
        const ema20 = this.calculateEMA(prices, 20);
        const ema50 = this.calculateEMA(prices, 50);
        const ema200 = this.calculateEMA(prices, 200);

        // 3. LONG SIGNAL (compra) - SISTEMA MULTI-CONFERMA
        const longSignal = {
            strength: 0,
            reasons: [],
            confirmations: 0 // Contatore conferme
        };

        // CONFERMA 1: RSI oversold + uptrend
        if (rsi !== null && rsi < 30 && trend === 'bullish') {
            longSignal.strength += 25;
            longSignal.confirmations++;
            longSignal.reasons.push(`RSI oversold (${rsi.toFixed(1)}) + uptrend`);
        }

        // CONFERMA 2: RSI fortemente oversold
        if (rsi !== null && rsi < 25) {
            longSignal.strength += 20;
            longSignal.confirmations++;
            longSignal.reasons.push(`RSI strongly oversold (${rsi.toFixed(1)})`);
        }

        // CONFERMA 3: MACD positivo e crescente
        if (macd && macd.macdAboveSignal && macd.macdAboveZero && macd.histogramGrowing) {
            longSignal.strength += 30;
            longSignal.confirmations++;
            longSignal.reasons.push(`MACD bullish (${macd.macdLine.toFixed(2)} > ${macd.signalLine.toFixed(2)})`);
        }

        // CONFERMA 4: Bollinger - Prezzo tocca lower band
        if (bollinger && bollinger.priceAtLower && rsi !== null && rsi < 35) {
            longSignal.strength += 25;
            longSignal.confirmations++;
            longSignal.reasons.push(`Price at lower Bollinger + RSI oversold`);
        }

        // CONFERMA 5: Trend bullish su multiple timeframe
        if (trend === 'bullish' && majorTrend === 'bullish') {
            longSignal.strength += 20;
            longSignal.confirmations++;
            longSignal.reasons.push(`Bullish trend confirmed (EMA 10>20, 50>200)`);
        }

        // CONFERMA 6: Prezzo sopra EMA key levels
        if (ema10 && ema20 && currentPrice > ema10 && ema10 > ema20) {
            longSignal.strength += 15;
            longSignal.confirmations++;
            longSignal.reasons.push(`Price above EMA 10 & EMA 10 > EMA 20`);
        }

        // CONFERMA 7: Volume alto (movimento forte)
        if (volume.isHigh) {
            longSignal.strength += 15;
            longSignal.confirmations++;
            longSignal.reasons.push(`High volume (${volume.ratio.toFixed(2)}x)`);
        }

        // CONFERMA 8: Prezzo NON scende (ultimi periodi)
        const priceChangeLong = prices.length >= 5 
            ? (prices[prices.length - 1] - prices[prices.length - 5]) / prices[prices.length - 5] * 100
            : 0;
        if (priceChangeLong >= -0.5) { // Non scende più di 0.5%
            longSignal.strength += 10;
            longSignal.reasons.push(`Price stable/rising (${priceChangeLong.toFixed(2)}%)`);
        }

        // 4. SHORT SIGNAL (vendi) - SISTEMA MULTI-CONFERMA (PIÙ RIGOROSO)
        const shortSignal = {
            strength: 0,
            reasons: [],
            confirmations: 0 // Contatore conferme
        };
        
        // Verifica che il prezzo stia effettivamente scendendo (PREREQUISITO)
        const priceChange = prices.length >= 3 
            ? (prices[prices.length - 1] - prices[prices.length - 3]) / prices[prices.length - 3] * 100
            : 0;
        
        // BLOCCA SHORT se prezzo sta ancora salendo (CRITICO!)
        if (priceChange > 0.1) {
            return {
                direction: 'NEUTRAL',
                strength: 0,
                reasons: [`SHORT blocked: Price still rising (+${priceChange.toFixed(2)}%) - waiting for reversal`],
                rsi: rsi,
                trend: trend,
                volume: volume,
                macd: macd,
                bollinger: bollinger
            };
        }

        // CONFERMA 1: RSI overbought + downtrend CONFERMATO
        if (rsi !== null && rsi > 70 && trend === 'bearish' && priceChange < 0) {
            shortSignal.strength += 35;
            shortSignal.confirmations++;
            shortSignal.reasons.push(`RSI overbought (${rsi.toFixed(1)}) + downtrend confirmed + price falling`);
        }

        // CONFERMA 2: RSI fortemente overbought + trend NON bullish
        if (rsi !== null && rsi > 75 && trend !== 'bullish' && priceChange < 0.1) {
            shortSignal.strength += 25;
            shortSignal.confirmations++;
            shortSignal.reasons.push(`RSI strongly overbought (${rsi.toFixed(1)})`);
        }

        // CONFERMA 3: MACD negativo e decrescente
        if (macd && !macd.macdAboveSignal && !macd.macdAboveZero && !macd.histogramGrowing) {
            shortSignal.strength += 30;
            shortSignal.confirmations++;
            shortSignal.reasons.push(`MACD bearish (${macd.macdLine.toFixed(2)} < ${macd.signalLine.toFixed(2)})`);
        }

        // CONFERMA 4: Bollinger - Prezzo tocca upper band + RSI overbought
        if (bollinger && bollinger.priceAtUpper && rsi !== null && rsi > 65) {
            shortSignal.strength += 25;
            shortSignal.confirmations++;
            shortSignal.reasons.push(`Price at upper Bollinger + RSI overbought`);
        }

        // CONFERMA 5: Trend bearish su multiple timeframe
        if (trend === 'bearish' && (majorTrend === 'bearish' || majorTrend === 'neutral')) {
            shortSignal.strength += 25;
            shortSignal.confirmations++;
            shortSignal.reasons.push(`Bearish trend confirmed (EMA 10<20)`);
        }

        // CONFERMA 6: Prezzo sotto EMA key levels
        if (ema10 && ema20 && currentPrice < ema10 && ema10 < ema20) {
            shortSignal.strength += 20;
            shortSignal.confirmations++;
            shortSignal.reasons.push(`Price below EMA 10 & EMA 10 < EMA 20`);
        }

        // CONFERMA 7: Prezzo STA SCENDENDO (non solo "potrebbe")
        if (priceChange < -0.1) { // Prezzo sceso >0.1% negli ultimi periodi
            shortSignal.strength += 20;
            shortSignal.confirmations++;
            shortSignal.reasons.push(`Price actively falling (${priceChange.toFixed(2)}%)`);
        }

        // CONFERMA 8: Volume alto (movimento forte)
        if (volume.isHigh) {
            shortSignal.strength += 15;
            shortSignal.confirmations++;
            shortSignal.reasons.push(`High volume (${volume.ratio.toFixed(2)}x)`);
        }

        // 5. DECISIONE FINALE - SISTEMA MULTI-CONFERMA
        
        // LONG: Richiede minimo 3 conferme + strength >= 50
        const longMeetsRequirements = longSignal.confirmations >= 3 && longSignal.strength >= this.MIN_SIGNAL_STRENGTH;
        
        // SHORT: Richiede minimo 4 conferme + strength >= 60 (più rigoroso)
        const SHORT_MIN_CONFIRMATIONS = 4;
        const SHORT_MIN_STRENGTH = 60;
        const shortMeetsRequirements = shortSignal.confirmations >= SHORT_MIN_CONFIRMATIONS && 
                                       shortSignal.strength >= SHORT_MIN_STRENGTH;
        
        if (longMeetsRequirements) {
            return {
                direction: 'LONG',
                strength: longSignal.strength,
                reasons: longSignal.reasons,
                confirmations: longSignal.confirmations,
                indicators: {
                    rsi: rsi,
                    trend: trend,
                    majorTrend: majorTrend,
                    volume: volume,
                    macd: macd,
                    bollinger: bollinger,
                    ema10: ema10,
                    ema20: ema20,
                    ema50: ema50,
                    ema200: ema200
                }
            };
        }

        if (shortMeetsRequirements) {
            return {
                direction: 'SHORT',
                strength: shortSignal.strength,
                reasons: shortSignal.reasons,
                confirmations: shortSignal.confirmations,
                indicators: {
                    rsi: rsi,
                    trend: trend,
                    majorTrend: majorTrend,
                    volume: volume,
                    macd: macd,
                    bollinger: bollinger,
                    ema10: ema10,
                    ema20: ema20,
                    ema50: ema50,
                    ema200: ema200
                }
            };
        }

        // Nessun segnale valido
        const maxStrength = Math.max(longSignal.strength, shortSignal.strength);
        const maxConfirmations = Math.max(longSignal.confirmations, shortSignal.confirmations);
        
        let reason = 'Signal strength below threshold';
        if (longSignal.strength > 0 && longSignal.confirmations < 3) {
            reason = `LONG needs ${3 - longSignal.confirmations} more confirmations (has ${longSignal.confirmations}/3)`;
        } else if (shortSignal.strength > 0 && shortSignal.confirmations < SHORT_MIN_CONFIRMATIONS) {
            reason = `SHORT needs ${SHORT_MIN_CONFIRMATIONS - shortSignal.confirmations} more confirmations (has ${shortSignal.confirmations}/${SHORT_MIN_CONFIRMATIONS})`;
        } else if (longSignal.strength < this.MIN_SIGNAL_STRENGTH && shortSignal.strength < SHORT_MIN_STRENGTH) {
            reason = `Signal strength too low (LONG: ${longSignal.strength}, SHORT: ${shortSignal.strength})`;
        }

        return {
            direction: 'NEUTRAL',
            strength: maxStrength,
            reasons: [reason],
            confirmations: maxConfirmations,
            indicators: {
                rsi: rsi,
                trend: trend,
                majorTrend: majorTrend,
                volume: volume,
                macd: macd,
                bollinger: bollinger,
                ema10: ema10,
                ema20: ema20,
                ema50: ema50,
                ema200: ema200
            }
        };
    }
}

// Singleton instance
const signalGenerator = new BidirectionalSignalGenerator();

module.exports = signalGenerator;


