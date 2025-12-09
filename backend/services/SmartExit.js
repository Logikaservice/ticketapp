/**
 * SMART EXIT SYSTEM - ADVANCED REASONING
 * Monitors open positions and makes intelligent decisions about when to close
 * 
 * LOGICA DI RAGIONAMENTO:
 * 1. Valuta trend del mercato (statico, lento, volatile)
 * 2. Considera guadagno attuale vs potenziale ulteriore guadagno
 * 3. Valuta rischio di perdere il guadagno attuale
 * 4. Considera opportunity cost (simboli più vantaggiosi)
 * 5. Chiude se guadagno "sufficiente" in mercato statico senza ripresa
 */

const db = require('../crypto_db');
const signalGenerator = require('../services/BidirectionalSignalGenerator');

// Promise-based database helpers
const dbAll = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
};

const dbRun = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(query, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

const dbGet = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) reject(err);
            else resolve(row || null);
        });
    });
};

/**
 * Smart Exit Configuration
 */
const SMART_EXIT_CONFIG = {
    ENABLED: true,
    CHECK_INTERVAL_MS: 10000, // Check every 10 seconds
    MIN_OPPOSITE_STRENGTH: 60, // Close if opposite signal strength >= 60
    MIN_PROFIT_TO_PROTECT: 0.5, // Only activate if position has at least 0.5% profit

    // ✅ FIX CRITICO: Grace Period - MAI chiudere posizioni appena aperte
    MIN_GRACE_PERIOD_MS: 60000, // ✅ NUOVO: 60 secondi minimi prima di poter chiudere (evita chiusure < 1 secondo)
    MIN_GRACE_PERIOD_FOR_LOSS_MS: 300000, // ✅ NUOVO: 5 minuti minimi se P&L è negativo (evita perdite immediate)

    // ✅ FIX: Soglie meno aggressive per evitare chiusure premature
    // Nuove configurazioni per ragionamento avanzato
    STATIC_MARKET_ATR_THRESHOLD: 0.3, // ATR < 0.3% = mercato statico
    SLOW_MARKET_ATR_THRESHOLD: 0.5, // ATR 0.3-0.5% = mercato lento
    SUFFICIENT_PROFIT_IN_STATIC: 2.0, // ✅ AUMENTATO: 2% minimo per chiudere in mercato statico (era 0.5% - troppo aggressivo)
    MIN_MOMENTUM_FOR_HOLD: 0.05, // ✅ RIDOTTO: Momentum minimo per tenere (0.05% invece di 0.1% - più permissivo)
    MAX_TIME_IN_STATIC_MARKET: 7200000, // ✅ AUMENTATO: 2 ore invece di 1 ora (più tempo prima di chiudere)
    OPPORTUNITY_COST_THRESHOLD: 2.0, // ✅ AUMENTATO: 2% di differenza invece di 1% (più conservativo)

    // ✅ NUOVO: Soglia minima assoluta - MAI chiudere sotto questa soglia
    MIN_ABSOLUTE_PROFIT_TO_CLOSE: 1.0, // MAI chiudere se guadagno < 1% (protezione contro chiusure premature)

    // ✅ NUOVO: Soglia per mercato lento - più conservativa
    MIN_PROFIT_FOR_SLOW_MARKET: 1.5, // Minimo 1.5% per chiudere in mercato lento

    // ✅ PRIORITÀ 1: Trailing Profit Protection
    TRAILING_PROFIT_ENABLED: true,
    TRAILING_PROFIT_LEVELS: [
        { peakProfit: 3.0, lockPercent: 0.60 },  // Se sale a 3%, blocca almeno 1.8% (60%)
        { peakProfit: 5.0, lockPercent: 0.65 },  // Se sale a 5%, blocca almeno 3.25% (65%)
        { peakProfit: 7.0, lockPercent: 0.70 },   // Se sale a 7%, blocca almeno 4.9% (70%)
        { peakProfit: 10.0, lockPercent: 0.75 },  // Se sale a 10%, blocca almeno 7.5% (75%)
        { peakProfit: 15.0, lockPercent: 0.80 },  // Se sale a 15%, blocca almeno 12% (80%)
    ],

    // ✅ PRIORITÀ 2: Soglie Dinamiche Basate su ATR
    DYNAMIC_THRESHOLDS_ENABLED: true,
    ATR_MULTIPLIER: 2.0, // Soglia = ATR × 2.0
    MIN_DYNAMIC_THRESHOLD: 0.5, // Soglia minima anche se ATR è molto basso
    MAX_DYNAMIC_THRESHOLD: 5.0, // Soglia massima anche se ATR è molto alto

    // ✅ PRIORITÀ 3: Risk/Reward Ratio
    RISK_REWARD_ENABLED: true,
    MIN_RISK_REWARD_RATIO: 1.5, // Minimo R/R 1:1.5 per mantenere posizione
    CALCULATE_RR_FROM_ENTRY: true, // Calcola R/R dall'entry price

    // ✅ NUOVO PRIORITÀ 1: Volume Confirmation
    VOLUME_CONFIRMATION_ENABLED: true,
    VOLUME_LOW_THRESHOLD: 0.7, // Volume < 70% media = basso
    VOLUME_HIGH_THRESHOLD: 1.5, // Volume > 150% media = alto
    REQUIRE_VOLUME_FOR_REVERSAL: true, // Richiedi volume alto per reversal

    // ✅ NUOVO PRIORITÀ 2: Support/Resistance Levels
    SUPPORT_RESISTANCE_ENABLED: true,
    SR_LOOKBACK_PERIODS: 50, // Cerca S/R negli ultimi 50 periodi
    SR_TOUCH_DISTANCE_PCT: 0.5, // Considera "vicino" se entro 0.5% del livello
    PARTIAL_CLOSE_AT_RESISTANCE: true, // Chiudi parzialmente a resistenza

    // ✅ NUOVO PRIORITÀ 3: Divergence Detection
    DIVERGENCE_DETECTION_ENABLED: true,
    RSI_PERIOD: 14, // Periodo RSI
    DIVERGENCE_LOOKBACK: 20, // Cerca divergenze negli ultimi 20 periodi
    MIN_DIVERGENCE_STRENGTH: 0.3, // Divergenza deve essere almeno 30% significativa

    // ✅ NUOVO PRIORITÀ 4: Multi-Timeframe Exit
    MULTI_TIMEFRAME_EXIT_ENABLED: true,
    EXIT_TIMEFRAMES: ['15m', '1h', '4h'], // Timeframe per exit
    EXIT_TIMEFRAME_WEIGHTS: { '15m': 0.2, '1h': 0.3, '4h': 0.5 }, // Peso per timeframe
    REQUIRE_HIGHER_TF_CONFIRMATION: true, // Richiedi conferma timeframe più lungo

    // ✅ NUOVO PRIORITÀ 5: Portfolio Drawdown Protection
    PORTFOLIO_DRAWDOWN_ENABLED: true,
    MAX_PORTFOLIO_DRAWDOWN_PCT: 5.0, // Max drawdown totale 5%
    CLOSE_WORST_ON_DRAWDOWN: true, // Chiudi posizioni peggiori se drawdown alto
    WORST_POSITIONS_TO_CLOSE: 2, // Quante posizioni peggiori chiudere
};

/**
 * Calcola ATR (Average True Range) per valutare volatilità
 */
