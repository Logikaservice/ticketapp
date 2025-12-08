/**
 * SERIOUS RISK MANAGER
 * Protegge il capitale PRIMA di tutto
 * Limiti assoluti non negoziabili
 */

const db = require('../crypto_db');

// Promise-based database helpers
const dbGet = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const dbAll = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
};

class SeriousRiskManager {
    constructor() {
        // LIMITI ASSOLUTI (non negoziabili)
        this.MAX_DAILY_LOSS_PCT = 0.05;        // 5% capitale
        this.MAX_TOTAL_EXPOSURE_PCT = 0.80;    // 80% capitale (base, aumenta con win rate alto)
        this.MAX_POSITION_SIZE_PCT = 0.10;     // 10% capitale per posizione (base, aumenta con win rate alto)
        this.MAX_DRAWDOWN_PCT = 0.10;          // 10% drawdown
        this.BASE_CAPITAL = 250;                // Protezione capitale base

        // Cache per performance
        this.lastCheck = null;
        this.cacheDuration = 5000; // 5 secondi
        this.cachedResult = null;
    }
    
    /**
     * ✅ Calcola limiti dinamici basati su win rate
     * Se il sistema ha win rate alto (>80%), permette più exposure e posizioni più grandi
     */
    async getDynamicLimits() {
        try {
            const db = require('../crypto_db');
            const stats = await new Promise((resolve, reject) => {
                db.get("SELECT * FROM performance_stats WHERE id = 1", (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            
            if (!stats || !stats.total_trades || stats.total_trades < 10) {
                // Non abbastanza dati, usa limiti conservativi
                return {
                    maxExposurePct: this.MAX_TOTAL_EXPOSURE_PCT,
                    maxPositionSizePct: this.MAX_POSITION_SIZE_PCT
                };
            }
            
            const winRate = stats.total_trades > 0 ? stats.winning_trades / stats.total_trades : 0.5;
            
            // ✅ LOGICA DINAMICA: Aumenta limiti se win rate è alto
            let maxExposurePct = this.MAX_TOTAL_EXPOSURE_PCT;
            let maxPositionSizePct = this.MAX_POSITION_SIZE_PCT;
            
            if (winRate >= 0.90) {
                // Win rate 90%+ → molto aggressivo
                maxExposurePct = 0.95; // 95% exposure (quasi tutto il capitale)
                maxPositionSizePct = 0.15; // 15% per posizione (più grande)
                console.log(`📊 [DYNAMIC LIMITS] Win rate ${(winRate * 100).toFixed(1)}% → Exposure: 95%, Position size: 15%`);
            } else if (winRate >= 0.80) {
                // Win rate 80-89% → aggressivo
                maxExposurePct = 0.90; // 90% exposure
                maxPositionSizePct = 0.12; // 12% per posizione
                console.log(`📊 [DYNAMIC LIMITS] Win rate ${(winRate * 100).toFixed(1)}% → Exposure: 90%, Position size: 12%`);
            } else if (winRate >= 0.70) {
                // Win rate 70-79% → moderato
                maxExposurePct = 0.85; // 85% exposure
                maxPositionSizePct = 0.11; // 11% per posizione
                console.log(`📊 [DYNAMIC LIMITS] Win rate ${(winRate * 100).toFixed(1)}% → Exposure: 85%, Position size: 11%`);
            }
            // Win rate <70% → usa limiti base (80% exposure, 10% position size)
            
            return {
                maxExposurePct: maxExposurePct,
                maxPositionSizePct: maxPositionSizePct,
                winRate: winRate
            };
        } catch (error) {
            console.warn(`⚠️ Error calculating dynamic limits, using defaults:`, error.message);
            return {
                maxExposurePct: this.MAX_TOTAL_EXPOSURE_PCT,
                maxPositionSizePct: this.MAX_POSITION_SIZE_PCT
            };
        }
    }

    /**
     * Calcola il rischio massimo disponibile
     * @returns {Object} { canTrade, reason, maxPositionSize, availableExposure, dailyLoss, currentExposure, drawdown }
     */
    async calculateMaxRisk() {
        // Cache per evitare troppe query
        const now = Date.now();
        if (this.lastCheck && (now - this.lastCheck) < this.cacheDuration && this.cachedResult) {
            return this.cachedResult;
        }

        try {
            // 1. Ottieni portfolio
            const portfolio = await dbGet("SELECT * FROM portfolio LIMIT 1");
            if (!portfolio) {
                return {
                    canTrade: false,
                    reason: 'Portfolio not found',
                    maxPositionSize: 0,
                    availableExposure: 0,
                    dailyLoss: 0,
                    currentExposure: 0,
                    drawdown: 0
                };
            }

            const cashBalance = parseFloat(portfolio.balance_usd) || 0;
            const holdings = JSON.parse(portfolio.holdings || '{}')['bitcoin'] || 0; // Legacy holding check, not main driver

            // 2. Calcola esposizione corrente (valore posizioni aperte)
            const openPositions = await dbAll(
                "SELECT * FROM open_positions WHERE status = 'open'"
            );

            let currentExposure = 0;
            for (const pos of openPositions) {
                // Per LONG: volume * entry_price
                // Per SHORT: volume * entry_price (stesso calcolo approssimativo)
                currentExposure += (parseFloat(pos.volume) || 0) * (parseFloat(pos.entry_price) || 0);
            }

            // ✅ FIX: Calcola Equity Totale (Cash + Esposizione)
            // Il rischio va calcolato sul totale del conto, non solo sul cash disponibile!
            const totalEquity = cashBalance + currentExposure;
            const currentExposurePct = totalEquity > 0 ? currentExposure / totalEquity : 0;

            // 3. Calcola perdita giornaliera
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayStart = today.toISOString();

            const todayTrades = await dbAll(
                "SELECT * FROM trades WHERE timestamp >= ? AND profit_loss < 0",
                [todayStart]
            );

            let dailyLoss = 0;
            for (const trade of todayTrades) {
                dailyLoss += Math.abs(trade.profit_loss || 0);
            }

            // ✅ FIX: Usa Equity per % Daily Loss
            const dailyLossPct = totalEquity > 0 ? dailyLoss / totalEquity : 0;

            // 4. Calcola drawdown (serve picco capitale)
            const peakCapital = await dbGet(
                "SELECT MAX(balance_usd) as peak FROM portfolio" // Nota: questo traccia solo picco cash storico, approssimazione accettabile per ora
                // TODO: In futuro tracciare Equity Peak
            );
            const peak = Math.max(parseFloat(peakCapital?.peak || 0), totalEquity); // Usa max tra storico e attuale
            const drawdown = peak > 0 ? (peak - totalEquity) / peak : 0;

            // 5. VERIFICA LIMITI ASSOLUTI
            // ✅ FIX: Base capital a €50 e check su Equity
            if (totalEquity < 50) {
                this.cachedResult = {
                    canTrade: false,
                    reason: 'Equity below base protection (€50)',
                    maxPositionSize: 0,
                    availableExposure: 0,
                    dailyLoss: dailyLossPct,
                    currentExposure: currentExposurePct,
                    drawdown: drawdown
                };
                this.lastCheck = now;
                return this.cachedResult;
            }

            if (dailyLossPct >= this.MAX_DAILY_LOSS_PCT) {
                this.cachedResult = {
                    canTrade: false,
                    reason: `Daily loss limit reached (${(dailyLossPct * 100).toFixed(2)}% >= ${(this.MAX_DAILY_LOSS_PCT * 100).toFixed(2)}%)`,
                    maxPositionSize: 0,
                    availableExposure: 0,
                    dailyLoss: dailyLossPct,
                    currentExposure: currentExposurePct,
                    drawdown: drawdown
                };
                this.lastCheck = now;
                return this.cachedResult;
            }

            if (currentExposurePct >= this.MAX_TOTAL_EXPOSURE_PCT) {
                this.cachedResult = {
                    canTrade: false,
                    reason: `Max exposure reached (${(currentExposurePct * 100).toFixed(2)}% >= ${(this.MAX_TOTAL_EXPOSURE_PCT * 100).toFixed(2)}%)`,
                    maxPositionSize: 0,
                    availableExposure: 0,
                    dailyLoss: dailyLossPct,
                    currentExposure: currentExposurePct,
                    drawdown: drawdown
                };
                this.lastCheck = now;
                return this.cachedResult;
            }

            if (drawdown >= this.MAX_DRAWDOWN_PCT) {
                this.cachedResult = {
                    canTrade: false,
                    reason: `Max drawdown reached (${(drawdown * 100).toFixed(2)}% >= ${(this.MAX_DRAWDOWN_PCT * 100).toFixed(2)}%)`,
                    maxPositionSize: 0,
                    availableExposure: 0,
                    dailyLoss: dailyLossPct,
                    currentExposure: currentExposurePct,
                    drawdown: drawdown
                };
                this.lastCheck = now;
                return this.cachedResult;
            }

            // 6. ✅ CALCOLA LIMITI DINAMICI basati su win rate
            const dynamicLimits = await this.getDynamicLimits();
            const maxExposurePct = dynamicLimits.maxExposurePct;
            const baseMaxPositionSizePct = dynamicLimits.maxPositionSizePct;
            
            // ✅ Verifica limite exposure con limiti dinamici
            if (currentExposurePct >= maxExposurePct) {
                this.cachedResult = {
                    canTrade: false,
                    reason: `Max exposure reached (${(currentExposurePct * 100).toFixed(2)}% >= ${(maxExposurePct * 100).toFixed(2)}%)`,
                    maxPositionSize: 0,
                    availableExposure: 0,
                    dailyLoss: dailyLossPct,
                    currentExposure: currentExposurePct,
                    drawdown: drawdown
                };
                this.lastCheck = now;
                return this.cachedResult;
            }
            
            // CALCOLA RISCHIO RESIDUO DISPONIBILE
            const availableExposurePct = Math.max(0, maxExposurePct - currentExposurePct);
            // Available Exposure in EUR = Total Equity * Available %
            const availableExposure = totalEquity * availableExposurePct;

            // Max position size: min tra % dinamica e 50% dell'exposure disponibile
            // ✅ KELLY CRITERION: Dynamic position sizing based on performance
            let maxPositionSizePct = Math.min(
                baseMaxPositionSizePct,
                availableExposurePct * 0.5
            );

            // Try to apply Kelly Criterion if we have enough trading history
            try {
                const db = require('../crypto_db');
                const stats = await new Promise((resolve, reject) => {
                    db.get("SELECT * FROM performance_stats WHERE id = 1", (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    });
                });

                if (stats && stats.total_trades >= 10) { // Minimum 10 trades for Kelly
                    const winRate = stats.total_trades > 0 ? stats.winning_trades / stats.total_trades : 0.5;
                    const avgWin = stats.winning_trades > 0 ? stats.total_profit / stats.winning_trades : 3;
                    const avgLoss = stats.losing_trades > 0 ? Math.abs(stats.total_loss) / stats.losing_trades : 2;

                    // Kelly Formula: f = (p * b - q) / b
                    // where p = win rate, q = 1 - p, b = avg_win / avg_loss
                    const p = winRate;
                    const q = 1 - p;
                    const b = avgLoss > 0 ? avgWin / avgLoss : 1.5;

                    const kellyFraction = (p * b - q) / b;

                    // Use Half-Kelly for safety (reduces risk of ruin)
                    const safeKelly = Math.max(0.01, Math.min(0.15, kellyFraction / 2));

                    console.log(`📊 [KELLY] Win Rate: ${(winRate * 100).toFixed(1)}% | Avg W/L: ${avgWin.toFixed(2)}/${avgLoss.toFixed(2)} | Kelly: ${(safeKelly * 100).toFixed(2)}%`);

                    maxPositionSizePct = safeKelly;
                } else {
                    console.log(`📊 [KELLY] Insufficient data (${stats?.total_trades || 0} trades), using default sizing`);
                }
            } catch (kellyError) {
                console.warn(`⚠️ Kelly Criterion calculation failed, using default sizing:`, kellyError.message);
            }

            // ✅ FIX CRITICO: Limita trade size al cash disponibile E verifica che ci sia abbastanza cash
            // Con saldo €1000 e posizioni da €50, max 20 posizioni possibili
            // Ma il RiskManager limita a 10% per posizione, quindi max €100 per posizione
            // Quindi con €1000 cash, max 10 posizioni da €100 = €1000 totali
            const maxPositionSize = Math.min(totalEquity * maxPositionSizePct, cashBalance);
            
            // ✅ FIX AGGIUNTIVO: Verifica che il cash disponibile sia ragionevole
            // Se cashBalance è anomalo (>10M), usa un limite più conservativo
            const MAX_REASONABLE_CASH = 1000000; // 1 milione EUR max ragionevole
            if (cashBalance > MAX_REASONABLE_CASH) {
                console.warn(`⚠️ [RISK MANAGER] Cash balance anomalo (€${cashBalance.toLocaleString()}), usando limite conservativo €${MAX_REASONABLE_CASH.toLocaleString()}`);
                const conservativeMax = Math.min(totalEquity * maxPositionSizePct, MAX_REASONABLE_CASH);
                // Se il maxPositionSize calcolato è troppo alto, limitalo
                if (maxPositionSize > conservativeMax) {
                    return {
                        canTrade: false,
                        reason: `Cash balance anomalo rilevato. Limite conservativo applicato.`,
                        maxPositionSize: 0,
                        availableExposure: 0,
                        dailyLoss: dailyLossPct,
                        currentExposure: currentExposurePct,
                        drawdown: drawdown
                    };
                }
            }

            // ✅ FIX: Prevent dust trading (posizioni insignificanti)
            const MIN_POSITION_SIZE = 5.0; // Minimo €5 per trade
            if (maxPositionSize < MIN_POSITION_SIZE) {
                this.cachedResult = {
                    canTrade: false,
                    reason: `Calculated position size (€${maxPositionSize.toFixed(2)}) below minimum (€${MIN_POSITION_SIZE.toFixed(2)}) - Saving capital`,
                    maxPositionSize: 0,
                    availableExposure: availableExposure,
                    dailyLoss: dailyLossPct,
                    currentExposure: currentExposurePct,
                    drawdown: drawdown
                };
                this.lastCheck = now;
                return this.cachedResult;
            }

            this.cachedResult = {
                canTrade: true,
                reason: 'OK',
                maxPositionSize: maxPositionSize,
                maxPositionSizePct: maxPositionSizePct,
                availableExposure: availableExposure,
                availableExposurePct: availableExposurePct,
                dailyLoss: dailyLossPct,
                currentExposure: currentExposurePct,
                drawdown: drawdown,
                currentCapital: cashBalance, // Maintain for compatibility
                totalEquity: totalEquity
            };

            this.lastCheck = now;
            return this.cachedResult;
        } catch (error) {
            console.error('❌ RiskManager Error:', error);
            return {
                canTrade: false,
                reason: `Error: ${error.message}`,
                maxPositionSize: 0,
                availableExposure: 0,
                dailyLoss: 0,
                currentExposure: 0,
                drawdown: 0
            };
        }
    }

    /**
     * Verifica se può aprire una nuova posizione
     * @param {number} positionSize - Dimensione posizione in EUR
     * @returns {Object} { allowed, reason }
     */
    async canOpenPosition(positionSize) {
        const risk = await this.calculateMaxRisk();

        if (!risk.canTrade) {
            return {
                allowed: false,
                reason: risk.reason
            };
        }

        if (positionSize > risk.maxPositionSize) {
            return {
                allowed: false,
                reason: `Position size (€${positionSize.toFixed(2)}) exceeds max (€${risk.maxPositionSize.toFixed(2)})`
            };
        }

        return {
            allowed: true,
            reason: 'OK'
        };
    }

    /**
     * Invalida cache (chiama dopo operazioni importanti)
     */
    invalidateCache() {
        this.lastCheck = null;
        this.cachedResult = null;
    }
}

// Singleton instance
const riskManager = new SeriousRiskManager();

module.exports = riskManager;

