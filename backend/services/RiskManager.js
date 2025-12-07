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
        this.MAX_TOTAL_EXPOSURE_PCT = 0.40;    // 40% capitale
        this.MAX_POSITION_SIZE_PCT = 0.10;     // 10% capitale per posizione (aumentato per conti piccoli)
        this.MAX_DRAWDOWN_PCT = 0.10;          // 10% drawdown
        this.BASE_CAPITAL = 250;                // Protezione capitale base

        // Cache per performance
        this.lastCheck = null;
        this.cacheDuration = 5000; // 5 secondi
        this.cachedResult = null;
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

            // 6. CALCOLA RISCHIO RESIDUO DISPONIBILE
            const availableExposurePct = Math.max(0, this.MAX_TOTAL_EXPOSURE_PCT - currentExposurePct);
            // Available Exposure in EUR = Total Equity * Available %
            const availableExposure = totalEquity * availableExposurePct;

            // Max position size: min tra 10% capitale e 50% dell'exposure disponibile
            // Aumentato da 0.1 a 0.5 per permettere operatività su conti piccoli (< €1000)
            const maxPositionSizePct = Math.min(
                this.MAX_POSITION_SIZE_PCT,
                availableExposurePct * 0.5
            );
            // Limit trade size to available cash to avoid negative balance
            const maxPositionSize = Math.min(totalEquity * maxPositionSizePct, cashBalance);

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