function calculateATR(klines, period = 14) {
    if (!klines || klines.length < period + 1) return null;

    const trs = [];
    for (let i = 1; i < klines.length; i++) {
        const high = parseFloat(klines[i].high || klines[i].high_price || 0);
        const low = parseFloat(klines[i].low || klines[i].low_price || 0);
        const prevClose = parseFloat(klines[i - 1].close || klines[i - 1].close_price || 0);

        if (high > 0 && low > 0 && prevClose > 0) {
            const tr = Math.max(
                high - low,
                Math.abs(high - prevClose),
                Math.abs(low - prevClose)
            );
            trs.push(tr);
        }
    }

    if (trs.length < period) return null;

    // Calcola ATR come media degli ultimi 'period' TR
    const recentTRs = trs.slice(-period);
    const atr = recentTRs.reduce((sum, tr) => sum + tr, 0) / period;
    return atr;
}

/**
 * Valuta momentum del prezzo (velocità di movimento)
 */
function calculateMomentum(priceHistory, periods = [5, 10, 20]) {
    if (!priceHistory || priceHistory.length < Math.max(...periods)) return null;

    const currentPrice = parseFloat(priceHistory[priceHistory.length - 1]?.close ||
        priceHistory[priceHistory.length - 1]?.price || 0);

    if (currentPrice === 0) return null;

    const momentums = periods.map(period => {
        if (priceHistory.length < period) return null;
        const pastPrice = parseFloat(priceHistory[priceHistory.length - period]?.close ||
            priceHistory[priceHistory.length - period]?.price || 0);
        if (pastPrice === 0) return null;
        return ((currentPrice - pastPrice) / pastPrice) * 100;
    });

    // Ritorna momentum medio
    const validMomentums = momentums.filter(m => m !== null);
    if (validMomentums.length === 0) return null;

    return validMomentums.reduce((sum, m) => sum + m, 0) / validMomentums.length;
}

/**
 * Valuta se il mercato è statico, lento o volatile
 */
function assessMarketCondition(klines, currentPrice) {
    if (!klines || klines.length < 20 || !currentPrice || currentPrice === 0) {
        return { condition: 'unknown', atr: null, atrPct: null };
    }

    const atr = calculateATR(klines, 14);
    if (!atr) return { condition: 'unknown', atr: null, atrPct: null };

    const atrPct = (atr / currentPrice) * 100;

    let condition;
    if (atrPct < SMART_EXIT_CONFIG.STATIC_MARKET_ATR_THRESHOLD) {
        condition = 'static'; // Mercato statico
    } else if (atrPct < SMART_EXIT_CONFIG.SLOW_MARKET_ATR_THRESHOLD) {
        condition = 'slow'; // Mercato lento
    } else {
        condition = 'volatile'; // Mercato volatile
    }

    return { condition, atr, atrPct };
}

/**
 * Valuta se ci sono opportunità migliori su altri simboli
 */
async function checkOpportunityCost(position) {
    try {
        // Cerca altri simboli con segnali migliori
        const allSymbols = await dbAll(
            "SELECT DISTINCT symbol FROM bot_settings WHERE is_active = 1 AND symbol != ?",
            [position.symbol]
        );

        if (allSymbols.length === 0) return { hasBetterOpportunity: false, bestSignal: null };

        let bestSignal = null;
        let bestStrength = 0;

        for (const symbolRow of allSymbols) {
            const symbol = symbolRow.symbol;
            try {
                const klines = await dbAll(
                    "SELECT * FROM klines WHERE symbol = ? AND interval = '15m' ORDER BY open_time DESC LIMIT 100",
                    [symbol]
                );

                if (klines.length < 20) continue;

                const priceHistory = klines.reverse().map(k => ({
                    price: k.close_price,
                    high: k.high_price,
                    low: k.low_price,
                    close: k.close_price,
                    timestamp: k.open_time
                }));

                const signal = signalGenerator.generateSignal(priceHistory, symbol);
                const relevantSignal = position.type === 'buy' ? signal.longSignal : signal.shortSignal;
                const strength = relevantSignal?.strength || 0;

                if (strength > bestStrength) {
                    bestStrength = strength;
                    bestSignal = { symbol, strength, direction: relevantSignal?.direction };
                }
            } catch (err) {
                // Skip questo simbolo se c'è errore
                continue;
            }
        }

        // Se c'è un segnale significativamente migliore (>1% di differenza), considera opportunity cost
        const currentPnLPct = parseFloat(position.profit_loss_pct) || 0;
        const hasBetterOpportunity = bestSignal &&
            bestSignal.strength > (currentPnLPct + SMART_EXIT_CONFIG.OPPORTUNITY_COST_THRESHOLD);

        return { hasBetterOpportunity, bestSignal };
    } catch (error) {
        console.error(`❌ Error checking opportunity cost:`, error.message);
        return { hasBetterOpportunity: false, bestSignal: null };
    }
}

/**
 * Calcola profitto massimo raggiunto (peak profit) dalla posizione
 */
function calculatePeakProfit(position, priceHistory) {
    if (!priceHistory || priceHistory.length === 0) {
        return parseFloat(position.profit_loss_pct) || 0;
    }

    const entryPrice = parseFloat(position.entry_price) || 0;
    const entryTime = new Date(position.opened_at || Date.now()).getTime();

    if (entryPrice === 0) return parseFloat(position.profit_loss_pct) || 0;

    let peakProfit = 0;
    const isLong = position.type === 'buy';

    // Cerca il prezzo massimo/minimo raggiunto dopo l'apertura
    priceHistory.forEach(candle => {
        const candleTime = new Date(candle.timestamp || 0).getTime();
        if (candleTime < entryTime) return; // Prima dell'apertura

        const high = parseFloat(candle.high || candle.high_price || candle.price || 0);
        const low = parseFloat(candle.low || candle.low_price || candle.price || 0);

        if (isLong && high > 0) {
            const profit = ((high - entryPrice) / entryPrice) * 100;
            if (profit > peakProfit) peakProfit = profit;
        } else if (!isLong && low > 0) {
            const profit = ((entryPrice - low) / entryPrice) * 100;
            if (profit > peakProfit) peakProfit = profit;
        }
    });

    // Usa anche highest_price dal database se disponibile
    if (position.highest_price) {
        const highestPrice = parseFloat(position.highest_price);
        if (isLong && highestPrice > entryPrice) {
            const profit = ((highestPrice - entryPrice) / entryPrice) * 100;
            if (profit > peakProfit) peakProfit = profit;
        }
    }

    // Se non trovato, usa profit_loss_pct attuale
    if (peakProfit === 0) {
        peakProfit = parseFloat(position.profit_loss_pct) || 0;
    }

    return Math.max(peakProfit, parseFloat(position.profit_loss_pct) || 0);
}

/**
 * Calcola soglia dinamica basata su ATR
 */
function calculateDynamicThreshold(atrPct) {
    if (!SMART_EXIT_CONFIG.DYNAMIC_THRESHOLDS_ENABLED || !atrPct) {
        return SMART_EXIT_CONFIG.MIN_ABSOLUTE_PROFIT_TO_CLOSE;
    }

    const dynamicThreshold = atrPct * SMART_EXIT_CONFIG.ATR_MULTIPLIER;

    // Limita tra min e max
    return Math.max(
        SMART_EXIT_CONFIG.MIN_DYNAMIC_THRESHOLD,
        Math.min(dynamicThreshold, SMART_EXIT_CONFIG.MAX_DYNAMIC_THRESHOLD)
    );
}

/**
 * Calcola Risk/Reward ratio attuale
 */
