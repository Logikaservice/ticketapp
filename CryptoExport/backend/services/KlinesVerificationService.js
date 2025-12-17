/**
 * 🔍 KLINES VERIFICATION SERVICE
 * 
 * Verifica che tutti i klines siano presenti e completi per i simboli attivi
 */

const { dbAll, dbGet } = require('../crypto_db');

class KlinesVerificationService {
    /**
     * Verifica completa dello stato dei klines
     * @returns {Promise<{healthy: boolean, message: string, details: object}>}
     */
    async verifyKlinesCompleteness() {
        try {
            // 1. Ottieni tutti i simboli attivi
            const activeSymbols = await this.getActiveSymbols();
            
            if (activeSymbols.length === 0) {
                return {
                    healthy: true,
                    message: 'Nessun simbolo attivo - verifica non necessaria',
                    details: {
                        activeSymbols: 0,
                        checkedSymbols: 0,
                        issues: []
                    }
                };
            }

            // 2. Intervalli richiesti per il trading
            const requiredIntervals = ['15m', '1h', '4h'];
            
            // 3. Verifica per ogni simbolo
            const issues = [];
            const symbolDetails = {};
            let totalIssues = 0;

            for (const symbol of activeSymbols) {
                const symbolCheck = await this.verifySymbolKlines(symbol, requiredIntervals);
                symbolDetails[symbol] = symbolCheck;
                
                if (!symbolCheck.healthy) {
                    issues.push({
                        symbol,
                        problems: symbolCheck.issues
                    });
                    totalIssues += symbolCheck.issues.length;
                }
            }

            // 4. Verifica klines recenti (ultima ora) - come controllo aggiuntivo
            const recentKlinesCheck = await this.checkRecentKlines();
            
            // 5. Determina stato generale
            const isHealthy = issues.length === 0 && recentKlinesCheck.healthy;

            let message;
            if (isHealthy) {
                message = `Aggregatore funziona - Tutti i klines presenti per ${activeSymbols.length} simbolo/i attivo/i`;
            } else {
                const symbolIssues = issues.length;
                const recentIssue = recentKlinesCheck.healthy ? '' : ' (nessuna kline recente)';
                message = `Problemi rilevati: ${symbolIssues} simbolo/i con klines incompleti${recentIssue}`;
            }

            return {
                healthy: isHealthy,
                message,
                details: {
                    activeSymbols: activeSymbols.length,
                    checkedSymbols: activeSymbols.length,
                    issues,
                    recentKlines: recentKlinesCheck,
                    symbolDetails
                }
            };
        } catch (error) {
            return {
                healthy: false,
                message: `Errore verifica klines: ${error.message}`,
                details: {
                    error: error.message
                }
            };
        }
    }

    /**
     * Ottiene tutti i simboli attivi dal bot_settings
     */
    async getActiveSymbols() {
        try {
            const results = await dbAll(
                `SELECT DISTINCT symbol 
                 FROM bot_settings 
                 WHERE strategy_name = 'RSI_Strategy' 
                   AND is_active = 1 
                   AND symbol != 'global'`
            );
            return results.map(r => r.symbol);
        } catch (error) {
            console.error('❌ [KLINES-VERIFY] Errore recupero simboli attivi:', error);
            return [];
        }
    }

    /**
     * Verifica klines per un singolo simbolo
     */
    async verifySymbolKlines(symbol, requiredIntervals) {
        const issues = [];
        const intervalDetails = {};

        for (const interval of requiredIntervals) {
            const intervalCheck = await this.verifyIntervalKlines(symbol, interval);
            intervalDetails[interval] = intervalCheck;

            if (!intervalCheck.healthy) {
                issues.push({
                    interval,
                    problem: intervalCheck.issue,
                    details: intervalCheck
                });
            }
        }

        return {
            healthy: issues.length === 0,
            issues,
            intervalDetails
        };
    }

