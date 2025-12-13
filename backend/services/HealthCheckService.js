/**
 * 🏥 HEALTH CHECK SERVICE
 * 
 * Monitora stato sistema e previene blocchi
 * Controlla: Backend, WebSocket, Aggregatore, Database, Backup
 */

const { dbGet } = require('../crypto_db');
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
            overall: 'unknown'
        };

        // Determina stato generale
        const criticalIssues = [];
        if (!status.backend.healthy) criticalIssues.push('Backend offline');
        if (!status.database.healthy) criticalIssues.push('Database inaccessibile');
        if (!status.websocket.healthy) criticalIssues.push('WebSocket inattivo');
        if (!status.aggregator.healthy) criticalIssues.push('Aggregatore non funziona');
        if (!status.backup.healthy) criticalIssues.push('Backup database non recente');

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
     */
    async checkAggregator() {
        try {
            // Verifica klines recenti (ultima ora)
            const recentKlines = await dbGet(
                `SELECT COUNT(*) as count 
                 FROM klines 
                 WHERE interval = '15m' 
                   AND open_time > $1`,
                [Date.now() - (60 * 60 * 1000)]
            );

            const count = parseInt(recentKlines?.count || 0);
            const expected = 4; // 4 klines in un'ora (ogni 15 min)
            const isWorking = count >= expected - 1; // Tolleranza -1

            if (isWorking) {
                return {
                    healthy: true,
                    working: true,
                    klinesLastHour: count,
                    message: `Aggregatore funziona (${count} klines ultima ora)`
                };
            }

            return {
                healthy: false,
                working: false,
                klinesLastHour: count,
                expected,
                message: `Aggregatore non crea klines (${count}/${expected} ultima ora)`
            };
        } catch (error) {
            return {
                healthy: false,
                working: false,
                error: error.message,
                message: 'Errore verifica aggregatore'
            };
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