function calculateRiskRewardRatio(position, currentPnLPct, marketCondition) {
    if (!SMART_EXIT_CONFIG.RISK_REWARD_ENABLED) return null;

    const entryPrice = parseFloat(position.entry_price) || 0;
    const stopLoss = parseFloat(position.stop_loss) || 0;
    const currentPrice = parseFloat(position.current_price || position.entry_price) || 0;

    if (entryPrice === 0 || currentPrice === 0) return null;

    const isLong = position.type === 'buy';

    // Calcola rischio (distanza da entry a stop loss)
    let risk = 0;
    if (stopLoss > 0) {
        if (isLong) {
            risk = ((entryPrice - stopLoss) / entryPrice) * 100;
        } else {
            risk = ((stopLoss - entryPrice) / entryPrice) * 100;
        }
    } else {
        // Se non c'è stop loss, usa ATR come rischio stimato
        risk = marketCondition.atrPct || 1.0;
    }

    if (risk <= 0) return null;

    // Reward = profitto attuale
    const reward = Math.abs(currentPnLPct);

    // R/R ratio = reward / risk
    const rrRatio = reward / risk;

    return {
        ratio: rrRatio,
        risk: risk,
        reward: reward,
        isFavorable: rrRatio >= SMART_EXIT_CONFIG.MIN_RISK_REWARD_RATIO
    };
}

/**
 * ✅ NUOVO: Calcola RSI da price history
 */
function calculateRSI(priceHistory, period = 14) {
    if (!priceHistory || priceHistory.length < period + 1) return null;

    const prices = priceHistory.map(p => parseFloat(p.close || p.close_price || p.price || 0)).filter(p => p > 0);
    if (prices.length < period + 1) return null;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
        const change = prices[prices.length - i] - prices[prices.length - i - 1];
        if (change > 0) gains += change;
        else losses += Math.abs(change);
    }

    if (losses === 0) return 100;

    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

/**
 * ✅ NUOVO PRIORITÀ 1: Volume Confirmation
 * Verifica se volume conferma o nega un segnale di reversal
 */
function checkVolumeConfirmation(klines, isReversalSignal) {
    if (!SMART_EXIT_CONFIG.VOLUME_CONFIRMATION_ENABLED || !klines || klines.length < 20) {
        return { confirmed: true, reason: 'Volume confirmation disabled or insufficient data' };
    }

    // Calcola volume medio degli ultimi 20 periodi
    const volumes = klines.slice(-20).map(k => parseFloat(k.volume || 0)).filter(v => v > 0);
    if (volumes.length === 0) {
        return { confirmed: true, reason: 'No volume data available' };
    }

    const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
    const currentVolume = parseFloat(klines[klines.length - 1]?.volume || 0);
    const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1.0;

    // Se è un segnale di reversal, richiedi volume alto
    if (isReversalSignal && SMART_EXIT_CONFIG.REQUIRE_VOLUME_FOR_REVERSAL) {
        if (volumeRatio < SMART_EXIT_CONFIG.VOLUME_HIGH_THRESHOLD) {
            return {
                confirmed: false,
                reason: `Reversal signal non confermato da volume (${(volumeRatio * 100).toFixed(0)}% della media) - Potrebbe essere falso segnale`,
                volumeRatio: volumeRatio
            };
        }
    }

    // Se volume è molto basso, potrebbe essere consolidamento sano (non reversal)
    if (volumeRatio < SMART_EXIT_CONFIG.VOLUME_LOW_THRESHOLD) {
        return {
            confirmed: false,
            reason: `Volume basso (${(volumeRatio * 100).toFixed(0)}% della media) - Potrebbe essere consolidamento, non reversal`,
            volumeRatio: volumeRatio
        };
    }

    return {
        confirmed: true,
        reason: `Volume conferma (${(volumeRatio * 100).toFixed(0)}% della media)`,
        volumeRatio: volumeRatio
    };
}

/**
 * ✅ NUOVO PRIORITÀ 2: Calcola Support/Resistance Levels
 */
function calculateSupportResistance(klines, currentPrice) {
    if (!SMART_EXIT_CONFIG.SUPPORT_RESISTANCE_ENABLED || !klines || klines.length < SMART_EXIT_CONFIG.SR_LOOKBACK_PERIODS) {
        return { support: null, resistance: null, nearSupport: false, nearResistance: false };
    }

    const lookback = Math.min(SMART_EXIT_CONFIG.SR_LOOKBACK_PERIODS, klines.length);
    const recentKlines = klines.slice(-lookback);

    // Trova high e low più frequenti (livelli toccati più volte)
    const highs = recentKlines.map(k => parseFloat(k.high || k.high_price || 0)).filter(h => h > 0);
    const lows = recentKlines.map(k => parseFloat(k.low || k.low_price || 0)).filter(l => l > 0);

    if (highs.length === 0 || lows.length === 0) {
        return { support: null, resistance: null, nearSupport: false, nearResistance: false };
    }

    // Calcola resistenza (media degli high più alti)
    const sortedHighs = [...highs].sort((a, b) => b - a);
    const topHighs = sortedHighs.slice(0, Math.max(3, Math.floor(sortedHighs.length * 0.1)));
    const resistance = topHighs.reduce((sum, h) => sum + h, 0) / topHighs.length;

    // Calcola supporto (media dei low più bassi)
    const sortedLows = [...lows].sort((a, b) => a - b);
    const bottomLows = sortedLows.slice(0, Math.max(3, Math.floor(sortedLows.length * 0.1)));
    const support = bottomLows.reduce((sum, l) => sum + l, 0) / bottomLows.length;

    // Verifica se siamo vicini a support/resistance
    const distancePct = SMART_EXIT_CONFIG.SR_TOUCH_DISTANCE_PCT;
    const nearResistance = resistance > 0 && Math.abs((currentPrice - resistance) / resistance * 100) <= distancePct;
    const nearSupport = support > 0 && Math.abs((currentPrice - support) / support * 100) <= distancePct;

    return {
        support: support,
        resistance: resistance,
        nearSupport: nearSupport,
        nearResistance: nearResistance,
        distanceToSupport: support > 0 ? Math.abs((currentPrice - support) / support * 100) : null,
        distanceToResistance: resistance > 0 ? Math.abs((currentPrice - resistance) / resistance * 100) : null
    };
}

/**
 * ✅ NUOVO PRIORITÀ 3: Rileva Divergenze RSI
 */
