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
    
    // Nuove configurazioni per ragionamento avanzato
    STATIC_MARKET_ATR_THRESHOLD: 0.3, // ATR < 0.3% = mercato statico
    SLOW_MARKET_ATR_THRESHOLD: 0.5, // ATR 0.3-0.5% = mercato lento
    SUFFICIENT_PROFIT_IN_STATIC: 0.5, // 0.5% (50% del guadagno) è sufficiente in mercato statico
    MIN_MOMENTUM_FOR_HOLD: 0.1, // Momentum minimo per tenere posizione (0.1% per periodo)
    MAX_TIME_IN_STATIC_MARKET: 3600000, // 1 ora in mercato statico senza movimento = chiudi
    OPPORTUNITY_COST_THRESHOLD: 1.0, // Se ci sono simboli con segnali >1% migliori, considera chiusura
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
 * Check if a position should be closed - ADVANCED REASONING
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
        
        // 1. Genera segnale per condizioni di mercato attuali
        const signal = signalGenerator.generateSignal(priceHistory, position.symbol);
        
        const isLongPosition = position.type === 'buy';
        const isShortPosition = position.type === 'sell';
        
        // 2. Controlla segnale opposto (logica originale)
        const oppositeSignal = isLongPosition ? signal.shortSignal : signal.longSignal;
        const oppositeStrength = oppositeSignal?.strength || 0;
        
        if (oppositeStrength >= SMART_EXIT_CONFIG.MIN_OPPOSITE_STRENGTH && currentPnLPct >= SMART_EXIT_CONFIG.MIN_PROFIT_TO_PROTECT) {
            return {
                shouldClose: true,
                reason: `Segnale opposto forte (${oppositeStrength}/100) - Chiusura per proteggere profitto`,
                oppositeStrength: oppositeStrength,
                currentPnL: currentPnLPct,
                decisionFactor: 'opposite_signal'
            };
        }
        
        // 3. Valuta condizione del mercato (statico, lento, volatile)
        const klines = priceHistory.map(p => ({
            high: p.high || p.price,
            low: p.low || p.price,
            close: p.close || p.price,
            high_price: p.high || p.price,
            low_price: p.low || p.price,
            close_price: p.close || p.price
        }));
        
        const marketCondition = assessMarketCondition(klines, currentPrice);
        const momentum = calculateMomentum(priceHistory, [5, 10, 20]);
        
        // 4. RAGIONAMENTO: Mercato statico con guadagno sufficiente
        if (marketCondition.condition === 'static' && currentPnLPct >= SMART_EXIT_CONFIG.SUFFICIENT_PROFIT_IN_STATIC) {
            // Se il mercato è statico e abbiamo un guadagno "sufficiente" (0.5%+), considera chiusura
            // Specialmente se non c'è momentum positivo
            if (!momentum || momentum < SMART_EXIT_CONFIG.MIN_MOMENTUM_FOR_HOLD) {
                return {
                    shouldClose: true,
                    reason: `Mercato statico (ATR: ${marketCondition.atrPct.toFixed(2)}%) con guadagno sufficiente (${currentPnLPct.toFixed(2)}%) ma senza momentum - Chiusura per evitare perdita`,
                    currentPnL: currentPnLPct,
                    marketCondition: marketCondition.condition,
                    momentum: momentum,
                    decisionFactor: 'static_market_no_momentum'
                };
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
        if (marketCondition.condition === 'slow' && currentPnLPct >= 0.5) {
            const sameDirectionSignal = isLongPosition ? signal.longSignal : signal.shortSignal;
            const sameDirectionStrength = sameDirectionSignal?.strength || 0;
            
            // Se il segnale nella stessa direzione si sta indebolendo (< 50), considera chiusura
            if (sameDirectionStrength < 50 && (!momentum || momentum < 0.05)) {
                return {
                    shouldClose: true,
                    reason: `Mercato lento con guadagno (${currentPnLPct.toFixed(2)}%) ma trend che si indebolisce (${sameDirectionStrength}/100) - Chiusura preventiva`,
                    currentPnL: currentPnLPct,
                    signalStrength: sameDirectionStrength,
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
        
        // 8. RAGIONAMENTO: Guadagno buono (0.5%+) ma mercato statico e paura di perdere
        if (currentPnLPct >= SMART_EXIT_CONFIG.SUFFICIENT_PROFIT_IN_STATIC && 
            marketCondition.condition === 'static' && 
            (!momentum || Math.abs(momentum) < 0.05)) {
            // Dopo "alti e bassi" (variazioni di prezzo), se ora è statico e abbiamo guadagno, chiudi
            const priceVariation = priceHistory.slice(-20).map(p => parseFloat(p.close || p.price));
            const maxPrice = Math.max(...priceVariation);
            const minPrice = Math.min(...priceVariation);
            const variationPct = ((maxPrice - minPrice) / minPrice) * 100;
            
            // Se c'è stata variazione (alti e bassi) ma ora è statico
            if (variationPct > 0.3 && marketCondition.atrPct < 0.3) {
                return {
                    shouldClose: true,
                    reason: `Guadagno ${currentPnLPct.toFixed(2)}% dopo alti e bassi (variazione ${variationPct.toFixed(2)}%) ma ora mercato statico - Chiusura per proteggere profitto`,
                    currentPnL: currentPnLPct,
                    priceVariation: variationPct,
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
            marketCondition: marketCondition.condition,
            momentum: momentum
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
                             volume_closed = volume
                         WHERE ticket_id = ?`,
                        [currentPrice, pnl, exitDecision.currentPnL || 0, position.ticket_id]
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
                    if (exitDecision.marketCondition) details.push(`Mercato: ${exitDecision.marketCondition}`);
                    if (exitDecision.momentum !== undefined) details.push(`Momentum: ${exitDecision.momentum?.toFixed(2)}%`);
                    if (exitDecision.oppositeStrength !== undefined) details.push(`Segnale Opposto: ${exitDecision.oppositeStrength}/100`);
                    
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
