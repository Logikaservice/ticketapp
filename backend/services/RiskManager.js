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
        this.MAX_POSITION_SIZE_PCT = 0.02;     // 2% capitale per posizione
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

            const currentCapital = portfolio.balance_usd;
            const holdings = JSON.parse(portfolio.holdings || '{}');
            
            // 2. Calcola esposizione corrente (valore posizioni aperte)
            const openPositions = await dbAll(
                "SELECT * FROM open_positions WHERE status = 'open'"
            );
            
            let currentExposure = 0;
            for (const pos of openPositions) {
                // Per LONG: volume * entry_price
                // Per SHORT: volume * entry_price (stesso calcolo)
                currentExposure += pos.volume * pos.entry_price;
            }
            
            const currentExposurePct = currentCapital > 0 ? currentExposure / currentCapital : 0;

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
            
            const dailyLossPct = currentCapital > 0 ? dailyLoss / currentCapital : 0;

            // 4. Calcola drawdown (serve picco capitale)
            // Per ora usiamo un approccio semplificato: se capitale < base, c'è drawdown
            const peakCapital = await dbGet(
                "SELECT MAX(balance_usd) as peak FROM portfolio"
            );
            const peak = peakCapital?.peak || currentCapital;
            const drawdown = peak > 0 ? (peak - currentCapital) / peak : 0;

            // 5. VERIFICA LIMITI ASSOLUTI
            if (currentCapital < this.BASE_CAPITAL) {
                this.cachedResult = {
                    canTrade: false,
                    reason: 'Capital below base protection (€250)',
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
            const availableExposurePct = this.MAX_TOTAL_EXPOSURE_PCT - currentExposurePct;
            const availableExposure = currentCapital * availableExposurePct;
            
            // Max position size: min tra 2% capitale e 10% dell'exposure disponibile
            const maxPositionSizePct = Math.min(
                this.MAX_POSITION_SIZE_PCT,
                availableExposurePct * 0.1
            );
            const maxPositionSize = currentCapital * maxPositionSizePct;

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
                currentCapital: currentCapital
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