function detectRSIDivergence(priceHistory, positionType) {
    if (!SMART_EXIT_CONFIG.DIVERGENCE_DETECTION_ENABLED || !priceHistory || priceHistory.length < SMART_EXIT_CONFIG.DIVERGENCE_LOOKBACK) {
        return { hasDivergence: false, type: null };
    }

    const lookback = Math.min(SMART_EXIT_CONFIG.DIVERGENCE_LOOKBACK, priceHistory.length);
    const recentHistory = priceHistory.slice(-lookback);

    // Calcola RSI per ogni punto
    const rsiValues = [];
    const prices = [];

    for (let i = SMART_EXIT_CONFIG.RSI_PERIOD; i < recentHistory.length; i++) {
        const window = recentHistory.slice(i - SMART_EXIT_CONFIG.RSI_PERIOD, i + 1);
        const rsi = calculateRSI(window, SMART_EXIT_CONFIG.RSI_PERIOD);
        if (rsi !== null) {
            rsiValues.push(rsi);
            prices.push(parseFloat(recentHistory[i].close || recentHistory[i].close_price || recentHistory[i].price || 0));
        }
    }

    if (rsiValues.length < 10 || prices.length < 10) {
        return { hasDivergence: false, type: null };
    }

    // Trova i punti più recenti e più vecchi per confronto
    const recentPrices = prices.slice(-5); // Ultimi 5 punti
    const recentRSI = rsiValues.slice(-5);
    const olderPrices = prices.slice(0, 5); // Primi 5 punti
    const olderRSI = rsiValues.slice(0, 5);

    const recentPriceHigh = Math.max(...recentPrices);
    const recentPriceLow = Math.min(...recentPrices);
    const olderPriceHigh = Math.max(...olderPrices);
    const olderPriceLow = Math.min(...olderPrices);

    const recentRSIHigh = Math.max(...recentRSI);
    const recentRSILow = Math.min(...recentRSI);
    const olderRSIHigh = Math.max(...olderRSI);
    const olderRSILow = Math.min(...olderRSI);

    // Divergenza bearish (per LONG): Prezzo sale ma RSI scende
    if (positionType === 'buy') {
        const priceRising = recentPriceHigh > olderPriceHigh;
        const rsiFalling = recentRSIHigh < olderRSIHigh;
        const divergenceStrength = priceRising && rsiFalling ?
            Math.abs((recentPriceHigh - olderPriceHigh) / olderPriceHigh) + Math.abs((olderRSIHigh - recentRSIHigh) / 100) : 0;

        if (divergenceStrength >= SMART_EXIT_CONFIG.MIN_DIVERGENCE_STRENGTH) {
            return {
                hasDivergence: true,
                type: 'bearish',
                strength: divergenceStrength,
                reason: `Divergenza bearish: Prezzo sale (+${((recentPriceHigh - olderPriceHigh) / olderPriceHigh * 100).toFixed(2)}%) ma RSI scende (${olderRSIHigh.toFixed(1)} → ${recentRSIHigh.toFixed(1)})`
            };
        }
    }

    // Divergenza bullish (per SHORT): Prezzo scende ma RSI sale
    if (positionType === 'sell') {
        const priceFalling = recentPriceLow < olderPriceLow;
        const rsiRising = recentRSILow > olderRSILow;
        const divergenceStrength = priceFalling && rsiRising ?
            Math.abs((olderPriceLow - recentPriceLow) / olderPriceLow) + Math.abs((recentRSILow - olderRSILow) / 100) : 0;

        if (divergenceStrength >= SMART_EXIT_CONFIG.MIN_DIVERGENCE_STRENGTH) {
            return {
                hasDivergence: true,
                type: 'bullish',
                strength: divergenceStrength,
                reason: `Divergenza bullish: Prezzo scende (-${((olderPriceLow - recentPriceLow) / olderPriceLow * 100).toFixed(2)}%) ma RSI sale (${olderRSILow.toFixed(1)} → ${recentRSILow.toFixed(1)})`
            };
        }
    }

    return { hasDivergence: false, type: null };
}

/**
 * ✅ NUOVO PRIORITÀ 4: Multi-Timeframe Exit Signal
 */
async function getMultiTimeframeExitSignal(symbol, positionType) {
    if (!SMART_EXIT_CONFIG.MULTI_TIMEFRAME_EXIT_ENABLED) {
        return { shouldExit: false, reason: 'Multi-timeframe exit disabled' };
    }

    const signalGenerator = require('../services/BidirectionalSignalGenerator');

    const exitSignals = {};
    let totalWeight = 0;
    let weightedScore = 0;

    for (const tf of SMART_EXIT_CONFIG.EXIT_TIMEFRAMES) {
        try {
            // Carica klines per questo timeframe
            const klines = await dbAll(
                "SELECT * FROM klines WHERE symbol = ? AND interval = ? ORDER BY open_time DESC LIMIT 50",
                [symbol, tf]
            );

            if (klines.length < 20) {
                continue; // Skip se dati insufficienti
            }

            const priceHistory = klines.reverse().map(k => ({
                open: k.open_price,
                high: k.high_price,
                low: k.low_price,
                close: k.close_price,
                timestamp: k.open_time
            }));

            // Genera segnale per questo timeframe
            const signal = signalGenerator.generateSignal(priceHistory, symbol);
            const relevantSignal = positionType === 'buy' ? signal.longSignal : signal.shortSignal;
            const oppositeSignal = positionType === 'buy' ? signal.shortSignal : signal.longSignal;

            // Score: positivo se trend valido, negativo se opposto
            const score = (relevantSignal?.strength || 0) - (oppositeSignal?.strength || 0);
            const weight = SMART_EXIT_CONFIG.EXIT_TIMEFRAME_WEIGHTS[tf] || 0.2;

            exitSignals[tf] = {
                score: score,
                strength: relevantSignal?.strength || 0,
                oppositeStrength: oppositeSignal?.strength || 0
            };

            weightedScore += score * weight;
            totalWeight += weight;
        } catch (err) {
            console.error(`⚠️ Error getting exit signal for ${symbol} ${tf}:`, err.message);
        }
    }

    if (totalWeight === 0) {
        return { shouldExit: false, reason: 'Insufficient data for multi-timeframe analysis' };
    }

    const finalScore = weightedScore / totalWeight;

    // Se 4h dice "tieni" (score positivo), non chiudere anche se 15m dice "esci"
    if (SMART_EXIT_CONFIG.REQUIRE_HIGHER_TF_CONFIRMATION && exitSignals['4h']) {
        if (exitSignals['4h'].score > 20) {
            return {
                shouldExit: false,
                reason: `4h timeframe dice "tieni" (score: ${exitSignals['4h'].score.toFixed(1)}) - Mantenere nonostante segnali timeframe più corti`,
                signals: exitSignals,
                finalScore: finalScore
            };
        }
    }

    // Se score finale è negativo (trend opposto), considera exit
    if (finalScore < -30) {
        return {
            shouldExit: true,
            reason: `Multi-timeframe exit: Score negativo (${finalScore.toFixed(1)}) - Trend opposto su multiple timeframe`,
            signals: exitSignals,
            finalScore: finalScore
        };
    }

    return {
        shouldExit: false,
        reason: `Multi-timeframe score: ${finalScore.toFixed(1)} - Trend ancora valido`,
        signals: exitSignals,
        finalScore: finalScore
    };
}

/**
 * ✅ NUOVO PRIORITÀ 5: Portfolio Drawdown Protection
 */
