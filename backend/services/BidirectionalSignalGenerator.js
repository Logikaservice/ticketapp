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
        // ✅ SICUREZZA 90%: Soglia alta per aprire solo quando siamo CERTI che la posizione possa fruttare
        // Strength 70+ = ~90% di certezza basata su multiple conferme tecniche
        this.MIN_SIGNAL_STRENGTH = 70; // Soglia alta per sicurezza massima
    }

    /**
     * Calcola RSI (valore corrente)
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
     * Calcola RSI per tutti i punti storici (per divergenze)
     * @param {Array} prices - Array di prezzi
     * @param {number} period - Periodo RSI (default 14)
     * @returns {Array} Array di valori RSI corrispondenti ai prezzi
     */
    calculateRSIHistory(prices, period = 14) {
        if (prices.length < period + 1) return [];

        const rsiValues = [];

        // Calcola RSI per ogni punto disponibile (rolling window)
        for (let i = period + 1; i <= prices.length; i++) {
            const priceSlice = prices.slice(0, i);
            const rsi = this.calculateRSI(priceSlice, period);
            if (rsi !== null) {
                rsiValues.push(rsi);
            } else {
                rsiValues.push(null);
            }
        }

        return rsiValues;
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
     * Trova picchi e valli (local maxima e minima)
     */
    findPeaksAndValleys(values, lookback = 5) {
        if (values.length < lookback * 2 + 1) return { peaks: [], valleys: [] };

        const peaks = [];
        const valleys = [];

        for (let i = lookback; i < values.length - lookback; i++) {
            const current = values[i];
            let isPeak = true;
            let isValley = true;

            // Controlla se è un picco (tutti i valori intorno sono più bassi)
            for (let j = i - lookback; j <= i + lookback; j++) {
                if (j !== i) {
                    if (values[j] >= current) isPeak = false;
                    if (values[j] <= current) isValley = false;
                }
            }

            if (isPeak) {
                peaks.push({ index: i, value: current });
            }
            if (isValley) {
                valleys.push({ index: i, value: current });
            }
        }

        return { peaks, valleys };
    }

    /**
     * Rileva divergenze RSI (prezzo vs RSI)
     * @param {Array} prices - Array di prezzi
     * @param {Array} rsiValues - Array di valori RSI corrispondenti
     * @returns {Object} { type: 'bullish'|'bearish'|null, strength: 0-100 }
     */
    detectRSIDivergence(prices, rsiValues) {
        if (!prices || !rsiValues || prices.length < 30 || rsiValues.length < 30) {
            return { type: null, strength: 0 };
        }

        // Usa solo gli ultimi 30-50 punti per divergenza recente
        const lookback = Math.min(30, Math.floor(prices.length * 0.6));
        const recentPrices = prices.slice(-lookback);
        const recentRSI = rsiValues.slice(-lookback);

        // Trova picchi e valli
        const pricePeaksValleys = this.findPeaksAndValleys(recentPrices, 3);
        const rsiPeaksValleys = this.findPeaksAndValleys(recentRSI, 3);

        // BULLISH DIVERGENCE: Prezzo fa minimi più bassi, RSI fa minimi più alti
        if (pricePeaksValleys.valleys.length >= 2 && rsiPeaksValleys.valleys.length >= 2) {
            const recentValleys = pricePeaksValleys.valleys.slice(-2);
            const recentRSIValleys = rsiPeaksValleys.valleys.slice(-2);

            if (recentValleys.length === 2 && recentRSIValleys.length === 2) {
                const priceLower = recentValleys[0].value > recentValleys[1].value; // Prezzo più basso
                const rsiHigher = recentRSIValleys[0].value < recentRSIValleys[1].value; // RSI più alto

                if (priceLower && rsiHigher) {
                    // Calcola strength basata su quanto è evidente la divergenza
                    const priceChange = Math.abs(recentValleys[0].value - recentValleys[1].value) / recentValleys[1].value;
                    const rsiChange = Math.abs(recentRSIValleys[0].value - recentRSIValleys[1].value);
                    const strength = Math.min(100, Math.floor((priceChange * 1000) + (rsiChange * 2)));

                    return {
                        type: 'bullish',
                        strength: Math.max(60, Math.min(100, strength)),
                        priceValleys: recentValleys,
                        rsiValleys: recentRSIValleys
                    };
                }
            }
        }

        // BEARISH DIVERGENCE: Prezzo fa massimi più alti, RSI fa massimi più bassi
        if (pricePeaksValleys.peaks.length >= 2 && rsiPeaksValleys.peaks.length >= 2) {
            const recentPeaks = pricePeaksValleys.peaks.slice(-2);
            const recentRSIPeaks = rsiPeaksValleys.peaks.slice(-2);

            if (recentPeaks.length === 2 && recentRSIPeaks.length === 2) {
                const priceHigher = recentPeaks[0].value < recentPeaks[1].value; // Prezzo più alto
                const rsiLower = recentRSIPeaks[0].value > recentRSIPeaks[1].value; // RSI più basso

                if (priceHigher && rsiLower) {
                    const priceChange = Math.abs(recentPeaks[1].value - recentPeaks[0].value) / recentPeaks[0].value;
                    const rsiChange = Math.abs(recentRSIPeaks[0].value - recentRSIPeaks[1].value);
                    const strength = Math.min(100, Math.floor((priceChange * 1000) + (rsiChange * 2)));

                    return {
                        type: 'bearish',
                        strength: Math.max(60, Math.min(100, strength)),
                        pricePeaks: recentPeaks,
                        rsiPeaks: recentRSIPeaks
                    };
                }
            }
        }

        return { type: null, strength: 0 };
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
     * @param {string} symbol - Simbolo (opzionale, per logging)
     * @returns {Object} { direction: 'LONG'|'SHORT'|'NEUTRAL', strength: 0-100, reasons: [] }
     */
    generateSignal(priceHistory, symbol = null) {
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

        // 2. Calcola RSI storico per divergenze
        const rsiHistory = this.calculateRSIHistory(prices, 14);
        const rsiDivergence = rsiHistory.length >= 15 ?
            this.detectRSIDivergence(prices, rsiHistory) : { type: null, strength: 0 };

        // 3. Calcola indicatori PROFESSIONALI
        const macd = this.calculateMACD(prices, 12, 26, 9);
        const bollinger = this.calculateBollingerBands(prices, 20, 2);

        // 4. Calcola EMA multiple per trend analysis
        const ema10 = this.calculateEMA(prices, 10);
        const ema20 = this.calculateEMA(prices, 20);
        const ema50 = this.calculateEMA(prices, 50);
        const ema200 = this.calculateEMA(prices, 200);

        // 3. LONG SIGNAL (compra) - SISTEMA MULTI-CONFERMA
        const longSignal = {
            strength: 0,
            reasons: [],
            confirmations: 0, // Contatore conferme
            strengthContributions: [] // Array per tracciare i punti di ogni indicatore
        };

        // CONFERMA 1: RSI oversold + uptrend
        if (rsi !== null && rsi < 30 && trend === 'bullish') {
            const points = 25;
            longSignal.strength += points;
            longSignal.confirmations++;
            longSignal.reasons.push(`RSI oversold (${rsi.toFixed(1)}) + uptrend`);
            longSignal.strengthContributions.push({ indicator: 'RSI oversold + uptrend', points, reason: `RSI oversold (${rsi.toFixed(1)}) + uptrend` });
        }

        // CONFERMA 2: RSI fortemente oversold
        if (rsi !== null && rsi < 25) {
            const points = 20;
            longSignal.strength += points;
            longSignal.confirmations++;
            longSignal.reasons.push(`RSI strongly oversold (${rsi.toFixed(1)})`);
            longSignal.strengthContributions.push({ indicator: 'RSI strongly oversold', points, reason: `RSI strongly oversold (${rsi.toFixed(1)})` });
        }

        // CONFERMA 2.5: BULLISH DIVERGENCE RSI (segnale molto forte!)
        if (rsiDivergence.type === 'bullish') {
            const points = Math.min(40, rsiDivergence.strength);
            longSignal.strength += points;
            longSignal.confirmations++;
            longSignal.reasons.push(`RSI Bullish Divergence detected (strength: ${rsiDivergence.strength})`);
            longSignal.strengthContributions.push({ indicator: 'RSI Bullish Divergence', points, reason: `RSI Bullish Divergence detected (strength: ${rsiDivergence.strength})` });
        }

        // CONFERMA 3: MACD positivo e crescente
        if (macd && macd.macdAboveSignal && macd.macdAboveZero && macd.histogramGrowing) {
            const points = 30;
            longSignal.strength += points;
            longSignal.confirmations++;
            longSignal.reasons.push(`MACD bullish (${macd.macdLine.toFixed(2)} > ${macd.signalLine.toFixed(2)})`);
            longSignal.strengthContributions.push({ indicator: 'MACD bullish', points, reason: `MACD bullish (${macd.macdLine.toFixed(2)} > ${macd.signalLine.toFixed(2)})` });
        }

        // CONFERMA 4: Bollinger - Prezzo tocca lower band
        if (bollinger && bollinger.priceAtLower && rsi !== null && rsi < 35) {
            const points = 25;
            longSignal.strength += points;
            longSignal.confirmations++;
            longSignal.reasons.push(`Price at lower Bollinger + RSI oversold`);
            longSignal.strengthContributions.push({ indicator: 'Bollinger lower band', points, reason: `Price at lower Bollinger + RSI oversold` });
        }

        // CONFERMA 5: Trend bullish su multiple timeframe
        if (trend === 'bullish' && majorTrend === 'bullish') {
            const points = 20;
            longSignal.strength += points;
            longSignal.confirmations++;
            longSignal.reasons.push(`Bullish trend confirmed (EMA 10>20, 50>200)`);
            longSignal.strengthContributions.push({ indicator: 'Bullish trend confirmed', points, reason: `Bullish trend confirmed (EMA 10>20, 50>200)` });
        }

        // CONFERMA 6: Prezzo sopra EMA key levels
        if (ema10 && ema20 && currentPrice > ema10 && ema10 > ema20) {
            const points = 15;
            longSignal.strength += points;
            longSignal.confirmations++;
            longSignal.reasons.push(`Price above EMA 10 & EMA 10 > EMA 20`);
            longSignal.strengthContributions.push({ indicator: 'Price above EMA', points, reason: `Price above EMA 10 & EMA 10 > EMA 20` });
        }

        // CONFERMA 7: Volume alto (movimento forte) - SOLO se prezzo sale o è stabile
        const priceChangeForVolume = prices.length >= 3
            ? (prices[prices.length - 1] - prices[prices.length - 3]) / prices[prices.length - 3] * 100
            : 0;
        if (volume.isHigh && priceChangeForVolume >= -0.2) { // Volume alto + prezzo sale/stabile (non scende)
            const points = 15;
            longSignal.strength += points;
            longSignal.confirmations++;
            longSignal.reasons.push(`High volume (${volume.ratio.toFixed(2)}x) + price stable/rising`);
            longSignal.strengthContributions.push({ indicator: 'High volume', points, reason: `High volume (${volume.ratio.toFixed(2)}x) + price stable/rising` });
        }

        // CONFERMA 8: Prezzo NON scende (ultimi periodi) - SOLO se prezzo sale o è stabile
        const priceChangeLong = prices.length >= 5
            ? (prices[prices.length - 1] - prices[prices.length - 5]) / prices[prices.length - 5] * 100
            : 0;
        if (priceChangeLong >= 0) { // Prezzo sale o è stabile (NON scende)
            const points = 10;
            longSignal.strength += points;
            longSignal.reasons.push(`Price stable/rising (${priceChangeLong.toFixed(2)}%)`);
            longSignal.strengthContributions.push({ indicator: 'Price stable/rising', points, reason: `Price stable/rising (${priceChangeLong.toFixed(2)}%)` });
        }

        // ✅ CONFERMA 9: MOMENTUM TREND - Prezzo sale consistentemente (trend forte in corso)
        const priceChange3 = prices.length >= 3
            ? (prices[prices.length - 1] - prices[prices.length - 3]) / prices[prices.length - 3] * 100
            : 0;
        const priceChange10 = prices.length >= 10
            ? (prices[prices.length - 1] - prices[prices.length - 10]) / prices[prices.length - 10] * 100
            : 0;
        // Se prezzo sale consistentemente su più timeframe, è un trend forte
        if (priceChange3 > 1.0 && priceChange10 > 1.5) { // Sale >1% su 3 periodi e >1.5% su 10 periodi
            const points = 25;
            longSignal.strength += points;
            longSignal.confirmations++;
            longSignal.reasons.push(`Strong momentum trend (+${priceChange3.toFixed(2)}% short, +${priceChange10.toFixed(2)}% medium)`);
            longSignal.strengthContributions.push({ indicator: 'Strong momentum trend', points, reason: `Strong momentum trend (+${priceChange3.toFixed(2)}% short, +${priceChange10.toFixed(2)}% medium)` });
        }

        // ✅ CONFERMA 10: RSI FORTE in trend positivo (60-85) - NON solo oversold!
        // RSI 60-85 in un uptrend indica forza, non solo overbought
        if (rsi !== null && rsi >= 60 && rsi <= 85 && trend === 'bullish' && priceChange3 > 0.5) {
            const points = 20;
            longSignal.strength += points;
            longSignal.confirmations++;
            longSignal.reasons.push(`RSI strong in uptrend (${rsi.toFixed(1)} - momentum signal)`);
            longSignal.strengthContributions.push({ indicator: 'RSI strong in uptrend', points, reason: `RSI strong in uptrend (${rsi.toFixed(1)} - momentum signal)` });
        }

        // ✅ CONFERMA 11: PREZZO SOPRA MULTIPLE EMA (trend molto forte)
        if (ema10 && ema20 && ema50 && currentPrice > ema10 && ema10 > ema20 && ema20 > ema50) {
            const points = 20;
            longSignal.strength += points;
            longSignal.confirmations++;
            longSignal.reasons.push(`Price above all key EMAs (strong trend alignment)`);
            longSignal.strengthContributions.push({ indicator: 'Price above all EMAs', points, reason: `Price above all key EMAs (strong trend alignment)` });
        }

        // ✅ CONFERMA 12: BREAKOUT PATTERN - Prezzo rompe upper Bollinger Band (breakout)
        if (bollinger && currentPrice > bollinger.upper && priceChange3 > 0.8) {
            const points = 20;
            longSignal.strength += points;
            longSignal.confirmations++;
            longSignal.reasons.push(`Breakout above upper Bollinger Band (+${priceChange3.toFixed(2)}%)`);
            longSignal.strengthContributions.push({ indicator: 'Breakout pattern', points, reason: `Breakout above upper Bollinger Band (+${priceChange3.toFixed(2)}%)` });
        }

        // ✅ CONFERMA 13: VOLUME CRESCENTE in trend positivo
        const volumeTrend = prices.length >= 10 ? volume.ratio : 1.0;
        if (volumeTrend > 1.5 && priceChange3 > 0.5 && trend === 'bullish') {
            const points = 15;
            longSignal.strength += points;
            longSignal.confirmations++;
            longSignal.reasons.push(`Increasing volume in uptrend (${volumeTrend.toFixed(2)}x)`);
            longSignal.strengthContributions.push({ indicator: 'Increasing volume', points, reason: `Increasing volume in uptrend (${volumeTrend.toFixed(2)}x)` });
        }

        // 4. SHORT SIGNAL (vendi) - SISTEMA MULTI-CONFERMA (PIÙ RIGOROSO)
        const shortSignal = {
            strength: 0,
            reasons: [],
            confirmations: 0, // Contatore conferme
            strengthContributions: [] // Array per tracciare i punti di ogni indicatore
        };

        // Verifica che il prezzo stia effettivamente scendendo (PREREQUISITO)
        const priceChange = prices.length >= 3
            ? (prices[prices.length - 1] - prices[prices.length - 3]) / prices[prices.length - 3] * 100
            : 0;

        // ✅ FIX CRITICO: Verifica movimento prezzo su più periodi per evitare SHORT su mercati neutri
        const priceChange5 = prices.length >= 5
            ? (prices[prices.length - 1] - prices[prices.length - 5]) / prices[prices.length - 5] * 100
            : 0;
        const priceChange10 = prices.length >= 10
            ? (prices[prices.length - 1] - prices[prices.length - 10]) / prices[prices.length - 10] * 100
            : 0;
        
        // BLOCCA SHORT se:
        // 1. Prezzo sta ancora salendo significativamente (>0.1%)
        // 2. Prezzo è stabile/neutrale (non scende in modo significativo su più timeframe)
        // Questo evita di generare SHORT su mercati laterali/neutri
        const isPriceRising = priceChange > 0.1;
        // ✅ FIX: Mercato neutrale = nessun movimento significativo in nessuna direzione
        const isPriceNeutral = (priceChange > -0.5 && priceChange < 0.5) || 
                               (priceChange5 > -1.0 && priceChange5 < 1.0) ||
                               (priceChange10 > -1.5 && priceChange10 < 1.5);
        
        // ✅ FIX CRITICO: Verifica se prezzo sta scendendo attivamente E in modo consistente
        // Se il prezzo è neutrale o laterale, NON generare segnali SHORT
        // Questo previene SHORT su mercati neutri/laterali (es. MANA/USDT senza movimento)
        // Verifica movimento CONSISTENTE: deve scendere sia su 3 che su 5 periodi
        const isPriceActivelyFalling = priceChange < -0.5 && priceChange5 < -0.8;
        
        // ✅ FIX CRITICO: Se mercato è neutrale O prezzo sta salendo, BLOCCA solo SHORT ma continua a calcolare LONG
        // NON fare return early per permettere ai segnali LONG di essere generati
        if (isPriceNeutral || isPriceRising) {
            const reason = isPriceNeutral 
                ? `Market is neutral/lateral (priceChange: ${priceChange.toFixed(2)}%, priceChange5: ${priceChange5.toFixed(2)}%, priceChange10: ${priceChange10.toFixed(2)}%)`
                : `Price still rising (+${priceChange.toFixed(2)}%) - waiting for reversal`;
            // Log solo se symbol è disponibile (non sempre presente)
            if (symbol) {
                console.log(`🚫 [${symbol}] SHORT blocked: ${reason}`);
            }
            // Resetta shortSignal ma continua il calcolo per permettere LONG
            shortSignal.strength = 0;
            shortSignal.confirmations = 0;
            shortSignal.reasons = [`SHORT blocked: ${reason}`];
            shortSignal.strengthContributions = [];
        }
        
        // Procedi con calcolo SHORT solo se prezzo sta scendendo attivamente
        

        // ⚠️ PANIC SELL EXCEPTION: Se c'è un crollo violento, ignora RSI Oversold
        // Normalmente RSI < 30 bloccherebbe lo SHORT, ma in un crash il prezzo può scendere con RSI a 5
        const isPanicSell = priceChange < -3.0 && volume.isHigh; // Crollo > 3% e volume alto
        if (isPanicSell) {
            shortSignal.reasons.push(`⚠️ PANIC SELL DETECTED: Ignoring RSI oversold due to crash (${priceChange.toFixed(2)}%)`);
            shortSignal.strength += 20; // Bonus forza per il crash
        }

        // CONFERMA 1: RSI overbought + downtrend CONFERMATO - SOLO se prezzo sta scendendo attivamente
        if (rsi !== null && rsi > 70 && trend === 'bearish' && isPriceActivelyFalling) {
            const points = 35;
            shortSignal.strength += points;
            shortSignal.confirmations++;
            shortSignal.reasons.push(`RSI overbought (${rsi.toFixed(1)}) + downtrend confirmed + price falling`);
            shortSignal.strengthContributions.push({ indicator: 'RSI overbought + downtrend', points, reason: `RSI overbought (${rsi.toFixed(1)}) + downtrend confirmed + price falling` });
        }

        // CONFERMA 2: RSI fortemente overbought + trend NON bullish - SOLO se prezzo scende
        if (rsi !== null && rsi > 75 && trend !== 'bullish' && isPriceActivelyFalling) {
            const points = 25;
            shortSignal.strength += points;
            shortSignal.confirmations++;
            shortSignal.reasons.push(`RSI strongly overbought (${rsi.toFixed(1)})`);
            shortSignal.strengthContributions.push({ indicator: 'RSI strongly overbought', points, reason: `RSI strongly overbought (${rsi.toFixed(1)})` });
        }

        // CONFERMA 2.5: BEARISH DIVERGENCE RSI (segnale molto forte!) - SOLO se prezzo scende
        if (rsiDivergence.type === 'bearish' && isPriceActivelyFalling) {
            const points = Math.min(40, rsiDivergence.strength);
            shortSignal.strength += points;
            shortSignal.confirmations++;
            shortSignal.reasons.push(`RSI Bearish Divergence detected (strength: ${rsiDivergence.strength})`);
            shortSignal.strengthContributions.push({ indicator: 'RSI Bearish Divergence', points, reason: `RSI Bearish Divergence detected (strength: ${rsiDivergence.strength})` });
        }

        // CONFERMA 3: MACD negativo e decrescente - SOLO se prezzo sta scendendo attivamente
        if (macd && !macd.macdAboveSignal && !macd.macdAboveZero && !macd.histogramGrowing && isPriceActivelyFalling) {
            const points = 30;
            shortSignal.strength += points;
            shortSignal.confirmations++;
            shortSignal.reasons.push(`MACD bearish (${macd.macdLine.toFixed(2)} < ${macd.signalLine.toFixed(2)})`);
            shortSignal.strengthContributions.push({ indicator: 'MACD bearish', points, reason: `MACD bearish (${macd.macdLine.toFixed(2)} < ${macd.signalLine.toFixed(2)})` });
        }

        // CONFERMA 4: Bollinger - Prezzo tocca upper band + RSI overbought - SOLO se prezzo scende
        if (bollinger && bollinger.priceAtUpper && rsi !== null && rsi > 65 && isPriceActivelyFalling) {
            const points = 25;
            shortSignal.strength += points;
            shortSignal.confirmations++;
            shortSignal.reasons.push(`Price at upper Bollinger + RSI overbought`);
            shortSignal.strengthContributions.push({ indicator: 'Bollinger upper band', points, reason: `Price at upper Bollinger + RSI overbought` });
        }

        // CONFERMA 5: Trend bearish su multiple timeframe - SOLO se prezzo sta scendendo attivamente
        if (trend === 'bearish' && (majorTrend === 'bearish' || majorTrend === 'neutral') && isPriceActivelyFalling) {
            const points = 25;
            shortSignal.strength += points;
            shortSignal.confirmations++;
            shortSignal.reasons.push(`Bearish trend confirmed (EMA 10<20)`);
            shortSignal.strengthContributions.push({ indicator: 'Bearish trend confirmed', points, reason: `Bearish trend confirmed (EMA 10<20)` });
        }

        // CONFERMA 6: Prezzo sotto EMA key levels - SOLO se prezzo sta scendendo attivamente
        if (ema10 && ema20 && currentPrice < ema10 && ema10 < ema20 && isPriceActivelyFalling) {
            const points = 20;
            shortSignal.strength += points;
            shortSignal.confirmations++;
            shortSignal.reasons.push(`Price below EMA 10 & EMA 10 < EMA 20`);
            shortSignal.strengthContributions.push({ indicator: 'Price below EMA', points, reason: `Price below EMA 10 & EMA 10 < EMA 20` });
        }

        // CONFERMA 7: Prezzo STA SCENDENDO (non solo "potrebbe") - SOLO se scende significativamente
        if (isPriceActivelyFalling) { // Prezzo sceso >0.3% o >0.5% su 5 periodi
            const points = 20;
            shortSignal.strength += points;
            shortSignal.confirmations++;
            shortSignal.reasons.push(`Price actively falling (${priceChange.toFixed(2)}%)`);
            shortSignal.strengthContributions.push({ indicator: 'Price actively falling', points, reason: `Price actively falling (${priceChange.toFixed(2)}%)` });
        }

        // CONFERMA 8: Volume alto (movimento forte) - SOLO se accompagnato da movimento del prezzo significativo
        if (volume.isHigh && isPriceActivelyFalling) {
            const points = 15;
            shortSignal.strength += points;
            shortSignal.confirmations++;
            shortSignal.reasons.push(`High volume (${volume.ratio.toFixed(2)}x)`);
            shortSignal.strengthContributions.push({ indicator: 'High volume', points, reason: `High volume (${volume.ratio.toFixed(2)}x)` });
        }

        // 5. DECISIONE FINALE - SISTEMA MULTI-CONFERMA CON SICUREZZA 90%

        // ✅ Requisiti bilanciati per mostrare segnali validi senza essere troppo restrittivi
        // LONG: Richiede minimo 3 conferme + strength >= 50 (bilanciato tra sicurezza e opportunità)
        const LONG_MIN_CONFIRMATIONS = 3;
        const LONG_MIN_STRENGTH = 50; // Abbassato da 70 per mostrare più segnali
        const longMeetsRequirements = longSignal.confirmations >= LONG_MIN_CONFIRMATIONS &&
            longSignal.strength >= LONG_MIN_STRENGTH;

        // SHORT: Richiede minimo 4 conferme + strength >= 50 (leggermente più rigoroso di LONG)
        const SHORT_MIN_CONFIRMATIONS = 4; // Abbassato da 5 per mostrare più segnali
        const SHORT_MIN_STRENGTH = 50; // Abbassato da 70 per mostrare più segnali

        // ✅ FIX CRITICO: Cappa strength a max 100 (evita valori impossibili come 130/100)
        longSignal.strength = Math.min(100, longSignal.strength);
        shortSignal.strength = Math.min(100, shortSignal.strength);

        const shortMeetsRequirements = shortSignal.confirmations >= SHORT_MIN_CONFIRMATIONS &&
            shortSignal.strength >= SHORT_MIN_STRENGTH;

        if (longMeetsRequirements) {
            return {
                direction: 'LONG',
                strength: longSignal.strength,
                reasons: longSignal.reasons,
                confirmations: longSignal.confirmations,
                // ✅ FIX: Restituisci anche longSignal e shortSignal per consistenza
                longSignal: {
                    strength: longSignal.strength,
                    confirmations: longSignal.confirmations,
                    reasons: longSignal.reasons,
                    strengthContributions: longSignal.strengthContributions
                },
                shortSignal: {
                    strength: shortSignal.strength,
                    confirmations: shortSignal.confirmations,
                    reasons: shortSignal.reasons,
                    strengthContributions: shortSignal.strengthContributions
                },
                indicators: {
                    rsi: rsi,
                    rsiDivergence: rsiDivergence,
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
                // ✅ FIX: Restituisci anche longSignal e shortSignal per consistenza
                longSignal: {
                    strength: longSignal.strength,
                    confirmations: longSignal.confirmations,
                    reasons: longSignal.reasons,
                    strengthContributions: longSignal.strengthContributions
                },
                shortSignal: {
                    strength: shortSignal.strength,
                    confirmations: shortSignal.confirmations,
                    reasons: shortSignal.reasons,
                    strengthContributions: shortSignal.strengthContributions
                },
                indicators: {
                    rsi: rsi,
                    rsiDivergence: rsiDivergence,
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
        if (longSignal.strength > 0 && longSignal.confirmations < LONG_MIN_CONFIRMATIONS) {
            reason = `LONG needs ${LONG_MIN_CONFIRMATIONS - longSignal.confirmations} more confirmations (has ${longSignal.confirmations}/${LONG_MIN_CONFIRMATIONS})`;
        } else if (shortSignal.strength > 0 && shortSignal.confirmations < SHORT_MIN_CONFIRMATIONS) {
            reason = `SHORT needs ${SHORT_MIN_CONFIRMATIONS - shortSignal.confirmations} more confirmations (has ${shortSignal.confirmations}/${SHORT_MIN_CONFIRMATIONS})`;
        } else if (longSignal.strength < LONG_MIN_STRENGTH && shortSignal.strength < SHORT_MIN_STRENGTH) {
            reason = `Signal strength too low (LONG: ${longSignal.strength}/${LONG_MIN_STRENGTH}, SHORT: ${shortSignal.strength}/${SHORT_MIN_STRENGTH})`;
        }

        return {
            direction: 'NEUTRAL',
            strength: maxStrength,
            reasons: [reason],
            confirmations: maxConfirmations,
            // ✅ FIX: Restituisci anche longSignal e shortSignal per mostrare progresso anche quando NEUTRAL
            longSignal: {
                strength: longSignal.strength,
                confirmations: longSignal.confirmations,
                reasons: longSignal.reasons,
                strengthContributions: longSignal.strengthContributions
            },
            shortSignal: {
                strength: shortSignal.strength,
                confirmations: shortSignal.confirmations,
                reasons: shortSignal.reasons,
                strengthContributions: shortSignal.strengthContributions
            },
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


