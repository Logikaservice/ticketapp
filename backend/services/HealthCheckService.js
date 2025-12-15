/**
 * 🏥 HEALTH CHECK SERVICE
 * 
 * Monitora stato sistema e previene blocchi
 * Controlla: Backend, WebSocket, Aggregatore, Database, Backup
 */

const { dbGet, dbAll } = require('../crypto_db');
const http = require('http');
const BackupService = require('./BackupService');

class HealthCheckService {
    constructor() {
        this.checkInterval = null;
        this.isRunning = false;
        this.lastStatus = null;
        this.alertCallback = null;
        this.autoFixAttempts = 0;
        this.maxAutoFixAttempts = 3;
    }

    /**
     * Avvia monitoring continuo
     */
    start(intervalMinutes = 5, alertCallback = null) {
        if (this.isRunning) {
            console.log('⚠️  [HEALTH-CHECK] Già in esecuzione');
            return;
        }

        this.isRunning = true;
        this.alertCallback = alertCallback;
        
        console.log('🏥 [HEALTH-CHECK] Avvio monitoring');
        console.log(`   • Intervallo: ${intervalMinutes} minuti`);

        // Verifica immediata
        this.performCheck().catch(err => {
            console.error('❌ [HEALTH-CHECK] Errore prima verifica:', err.message);
        });

        // Poi periodicamente
        this.checkInterval = setInterval(() => {
            this.performCheck().catch(err => {
                console.error('❌ [HEALTH-CHECK] Errore verifica periodica:', err.message);
            });
        }, intervalMinutes * 60 * 1000);

        console.log('✅ [HEALTH-CHECK] Monitoring attivato');
    }