async function checkPortfolioDrawdown() {
    if (!SMART_EXIT_CONFIG.PORTFOLIO_DRAWDOWN_ENABLED) {
        return { shouldCloseWorst: false, worstPositions: [] };
    }

    try {
        const openPositions = await dbAll("SELECT * FROM open_positions WHERE status = 'open'");
        if (openPositions.length === 0) {
            return { shouldCloseWorst: false, worstPositions: [] };
        }

        // Calcola drawdown totale (somma P&L negativo)
        const totalPnL = openPositions.reduce((sum, pos) => {
            const pnl = parseFloat(pos.profit_loss) || 0;
            return sum + (pnl < 0 ? pnl : 0); // Solo perdite
        }, 0);

        // Calcola valore totale investito
        const totalInvested = openPositions.reduce((sum, pos) => {
            const volume = parseFloat(pos.volume) || 0;
            const volumeClosed = parseFloat(pos.volume_closed) || 0;
            const entryPrice = parseFloat(pos.entry_price) || 0;
            const remainingVolume = volume - volumeClosed;
            return sum + (remainingVolume * entryPrice);
        }, 0);

        const drawdownPct = totalInvested > 0 ? Math.abs(totalPnL / totalInvested * 100) : 0;

        if (drawdownPct > SMART_EXIT_CONFIG.MAX_PORTFOLIO_DRAWDOWN_PCT) {
            // Ordina posizioni per P&L (peggiori prima)
            const sortedPositions = [...openPositions].sort((a, b) => {
                const pnlA = parseFloat(a.profit_loss_pct) || 0;
                const pnlB = parseFloat(b.profit_loss_pct) || 0;
                return pnlA - pnlB; // Ordine crescente (più negative prima)
            });

            const worstPositions = sortedPositions.slice(0, SMART_EXIT_CONFIG.WORST_POSITIONS_TO_CLOSE);

            return {
                shouldCloseWorst: true,
                worstPositions: worstPositions,
                drawdownPct: drawdownPct,
                reason: `Portfolio drawdown ${drawdownPct.toFixed(2)}% > max ${SMART_EXIT_CONFIG.MAX_PORTFOLIO_DRAWDOWN_PCT}% - Chiudere ${worstPositions.length} posizioni peggiori`
            };
        }

        return {
            shouldCloseWorst: false,
            worstPositions: [],
            drawdownPct: drawdownPct
        };
    } catch (err) {
        console.error('⚠️ Error checking portfolio drawdown:', err.message);
        return { shouldCloseWorst: false, worstPositions: [] };
    }
}

/**
 * Calcola trailing profit protection - blocca percentuale del profitto massimo
 */
function calculateTrailingProfitProtection(currentPnLPct, peakProfit) {
    if (!SMART_EXIT_CONFIG.TRAILING_PROFIT_ENABLED || peakProfit <= 0) {
        return null;
    }

    // Trova il livello di trailing profit applicabile
    let applicableLevel = null;
    for (let i = SMART_EXIT_CONFIG.TRAILING_PROFIT_LEVELS.length - 1; i >= 0; i--) {
        const level = SMART_EXIT_CONFIG.TRAILING_PROFIT_LEVELS[i];
        if (peakProfit >= level.peakProfit) {
            applicableLevel = level;
            break;
        }
    }

    if (!applicableLevel) return null;

    // Calcola profitto minimo da bloccare
    const lockedProfit = peakProfit * applicableLevel.lockPercent;

    // Se il profitto attuale è sceso sotto il profitto bloccato, chiudi
    if (currentPnLPct < lockedProfit) {
        return {
            shouldLock: true,
            peakProfit: peakProfit,
            lockedProfit: lockedProfit,
            currentPnL: currentPnLPct,
            lockPercent: applicableLevel.lockPercent
        };
    }

    return {
        shouldLock: false,
        peakProfit: peakProfit,
        lockedProfit: lockedProfit,
        currentPnL: currentPnLPct
    };
}

/**
 * Check if a position should be closed - ADVANCED REASONING + PROFESSIONAL FEATURES
 * @param {Object} position - Open position
 * @param {Array} priceHistory - Price history for signal analysis
 * @returns {Object} { shouldClose, reason, details }
 */
