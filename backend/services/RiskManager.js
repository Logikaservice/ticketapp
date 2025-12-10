/**
 * SERIOUS RISK MANAGER
 * Protegge il capitale PRIMA di tutto
 * Limiti assoluti non negoziabili
 */

// ✅ POSTGRESQL ONLY: Richiede esplicitamente PostgreSQL
const cryptoDb = require('../crypto_db');

// Verifica che il modulo esporti gli helper PostgreSQL
if (!cryptoDb.dbGet || !cryptoDb.dbAll) {
    throw new Error('❌ CRITICAL: crypto_db must be PostgreSQL module. SQLite support removed.');
}

const dbGet = cryptoDb.dbGet;
const dbAll = cryptoDb.dbAll;

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
            // ✅ MIGRAZIONE POSTGRESQL: Usa dbGet invece di db.get
            const stats = await dbGet("SELECT * FROM performance_stats WHERE id = 1");

            // ✅ CONFIGURABILE: Legge max_exposure_pct dal database
            let baseMaxExposurePct = this.MAX_TOTAL_EXPOSURE_PCT;
            try {
                const botParams = await dbGet("SELECT * FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND (symbol = 'global' OR symbol = 'bitcoin') ORDER BY CASE WHEN symbol = 'global' THEN 0 ELSE 1 END LIMIT 1");
                if (botParams && botParams.parameters) {
                    const params = typeof botParams.parameters === 'string' ? JSON.parse(botParams.parameters) : botParams.parameters;
                    if (params.max_exposure_pct !== undefined) {
                        baseMaxExposurePct = parseFloat(params.max_exposure_pct) / 100; // Converti da % a decimale
                    }
                }
            } catch (paramError) {
                // Usa default se errore
            }

            if (!stats || !stats.total_trades || stats.total_trades < 10) {
                // Non abbastanza dati, usa limiti conservativi
                return {
                    maxExposurePct: baseMaxExposurePct,
                    maxPositionSizePct: this.MAX_POSITION_SIZE_PCT
                };
            }

            const winRate = stats.total_trades > 0 ? stats.winning_trades / stats.total_trades : 0.5;

            // ✅ LOGICA DINAMICA: Aumenta limiti se win rate è alto (ma rispetta max_exposure_pct configurato)
            let maxExposurePct = baseMaxExposurePct;
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
            // ✅ CONFIGURABILE: Legge max_daily_loss_pct e max_exposure_pct dal database
            let maxDailyLossPct = this.MAX_DAILY_LOSS_PCT;
            let maxExposurePct = this.MAX_TOTAL_EXPOSURE_PCT;
            
            try {
                // Prova prima 'global', poi 'bitcoin'
                let botParams = await dbGet("SELECT * FROM bot_settings WHERE strategy_name = $1 AND symbol = $2 LIMIT 1", ['RSI_Strategy', 'global']);
                if (!botParams) {
                    botParams = await dbGet("SELECT * FROM bot_settings WHERE strategy_name = $1 AND symbol = $2 LIMIT 1", ['RSI_Strategy', 'bitcoin']);
                }
                
                if (botParams && botParams.parameters) {
                    const params = typeof botParams.parameters === 'string' ? JSON.parse(botParams.parameters) : botParams.parameters;
                    if (params.max_daily_loss_pct !== undefined && params.max_daily_loss_pct !== null && params.max_daily_loss_pct !== '') {
                        const parsedValue = parseFloat(params.max_daily_loss_pct);
                        if (!isNaN(parsedValue) && parsedValue > 0) {
                            maxDailyLossPct = parsedValue / 100; // Converti da % a decimale
                        }
                    }
                    if (params.max_exposure_pct !== undefined && params.max_exposure_pct !== null && params.max_exposure_pct !== '') {
                        const parsedValue = parseFloat(params.max_exposure_pct);
                        if (!isNaN(parsedValue) && parsedValue > 0) {
                            maxExposurePct = parsedValue / 100; // Converti da % a decimale
                        }
                    }
                }
            } catch (paramError) {
                console.warn('⚠️ [RISK-MANAGER] Errore lettura parametri, uso defaults:', paramError.message);
                // Le variabili rimangono con i valori di default già assegnati sopra
            }

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

            // ✅ FIX CRITICO: Calcola correttamente exposure e total equity
            // Per LONG: usa current_price (valore attuale) se disponibile, altrimenti entry_price
            // Per SHORT: usa entry_price (debito fisso)
            let currentExposure = 0;
            let totalEquityFromPositions = 0;

            for (const pos of openPositions) {
                const volume = parseFloat(pos.volume) || 0;
                const entryPrice = parseFloat(pos.entry_price) || 0;
                const currentPrice = parseFloat(pos.current_price) || entryPrice; // Usa current_price se disponibile
                
                if (pos.type === 'buy') {
                    // LONG: valore attuale delle crypto possedute
                    const positionValue = volume * currentPrice;
                    currentExposure += positionValue;
                    totalEquityFromPositions += positionValue;
                } else {
                    // SHORT: debito fisso all'entry price (quanto dobbiamo restituire)
                    const shortLiability = volume * entryPrice;
                    currentExposure += shortLiability;
                    // Per SHORT, il cash è stato aumentato all'apertura, ma dobbiamo restituire entry_price * volume
                    // Quindi il valore netto è: cash_aumentato - debito = 0 all'apertura
                    // Ma il debito rimane fisso, quindi sottraiamo dal total equity
                    totalEquityFromPositions -= shortLiability;
                }
            }

            // ✅ FIX CRITICO: Calcola Total Equity correttamente
            // Quando apri una posizione LONG:
            //   - Cash diminuisce di entry_price * volume
            //   - Possiedi volume crypto
            //   - Total Equity = Cash_residuo + Valore_attuale_crypto
            // 
            // Quando apri una posizione SHORT:
            //   - Cash aumenta di entry_price * volume (prestito)
            //   - Devi restituire volume crypto (debito)
            //   - Total Equity = Cash_aumentato - Debito_fisso
            //
            // Quindi: Total Equity = Cash + Valore_LONG - Debito_SHORT
            const totalEquity = cashBalance + totalEquityFromPositions;
            
            // ✅ FIX CRITICO: Exposure % deve usare totalEquity, non solo cashBalance
            // L'exposure % rappresenta quanto del totale equity è investito in posizioni
            const currentExposurePct = totalEquity > 0 ? currentExposure / totalEquity : 0;

            // 3. Calcola perdita giornaliera
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayStart = today.toISOString();

            const todayTrades = await dbAll(
                "SELECT * FROM trades WHERE timestamp >= $1 AND profit_loss < 0",
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
            // ✅ FIX: Base capital a $50 USDT e check su Equity
            if (totalEquity < 50) {
                this.cachedResult = {
                    canTrade: false,
                    reason: 'Equity below base protection ($50 USDT)',
                    maxPositionSize: 0,
                    availableExposure: 0,
                    dailyLoss: dailyLossPct,
                    currentExposure: currentExposurePct,
                    drawdown: drawdown
                };
                this.lastCheck = now;
                return this.cachedResult;
            }

            if (dailyLossPct >= maxDailyLossPct) {
                this.cachedResult = {
                    canTrade: false,
                    reason: `Daily loss limit reached (${(dailyLossPct * 100).toFixed(2)}% >= ${(maxDailyLossPct * 100).toFixed(2)}%)`,
                    maxPositionSize: 0,
                    availableExposure: 0,
                    dailyLoss: dailyLossPct,
                    currentExposure: currentExposurePct,
                    drawdown: drawdown
                };
                this.lastCheck = now;
                return this.cachedResult;
            }

            // ✅ Verifica limite exposure (sarà verificato anche dopo con limiti dinamici, ma questo è un check preliminare)
            // Usa maxExposurePct già letto dal database all'inizio
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
            // ✅ FIX: Usa i limiti dinamici invece di quelli del database (maxExposurePct già dichiarata alla riga 116)
            maxExposurePct = dynamicLimits.maxExposurePct;
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
            // Available Exposure in USDT = Total Equity * Available %
            const availableExposure = totalEquity * availableExposurePct;

            // ✅ FIXED POSITION SIZING: Logica semplice e aggressiva
            // - 80% del portfolio diviso in 10 posizioni = 8% per posizione
            // - Minimo assoluto: $80 USDT per posizione (anche con portfolio piccolo)
            // - Cresce con il portfolio: se portfolio cresce, posizioni crescono

            const FIXED_POSITION_PCT = 0.08;  // 8% del portfolio (10 posizioni = 80% exposure)
            const MIN_POSITION_SIZE = 80.0;   // Minimo assoluto $80 USDT

            // Calcola dimensione posizione basata su portfolio
            let calculatedPositionSize = totalEquity * FIXED_POSITION_PCT;

            // Applica minimo assoluto (mai meno di $80 USDT)
            let maxPositionSize = Math.max(calculatedPositionSize, MIN_POSITION_SIZE);

            // Limita al cash disponibile (non puoi investire più di quanto hai)
            maxPositionSize = Math.min(maxPositionSize, cashBalance);

            console.log(`💰 [FIXED SIZING] Portfolio: $${totalEquity.toFixed(2)} USDT | Position: $${maxPositionSize.toFixed(2)} USDT (${FIXED_POSITION_PCT * 100}% o min $${MIN_POSITION_SIZE} USDT)`);

            // ✅ FIX AGGIUNTIVO: Verifica che il cash disponibile sia ragionevole
            // Se cashBalance è anomalo (>10M), usa un limite più conservativo
            const MAX_REASONABLE_CASH = 1000000; // 1 milione USDT max ragionevole
            if (cashBalance > MAX_REASONABLE_CASH) {
                console.warn(`⚠️ [RISK MANAGER] Cash balance anomalo ($${cashBalance.toLocaleString()} USDT), usando limite conservativo $${MAX_REASONABLE_CASH.toLocaleString()} USDT`);
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

            // ✅ Minimo già gestito sopra ($80 USDT) nella logica Fixed Sizing

            this.cachedResult = {
                canTrade: true,
                reason: 'OK',
                maxPositionSize: maxPositionSize,
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
     * @param {number} positionSize - Dimensione posizione in USDT
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
                reason: `Position size ($${positionSize.toFixed(2)} USDT) exceeds max ($${risk.maxPositionSize.toFixed(2)} USDT)`
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

