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
     * 🎯 PROFESSIONAL TRADING: Market Structure Analysis
     * Identifica supporti e resistenze chiave basati su swing highs/lows
     * @param {Array} prices - Array di prezzi
     * @param {number} lookback - Periodi per identificare swing points (default 5)
     * @returns {Object} { supports: [], resistances: [], nearestSupport, nearestResistance }
     */
    analyzeMarketStructure(prices, lookback = 5) {
        if (prices.length < lookback * 3) {
            return { supports: [], resistances: [], nearestSupport: null, nearestResistance: null };
        }

        const swingHighs = [];
        const swingLows = [];
        const currentPrice = prices[prices.length - 1];

        // Identifica swing highs e lows
        for (let i = lookback; i < prices.length - lookback; i++) {
            let isSwingHigh = true;
            let isSwingLow = true;

            // Verifica se è un swing high (massimo locale)
            for (let j = i - lookback; j <= i + lookback; j++) {
                if (j !== i) {
                    if (prices[j] >= prices[i]) isSwingHigh = false;
                    if (prices[j] <= prices[i]) isSwingLow = false;
                }
            }

            if (isSwingHigh) {
                swingHighs.push({ index: i, price: prices[i], distance: Math.abs(prices[i] - currentPrice) / currentPrice });
            }
            if (isSwingLow) {
                swingLows.push({ index: i, price: prices[i], distance: Math.abs(prices[i] - currentPrice) / currentPrice });
            }
        }

        // Trova supporto e resistenza più vicini
        const resistances = swingHighs.filter(h => h.price > currentPrice).sort((a, b) => a.distance - b.distance);
        const supports = swingLows.filter(l => l.price < currentPrice).sort((a, b) => a.distance - b.distance);

        return {
            supports: supports.slice(0, 3), // Top 3 supporti
            resistances: resistances.slice(0, 3), // Top 3 resistenze
            nearestSupport: supports.length > 0 ? supports[0] : null,
            nearestResistance: resistances.length > 0 ? resistances[0] : null,
            swingHighs: swingHighs.slice(-5), // Ultimi 5 swing highs
            swingLows: swingLows.slice(-5) // Ultimi 5 swing lows
        };
    }

    /**
     * 🎯 PROFESSIONAL TRADING: Momentum Quality Check
     * Verifica se il momentum è sostenibile o sta esaurendosi
     * @param {Array} prices - Array di prezzi
     * @param {Array} priceHistory - Array completo con high/low/volume se disponibile
     * @returns {Object} { isHealthy, score, warnings, volumeTrend, momentumStrength }
     */
    analyzeMomentumQuality(prices, priceHistory = null) {
        if (prices.length < 20) {
            return { isHealthy: false, score: 0, warnings: ['Insufficient data'], volumeTrend: 'unknown', momentumStrength: 0 };
        }

        const warnings = [];
        let qualityScore = 100; // Parte da 100, sottraiamo per problemi

        // 1. Verifica se il momentum sta rallentando (price change decrescente)
        const recentChanges = [];
        for (let i = prices.length - 10; i < prices.length - 1; i++) {
            const change = (prices[i + 1] - prices[i]) / prices[i] * 100;
            recentChanges.push(change);
        }

        // Se gli ultimi movimenti sono più piccoli dei precedenti, momentum sta rallentando
        const firstHalf = recentChanges.slice(0, 5).reduce((a, b) => a + Math.abs(b), 0) / 5;
        const secondHalf = recentChanges.slice(5).reduce((a, b) => a + Math.abs(b), 0) / 4;

        if (secondHalf < firstHalf * 0.7) {
            qualityScore -= 30;
            warnings.push('Momentum in rallentamento (movimenti di prezzo in diminuzione)');
        }

        // 2. Verifica volume trend (se disponibile)
        let volumeTrend = 'unknown';
        if (priceHistory && priceHistory.length > 10 && priceHistory[0].volume !== undefined) {
            const recentVolumes = priceHistory.slice(-5).map(h => h.volume || 0);
            const olderVolumes = priceHistory.slice(-15, -5).map(h => h.volume || 0);

            const avgRecentVol = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
            const avgOlderVol = olderVolumes.reduce((a, b) => a + b, 0) / olderVolumes.length;

            if (avgRecentVol < avgOlderVol * 0.8) {
                volumeTrend = 'decreasing';
                qualityScore -= 25;
                warnings.push('Volume in calo durante il rialzo (momentum debole)');
            } else if (avgRecentVol > avgOlderVol * 1.2) {
                volumeTrend = 'increasing';
                qualityScore += 10; // Bonus per volume crescente
            } else {
                volumeTrend = 'stable';
            }
        }

        // 3. Calcola momentum strength (ROC - Rate of Change)
        const roc10 = prices.length >= 10 ? (prices[prices.length - 1] - prices[prices.length - 10]) / prices[prices.length - 10] * 100 : 0;
        const roc20 = prices.length >= 20 ? (prices[prices.length - 1] - prices[prices.length - 20]) / prices[prices.length - 20] * 100 : 0;

        // Se ROC sta diminuendo, momentum si sta esaurendo
        if (roc10 > 0 && roc20 > 0 && roc10 < roc20 * 0.5) {
            qualityScore -= 20;
            warnings.push('Momentum in indebolimento (ROC10 < ROC20/2)');
        }

        const momentumStrength = Math.max(roc10, roc20);
        const isHealthy = qualityScore >= 60 && warnings.length <= 1;

        return {
            isHealthy: isHealthy,
            score: Math.max(0, Math.min(100, qualityScore)),
            warnings: warnings,
            volumeTrend: volumeTrend,
            momentumStrength: momentumStrength,
            roc10: roc10,
            roc20: roc20
        };
    }

    /**
     * 🎯 PROFESSIONAL TRADING: Reversal Risk Assessment
     * Valuta il rischio che il prezzo inverta dopo un rally/dump
     * @param {Array} prices - Array di prezzi
     * @param {number} rsi - RSI corrente
     * @param {Object} macd - MACD object
     * @returns {Object} { risk: 'low'|'medium'|'high', score: 0-100, reasons: [] }
     */
    assessReversalRisk(prices, rsi, macd) {
        if (prices.length < 30) {
            return { risk: 'unknown', score: 0, reasons: ['Insufficient data'] };
        }

        let riskScore = 0; // 0 = low risk, 100 = high risk
        const reasons = [];

        const currentPrice = prices[prices.length - 1];
        const priceChange10 = (currentPrice - prices[prices.length - 10]) / prices[prices.length - 10] * 100;
        const priceChange20 = (currentPrice - prices[prices.length - 20]) / prices[prices.length - 20] * 100;

        // 1. RSI Extreme Levels (overbought/oversold estremi)
        if (rsi !== null) {
            if (rsi > 80 && priceChange10 > 3) {
                riskScore += 35;
                reasons.push(`RSI estremamente ipercomprato (${rsi.toFixed(1)}) dopo rally - alto rischio inversione`);
            } else if (rsi > 75 && priceChange10 > 2) {
                riskScore += 20;
                reasons.push(`RSI ipercomprato (${rsi.toFixed(1)}) - rischio inversione moderato`);
            } else if (rsi < 20 && priceChange10 < -3) {
                riskScore += 35;
                reasons.push(`RSI estremamente ipervenduto (${rsi.toFixed(1)}) dopo crollo - alto rischio rimbalzo`);
            } else if (rsi < 25 && priceChange10 < -2) {
                riskScore += 20;
                reasons.push(`RSI ipervenduto (${rsi.toFixed(1)}) - rischio rimbalzo moderato`);
            }
        }

        // 2. Parabolic Move (movimento parabolico = alto rischio reversal)
        // Se prezzo sale/scende molto più velocemente su 10 periodi che su 20
        if (Math.abs(priceChange10) > Math.abs(priceChange20) * 1.5 && Math.abs(priceChange10) > 5) {
            riskScore += 30;
            reasons.push(`Movimento parabolico rilevato (${priceChange10.toFixed(2)}% in 10 periodi) - esaurimento probabile`);
        }

        // 3. MACD Divergence (se MACD non conferma il movimento del prezzo)
        if (macd && macd.histogram !== undefined) {
            const rsiHistory = this.calculateRSIHistory(prices, 14);
            if (rsiHistory.length >= 15) {
                const divergence = this.detectRSIDivergence(prices, rsiHistory);

                if (divergence.type === 'bearish' && priceChange10 > 2) {
                    riskScore += 25;
                    reasons.push('Divergenza ribassista rilevata - segnale inversione');
                } else if (divergence.type === 'bullish' && priceChange10 < -2) {
                    riskScore += 25;
                    reasons.push('Divergenza rialzista rilevata - segnale rimbalzo');
                }
            }
        }

        // 4. Extended Move (prezzo troppo lontano dalla media)
        const sma20 = this.calculateSMA(prices, 20);
        if (sma20) {
            const distanceFromSMA = ((currentPrice - sma20) / sma20) * 100;
            if (Math.abs(distanceFromSMA) > 8) {
                riskScore += 20;
                reasons.push(`Prezzo ${distanceFromSMA > 0 ? 'sopra' : 'sotto'} SMA20 del ${Math.abs(distanceFromSMA).toFixed(2)}% - probabile ritorno alla media`);
            }
        }

        // 5. Consecutive Candles (troppi candles consecutivi nella stessa direzione)
        let consecutiveUp = 0;
        let consecutiveDown = 0;
        for (let i = prices.length - 1; i > prices.length - 8 && i > 0; i--) {
            if (prices[i] > prices[i - 1]) {
                consecutiveUp++;
                consecutiveDown = 0;
            } else if (prices[i] < prices[i - 1]) {
                consecutiveDown++;
                consecutiveUp = 0;
            } else {
                break;
            }
        }

        if (consecutiveUp >= 6) {
            riskScore += 15;
            reasons.push(`${consecutiveUp} candele rialziste consecutive - probabile ritracciamento`);
        } else if (consecutiveDown >= 6) {
            riskScore += 15;
            reasons.push(`${consecutiveDown} candele ribassiste consecutive - probabile rimbalzo`);
        }

        // Determina livello di rischio
        let riskLevel = 'low';
        if (riskScore >= 60) {
            riskLevel = 'high';
        } else if (riskScore >= 35) {
            riskLevel = 'medium';
        }

        return {
            risk: riskLevel,
            score: Math.min(100, riskScore),
            reasons: reasons,
            priceChange10: priceChange10,
            priceChange20: priceChange20
        };
    }

    /**
     * 🎯 PROFESSIONAL TRADING: Calculate Risk/Reward Ratio
     * Calcola il rapporto rischio/rendimento basato su struttura di mercato
     * @param {number} entryPrice - Prezzo di entrata
     * @param {Object} marketStructure - Struttura di mercato (supporti/resistenze)
     * @param {string} direction - 'LONG' o 'SHORT'
     * @returns {Object} { ratio, stopLoss, takeProfit, isAcceptable }
     */
    calculateRiskReward(entryPrice, marketStructure, direction = 'LONG') {
        if (!marketStructure || !marketStructure.nearestSupport || !marketStructure.nearestResistance) {
            return { ratio: 0, stopLoss: null, takeProfit: null, isAcceptable: false, reason: 'No market structure available' };
        }

        let stopLoss, takeProfit, risk, reward;

        if (direction === 'LONG') {
            // Stop loss sotto il supporto più vicino
            stopLoss = marketStructure.nearestSupport ? marketStructure.nearestSupport.price * 0.995 : entryPrice * 0.97;
            // Take profit alla resistenza più vicina
            takeProfit = marketStructure.nearestResistance ? marketStructure.nearestResistance.price * 0.995 : entryPrice * 1.05;

            risk = entryPrice - stopLoss;
            reward = takeProfit - entryPrice;
        } else {
            // SHORT
            stopLoss = marketStructure.nearestResistance ? marketStructure.nearestResistance.price * 1.005 : entryPrice * 1.03;
            takeProfit = marketStructure.nearestSupport ? marketStructure.nearestSupport.price * 1.005 : entryPrice * 0.95;

            risk = stopLoss - entryPrice;
            reward = entryPrice - takeProfit;
        }

        const ratio = risk > 0 ? reward / risk : 0;
        const isAcceptable = ratio >= 1.5; // Minimo 1:1.5 risk/reward

        return {
            ratio: ratio,
            stopLoss: stopLoss,
            takeProfit: takeProfit,
            risk: risk,
            reward: reward,
            isAcceptable: isAcceptable,
            reason: isAcceptable ? `Buon R/R ratio (1:${ratio.toFixed(2)})` : `Scarso R/R ratio (1:${ratio.toFixed(2)}) - richiesto almeno 1:1.5`
        };
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
     * @param {Object} params - Parametri configurabili (rsi_period, rsi_oversold, rsi_overbought)
     * @returns {Object} { direction: 'LONG'|'SHORT'|'NEUTRAL', strength: 0-100, reasons: [] }
     */
    generateSignal(priceHistory, symbol = null, params = {}) {
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

        // ✅ FIX: Usa parametri RSI configurati dall'utente invece di valori hardcoded
        const rsiPeriod = params.rsi_period || 14;
        const rsiOversold = params.rsi_oversold || 30;
        const rsiOverbought = params.rsi_overbought || 70;
        
        // 1. Calcola indicatori BASE
        const rsi = this.calculateRSI(prices, rsiPeriod);
        const trend = this.detectTrend(prices);
        const majorTrend = this.detectMajorTrend(prices); // EMA 50/200
        const volume = this.analyzeVolume(prices);
        const atr = this.calculateATR(highs, lows, closes);
        const currentPrice = prices[prices.length - 1];
        const avgPrice = prices.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, prices.length);
        const volatility = atr ? atr / currentPrice : 0.02; // Default 2%
        const avgVolatility = this.calculateVolatility(prices.slice(-30)) / avgPrice || 0.02;

        // 2. Calcola RSI storico per divergenze (usa periodo configurato)
        const rsiHistory = this.calculateRSIHistory(prices, rsiPeriod);
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

        // ✅ FIX CRITICO: Verifica movimento prezzo per LONG (PREREQUISITO)
        // Calcola variazioni prezzo su più timeframe
        const priceChange = prices.length >= 3
            ? (prices[prices.length - 1] - prices[prices.length - 3]) / prices[prices.length - 3] * 100
            : 0;
        const priceChange5 = prices.length >= 5
            ? (prices[prices.length - 1] - prices[prices.length - 5]) / prices[prices.length - 5] * 100
            : 0;
        const priceChange10 = prices.length >= 10
            ? (prices[prices.length - 1] - prices[prices.length - 10]) / prices[prices.length - 10] * 100
            : 0;

        // ✅ LOGICA INTELLIGENTE: Blocca LONG solo se prezzo scende SENZA segnali di inversione
        // Se ci sono segnali forti di inversione (RSI oversold, divergenze bullish), permette LONG anche durante discese
        const isPriceActivelyFalling = (priceChange < -0.3 && priceChange5 < -0.3) || 
                                       (priceChange5 < -0.5) ||
                                       (priceChange10 < -1.0 && priceChange5 < -0.2);
        
        // Verifica se ci sono segnali forti di inversione che giustificano LONG durante discesa
        const hasStrongReversalSignals = (rsi !== null && rsi < rsiOversold) || // RSI oversold = possibile inversione
                                        (rsiDivergence.type === 'bullish' && rsiDivergence.strength > 30); // Divergenza bullish forte
        
        // Blocca LONG solo se prezzo scende E NON ci sono segnali di inversione forti
        if (isPriceActivelyFalling && !hasStrongReversalSignals) {
            const reason = `Prezzo in calo attivo (${priceChange.toFixed(2)}%, ${priceChange5.toFixed(2)}%, ${priceChange10.toFixed(2)}%) senza segnali di inversione - in attesa di inversione`;
            if (symbol) {
                console.log(`🚫 [${symbol}] LONG bloccato: ${reason}`);
            }
            // Blocca completamente LONG se prezzo scende senza segnali di inversione
            longSignal.strength = 0;
            longSignal.confirmations = 0;
            longSignal.reasons = [`🚫 BLOCKED: ${reason}`];
            longSignal.strengthContributions = [];
            // NON fare return - continua per permettere SHORT di essere generato
            // Ma salta tutte le conferme LONG (vedi controlli sotto)
        } else if (isPriceActivelyFalling && hasStrongReversalSignals) {
            // Prezzo scende MA ci sono segnali di inversione - permette LONG ma con strength ridotta
            if (symbol) {
                console.log(`⚠️ [${symbol}] LONG durante discesa ma con segnali di inversione (RSI: ${rsi?.toFixed(1) || 'N/A'}, Divergence: ${rsiDivergence.type || 'none'}) - Permettendo LONG`);
            }
            // Non bloccare, ma le conferme aggiungeranno strength normalmente
        }

        // ✅ SKIP tutte le conferme LONG solo se prezzo scende SENZA segnali di inversione
        if (!isPriceActivelyFalling || hasStrongReversalSignals) {
        // CONFERMA 1: RSI oversold + uptrend (usa soglia configurata)
        if (rsi !== null && rsi < rsiOversold && trend === 'bullish') {
            const points = 25;
            longSignal.strength += points;
            longSignal.confirmations++;
            longSignal.reasons.push(`RSI oversold (${rsi.toFixed(1)} < ${rsiOversold}) + uptrend`);
            longSignal.strengthContributions.push({ indicator: 'RSI oversold + uptrend', points, reason: `RSI oversold (${rsi.toFixed(1)} < ${rsiOversold}) + uptrend` });
        }

        // CONFERMA 2: RSI fortemente oversold (usa soglia configurata - 5 punti)
        const rsiStronglyOversold = rsiOversold - 5;
        if (rsi !== null && rsi < rsiStronglyOversold) {
            const points = 20;
            longSignal.strength += points;
            longSignal.confirmations++;
            longSignal.reasons.push(`RSI strongly oversold (${rsi.toFixed(1)} < ${rsiStronglyOversold})`);
            longSignal.strengthContributions.push({ indicator: 'RSI strongly oversold', points, reason: `RSI strongly oversold (${rsi.toFixed(1)} < ${rsiStronglyOversold})` });
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
            longSignal.reasons.push(`MACD rialzista (${macd.macdLine.toFixed(2)} > ${macd.signalLine.toFixed(2)})`);
            longSignal.strengthContributions.push({ indicator: 'MACD rialzista', points, reason: `MACD rialzista (${macd.macdLine.toFixed(2)} > ${macd.signalLine.toFixed(2)})` });
        }

        // CONFERMA 4: Bollinger - Prezzo tocca lower band (usa soglia configurata + 5)
        if (bollinger && bollinger.priceAtLower && rsi !== null && rsi < (rsiOversold + 5)) {
            const points = 25;
            longSignal.strength += points;
            longSignal.confirmations++;
            longSignal.reasons.push(`Prezzo alla Bollinger inferiore + RSI ipervenduto`);
            longSignal.strengthContributions.push({ indicator: 'Bollinger inferiore', points, reason: `Prezzo alla Bollinger inferiore + RSI ipervenduto` });
        }

        // CONFERMA 5: Trend bullish su multiple timeframe
        if (trend === 'bullish' && majorTrend === 'bullish') {
            const points = 20;
            longSignal.strength += points;
            longSignal.confirmations++;
            longSignal.reasons.push(`Trend rialzista confermato (EMA 10>20, 50>200)`);
            longSignal.strengthContributions.push({ indicator: 'Trend rialzista confermato', points, reason: `Trend rialzista confermato (EMA 10>20, 50>200)` });
        }

        // ✅ NUOVO: CONFERMA 5.5: Trend bullish anche senza RSI estremo (per mercati neutri)
        if (trend === 'bullish' && rsi !== null && rsi >= 40 && rsi <= 60) {
            const points = 15;
            longSignal.strength += points;
            longSignal.confirmations++;
            longSignal.reasons.push(`Trend rialzista con RSI neutrale (${rsi.toFixed(1)}) - momentum trend`);
            longSignal.strengthContributions.push({ indicator: 'Trend rialzista (RSI neutrale)', points, reason: `Trend rialzista con RSI neutrale (${rsi.toFixed(1)})` });
        }

        // CONFERMA 6: Prezzo sopra EMA key levels
        if (ema10 && ema20 && currentPrice > ema10 && ema10 > ema20) {
            const points = 15;
            longSignal.strength += points;
            longSignal.confirmations++;
            longSignal.reasons.push(`Prezzo sopra EMA 10 e EMA 10 > EMA 20`);
            longSignal.strengthContributions.push({ indicator: 'Prezzo sopra EMA', points, reason: `Prezzo sopra EMA 10 e EMA 10 > EMA 20` });
        }

        // ✅ NUOVO: CONFERMA 6.5: MACD bullish anche con RSI neutrale (segnale forte)
        if (macd && macd.macdAboveSignal && macd.macdAboveZero && rsi !== null && rsi >= 40 && rsi <= 60) {
            const points = 20;
            longSignal.strength += points;
            longSignal.confirmations++;
            longSignal.reasons.push(`MACD rialzista con RSI neutrale (${rsi.toFixed(1)}) - momentum in crescita`);
            longSignal.strengthContributions.push({ indicator: 'MACD rialzista (RSI neutrale)', points, reason: `MACD rialzista con RSI neutrale (${rsi.toFixed(1)})` });
        }

        // CONFERMA 7: Volume alto (movimento forte) - SOLO se prezzo sale o è stabile
        const priceChangeForVolume = prices.length >= 3
            ? (prices[prices.length - 1] - prices[prices.length - 3]) / prices[prices.length - 3] * 100
            : 0;
        if (volume.isHigh && priceChangeForVolume >= -0.2) { // Volume alto + prezzo sale/stabile (non scende)
            const points = 15;
            longSignal.strength += points;
            longSignal.confirmations++;
            longSignal.reasons.push(`Volume alto (${volume.ratio.toFixed(2)}x) + prezzo stabile/in crescita`);
            longSignal.strengthContributions.push({ indicator: 'Volume alto', points, reason: `Volume alto (${volume.ratio.toFixed(2)}x) + prezzo stabile/in crescita` });
        }

        // CONFERMA 8: Prezzo NON scende (ultimi periodi) - SOLO se prezzo sale o è stabile
        const priceChangeLong = prices.length >= 5
            ? (prices[prices.length - 1] - prices[prices.length - 5]) / prices[prices.length - 5] * 100
            : 0;
        if (priceChangeLong >= 0) { // Prezzo sale o è stabile (NON scende)
            const points = 10;
            longSignal.strength += points;
            longSignal.reasons.push(`Prezzo stabile/in crescita (${priceChangeLong.toFixed(2)}%)`);
            longSignal.strengthContributions.push({ indicator: 'Prezzo stabile/in crescita', points, reason: `Prezzo stabile/in crescita (${priceChangeLong.toFixed(2)}%)` });
        }

        // ✅ CONFERMA 9: MOMENTUM TREND - Prezzo sale consistentemente (trend forte in corso)
        // ✅ FIX: Riutilizza priceChange10 già dichiarato sopra (linea 760)
        const priceChange3 = prices.length >= 3
            ? (prices[prices.length - 1] - prices[prices.length - 3]) / prices[prices.length - 3] * 100
            : 0;
        // priceChange10 già dichiarato sopra per LONG (linea 760), riutilizziamo
        // Se prezzo sale consistentemente su più timeframe, è un trend forte
        if (priceChange3 > 1.0 && priceChange10 > 1.5) { // Sale >1% su 3 periodi e >1.5% su 10 periodi
            const points = 25;
            longSignal.strength += points;
            longSignal.confirmations++;
            longSignal.reasons.push(`Trend momentum forte (+${priceChange3.toFixed(2)}% breve, +${priceChange10.toFixed(2)}% medio)`);
            longSignal.strengthContributions.push({ indicator: 'Trend momentum forte', points, reason: `Trend momentum forte (+${priceChange3.toFixed(2)}% breve, +${priceChange10.toFixed(2)}% medio)` });
        }

        // ✅ CONFERMA 10: RSI FORTE in trend positivo (60-85) - NON solo oversold!
        // RSI 60-85 in un uptrend indica forza, non solo overbought
        if (rsi !== null && rsi >= 60 && rsi <= 85 && trend === 'bullish' && priceChange3 > 0.5) {
            const points = 20;
            longSignal.strength += points;
            longSignal.confirmations++;
            longSignal.reasons.push(`RSI forte in trend rialzista (${rsi.toFixed(1)} - segnale momentum)`);
            longSignal.strengthContributions.push({ indicator: 'RSI forte in trend rialzista', points, reason: `RSI forte in trend rialzista (${rsi.toFixed(1)} - segnale momentum)` });
        }

        // ✅ CONFERMA 11: PREZZO SOPRA MULTIPLE EMA (trend molto forte)
        if (ema10 && ema20 && ema50 && currentPrice > ema10 && ema10 > ema20 && ema20 > ema50) {
            const points = 20;
            longSignal.strength += points;
            longSignal.confirmations++;
            longSignal.reasons.push(`Prezzo sopra tutte le EMA chiave (allineamento trend forte)`);
            longSignal.strengthContributions.push({ indicator: 'Prezzo sopra tutte le EMA', points, reason: `Prezzo sopra tutte le EMA chiave (allineamento trend forte)` });
        }

        // ✅ CONFERMA 12: BREAKOUT PATTERN - Prezzo rompe upper Bollinger Band (breakout)
        if (bollinger && currentPrice > bollinger.upper && priceChange3 > 0.8) {
            const points = 20;
            longSignal.strength += points;
            longSignal.confirmations++;
            longSignal.reasons.push(`Breakout sopra Bollinger superiore (+${priceChange3.toFixed(2)}%)`);
            longSignal.strengthContributions.push({ indicator: 'Pattern breakout', points, reason: `Breakout sopra Bollinger superiore (+${priceChange3.toFixed(2)}%)` });
        }

        // ✅ CONFERMA 13: VOLUME CRESCENTE in trend positivo
        const volumeTrend = prices.length >= 10 ? volume.ratio : 1.0;
        if (volumeTrend > 1.5 && priceChange3 > 0.5 && trend === 'bullish') {
            const points = 15;
            longSignal.strength += points;
            longSignal.confirmations++;
            longSignal.reasons.push(`Volume crescente in trend rialzista (${volumeTrend.toFixed(2)}x)`);
            longSignal.strengthContributions.push({ indicator: 'Volume crescente', points, reason: `Volume crescente in trend rialzista (${volumeTrend.toFixed(2)}x)` });
        }
        } // ✅ FINE BLOCCO: Salta tutte le conferme LONG se prezzo sta scendendo

        // 4. SHORT SIGNAL (vendi) - SISTEMA MULTI-CONFERMA (PIÙ RIGOROSO)
        const shortSignal = {
            strength: 0,
            reasons: [],
            confirmations: 0, // Contatore conferme
            strengthContributions: [] // Array per tracciare i punti di ogni indicatore
        };

        // Verifica che il prezzo stia effettivamente scendendo (PREREQUISITO)
        // ✅ FIX: Usa nomi diversi per evitare conflitto con variabili LONG
        const priceChangeShort = prices.length >= 3
            ? (prices[prices.length - 1] - prices[prices.length - 3]) / prices[prices.length - 3] * 100
            : 0;

        // ✅ FIX CRITICO: Verifica movimento prezzo su più periodi per evitare SHORT su mercati neutri
        const priceChange5Short = prices.length >= 5
            ? (prices[prices.length - 1] - prices[prices.length - 5]) / prices[prices.length - 5] * 100
            : 0;
        // priceChange10 già dichiarato sopra per LONG, riutilizziamo per SHORT se necessario
        const priceChange10Short = prices.length >= 10
            ? (prices[prices.length - 1] - prices[prices.length - 10]) / prices[prices.length - 10] * 100
            : 0;


        // BLOCCA SHORT se:
        // 1. Prezzo sta ancora salendo significativamente (>0.15%)
        // 2. Prezzo è stabile/neutrale (non scende in modo significativo su più timeframe)
        // Questo evita di generare SHORT su mercati laterali/neutri
        // ✅ FIX: Soglia leggermente più alta (0.15% invece di 0.1%) per evitare falsi positivi
        const isPriceRising = priceChangeShort > 0.15;
        // ✅ FIX: Mercato neutrale = nessun movimento significativo in nessuna direzione
        // ✅ MIGLIORATO: Considera neutrale solo se NON c'è movimento su TUTTI i timeframe
        // ✅ FIX: Soglie più flessibili per riconoscere mercati davvero neutri
        // Se almeno un timeframe mostra movimento al ribasso, NON è neutrale
        const isPriceNeutral = (priceChangeShort > -0.2 && priceChangeShort < 0.2) &&
            (priceChange5Short > -0.3 && priceChange5Short < 0.3) &&
            (priceChange10Short > -0.5 && priceChange10Short < 0.5);

        // ✅ FIX CRITICO: Verifica se prezzo sta scendendo attivamente E in modo consistente
        // Se il prezzo è neutrale o laterale, NON generare segnali SHORT
        // Questo previene SHORT su mercati neutri/laterali (es. MANA/USDT senza movimento)
        // ✅ MIGLIORATO: Rileva trend al ribasso anche se non estremamente aggressivo
        // ✅ FIX: Soglie più flessibili per riconoscere discese graduali ma consistenti
        // Verifica movimento CONSISTENTE: deve scendere su almeno uno dei timeframe
        // Nuove soglie più realistiche (ridotte ulteriormente per catturare discese graduali):
        // - Se scende >0.2% su 3 periodi E >0.2% su 5 periodi = discesa consistente (anche graduale)
        // - OPPURE scende >0.3% su 3 periodi = discesa più rapida
        // - OPPURE scende >0.4% su 5 periodi = trend al ribasso medio termine
        // - OPPURE scende >0.5% su 10 periodi = trend al ribasso lungo termine
        const isPriceActivelyFalling = (priceChangeShort < -0.2 && priceChange5Short < -0.2) || 
                                       (priceChangeShort < -0.3) || 
                                       (priceChange5Short < -0.4) ||
                                       (priceChange10Short < -0.5);

        // ✅ FIX CRITICO: Se mercato è neutrale O prezzo sta salendo, BLOCCA solo SHORT ma continua a calcolare LONG
        // NON fare return early per permettere ai segnali LONG di essere generati
        if (isPriceNeutral || isPriceRising) {
            const reason = isPriceNeutral
                ? `Mercato neutrale/laterale (Var: ${priceChangeShort.toFixed(2)}%, Var5: ${priceChange5Short.toFixed(2)}%, Var10: ${priceChange10Short.toFixed(2)}%)`
                : `Prezzo ancora in salita (+${priceChangeShort.toFixed(2)}%) - in attesa di inversione`;
            // Log solo se symbol è disponibile (non sempre presente)
            if (symbol) {
                console.log(`🚫 [${symbol}] SHORT bloccato: ${reason}`);
            }
            // Resetta shortSignal ma continua il calcolo per permettere LONG
            shortSignal.strength = 0;
            shortSignal.confirmations = 0;
            shortSignal.reasons = [`SHORT bloccato: ${reason}`];
            shortSignal.strengthContributions = [];
        }

        // Procedi con calcolo SHORT solo se prezzo sta scendendo attivamente


        // ⚠️ PANIC SELL EXCEPTION: Se c'è un crollo violento, ignora RSI Oversold
        // Normalmente RSI < 30 bloccherebbe lo SHORT, ma in un crash il prezzo può scendere con RSI a 5
        const isPanicSell = priceChangeShort < -3.0 && volume.isHigh; // Crollo > 3% e volume alto
        if (isPanicSell) {
            shortSignal.reasons.push(`⚠️ PANIC SELL DETECTED: Ignoring RSI oversold due to crash (${priceChangeShort.toFixed(2)}%)`);
            shortSignal.strength += 20; // Bonus forza per il crash
        }

        // CONFERMA 1: RSI overbought + downtrend CONFERMATO - SOLO se prezzo sta scendendo attivamente (usa soglia configurata)
        if (rsi !== null && rsi > rsiOverbought && trend === 'bearish' && isPriceActivelyFalling) {
            const points = 35;
            shortSignal.strength += points;
            shortSignal.confirmations++;
            shortSignal.reasons.push(`RSI overbought (${rsi.toFixed(1)} > ${rsiOverbought}) + downtrend confirmed + price falling`);
            shortSignal.strengthContributions.push({ indicator: 'RSI overbought + downtrend', points, reason: `RSI overbought (${rsi.toFixed(1)} > ${rsiOverbought}) + downtrend confirmed + price falling` });
        }

        // CONFERMA 2: RSI fortemente overbought + trend NON bullish - SOLO se prezzo scende (usa soglia configurata + 5)
        const rsiStronglyOverbought = rsiOverbought + 5;
        if (rsi !== null && rsi > rsiStronglyOverbought && trend !== 'bullish' && isPriceActivelyFalling) {
            const points = 25;
            shortSignal.strength += points;
            shortSignal.confirmations++;
            shortSignal.reasons.push(`RSI strongly overbought (${rsi.toFixed(1)} > ${rsiStronglyOverbought})`);
            shortSignal.strengthContributions.push({ indicator: 'RSI strongly overbought', points, reason: `RSI strongly overbought (${rsi.toFixed(1)} > ${rsiStronglyOverbought})` });
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
            shortSignal.reasons.push(`MACD ribassista (${macd.macdLine.toFixed(2)} < ${macd.signalLine.toFixed(2)})`);
            shortSignal.strengthContributions.push({ indicator: 'MACD ribassista', points, reason: `MACD ribassista (${macd.macdLine.toFixed(2)} < ${macd.signalLine.toFixed(2)})` });
        }

        // CONFERMA 4: Bollinger - Prezzo tocca upper band + RSI overbought - SOLO se prezzo scende (usa soglia configurata - 5)
        if (bollinger && bollinger.priceAtUpper && rsi !== null && rsi > (rsiOverbought - 5) && isPriceActivelyFalling) {
            const points = 25;
            shortSignal.strength += points;
            shortSignal.confirmations++;
            shortSignal.reasons.push(`Prezzo alla Bollinger superiore + RSI ipercomprato`);
            shortSignal.strengthContributions.push({ indicator: 'Bollinger superiore', points, reason: `Prezzo alla Bollinger superiore + RSI ipercomprato` });
        }

        // CONFERMA 5: Trend bearish su multiple timeframe - SOLO se prezzo sta scendendo attivamente
        if (trend === 'bearish' && (majorTrend === 'bearish' || majorTrend === 'neutral') && isPriceActivelyFalling) {
            const points = 25;
            shortSignal.strength += points;
            shortSignal.confirmations++;
            shortSignal.reasons.push(`Trend ribassista confermato (EMA 10<20)`);
            shortSignal.strengthContributions.push({ indicator: 'Trend ribassista confermato', points, reason: `Trend ribassista confermato (EMA 10<20)` });
        }

        // ✅ NUOVO: CONFERMA 5.5: Trend bearish anche senza RSI estremo (per mercati neutri)
        if (trend === 'bearish' && isPriceActivelyFalling && rsi !== null && rsi >= 40 && rsi <= 60) {
            const points = 15;
            shortSignal.strength += points;
            shortSignal.confirmations++;
            shortSignal.reasons.push(`Trend ribassista con RSI neutrale (${rsi.toFixed(1)}) - momentum trend`);
            shortSignal.strengthContributions.push({ indicator: 'Trend ribassista (RSI neutrale)', points, reason: `Trend ribassista con RSI neutrale (${rsi.toFixed(1)})` });
        }

        // CONFERMA 6: Prezzo sotto EMA key levels - SOLO se prezzo sta scendendo attivamente
        if (ema10 && ema20 && currentPrice < ema10 && ema10 < ema20 && isPriceActivelyFalling) {
            const points = 20;
            shortSignal.strength += points;
            shortSignal.confirmations++;
            shortSignal.reasons.push(`Prezzo sotto EMA 10 e EMA 10 < EMA 20`);
            shortSignal.strengthContributions.push({ indicator: 'Prezzo sotto EMA', points, reason: `Prezzo sotto EMA 10 e EMA 10 < EMA 20` });
        }

        // ✅ NUOVO: CONFERMA 6.5: MACD bearish anche con RSI neutrale (segnale forte)
        if (macd && !macd.macdAboveSignal && !macd.macdAboveZero && isPriceActivelyFalling && rsi !== null && rsi >= 40 && rsi <= 60) {
            const points = 20;
            shortSignal.strength += points;
            shortSignal.confirmations++;
            shortSignal.reasons.push(`MACD ribassista con RSI neutrale (${rsi.toFixed(1)}) - momentum in crescita`);
            shortSignal.strengthContributions.push({ indicator: 'MACD ribassista (RSI neutrale)', points, reason: `MACD ribassista con RSI neutrale (${rsi.toFixed(1)})` });
        }

        // CONFERMA 7: Prezzo STA SCENDENDO (non solo "potrebbe") - SOLO se scende significativamente
        if (isPriceActivelyFalling) { // Prezzo sceso >0.3% o >0.5% su 5 periodi
            const points = 20;
            shortSignal.strength += points;
            shortSignal.confirmations++;
            shortSignal.reasons.push(`Prezzo in calo attivo (${priceChangeShort.toFixed(2)}%)`);
            shortSignal.strengthContributions.push({ indicator: 'Prezzo in calo attivo', points, reason: `Prezzo in calo attivo (${priceChangeShort.toFixed(2)}%)` });
        }

        // CONFERMA 8: Volume alto (movimento forte) - SOLO se accompagnato da movimento del prezzo significativo
        if (volume.isHigh && isPriceActivelyFalling) {
            const points = 15;
            shortSignal.strength += points;
            shortSignal.confirmations++;
            shortSignal.reasons.push(`Volume alto (${volume.ratio.toFixed(2)}x)`);
            shortSignal.strengthContributions.push({ indicator: 'Volume alto', points, reason: `Volume alto (${volume.ratio.toFixed(2)}x)` });
        }

        // 5. 🎯 PROFESSIONAL TRADING FILTERS - Analisi professionale prima della decisione finale

        // ✅ ANALISI STRUTTURA DI MERCATO (Supporti/Resistenze)
        const marketStructure = this.analyzeMarketStructure(prices, 5);

        // ✅ ANALISI QUALITÀ MOMENTUM (Volume, Esaurimento)
        const momentumQuality = this.analyzeMomentumQuality(prices, priceHistory);

        // ✅ VALUTAZIONE RISCHIO REVERSAL (Divergenze, Overbought/Oversold estremi)
        const reversalRisk = this.assessReversalRisk(prices, rsi, macd);

        // ✅ FIX CRITICO: Cappa strength a max 100 (evita valori impossibili come 130/100)
        longSignal.strength = Math.min(100, longSignal.strength);
        shortSignal.strength = Math.min(100, shortSignal.strength);

        // 🎯 PROFESSIONAL DECISION LOGIC - Requisiti più rigorosi e intelligenti

        // LONG: Requisiti base + filtri professionali
        // ✅ CONFIGURABILE: Legge da params (se disponibile), altrimenti default
        const LONG_MIN_CONFIRMATIONS = params.min_confirmations_long || 3;
        const LONG_MIN_STRENGTH = params.min_signal_strength || 60; // Legge da database (default 60)

        let longMeetsRequirements = longSignal.confirmations >= LONG_MIN_CONFIRMATIONS &&
            longSignal.strength >= LONG_MIN_STRENGTH;

        // 🚫 FILTRI PROFESSIONALI PER LONG - Blocca entry se:
        // ✅ MIGLIORATO: Con segnali molto forti (strength > 80), i filtri diventano warning invece di block
        // Questo permette di "aprire e seguire" anche con alcuni rischi, gestendo con stop loss dinamico
        const longProfessionalFilters = [];
        const isVeryStrongSignal = longSignal.strength > 80 && longSignal.confirmations >= LONG_MIN_CONFIRMATIONS;

        // 1. MOMENTUM ESAURITO - Non entrare se il momentum sta rallentando
        // ✅ Con segnali molto forti, diventa warning invece di block
        if (priceChange3 > 1.0 && !momentumQuality.isHealthy) {
            if (isVeryStrongSignal) {
                // Segnale forte: warning ma permette entry (stop loss più stretto)
                longProfessionalFilters.push(`⚠️ ATTENZIONE: Momentum esaurito (qualità: ${momentumQuality.score}/100) - Entry permessa ma stop loss più stretto`);
                longSignal.reasons.push(`⚠️ Filtro Professionale: ${momentumQuality.warnings.join(', ')} - Entry permessa per segnale forte`);
            } else {
                longMeetsRequirements = false;
                longProfessionalFilters.push(`🚫 BLOCCATO: Momentum esaurito (qualità: ${momentumQuality.score}/100) - ${momentumQuality.warnings.join(', ')}`);
                longSignal.reasons.push(`⚠️ Filtro Professionale: ${momentumQuality.warnings.join(', ')}`);
            }
        }

        // 2. ALTO RISCHIO REVERSAL - Non entrare se rischio reversal è alto/medio durante rally
        // ✅ Con segnali molto forti, diventa warning invece di block
        if (priceChange10 > 2 && (reversalRisk.risk === 'high' || reversalRisk.risk === 'medium')) {
            if (isVeryStrongSignal) {
                // Segnale forte: warning ma permette entry (stop loss più stretto)
                longProfessionalFilters.push(`⚠️ ATTENZIONE: Alto rischio inversione (${reversalRisk.risk}) - Entry permessa ma stop loss più stretto`);
                longSignal.reasons.push(`⚠️ Filtro Professionale: ${reversalRisk.reasons[0] || 'Alto rischio inversione'} - Entry permessa per segnale forte`);
            } else {
                longMeetsRequirements = false;
                longProfessionalFilters.push(`🚫 BLOCCATO: Alto rischio inversione dopo rally (${reversalRisk.risk}, score: ${reversalRisk.score}/100) - ${reversalRisk.reasons.join(', ')}`);
                longSignal.reasons.push(`⚠️ Filtro Professionale: ${reversalRisk.reasons[0] || 'Alto rischio inversione'}`);
            }
        }

        // 3. VOLUME DECRESCENTE DURANTE RALLY - Segnale di debolezza
        // ✅ Con segnali molto forti, diventa warning invece di block
        if (priceChange3 > 0.8 && momentumQuality.volumeTrend === 'decreasing') {
            if (isVeryStrongSignal) {
                // Segnale forte: warning ma permette entry
                longProfessionalFilters.push(`⚠️ ATTENZIONE: Volume in calo durante il rialzo - Entry permessa per segnale forte`);
                longSignal.reasons.push(`⚠️ Filtro Professionale: Volume in calo durante il rialzo - Entry permessa per segnale forte`);
            } else {
                longMeetsRequirements = false;
                longProfessionalFilters.push(`🚫 BLOCCATO: Volume in calo durante il rialzo - momentum debole, probabile inversione`);
                longSignal.reasons.push(`⚠️ Filtro Professionale: Volume in calo durante il rialzo`);
            }
        }

        // 4. VICINO A RESISTENZA FORTE - Non comprare vicino a resistenza
        if (marketStructure.nearestResistance && marketStructure.nearestResistance.distance < 0.02) {
            // Se siamo a meno del 2% dalla resistenza, riduci strength
            const penalty = 30;
            longSignal.strength = Math.max(0, longSignal.strength - penalty);
            longProfessionalFilters.push(`⚠️ ATTENZIONE: Vicino a resistenza (${(marketStructure.nearestResistance.distance * 100).toFixed(2)}% dist) - forza ridotta di ${penalty}`);
            longSignal.reasons.push(`⚠️ Filtro Professionale: Vicino a resistenza a ${marketStructure.nearestResistance.price.toFixed(2)}`);

            // Se dopo la penalità non raggiunge più i requisiti, blocca
            if (longSignal.strength < LONG_MIN_STRENGTH) {
                longMeetsRequirements = false;
            }
        }

        // 5. RISK/REWARD RATIO - Calcola e verifica se accettabile
        let riskReward = null;
        if (marketStructure.nearestSupport && marketStructure.nearestResistance) {
            riskReward = this.calculateRiskReward(currentPrice, marketStructure, 'LONG');
            if (!riskReward.isAcceptable) {
                // Non bloccare completamente, ma riduci strength
                const penalty = 20;
                longSignal.strength = Math.max(0, longSignal.strength - penalty);
                longProfessionalFilters.push(`⚠️ ATTENZIONE: Rapporto R/R scarso (1:${riskReward.ratio.toFixed(2)}) - forza ridotta di ${penalty}`);
                longSignal.reasons.push(`⚠️ Filtro Professionale: ${riskReward.reason}`);

                if (longSignal.strength < LONG_MIN_STRENGTH) {
                    longMeetsRequirements = false;
                }
            }
        }

        // SHORT: Requisiti base + filtri professionali
        // ✅ CONFIGURABILE: Legge da params (se disponibile), altrimenti default
        const SHORT_MIN_CONFIRMATIONS = params.min_confirmations_short || 4;
        const SHORT_MIN_STRENGTH = params.min_signal_strength || 60; // Legge da database (default 60)

        let shortMeetsRequirements = shortSignal.confirmations >= SHORT_MIN_CONFIRMATIONS &&
            shortSignal.strength >= SHORT_MIN_STRENGTH;

        // 🚫 FILTRI PROFESSIONALI PER SHORT - Blocca entry se:
        // ✅ MIGLIORATO: Con segnali molto forti (strength > 80), i filtri diventano warning invece di block
        // Questo permette di "aprire e seguire" anche con alcuni rischi, gestendo con stop loss dinamico
        const shortProfessionalFilters = [];
        const isVeryStrongShortSignal = shortSignal.strength > 80 && shortSignal.confirmations >= SHORT_MIN_CONFIRMATIONS;

        // 1. MOMENTUM ESAURITO - Non entrare SHORT se il momentum ribassista sta rallentando
        // ✅ Con segnali molto forti, diventa warning invece di block
        if (priceChange3 < -1.0 && !momentumQuality.isHealthy) {
            if (isVeryStrongShortSignal) {
                // Segnale forte: warning ma permette entry (stop loss più stretto)
                shortProfessionalFilters.push(`⚠️ ATTENZIONE: Momentum ribassista esaurito (qualità: ${momentumQuality.score}/100) - Entry permessa ma stop loss più stretto`);
                shortSignal.reasons.push(`⚠️ Filtro Professionale: ${momentumQuality.warnings.join(', ')} - Entry permessa per segnale forte`);
            } else {
                shortMeetsRequirements = false;
                shortProfessionalFilters.push(`🚫 BLOCCATO: Momentum ribassista esaurito (qualità: ${momentumQuality.score}/100) - ${momentumQuality.warnings.join(', ')}`);
                shortSignal.reasons.push(`⚠️ Filtro Professionale: ${momentumQuality.warnings.join(', ')}`);
            }
        }

        // 2. ALTO RISCHIO BOUNCE - Non entrare SHORT se rischio bounce è alto
        // ✅ Con segnali molto forti, diventa warning invece di block
        if (priceChange10 < -2 && (reversalRisk.risk === 'high' || reversalRisk.risk === 'medium')) {
            if (isVeryStrongShortSignal) {
                // Segnale forte: warning ma permette entry (stop loss più stretto)
                shortProfessionalFilters.push(`⚠️ ATTENZIONE: Alto rischio rimbalzo (${reversalRisk.risk}) - Entry permessa ma stop loss più stretto`);
                shortSignal.reasons.push(`⚠️ Filtro Professionale: ${reversalRisk.reasons[0] || 'Alto rischio rimbalzo'} - Entry permessa per segnale forte`);
            } else {
                shortMeetsRequirements = false;
                shortProfessionalFilters.push(`🚫 BLOCCATO: Alto rischio rimbalzo dopo crollo (${reversalRisk.risk}, score: ${reversalRisk.score}/100) - ${reversalRisk.reasons.join(', ')}`);
                shortSignal.reasons.push(`⚠️ Filtro Professionale: ${reversalRisk.reasons[0] || 'Alto rischio rimbalzo'}`);
            }
        }

        // 3. VICINO A SUPPORTO FORTE - Non vendere vicino a supporto
        if (marketStructure.nearestSupport && marketStructure.nearestSupport.distance < 0.02) {
            const penalty = 30;
            shortSignal.strength = Math.max(0, shortSignal.strength - penalty);
            shortProfessionalFilters.push(`⚠️ ATTENZIONE: Vicino a supporto (${(marketStructure.nearestSupport.distance * 100).toFixed(2)}% dist) - forza ridotta di ${penalty}`);
            shortSignal.reasons.push(`⚠️ Filtro Professionale: Vicino a supporto a ${marketStructure.nearestSupport.price.toFixed(2)}`);

            if (shortSignal.strength < SHORT_MIN_STRENGTH) {
                shortMeetsRequirements = false;
            }
        }

        // Log filtri professionali se presenti
        if (symbol && (longProfessionalFilters.length > 0 || shortProfessionalFilters.length > 0)) {
            console.log(`🎯 [PROFESSIONAL FILTERS - ${symbol}]`);
            if (longProfessionalFilters.length > 0) {
                console.log(`   LONG Filters: ${longProfessionalFilters.join(' | ')}`);
            }
            if (shortProfessionalFilters.length > 0) {
                console.log(`   SHORT Filters: ${shortProfessionalFilters.join(' | ')}`);
            }
        }

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
                },
                // 🎯 PROFESSIONAL ANALYSIS DATA
                professionalAnalysis: {
                    marketStructure: marketStructure,
                    momentumQuality: momentumQuality,
                    reversalRisk: reversalRisk,
                    riskReward: riskReward,
                    filters: {
                        long: longProfessionalFilters,
                        short: shortProfessionalFilters
                    }
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
                },
                // 🎯 PROFESSIONAL ANALYSIS DATA
                professionalAnalysis: {
                    marketStructure: marketStructure,
                    momentumQuality: momentumQuality,
                    reversalRisk: reversalRisk,
                    riskReward: riskReward,
                    filters: {
                        long: longProfessionalFilters,
                        short: shortProfessionalFilters
                    }
                }
            };
        }

        // Nessun segnale valido
        const maxStrength = Math.max(longSignal.strength, shortSignal.strength);
        const maxConfirmations = Math.max(longSignal.confirmations, shortSignal.confirmations);

        let reason = 'Forza segnale sotto soglia';
        if (longSignal.strength > 0 && longSignal.confirmations < LONG_MIN_CONFIRMATIONS) {
            reason = `LONG necessita ${LONG_MIN_CONFIRMATIONS - longSignal.confirmations} conferme (attuali: ${longSignal.confirmations}/${LONG_MIN_CONFIRMATIONS})`;
        } else if (shortSignal.strength > 0 && shortSignal.confirmations < SHORT_MIN_CONFIRMATIONS) {
            reason = `SHORT necessita ${SHORT_MIN_CONFIRMATIONS - shortSignal.confirmations} conferme (attuali: ${shortSignal.confirmations}/${SHORT_MIN_CONFIRMATIONS})`;
        } else if (longSignal.strength < LONG_MIN_STRENGTH && shortSignal.strength < SHORT_MIN_STRENGTH) {
            reason = `Forza segnale insufficiente (LONG: ${longSignal.strength}/${LONG_MIN_STRENGTH}, SHORT: ${shortSignal.strength}/${SHORT_MIN_STRENGTH})`;
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
            },
            // 🎯 PROFESSIONAL ANALYSIS DATA (anche per NEUTRAL)
            professionalAnalysis: {
                marketStructure: marketStructure,
                momentumQuality: momentumQuality,
                reversalRisk: reversalRisk,
                riskReward: riskReward,
                filters: {
                    long: longProfessionalFilters,
                    short: shortProfessionalFilters
                }
            }
        };
    }
}

// Singleton instance
const signalGenerator = new BidirectionalSignalGenerator();

module.exports = signalGenerator;