    /**
     * Verifica klines per un intervallo specifico
     */
    async verifyIntervalKlines(symbol, interval) {
        try {
            // 1. Conta totale klines per questo simbolo/intervallo
            const totalCount = await dbGet(
                `SELECT COUNT(*) as count 
                 FROM klines 
                 WHERE symbol = $1 AND interval = $2`,
                [symbol, interval]
            );
            const count = parseInt(totalCount?.count || 0);

            // 2. Verifica se ci sono klines recenti (ultime 24 ore)
            const now = Date.now();
            const last24h = now - (24 * 60 * 60 * 1000);
            const recentCount = await dbGet(
                `SELECT COUNT(*) as count 
                 FROM klines 
                 WHERE symbol = $1 
                   AND interval = $2 
                   AND open_time > $3`,
                [symbol, interval, last24h]
            );
            const recent = parseInt(recentCount?.count || 0);

            // 3. Verifica ultima kline
            const lastKline = await dbGet(
                `SELECT open_time, close_time 
                 FROM klines 
                 WHERE symbol = $1 AND interval = $2 
                 ORDER BY open_time DESC LIMIT 1`,
                [symbol, interval]
            );

            // 4. Calcola gap temporale dall'ultima kline
            let gapHours = null;
            let lastKlineTime = null;
            if (lastKline && lastKline.open_time) {
                lastKlineTime = parseInt(lastKline.open_time);
                const gapMs = now - lastKlineTime;
                gapHours = gapMs / (1000 * 60 * 60);
            }

            // 5. Determina se è sano
            // ✅ LOGICA MIGLIORATA: Priorità alla funzionalità dell'aggregatore (klines recenti)
            // piuttosto che alla completezza storica
            // 
            // Per 15m: verifica sempre che ci siano klines recenti (aggregatore funziona)
            // Per 1h e 4h: più permissivo - accetta anche se non ci sono 50 klines storici,
            // purché ci siano klines recenti (aggregatore sta creando dati)
            const minRecent = this.getMinRecentForInterval(interval);
            const maxGapHours = this.getMaxGapForInterval(interval);
            
            // Requisiti minimi storici (solo per 15m, più permissivo per 1h/4h)
            const minTotal = interval === '15m' ? 50 : 20; // 15m richiede più dati, 1h/4h più permissivo

            let isHealthy = true;
            let issue = null;

            // Verifica 1: Klines recenti (PRIORITÀ - aggregatore deve funzionare)
            if (recent < minRecent) {
                isHealthy = false;
                issue = `Poche klines recenti: ${recent} nelle ultime 24h (minimo ${minRecent})`;
            }
            // Verifica 2: Gap temporale (dati devono essere aggiornati)
            else if (gapHours !== null && gapHours > maxGapHours) {
                isHealthy = false;
                issue = `Gap temporale troppo grande: ${gapHours.toFixed(1)}h dall'ultima kline (max ${maxGapHours}h)`;
            }
            // Verifica 3: Nessuna kline trovata
            else if (lastKlineTime === null) {
                isHealthy = false;
                issue = 'Nessuna kline trovata';
            }
            // Verifica 4: Dati storici (solo se non ci sono klines recenti sufficienti)
            // Se ci sono klines recenti, i dati storici sono meno critici
            else if (count < minTotal && recent < minRecent * 2) {
                // Solo se non ci sono abbastanza klines recenti, verifica i dati storici
                // Questo permette a simboli nuovi di essere considerati OK se l'aggregatore funziona
                isHealthy = false;
                issue = `Dati insufficienti: ${count} klines (minimo ${minTotal}), ma aggregatore funziona (${recent} recenti)`;
            }

            return {
                healthy: isHealthy,
                totalKlines: count,
                recentKlines: recent,
                lastKlineTime: lastKlineTime ? new Date(lastKlineTime).toISOString() : null,
                gapHours: gapHours ? gapHours.toFixed(1) : null,
                issue
            };
        } catch (error) {
            return {
                healthy: false,
                issue: `Errore verifica: ${error.message}`,
                error: error.message
            };
        }
    }

    /**
     * Verifica klines recenti (ultima ora) - controllo rapido
     */
    async checkRecentKlines() {
        try {
            const oneHourAgo = Date.now() - (60 * 60 * 1000);
            const recentKlines = await dbGet(
                `SELECT COUNT(*) as count 
                 FROM klines 
                 WHERE interval = '15m' 
                   AND open_time > $1`,
                [oneHourAgo]
            );

            const count = parseInt(recentKlines?.count || 0);
            const expected = 4; // 4 klines in un'ora (ogni 15 min)
            const isWorking = count >= expected - 1; // Tolleranza -1

            return {
                healthy: isWorking,
                klinesLastHour: count,
                expected,
                message: isWorking 
                    ? `Aggregatore funziona (${count} klines ultima ora)`
                    : `Aggregatore non crea klines (${count}/${expected} ultima ora)`
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message,
                message: `Errore verifica klines recenti: ${error.message}`
            };
        }
    }

    /**
     * Restituisce il numero minimo di klines recenti richiesto per intervallo
     */
    getMinRecentForInterval(interval) {
        const map = {
            '15m': 20,  // ~20 klines in 24h (ogni 15 min)
            '1h': 20,   // 24 klines in 24h
            '4h': 5     // 6 klines in 24h
        };
        return map[interval] || 10;
    }

    /**
     * Restituisce il gap massimo accettabile per intervallo (in ore)
     */
    getMaxGapForInterval(interval) {
        const map = {
            '15m': 2,   // Max 2 ore di gap per 15m
            '1h': 4,    // Max 4 ore di gap per 1h
            '4h': 8     // Max 8 ore di gap per 4h
        };
        return map[interval] || 4;
    }
}

module.exports = new KlinesVerificationService();