async function shouldClosePosition(position, priceHistory) {
    try {
        const currentPnLPct = parseFloat(position.profit_loss_pct) || 0;
        const currentPrice = parseFloat(position.current_price || position.entry_price) || 0;
        const entryPrice = parseFloat(position.entry_price) || 0;
        const entryTime = new Date(position.opened_at || Date.now());
        const timeInPosition = Date.now() - entryTime.getTime();

        // ✅ FIX CRITICO: Grace Period - MAI chiudere posizioni appena aperte
        // Questo evita chiusure immediate (< 1 secondo) che causano perdite assurde
        if (timeInPosition < SMART_EXIT_CONFIG.MIN_GRACE_PERIOD_MS) {
            const secondsOpen = Math.floor(timeInPosition / 1000);
            return {
                shouldClose: false,
                reason: `Grace period attivo: Posizione aperta da ${secondsOpen} secondi (minimo ${SMART_EXIT_CONFIG.MIN_GRACE_PERIOD_MS / 1000}s richiesti) - Protezione contro chiusure premature`,
                currentPnL: currentPnLPct,
                timeInPosition: timeInPosition,
                decisionFactor: 'grace_period'
            };
        }

        // ✅ FIX CRITICO: Grace Period esteso per posizioni in perdita
        // Se la posizione è in perdita, aspetta più tempo prima di chiudere (evita perdite immediate)
        if (currentPnLPct < 0 && timeInPosition < SMART_EXIT_CONFIG.MIN_GRACE_PERIOD_FOR_LOSS_MS) {
            const minutesOpen = Math.floor(timeInPosition / 60000);
            const requiredMinutes = Math.floor(SMART_EXIT_CONFIG.MIN_GRACE_PERIOD_FOR_LOSS_MS / 60000);
            return {
                shouldClose: false,
                reason: `Grace period esteso per perdita: Posizione in perdita (${currentPnLPct.toFixed(2)}%) aperta da ${minutesOpen} minuti (minimo ${requiredMinutes} minuti richiesti) - Protezione contro perdite immediate`,
                currentPnL: currentPnLPct,
                timeInPosition: timeInPosition,
                decisionFactor: 'grace_period_loss'
            };
        }

        // ✅ PRIORITÀ 1: Trailing Profit Protection - CRITICO
        const peakProfit = calculatePeakProfit(position, priceHistory);
        const trailingProfit = calculateTrailingProfitProtection(currentPnLPct, peakProfit);

        if (trailingProfit && trailingProfit.shouldLock) {
            return {
                shouldClose: true,
                reason: `Trailing Profit Protection: Profitto sceso da ${peakProfit.toFixed(2)}% a ${currentPnLPct.toFixed(2)}% (sotto soglia bloccata ${trailingProfit.lockedProfit.toFixed(2)}%) - Chiusura per bloccare ${(trailingProfit.lockPercent * 100).toFixed(0)}% del profitto massimo`,
                currentPnL: currentPnLPct,
                peakProfit: peakProfit,
                lockedProfit: trailingProfit.lockedProfit,
                decisionFactor: 'trailing_profit_protection'
            };
        }

        // ✅ NUOVO PRIORITÀ 3: Divergence Detection - Rileva reversal PRIMA che accada
        const divergence = detectRSIDivergence(priceHistory, position.type);
        if (divergence.hasDivergence) {
            // Divergenza bearish per LONG o bullish per SHORT = esci
            if ((position.type === 'buy' && divergence.type === 'bearish') ||
                (position.type === 'sell' && divergence.type === 'bullish')) {
                return {
                    shouldClose: true,
                    reason: `Divergenza ${divergence.type}: ${divergence.reason} - Chiusura preventiva prima del reversal`,
                    currentPnL: currentPnLPct,
                    divergence: divergence,
                    decisionFactor: 'rsi_divergence'
                };
            }
        }

        // 1. Genera segnale per condizioni di mercato attuali
        const signal = signalGenerator.generateSignal(priceHistory, position.symbol);

        const isLongPosition = position.type === 'buy';
        const isShortPosition = position.type === 'sell';

        // 2. Controlla segnale opposto (logica originale)
        const oppositeSignal = isLongPosition ? signal.shortSignal : signal.longSignal;
        const oppositeStrength = oppositeSignal?.strength || 0;

        // ✅ NUOVO PRIORITÀ 1: Volume Confirmation per segnale opposto
        let volumeConfirmation = { confirmed: true };
        if (oppositeStrength >= SMART_EXIT_CONFIG.MIN_OPPOSITE_STRENGTH) {
            // Carica klines per volume analysis
            const klines = await dbAll(
                "SELECT * FROM klines WHERE symbol = ? AND interval = '15m' ORDER BY open_time DESC LIMIT 30",
                [position.symbol]
            );

            if (klines.length >= 20) {
                volumeConfirmation = checkVolumeConfirmation(klines.reverse(), true); // true = reversal signal

                // Se volume NON conferma, non chiudere (potrebbe essere falso segnale)
                if (!volumeConfirmation.confirmed) {
                    return {
                        shouldClose: false,
                        reason: `Segnale opposto forte (${oppositeStrength}/100) ma ${volumeConfirmation.reason} - Mantenere posizione`,
                        oppositeStrength: oppositeStrength,
                        volumeConfirmation: volumeConfirmation,
                        currentPnL: currentPnLPct,
                        decisionFactor: 'opposite_signal_no_volume'
                    };
                }
            }
        }

        if (oppositeStrength >= SMART_EXIT_CONFIG.MIN_OPPOSITE_STRENGTH && currentPnLPct >= SMART_EXIT_CONFIG.MIN_PROFIT_TO_PROTECT && volumeConfirmation.confirmed) {
            return {
                shouldClose: true,
                reason: `Segnale opposto forte (${oppositeStrength}/100) confermato da volume (${volumeConfirmation.volumeRatio ? (volumeConfirmation.volumeRatio * 100).toFixed(0) + '%' : 'N/A'}) - Chiusura per proteggere profitto`,
                oppositeStrength: oppositeStrength,
                volumeConfirmation: volumeConfirmation,
                currentPnL: currentPnLPct,
                decisionFactor: 'opposite_signal_volume_confirmed'
            };
        }

        // 3. Valuta condizione del mercato (statico, lento, volatile)
        const klines = priceHistory.map(p => ({
            high: p.high || p.price,
            low: p.low || p.price,
            close: p.close || p.price,
            high_price: p.high || p.price,
            low_price: p.low || p.price,
            close_price: p.close || p.price,
            volume: p.volume || 0
        }));

        // ✅ Carica klines complete dal DB per volume e support/resistance
        const dbKlines = await dbAll(
            "SELECT * FROM klines WHERE symbol = ? AND interval = '15m' ORDER BY open_time DESC LIMIT 50",
            [position.symbol]
        );
        const fullKlines = dbKlines.reverse().map(k => ({
            high: k.high_price,
            low: k.low_price,
            close: k.close_price,
            volume: k.volume || 0,
            high_price: k.high_price,
            low_price: k.low_price,
            close_price: k.close_price
        }));

        const marketCondition = assessMarketCondition(klines, currentPrice);
        const momentum = calculateMomentum(priceHistory, [5, 10, 20]);

        // ✅ NUOVO PRIORITÀ 2: Support/Resistance Levels
        const supportResistance = calculateSupportResistance(fullKlines, currentPrice);

        // ✅ Se siamo vicini a resistenza e in profitto, considera partial close
        if (supportResistance.nearResistance && currentPnLPct > 2.0 && SMART_EXIT_CONFIG.PARTIAL_CLOSE_AT_RESISTANCE) {
            // Non chiudere completamente, ma suggerisci partial close (gestito da updatePositionsPnL)
            // Per ora, solo logga
            console.log(`📊 [S/R] ${position.symbol} vicino a resistenza (€${supportResistance.resistance.toFixed(2)}) con profitto ${currentPnLPct.toFixed(2)}% - Considera partial close`);
        }

        // ✅ NUOVO PRIORITÀ 4: Multi-Timeframe Exit
        const multiTFExit = await getMultiTimeframeExitSignal(position.symbol, position.type);
        if (multiTFExit.shouldExit && currentPnLPct >= SMART_EXIT_CONFIG.MIN_PROFIT_TO_PROTECT) {
            return {
                shouldClose: true,
                reason: `Multi-timeframe exit: ${multiTFExit.reason}`,
                currentPnL: currentPnLPct,
                multiTFExit: multiTFExit,
                decisionFactor: 'multi_timeframe_exit'
            };
        }

        // ✅ Se timeframe più lungo dice "tieni", non chiudere anche se altri fattori suggeriscono exit
        if (multiTFExit.finalScore > 20 && !multiTFExit.shouldExit) {
            // Override: timeframe più lungo ha priorità
            // Continua con altre valutazioni ma con peso minore
        }

        // ✅ PRIORITÀ 2: Soglia Dinamica Basata su ATR
        const dynamicThreshold = calculateDynamicThreshold(marketCondition.atrPct);
        const effectiveMinThreshold = Math.max(
            SMART_EXIT_CONFIG.MIN_ABSOLUTE_PROFIT_TO_CLOSE,
            dynamicThreshold
        );

        // ✅ FIX: Protezione contro chiusure premature - MAI chiudere sotto soglia minima (dinamica)
        if (currentPnLPct < effectiveMinThreshold) {
            return {
                shouldClose: false,
                reason: `Guadagno ${currentPnLPct.toFixed(2)}% < soglia dinamica ${effectiveMinThreshold.toFixed(2)}% (ATR: ${marketCondition.atrPct?.toFixed(2) || 'N/A'}%) - Mantenere posizione`,
                currentPnL: currentPnLPct,
                dynamicThreshold: effectiveMinThreshold,
                atrPct: marketCondition.atrPct,
                decisionFactor: 'below_dynamic_threshold'
            };
        }

        // ✅ PRIORITÀ 3: Risk/Reward Ratio Check
        const riskReward = calculateRiskRewardRatio(position, currentPnLPct, marketCondition);
        if (riskReward && riskReward.isFavorable) {
            // Se R/R è ancora favorevole, non chiudere (a meno che non ci siano altri motivi critici)
            const sameDirectionSignal = isLongPosition ? signal.longSignal : signal.shortSignal;
            const sameDirectionStrength = sameDirectionSignal?.strength || 0;

            // Solo chiudi se trend è molto debole (< 30) E segnale opposto forte
            if (sameDirectionStrength >= 30 && oppositeStrength < 70) {
                return {
                    shouldClose: false,
                    reason: `Risk/Reward favorevole (${riskReward.ratio.toFixed(2)}:1) e trend valido (${sameDirectionStrength}/100) - Mantenere posizione`,
                    currentPnL: currentPnLPct,
                    riskReward: riskReward,
                    decisionFactor: 'favorable_risk_reward'
                };
            }
        }

        // 4. RAGIONAMENTO: Mercato statico con guadagno sufficiente
        // ✅ USA SOGLIA DINAMICA invece di fissa
        const staticMarketThreshold = Math.max(
            SMART_EXIT_CONFIG.SUFFICIENT_PROFIT_IN_STATIC,
            dynamicThreshold
        );

        if (marketCondition.condition === 'static' && currentPnLPct >= staticMarketThreshold) {
            // ✅ FIX: Solo se guadagno è DAVVERO sufficiente (>= soglia dinamica) E non c'è momentum
            // Specialmente se non c'è momentum positivo
            if (!momentum || momentum < SMART_EXIT_CONFIG.MIN_MOMENTUM_FOR_HOLD) {
                // ✅ AGGIUNTO: Verifica anche che il trend non stia migliorando
                const sameDirectionSignal = isLongPosition ? signal.longSignal : signal.shortSignal;
                const sameDirectionStrength = sameDirectionSignal?.strength || 0;

                // ✅ Solo chiudi se il trend nella stessa direzione è debole (< 40)
                // ✅ E se R/R non è ancora favorevole
                const shouldCloseStatic = sameDirectionStrength < 40 &&
                    (!riskReward || !riskReward.isFavorable || riskReward.ratio < 1.5);

                if (shouldCloseStatic) {
                    return {
                        shouldClose: true,
                        reason: `Mercato statico (ATR: ${marketCondition.atrPct.toFixed(2)}%) con guadagno ${currentPnLPct.toFixed(2)}% (soglia dinamica: ${staticMarketThreshold.toFixed(2)}%) ma trend debole (${sameDirectionStrength}/100) e senza momentum - Chiusura per proteggere profitto`,
                        currentPnL: currentPnLPct,
                        marketCondition: marketCondition.condition,
                        momentum: momentum,
                        signalStrength: sameDirectionStrength,
                        dynamicThreshold: staticMarketThreshold,
                        decisionFactor: 'static_market_no_momentum'
                    };
                }
            }
        }

        // 5. RAGIONAMENTO: Mercato statico per troppo tempo senza movimento
        if (marketCondition.condition === 'static' && timeInPosition > SMART_EXIT_CONFIG.MAX_TIME_IN_STATIC_MARKET) {
            if (currentPnLPct > 0) {
                return {
                    shouldClose: true,
                    reason: `Mercato statico per ${(timeInPosition / 60000).toFixed(0)} minuti con guadagno (${currentPnLPct.toFixed(2)}%) - Chiusura per liberare capitale`,
                    currentPnL: currentPnLPct,
                    timeInPosition: timeInPosition,
                    decisionFactor: 'static_market_too_long'
                };
            }
        }

        // 6. RAGIONAMENTO: Mercato lento con guadagno buono ma trend che si indebolisce
        // ✅ FIX: Soglia più alta (1.5% invece di 0.5%) per mercato lento
        if (marketCondition.condition === 'slow' && currentPnLPct >= SMART_EXIT_CONFIG.MIN_PROFIT_FOR_SLOW_MARKET) {
            const sameDirectionSignal = isLongPosition ? signal.longSignal : signal.shortSignal;
            const sameDirectionStrength = sameDirectionSignal?.strength || 0;

            // ✅ FIX: Solo se trend è MOLTO debole (< 30) E momentum negativo
            if (sameDirectionStrength < 30 && (!momentum || momentum < -0.1)) {
                return {
                    shouldClose: true,
                    reason: `Mercato lento con guadagno (${currentPnLPct.toFixed(2)}%) ma trend molto debole (${sameDirectionStrength}/100) e momentum negativo - Chiusura preventiva`,
                    currentPnL: currentPnLPct,
                    signalStrength: sameDirectionStrength,
                    momentum: momentum,
                    decisionFactor: 'weakening_trend'
                };
            }
        }

        // 7. RAGIONAMENTO: Opportunity Cost - Ci sono simboli migliori?
        if (currentPnLPct >= SMART_EXIT_CONFIG.MIN_PROFIT_TO_PROTECT) {
            const opportunity = await checkOpportunityCost(position);
            if (opportunity.hasBetterOpportunity && opportunity.bestSignal) {
                return {
                    shouldClose: true,
                    reason: `Opportunità migliore su ${opportunity.bestSignal.symbol} (${opportunity.bestSignal.strength}/100 vs guadagno attuale ${currentPnLPct.toFixed(2)}%) - Chiusura per riallocare`,
                    currentPnL: currentPnLPct,
                    betterOpportunity: opportunity.bestSignal,
                    decisionFactor: 'opportunity_cost'
                };
            }
        }

        // 8. RAGIONAMENTO: Guadagno buono ma mercato statico e paura di perdere
        // ✅ FIX: Usa soglia dinamica invece di fissa
        const profitProtectionThreshold = Math.max(
            SMART_EXIT_CONFIG.SUFFICIENT_PROFIT_IN_STATIC,
            dynamicThreshold
        );

        if (currentPnLPct >= profitProtectionThreshold &&
            marketCondition.condition === 'static' &&
            (!momentum || Math.abs(momentum) < 0.05)) {
            // Dopo "alti e bassi" (variazioni di prezzo), se ora è statico e abbiamo guadagno, chiudi
            const priceVariation = priceHistory.slice(-20).map(p => parseFloat(p.close || p.price));
            const maxPrice = Math.max(...priceVariation);
            const minPrice = Math.min(...priceVariation);
            const variationPct = ((maxPrice - minPrice) / minPrice) * 100;

            // ✅ FIX: Solo se variazione è significativa (> ATR) e guadagno è buono (>= soglia dinamica)
            // ✅ E se R/R non è ancora favorevole
            const minVariation = marketCondition.atrPct || 0.5;
            if (variationPct > minVariation && marketCondition.atrPct < 0.3 &&
                currentPnLPct >= profitProtectionThreshold &&
                (!riskReward || !riskReward.isFavorable)) {
                return {
                    shouldClose: true,
                    reason: `Guadagno ${currentPnLPct.toFixed(2)}% dopo alti e bassi (variazione ${variationPct.toFixed(2)}%) ma ora mercato statico - Chiusura per proteggere profitto`,
                    currentPnL: currentPnLPct,
                    priceVariation: variationPct,
                    dynamicThreshold: profitProtectionThreshold,
                    decisionFactor: 'profit_protection_static'
                };
            }
        }

        // Nessuna ragione per chiudere
        return {
            shouldClose: false,
            reason: null,
            oppositeStrength: oppositeStrength,
            currentPnL: currentPnLPct,
            peakProfit: peakProfit,
            marketCondition: marketCondition.condition,
            momentum: momentum,
            dynamicThreshold: effectiveMinThreshold,
            riskReward: riskReward,
            trailingProfit: trailingProfit
        };
    } catch (error) {
        console.error(`❌ Smart Exit error for ${position.symbol}:`, error.message);
        return { shouldClose: false, reason: null };
    }
}

