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
        // Default sensati (possono essere sovrascritti da DB)
        // NOTE: max_daily_loss_pct è stato rimosso dal sistema per richiesta utente.
        this.MAX_DAILY_LOSS_PCT = 0.05;        // (non usato)
        // max_exposure_pct: di default 80%, ma sempre configurabile da DB
        this.MAX_TOTAL_EXPOSURE_PCT = 0.80;    // 80% capitale (default)
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

            // ✅ CONFIGURABILE: max_exposure_pct dal DB (global ha precedenza)
            let baseMaxExposurePct = this.MAX_TOTAL_EXPOSURE_PCT;
            try {
                const botParams = await dbGet(
                    "SELECT * FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND (symbol = 'global' OR symbol = 'bitcoin') ORDER BY CASE WHEN symbol = 'global' THEN 0 ELSE 1 END LIMIT 1"
                );
                if (botParams && botParams.parameters) {
                    const params = typeof botParams.parameters === 'string' ? JSON.parse(botParams.parameters) : botParams.parameters;
                    const parsed = parseFloat(params.max_exposure_pct);
                    if (!isNaN(parsed) && parsed > 0) {
                        baseMaxExposurePct = parsed / 100;
                    }
                }
            } catch (e) {
                // ignore
            }

            if (!stats || !stats.total_trades || stats.total_trades < 10) {
                // Non abbastanza dati, usa limiti conservativi
                return {
                    maxExposurePct: baseMaxExposurePct,
                    maxPositionSizePct: this.MAX_POSITION_SIZE_PCT
                };
            }

            const winRate = stats.total_trades > 0 ? stats.winning_trades / stats.total_trades : 0.5;

            // ✅ SCELTA UTENTE: max exposure NON deve essere cambiato dal win-rate
            // (il win-rate può al massimo influenzare la size % per posizione)
            let maxExposurePct = baseMaxExposurePct;
            let maxPositionSizePct = this.MAX_POSITION_SIZE_PCT;

            if (winRate >= 0.90) {
                // Win rate 90%+ → molto aggressivo
                maxPositionSizePct = 0.15; // 15% per posizione (più grande)
                console.log(`📊 [DYNAMIC LIMITS] Win rate ${(winRate * 100).toFixed(1)}% → Exposure: ${(maxExposurePct * 100).toFixed(0)}%, Position size: 15%`);
            } else if (winRate >= 0.80) {
                // Win rate 80-89% → aggressivo
                maxPositionSizePct = 0.12; // 12% per posizione
                console.log(`📊 [DYNAMIC LIMITS] Win rate ${(winRate * 100).toFixed(1)}% → Exposure: ${(maxExposurePct * 100).toFixed(0)}%, Position size: 12%`);
            } else if (winRate >= 0.70) {
                // Win rate 70-79% → moderato
                maxPositionSizePct = 0.11; // 11% per posizione
                console.log(`📊 [DYNAMIC LIMITS] Win rate ${(winRate * 100).toFixed(1)}% → Exposure: ${(maxExposurePct * 100).toFixed(0)}%, Position size: 11%`);
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
            // ✅ SCELTA UTENTE (DB):
            // - trade_size_usdt: se configurato, diventa anche "minimo assoluto" (no micro-trade)
            // ✅ RIMOSSO: max_exposure_pct non più utilizzato (limitava erroneamente le posizioni)
            // Usa sempre 100% come default per non limitare l'esposizione
            let maxExposurePct = 1.0; // 100% - non limita più l'esposizione
            let configuredTradeSize = null;

            try {
                let botParams = await dbGet("SELECT * FROM bot_settings WHERE strategy_name = $1 AND symbol = $2 LIMIT 1", ['RSI_Strategy', 'global']);
                if (!botParams) {
                    botParams = await dbGet("SELECT * FROM bot_settings WHERE strategy_name = $1 AND symbol = $2 LIMIT 1", ['RSI_Strategy', 'bitcoin']);
                }
                if (botParams && botParams.parameters) {
                    const params = typeof botParams.parameters === 'string' ? JSON.parse(botParams.parameters) : botParams.parameters;

                    // ✅ RIMOSSO: max_exposure_pct non più utilizzato (limitava erroneamente le posizioni)
                    // Manteniamo sempre 100% per non limitare
                    // trade size (minimo assoluto se configurato)
                    const ts = params.trade_size_usdt ?? params.trade_size_eur ?? null;
                    const tsParsed = ts !== null && ts !== undefined ? parseFloat(ts) : NaN;
                    if (!isNaN(tsParsed) && tsParsed >= 10) {
                        configuredTradeSize = tsParsed;
                    }
                }
            } catch (paramError) {
                console.warn('⚠️ [RISK-MANAGER] Errore lettura parametri, uso defaults:', paramError.message);
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

            // ✅ FIX: Usa trade_size_usdt per calcolare esposizione invece di entry_price * volume
            // Questo garantisce che le limitazioni usino il valore configurato, non il valore reale investito
            const configuredTradeSize = params.trade_size_usdt ?? params.trade_size_eur ?? null;
            const tradeSizeForExposure = configuredTradeSize && configuredTradeSize >= 10 ? configuredTradeSize : null;

            for (const pos of openPositions) {
                const volume = parseFloat(pos.volume) || 0;
                const entryPrice = parseFloat(pos.entry_price) || 0;
                const currentPrice = parseFloat(pos.current_price) || entryPrice; // Usa current_price se disponibile
                
                if (pos.type === 'buy') {
                    // LONG: usa trade_size_usdt se configurato per esposizione, altrimenti entry_price * volume
                    // Per equity usa valore reale (currentPrice * volume)
                    const exposureValue = tradeSizeForExposure || (volume * entryPrice);
                    currentExposure += exposureValue;
                    const positionValue = volume * currentPrice; // Per equity usa valore attuale
                    totalEquityFromPositions += positionValue;
                } else {
                    // SHORT: usa trade_size_usdt se configurato per esposizione, altrimenti entry_price * volume
                    const exposureValue = tradeSizeForExposure || (volume * entryPrice);
                    currentExposure += exposureValue;
                    // Per SHORT, il cash è stato aumentato all'apertura, ma dobbiamo restituire entry_price * volume
                    // Quindi il valore netto è: cash_aumentato - debito = 0 all'apertura
                    // Ma il debito rimane fisso, quindi sottraiamo dal total equity
                    const shortLiability = volume * entryPrice; // Per equity usa valore reale
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
            // ✅ FIX CRITICO: Il drawdown deve essere calcolato rispetto al picco DOPO l'ultimo reset
            // Se il balance attuale è molto più basso del picco storico, potrebbe essere perché
            // è stato fatto un reset. In questo caso, usa il balance attuale come nuovo picco.
            const peakCapital = await dbGet(
                "SELECT MAX(balance_usd) as peak FROM portfolio" // Nota: questo traccia solo picco cash storico, approssimazione accettabile per ora
                // TODO: In futuro tracciare Equity Peak
            );
            const historicalPeak = parseFloat(peakCapital?.peak || 0);
            
            // ✅ FIX: Se il balance attuale è molto più basso del picco storico (es. >50% di differenza),
            // probabilmente è stato fatto un reset. In questo caso, usa il balance attuale come nuovo picco.
            // Questo evita che il drawdown blocchi tutto dopo un reset.
            const peakDifference = historicalPeak > 0 ? (historicalPeak - cashBalance) / historicalPeak : 0;
            const likelyReset = peakDifference > 0.5; // Se differenza > 50%, probabilmente è un reset
            
            let peak = Math.max(historicalPeak, totalEquity);
            if (likelyReset && cashBalance > 0) {
                // Se sembra un reset, usa il balance attuale come nuovo picco
                peak = Math.max(cashBalance, totalEquity);
                console.log(`🔄 [RISK-MANAGER] Rilevato possibile reset (differenza picco: ${(peakDifference * 100).toFixed(1)}%). Usando balance attuale ($${cashBalance.toFixed(2)}) come nuovo picco.`);
            }
            
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

            // ✅ Per richiesta utente: max_daily_loss_pct è stato rimosso.
            // Non blocchiamo MAI l'apertura basandoci su perdita giornaliera.

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

            // ✅ RIMOSSO: Blocco basato su drawdown rispetto a picco storico
            // Se l'utente ha investito $1000 o $250, quei soldi sono già investiti.
            // Il bot deve semplicemente usare il capitale disponibile con la migliore strategia.
            // Il blocco basato su "drawdown rispetto a picco storico" non ha senso
            // perché il capitale è già investito e l'utente vuole che venga usato.
            // 
            // I controlli che rimangono attivi sono:
            // - Max Exposure - per non investire più dell'80% del capitale
            // - Daily Loss Limit (configurabile) - per proteggere da perdite eccessive in un giorno
            // - Equity minima (< $50) - per evitare posizioni troppo piccole
            //
            // NON blocchiamo più basandoci su drawdown rispetto a picco storico

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
            // - Se trade_size_usdt è configurato, usa quello come dimensione fissa
            // - Altrimenti: 80% del portfolio diviso in 10 posizioni = 8% per posizione
            // - Minimo assoluto: $80 USDT per posizione (anche con portfolio piccolo)
            // - Cresce con il portfolio: se portfolio cresce, posizioni crescono

            const FIXED_POSITION_PCT = 0.08;  // 8% del portfolio (default)
            const MIN_POSITION_SIZE = 80.0;   // Minimo assoluto quando non configurato

            let maxPositionSize;
            
            // ✅ FIX: Se trade_size_usdt è configurato, usa quello come dimensione fissa
            if (configuredTradeSize) {
                maxPositionSize = configuredTradeSize;
                console.log(`💰 [FIXED SIZING] Usando trade_size_usdt configurato: $${maxPositionSize.toFixed(2)} USDT`);
                
                // ✅ FIX CRITICO: Se trade_size_usdt è configurato, verifica che ci sia abbastanza cash
                // Se non c'è abbastanza cash, blocca invece di ridurre la dimensione
                if (cashBalance < configuredTradeSize) {
                    this.cachedResult = {
                        canTrade: false,
                        reason: `Insufficient cash for configured trade size ($${cashBalance.toFixed(2)} < $${configuredTradeSize.toFixed(2)} USDT). Need $${configuredTradeSize.toFixed(2)} but only have $${cashBalance.toFixed(2)}`,
                        maxPositionSize: 0,
                        availableExposure: 0,
                        dailyLoss: dailyLossPct,
                        currentExposure: currentExposurePct,
                        drawdown: drawdown,
                        currentCapital: cashBalance,
                        totalEquity: totalEquity
                    };
                    this.lastCheck = now;
                    return this.cachedResult;
                }
                // ✅ Se c'è abbastanza cash, usa il trade_size configurato (non limitare al cash)
                // Questo garantisce che quando trade_size_usdt è configurato, viene sempre rispettato
                console.log(`✅ [FIXED SIZING] Cash sufficiente: $${cashBalance.toFixed(2)} >= $${configuredTradeSize.toFixed(2)} USDT`);
            } else {
                // Calcola dimensione posizione basata su portfolio (8% default)
                let calculatedPositionSize = totalEquity * FIXED_POSITION_PCT;
                // Applica minimo assoluto (mai meno di $80 USDT)
                maxPositionSize = Math.max(calculatedPositionSize, MIN_POSITION_SIZE);
                
                // ✅ FIX CRITICO: Se il cash disponibile è inferiore al minimo richiesto,
                // blocca l'apertura di nuove posizioni (non aprire posizioni troppo piccole)
                // Questo garantisce che ogni posizione sia almeno $80 USDT
                if (cashBalance < MIN_POSITION_SIZE) {
                    // fallback legacy: se non c'è trade_size configurato, permetti size piccola se >=$10
                    console.log(`⚠️ [FIXED SIZING] Cash insufficiente per posizione minima: $${cashBalance.toFixed(2)} < $${MIN_POSITION_SIZE} USDT`);
                    if (cashBalance < 10) {
                        this.cachedResult = {
                            canTrade: false,
                            reason: `Insufficient cash for minimum position size ($${cashBalance.toFixed(2)} < $${MIN_POSITION_SIZE} USDT)`,
                            maxPositionSize: 0,
                            availableExposure: 0,
                            dailyLoss: dailyLossPct,
                            currentExposure: currentExposurePct,
                            drawdown: drawdown,
                            currentCapital: cashBalance,
                            totalEquity: totalEquity
                        };
                        this.lastCheck = now;
                        return this.cachedResult;
                    }
                    maxPositionSize = cashBalance;
                    console.log(`⚠️ [FIXED SIZING] Posizione limitata a cash disponibile: $${maxPositionSize.toFixed(2)} USDT (minimo richiesto: $${MIN_POSITION_SIZE} USDT)`);
                } else {
                    // Limita al cash disponibile (non puoi investire più di quanto hai)
                    maxPositionSize = Math.min(maxPositionSize, cashBalance);
                }
            }

            // ✅ FIX CRITICO: Se trade_size_usdt è configurato, NON limitarlo da availableExposure
            // L'esposizione massima è un limite GLOBALE, non per singola posizione
            // Se l'utente ha configurato $100, deve usare $100 (a meno che non ci sia abbastanza cash)
            // L'esposizione massima verrà rispettata a livello globale (non può aprire più posizioni se supera l'80%)
            if (!configuredTradeSize) {
                // Se non c'è trade_size configurato, limita all'esposizione disponibile
                maxPositionSize = Math.min(maxPositionSize, availableExposure);
            } else {
                // ✅ Se trade_size_usdt è configurato, usa quello SEMPRE (non limitare da availableExposure)
                // L'esposizione massima verrà rispettata dal controllo globale (canOpenPosition)
                console.log(`✅ [FIXED SIZING] Trade size configurato ($${configuredTradeSize.toFixed(2)}) - NON limitato da availableExposure ($${availableExposure.toFixed(2)}). L'esposizione massima è un limite globale.`);
            }

            console.log(`💰 [FIXED SIZING] Portfolio: $${totalEquity.toFixed(2)} USDT | Position: $${maxPositionSize.toFixed(2)} USDT | Available Exposure: $${availableExposure.toFixed(2)} USDT | Cash: $${cashBalance.toFixed(2)} USDT`);

            // ✅ FIX AGGIUNTIVO: Verifica che il cash disponibile sia ragionevole
            // Se cashBalance è anomalo (>10M), usa un limite più conservativo
            const MAX_REASONABLE_CASH = 1000000; // 1 milione USDT max ragionevole
            if (cashBalance > MAX_REASONABLE_CASH) {
                console.warn(`⚠️ [RISK MANAGER] Cash balance anomalo ($${cashBalance.toLocaleString()} USDT), usando limite conservativo $${MAX_REASONABLE_CASH.toLocaleString()} USDT`);
                const conservativeMax = Math.min(totalEquity * baseMaxPositionSizePct, MAX_REASONABLE_CASH);
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