    /**
     * Ferma monitoring
     */
    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        this.isRunning = false;
        console.log('🛑 [HEALTH-CHECK] Monitoring fermato');
    }

    /**
     * Esegue verifica completa
     */
    async performCheck() {
        const timestamp = new Date().toISOString();
        console.log(`\n[${timestamp}] 🔍 [HEALTH-CHECK] Inizio verifica...`);

        const status = {
            timestamp,
            backend: await this.checkBackend(),
            database: await this.checkDatabase(),
            websocket: await this.checkWebSocket(),
            aggregator: await this.checkAggregator(),
            backup: await this.checkBackup(),
            // ✅ NUOVI CONTROLLI DATI
            dataKlines: await this.checkKlinesCount(),
            dataPriceHistory: await this.checkPriceHistoryCount(),
            dataGaps: await this.checkDataGaps(),
            dataAnomalousPrices: await this.checkAnomalousPrices(),
            overall: 'unknown'
        };

        // Determina stato generale
        const criticalIssues = [];
        if (!status.backend.healthy) criticalIssues.push('Backend offline');
        if (!status.database.healthy) criticalIssues.push('Database inaccessibile');
        if (!status.websocket.healthy) criticalIssues.push('WebSocket inattivo');
        if (!status.aggregator.healthy) criticalIssues.push('Aggregatore non funziona');
        if (!status.backup.healthy) criticalIssues.push('Backup database non recente');
        
        // ✅ NUOVI CONTROLLI DATI - Aggiungi ai problemi critici
        if (!status.dataKlines.healthy) {
            criticalIssues.push(`Klines insufficienti: ${status.dataKlines.symbolsWithIssues?.length || 0} simboli`);
        }
        if (!status.dataPriceHistory.healthy) {
            criticalIssues.push(`Price history insufficiente: ${status.dataPriceHistory.symbolsWithIssues?.length || 0} simboli`);
        }
        if (!status.dataGaps.healthy) {
            criticalIssues.push(`Gap temporali rilevati: ${status.dataGaps.totalGaps || 0} gap in ${status.dataGaps.symbolsWithGaps?.length || 0} simboli`);
        }
        if (!status.dataAnomalousPrices.healthy) {
            criticalIssues.push(`Prezzi anomali rilevati: ${status.dataAnomalousPrices.totalAnomalies || 0} in ${status.dataAnomalousPrices.symbolsWithAnomalies?.length || 0} simboli`);
        }

        status.overall = criticalIssues.length === 0 ? 'healthy' : 'unhealthy';
        status.criticalIssues = criticalIssues;

        this.lastStatus = status;

        // Log risultati
        this.logStatus(status);

        // Gestisci problemi
        if (status.overall === 'unhealthy') {
            await this.handleUnhealthyState(status);
        } else {
            // Reset contatore tentativi se tutto ok
            this.autoFixAttempts = 0;
        }

        return status;
    }

    /**
     * Verifica backend attivo
     */
    async checkBackend() {
        try {
            const port = process.env.PORT || 3001;
            
            // Se siamo in questo processo, backend è attivo
            if (process.env.BACKEND_RUNNING === 'true') {
                return {
                    healthy: true,
                    running: true,
                    port,
                    message: 'Backend attivo (stesso processo)'
                };
            }

            // Altrimenti tenta connessione
            const result = await this.httpGet(`http://localhost:${port}/api/health`, 3000);
            return {
                healthy: true,
                running: true,
                port,
                statusCode: 200,
                message: 'Backend risponde'
            };
        } catch (error) {
            return {
                healthy: false,
                running: false,
                error: error.message,
                message: 'Backend non risponde'
            };
        }
    }

    /**
     * Verifica database accessibile
     */
    async checkDatabase() {
        try {
            const result = await dbGet('SELECT 1 as test');
            return {
                healthy: true,
                accessible: true,
                message: 'Database accessibile'
            };
        } catch (error) {
            return {
                healthy: false,
                accessible: false,
                error: error.message,
                message: 'Database non accessibile'
            };
        }
    }

    /**
     * Verifica WebSocket attivo e salva dati
     */
    async checkWebSocket() {
        try {
            // Verifica aggiornamenti recenti (ultimi 5 minuti)
            const recentUpdates = await dbGet(
                `SELECT COUNT(*) as count 
                 FROM price_history 
                 WHERE timestamp > NOW() - INTERVAL '5 minutes'`
            );

            const count = parseInt(recentUpdates?.count || 0);
            const isActive = count > 0;

            if (isActive) {
                return {
                    healthy: true,
                    active: true,
                    updatesLast5Min: count,
                    message: `WebSocket attivo (${count} aggiornamenti ultimi 5 min)`
                };
            }

            // WebSocket non attivo - verifica ultimo aggiornamento
            const lastUpdate = await dbGet(
                `SELECT MAX(timestamp) as last_update FROM price_history`
            );

            const lastTime = lastUpdate?.last_update ? new Date(lastUpdate.last_update).getTime() : 0;
            const hoursAgo = ((Date.now() - lastTime) / (1000 * 60 * 60)).toFixed(1);

            return {
                healthy: false,
                active: false,
                updatesLast5Min: 0,
                lastUpdate: hoursAgo,
                message: `WebSocket inattivo (ultimo aggiornamento ${hoursAgo} ore fa)`
            };
        } catch (error) {
            return {
                healthy: false,
                active: false,
                error: error.message,
                message: 'Errore verifica WebSocket'
            };
        }
    }

    /**
     * Verifica aggregatore crea klines
     * Usa KlinesVerificationService per verifica completa
     */
    async checkAggregator() {
        try {
            const KlinesVerificationService = require('./KlinesVerificationService');
            const verification = await KlinesVerificationService.verifyKlinesCompleteness();

            return {
                healthy: verification.healthy,
                working: verification.healthy,
                message: verification.message,
                details: verification.details
            };
        } catch (error) {
            // Fallback a verifica semplice se il servizio completo fallisce
            try {
                const recentKlines = await dbGet(
                    `SELECT COUNT(*) as count 
                     FROM klines 
                     WHERE interval = '15m' 
                       AND open_time > $1`,
                    [Date.now() - (60 * 60 * 1000)]
                );

                const count = parseInt(recentKlines?.count || 0);
                const expected = 4;
                const isWorking = count >= expected - 1;

                return {
                    healthy: isWorking,
                    working: isWorking,
                    klinesLastHour: count,
                    expected,
                    message: isWorking 
                        ? `Aggregatore funziona (${count} klines ultima ora)`
                        : `Aggregatore non crea klines (${count}/${expected} ultima ora)`,
                    fallback: true
                };
            } catch (fallbackError) {
                return {
                    healthy: false,
                    working: false,
                    error: error.message,
                    message: 'Errore verifica aggregatore'
                };
            }
        }
    }

    /**
     * Verifica stato backup database
     */
    async checkBackup() {
        try {
            const backupStatus = BackupService.getBackupStatus();
            return backupStatus;
        } catch (error) {
            return {
                healthy: false,
                active: false,
                error: error.message,
                message: 'Errore verifica backup'
            };
        }
    }

    /**
     * ✅ CONTROLLO 1: Verifica che tutti i simboli abbiano almeno 50 klines
     */
    async checkKlinesCount() {
        try {
            const SYMBOL_TO_PAIR = require('../routes/cryptoRoutes').SYMBOL_TO_PAIR || {};
            const MIN_KLINES_REQUIRED = 50;
            const KLINE_INTERVAL = '15m';

            const symbols = Object.keys(SYMBOL_TO_PAIR);
            const symbolsWithIssues = [];
            let totalKlines = 0;
            let symbolsOK = 0;

            for (const symbol of symbols) {
                try {
                    const result = await dbGet(
                        `SELECT COUNT(*) as count FROM klines WHERE symbol = $1 AND interval = $2`,
                        [symbol, KLINE_INTERVAL]
                    );
                    const count = parseInt(result?.count || 0);
                    totalKlines += count;

                    if (count < MIN_KLINES_REQUIRED) {
                        symbolsWithIssues.push({
                            symbol,
                            count,
                            required: MIN_KLINES_REQUIRED,
                            missing: MIN_KLINES_REQUIRED - count
                        });
                    } else {
                        symbolsOK++;
                    }
                } catch (error) {
                    symbolsWithIssues.push({
                        symbol,
                        error: error.message
                    });
                }
            }

            const isHealthy = symbolsWithIssues.length === 0;
            const avgKlines = symbols.length > 0 ? Math.floor(totalKlines / symbols.length) : 0;

            return {
                healthy: isHealthy,
                minRequired: MIN_KLINES_REQUIRED,
                symbolsChecked: symbols.length,
                symbolsOK,
                symbolsWithIssues: symbolsWithIssues.length,
                avgKlinesPerSymbol: avgKlines,
                details: symbolsWithIssues.slice(0, 10), // Primi 10 per non appesantire
                message: isHealthy
                    ? `Tutti i simboli hanno almeno ${MIN_KLINES_REQUIRED} klines (media: ${avgKlines})`
                    : `${symbolsWithIssues.length} simboli con klines insufficienti (< ${MIN_KLINES_REQUIRED})`
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message,
                message: 'Errore verifica conteggio klines'
            };
        }
    }

    /**
     * ✅ CONTROLLO 2: Verifica che tutti i simboli abbiano almeno 50 price_history
     */
    async checkPriceHistoryCount() {
        try {
            const SYMBOL_TO_PAIR = require('../routes/cryptoRoutes').SYMBOL_TO_PAIR || {};
            const MIN_PRICE_HISTORY_REQUIRED = 50;

            const symbols = Object.keys(SYMBOL_TO_PAIR);
            const symbolsWithIssues = [];
            let totalPriceHistory = 0;
            let symbolsOK = 0;

            for (const symbol of symbols) {
                try {
                    const result = await dbGet(
                        `SELECT COUNT(*) as count FROM price_history WHERE symbol = $1`,
                        [symbol]
                    );
                    const count = parseInt(result?.count || 0);
                    totalPriceHistory += count;

                    if (count < MIN_PRICE_HISTORY_REQUIRED) {
                        symbolsWithIssues.push({
                            symbol,
                            count,
                            required: MIN_PRICE_HISTORY_REQUIRED,
                            missing: MIN_PRICE_HISTORY_REQUIRED - count
                        });
                    } else {
                        symbolsOK++;
                    }
                } catch (error) {
                    symbolsWithIssues.push({
                        symbol,
                        error: error.message
                    });
                }
            }

            const isHealthy = symbolsWithIssues.length === 0;
            const avgPriceHistory = symbols.length > 0 ? Math.floor(totalPriceHistory / symbols.length) : 0;

            return {
                healthy: isHealthy,
                minRequired: MIN_PRICE_HISTORY_REQUIRED,
                symbolsChecked: symbols.length,
                symbolsOK,
                symbolsWithIssues: symbolsWithIssues.length,
                avgPriceHistoryPerSymbol: avgPriceHistory,
                details: symbolsWithIssues.slice(0, 10),
                message: isHealthy
                    ? `Tutti i simboli hanno almeno ${MIN_PRICE_HISTORY_REQUIRED} price_history (media: ${avgPriceHistory})`
                    : `${symbolsWithIssues.length} simboli con price_history insufficiente (< ${MIN_PRICE_HISTORY_REQUIRED})`
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message,
                message: 'Errore verifica conteggio price_history'
            };
        }
    }

    /**
     * ✅ CONTROLLO 3: Verifica gap temporali nei dati
     */
    async checkDataGaps() {
        try {
            const SYMBOL_TO_PAIR = require('../routes/cryptoRoutes').SYMBOL_TO_PAIR || {};
            const KLINE_INTERVAL = '15m';
            const KLINE_INTERVAL_MS = 15 * 60 * 1000; // 15 minuti

            const symbols = Object.keys(SYMBOL_TO_PAIR);
            const symbolsWithGaps = [];
            let totalGaps = 0;

            // Controlla solo i primi 20 simboli per performance (puoi aumentare se necessario)
            const symbolsToCheck = symbols.slice(0, 20);

            for (const symbol of symbolsToCheck) {
                try {
                    const klines = await dbAll(
                        `SELECT open_time FROM klines 
                         WHERE symbol = $1 AND interval = $2 
                         ORDER BY open_time ASC`,
                        [symbol, KLINE_INTERVAL]
                    );

                    if (klines.length < 2) continue;

                    const gaps = [];
                    for (let i = 1; i < klines.length; i++) {
                        const prevTime = parseInt(klines[i - 1].open_time);
                        const currTime = parseInt(klines[i].open_time);
                        const expectedTime = prevTime + KLINE_INTERVAL_MS;

                        // Gap se differenza > 1.5x l'intervallo (tolleranza per ritardi)
                        if (currTime - expectedTime > KLINE_INTERVAL_MS * 1.5) {
                            const missing = Math.floor((currTime - expectedTime) / KLINE_INTERVAL_MS);
                            gaps.push({
                                from: prevTime,
                                to: currTime,
                                missing
                            });
                        }
                    }

                    if (gaps.length > 0) {
                        totalGaps += gaps.length;
                        symbolsWithGaps.push({
                            symbol,
                            gapsCount: gaps.length,
                            gaps: gaps.slice(0, 5) // Primi 5 gap
                        });
                    }
                } catch (error) {
                    // Ignora errori singoli
                }
            }

            const isHealthy = totalGaps === 0;

            return {
                healthy: isHealthy,
                symbolsChecked: symbolsToCheck.length,
                totalGaps,
                symbolsWithGaps: symbolsWithGaps.length,
                details: symbolsWithGaps.slice(0, 10),
                message: isHealthy
                    ? `Nessun gap temporale rilevato (${symbolsToCheck.length} simboli verificati)`
                    : `${totalGaps} gap temporali rilevati in ${symbolsWithGaps.length} simboli`
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message,
                message: 'Errore verifica gap temporali'
            };
        }
    }

    /**
     * ✅ CONTROLLO 4: Verifica prezzi anomali
     */
    async checkAnomalousPrices() {
        try {
            const SYMBOL_TO_PAIR = require('../routes/cryptoRoutes').SYMBOL_TO_PAIR || {};
            const KLINE_INTERVAL = '15m';
            const MAX_PRICE = 100000;
            const MIN_PRICE = 0.000001;

            const symbols = Object.keys(SYMBOL_TO_PAIR);
            const symbolsWithAnomalies = [];
            let totalAnomalies = 0;

            // Controlla solo i primi 20 simboli per performance
            const symbolsToCheck = symbols.slice(0, 20);

            for (const symbol of symbolsToCheck) {
                try {
                    const klines = await dbAll(
                        `SELECT open_time, open_price, high_price, low_price, close_price 
                         FROM klines 
                         WHERE symbol = $1 AND interval = $2
                         ORDER BY open_time DESC LIMIT 100`,
                        [symbol, KLINE_INTERVAL]
                    );

                    const anomalies = [];
                    for (const kline of klines) {
                        const open = parseFloat(kline.open_price);
                        const high = parseFloat(kline.high_price);
                        const low = parseFloat(kline.low_price);
                        const close = parseFloat(kline.close_price);

                        // Verifica range prezzi
                        if (open > MAX_PRICE || open < MIN_PRICE ||
                            high > MAX_PRICE || high < MIN_PRICE ||
                            low > MAX_PRICE || low < MIN_PRICE ||
                            close > MAX_PRICE || close < MIN_PRICE) {
                            anomalies.push({
                                open_time: kline.open_time,
                                reason: 'Prezzo fuori range'
                            });
                            continue;
                        }

                        // Verifica che high >= low e close nel range
                        if (high < low || close > high || close < low) {
                            anomalies.push({
                                open_time: kline.open_time,
                                reason: 'Range invalido (high < low o close fuori range)'
                            });
                        }
                    }

                    if (anomalies.length > 0) {
                        totalAnomalies += anomalies.length;
                        symbolsWithAnomalies.push({
                            symbol,
                            anomaliesCount: anomalies.length,
                            anomalies: anomalies.slice(0, 5) // Primi 5
                        });
                    }
                } catch (error) {
                    // Ignora errori singoli
                }
            }

            const isHealthy = totalAnomalies === 0;

            return {
                healthy: isHealthy,
                symbolsChecked: symbolsToCheck.length,
                totalAnomalies,
                symbolsWithAnomalies: symbolsWithAnomalies.length,
                details: symbolsWithAnomalies.slice(0, 10),
                message: isHealthy
                    ? `Nessun prezzo anomalo rilevato (${symbolsToCheck.length} simboli verificati)`
                    : `${totalAnomalies} prezzi anomali rilevati in ${symbolsWithAnomalies.length} simboli`
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message,
                message: 'Errore verifica prezzi anomali'
            };
        }
    }

    /**
     * Gestisce stato non sano
     */
    async handleUnhealthyState(status) {
        console.log('🚨 [HEALTH-CHECK] SISTEMA NON SANO - Problemi rilevati:');
        status.criticalIssues.forEach(issue => {
            console.log(`   ❌ ${issue}`);
        });

        // Alert se configurato
        if (this.alertCallback) {
            try {
                await this.alertCallback(status);
            } catch (error) {
                console.error('❌ [HEALTH-CHECK] Errore alert:', error.message);
            }
        }

        // Registra in database
        await this.saveHealthLog(status);

        // Suggerimenti automatici
        console.log('\n💡 [HEALTH-CHECK] Suggerimenti:');
        if (!status.backend.healthy) {
            console.log('   → Backend offline: Avvia con "node backend/index.js"');
        }
        if (!status.websocket.healthy && status.backend.healthy) {
            console.log('   → WebSocket inattivo: Riavvia backend per riconnetterlo');
        }
        if (!status.aggregator.healthy && status.websocket.healthy) {
            console.log('   → Aggregatore inattivo: Verifica log backend per errori');
        }
    }

    /**
     * Log stato in console
     */
    logStatus(status) {
        console.log(`\n📊 [HEALTH-CHECK] Risultati:`);
        console.log(`   • Backend: ${status.backend.healthy ? '✅' : '❌'} ${status.backend.message}`);
        console.log(`   • Database: ${status.database.healthy ? '✅' : '❌'} ${status.database.message}`);
        console.log(`   • WebSocket: ${status.websocket.healthy ? '✅' : '❌'} ${status.websocket.message}`);
        console.log(`   • Aggregatore: ${status.aggregator.healthy ? '✅' : '❌'} ${status.aggregator.message}`);
        console.log(`   • Backup: ${status.backup.healthy ? '✅' : '⚠️ '} ${status.backup.message}`);
        // ✅ NUOVI CONTROLLI DATI
        if (status.dataKlines) {
            console.log(`   • Klines Count: ${status.dataKlines.healthy ? '✅' : '❌'} ${status.dataKlines.message}`);
        }
        if (status.dataPriceHistory) {
            console.log(`   • Price History Count: ${status.dataPriceHistory.healthy ? '✅' : '❌'} ${status.dataPriceHistory.message}`);
        }
        if (status.dataGaps) {
            console.log(`   • Data Gaps: ${status.dataGaps.healthy ? '✅' : '❌'} ${status.dataGaps.message}`);
        }
        if (status.dataAnomalousPrices) {
            console.log(`   • Anomalous Prices: ${status.dataAnomalousPrices.healthy ? '✅' : '❌'} ${status.dataAnomalousPrices.message}`);
        }
        console.log(`   • GENERALE: ${status.overall === 'healthy' ? '✅ SANO' : '🚨 PROBLEMI'}`);
    }

    /**
     * Salva log in database
     */
    async saveHealthLog(status) {
        try {
            const { dbRun } = require('../crypto_db');
            await dbRun(
                `INSERT INTO system_status (key, value, updated_at) 
                 VALUES ('health_check', $1, CURRENT_TIMESTAMP)
                 ON CONFLICT (key) 
                 DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
                [JSON.stringify(status)]
            );
        } catch (error) {
            // Ignora errori di salvataggio (se tabella non esiste)
        }
    }

    /**
     * Helper: HTTP GET con timeout
     */
    httpGet(url, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const req = http.get(url, { timeout }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve({ statusCode: res.statusCode, data }));
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        });
    }

    /**
     * Ottiene ultimo stato
     */
    getLastStatus() {
        return this.lastStatus;
    }

    /**
     * Verifica stato corrente (sincrono)
     */
    isHealthy() {
        if (!this.lastStatus) return null;
        return this.lastStatus.overall === 'healthy';
    }
}

module.exports = new HealthCheckService();