/**
 * Main Smart Exit Loop
 * Checks all open positions and makes intelligent decisions about when to close
 */
async function runSmartExit() {
    if (!SMART_EXIT_CONFIG.ENABLED) return;

    try {
        // ✅ NUOVO PRIORITÀ 5: Portfolio Drawdown Protection - Controlla PRIMA di analizzare singole posizioni
        const portfolioDrawdown = await checkPortfolioDrawdown();
        if (portfolioDrawdown.shouldCloseWorst && portfolioDrawdown.worstPositions.length > 0) {
            console.log(`🚨 [PORTFOLIO DRAWDOWN] Drawdown totale: ${portfolioDrawdown.drawdownPct.toFixed(2)}% > max ${SMART_EXIT_CONFIG.MAX_PORTFOLIO_DRAWDOWN_PCT}%`);
            console.log(`   → Chiudendo ${portfolioDrawdown.worstPositions.length} posizioni peggiori per proteggere portfolio`);

            // ✅ Usa closePosition da cryptoRoutes (importato dinamicamente per evitare dipendenza circolare)
            // Nota: closePosition è definita in cryptoRoutes ma non esportata, quindi usiamo un workaround
            // In alternativa, possiamo emettere un evento che cryptoRoutes gestisce
            console.log(`⚠️ [PORTFOLIO DRAWDOWN] Drawdown alto rilevato. Posizioni da chiudere: ${portfolioDrawdown.worstPositions.map(p => `${p.symbol} (${p.profit_loss_pct}%)`).join(', ')}`);
            console.log(`   → Usa endpoint /cleanup-positions per chiudere automaticamente le posizioni peggiori`);
            // TODO: Implementare chiusura automatica quando closePosition sarà esportata o tramite evento
        }

        // Get all open positions
        const openPositions = await dbAll("SELECT * FROM open_positions WHERE status = 'open'");

        if (openPositions.length === 0) {
            return; // No positions to check
        }

        console.log(`🔍 [SMART EXIT] Analizzando ${openPositions.length} posizioni aperte con ragionamento avanzato...`);

        for (const position of openPositions) {
            try {
                // Load price history for this symbol (last 100 klines)
                const klines = await dbAll(
                    "SELECT * FROM klines WHERE symbol = ? AND interval = '15m' ORDER BY open_time DESC LIMIT 100",
                    [position.symbol]
                );

                if (klines.length < 20) {
                    console.log(`⚠️ [SMART EXIT] Dati insufficienti per ${position.symbol}, salto`);
                    continue;
                }

                // Convert klines to price history format
                const priceHistory = klines.reverse().map(k => ({
                    price: k.close_price,
                    high: k.high_price,
                    low: k.low_price,
                    close: k.close_price,
                    timestamp: k.open_time
                }));

                // Check if position should be closed (ADVANCED REASONING)
                const exitDecision = await shouldClosePosition(position, priceHistory);

                if (exitDecision.shouldClose) {
                    console.log(`🚨 [SMART EXIT] DECISIONE: Chiudere posizione ${position.ticket_id}`);
                    console.log(`   📊 Motivo: ${exitDecision.reason}`);
                    console.log(`   💰 P&L Attuale: ${exitDecision.currentPnL?.toFixed(2) || 0}%`);

                    // ✅ PRIORITÀ 1: Trailing Profit Protection
                    if (exitDecision.peakProfit !== undefined) {
                        console.log(`   📈 Peak Profit: ${exitDecision.peakProfit.toFixed(2)}%`);
                    }
                    if (exitDecision.lockedProfit !== undefined) {
                        console.log(`   🔒 Profitto Bloccato: ${exitDecision.lockedProfit.toFixed(2)}%`);
                    }

                    // ✅ PRIORITÀ 2: Soglia Dinamica
                    if (exitDecision.dynamicThreshold !== undefined) {
                        console.log(`   📊 Soglia Dinamica (ATR-based): ${exitDecision.dynamicThreshold.toFixed(2)}%`);
                    }
                    if (exitDecision.atrPct !== undefined) {
                        console.log(`   📈 ATR: ${exitDecision.atrPct.toFixed(2)}%`);
                    }

                    // ✅ PRIORITÀ 3: Risk/Reward
                    if (exitDecision.riskReward) {
                        console.log(`   ⚖️  Risk/Reward: ${exitDecision.riskReward.ratio.toFixed(2)}:1 (${exitDecision.riskReward.isFavorable ? 'Favorevole' : 'Non favorevole'})`);
                    }

                    console.log(`   🎯 Fattore Decisione: ${exitDecision.decisionFactor || 'unknown'}`);

                    if (exitDecision.marketCondition) {
                        console.log(`   📈 Condizione Mercato: ${exitDecision.marketCondition}`);
                    }
                    if (exitDecision.momentum !== undefined) {
                        console.log(`   ⚡ Momentum: ${exitDecision.momentum?.toFixed(2) || 0}%`);
                    }

                    // Close the position properly
                    const currentPrice = parseFloat(position.current_price || position.entry_price);

                    // Use the closePosition helper from cryptoRoutes
                    // Since closePosition is not exported, we'll use a direct database approach
                    // but we need to calculate P&L properly
                    const remainingVolume = parseFloat(position.volume) - (parseFloat(position.volume_closed) || 0);

                    let pnl = 0;
                    if (position.type === 'buy') {
                        pnl = (currentPrice - parseFloat(position.entry_price)) * remainingVolume;
                    } else {
                        pnl = (parseFloat(position.entry_price) - currentPrice) * remainingVolume;
                    }

                    // Update position to closed with proper P&L
                    await dbRun(
                        `UPDATE open_positions 
                         SET status = 'closed', 
                             closed_at = CURRENT_TIMESTAMP,
                             current_price = ?,
                             profit_loss = ?,
                             profit_loss_pct = ?,
                             volume_closed = volume,
                             close_reason = ?
                         WHERE ticket_id = ?`,
                        [currentPrice, pnl, exitDecision.currentPnL || 0, exitDecision.reason || 'SmartExit', position.ticket_id]
                    );

                    // Update portfolio balance
                    const portfolio = await dbAll("SELECT * FROM portfolio LIMIT 1");
                    if (portfolio && portfolio.length > 0) {
                        const currentBalance = parseFloat(portfolio[0].balance_usd) || 0;
                        const newBalance = currentBalance + pnl;
                        await dbRun(
                            "UPDATE portfolio SET balance_usd = ? WHERE id = ?",
                            [newBalance, portfolio[0].id]
                        );
                    }

                    console.log(`✅ [SMART EXIT] Posizione ${position.ticket_id} chiusa a €${currentPrice.toFixed(2)} | P&L: ${exitDecision.currentPnL?.toFixed(2) || 0}%`);
                } else {
                    // Log monitoring status with more details
                    const details = [];
                    if (exitDecision.peakProfit !== undefined && exitDecision.peakProfit > exitDecision.currentPnL) {
                        details.push(`Peak: ${exitDecision.peakProfit.toFixed(2)}%`);
                    }
                    if (exitDecision.dynamicThreshold !== undefined) {
                        details.push(`Soglia: ${exitDecision.dynamicThreshold.toFixed(2)}%`);
                    }
                    if (exitDecision.riskReward) {
                        details.push(`R/R: ${exitDecision.riskReward.ratio.toFixed(2)}:1`);
                    }
                    if (exitDecision.marketCondition) details.push(`Mercato: ${exitDecision.marketCondition}`);
                    if (exitDecision.momentum !== undefined) details.push(`Momentum: ${exitDecision.momentum?.toFixed(2)}%`);
                    if (exitDecision.oppositeStrength !== undefined) details.push(`Opposto: ${exitDecision.oppositeStrength}/100`);

                    console.log(`📊 [SMART EXIT] ${position.ticket_id} | P&L: ${exitDecision.currentPnL?.toFixed(2) || 0}% | ${details.join(' | ')} - MANTENERE`);
                }
            } catch (posError) {
                console.error(`❌ [SMART EXIT] Errore processando posizione ${position.ticket_id}:`, posError.message);
            }
        }
    } catch (error) {
        console.error('❌ [SMART EXIT] Errore nel loop principale:', error.message);
    }
}

// Start Smart Exit loop
if (SMART_EXIT_CONFIG.ENABLED) {
    console.log(`🎯 [SMART EXIT] Started (Check interval: ${SMART_EXIT_CONFIG.CHECK_INTERVAL_MS}ms, Min opposite strength: ${SMART_EXIT_CONFIG.MIN_OPPOSITE_STRENGTH})`);
    setInterval(runSmartExit, SMART_EXIT_CONFIG.CHECK_INTERVAL_MS);
}

module.exports = {
    runSmartExit,
    shouldClosePosition,
    SMART_EXIT_CONFIG
};
