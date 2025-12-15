/**
 * 🔍 VERIFICA SISTEMA COMPLETA
 * 
 * Verifica approfondita per capire perché ci sono gap:
 * - Stato backend/PM2
 * - Stato WebSocket
 * - Connessione database
 * - Connessione Binance
 * - Log errori recenti
 */

const { dbAll, dbGet } = require('../crypto_db');
const { execSync } = require('child_process');
const https = require('https');

const log = {
    info: (msg) => console.log(`ℹ️  ${msg}`),
    success: (msg) => console.log(`✅ ${msg}`),
    warn: (msg) => console.warn(`⚠️  ${msg}`),
    error: (msg) => console.error(`❌ ${msg}`),
    section: (msg) => console.log(`\n${'='.repeat(80)}\n📊 ${msg}\n${'='.repeat(80)}`)
};

async function checkPM2Status() {
    try {
        const output = execSync('pm2 list', { encoding: 'utf8', timeout: 5000 });
        return {
            available: true,
            output: output,
            hasBackend: output.includes('ticketapp-backend') || output.includes('backend')
        };
    } catch (error) {
        return {
            available: false,
            error: error.message
        };
    }
}

async function checkBackendHealth() {
    try {
        return new Promise((resolve) => {
            const req = https.get('https://api.binance.com/api/v3/ping', { timeout: 5000 }, (res) => {
                resolve({
                    reachable: res.statusCode === 200,
                    statusCode: res.statusCode
                });
            });
            req.on('error', () => resolve({ reachable: false, error: 'Connection failed' }));
            req.on('timeout', () => {
                req.destroy();
                resolve({ reachable: false, error: 'Timeout' });
            });
        });
    } catch (error) {
        return { reachable: false, error: error.message };
    }
}

async function checkBinanceAPI() {
    try {
        return new Promise((resolve) => {
            const req = https.get('https://api.binance.com/api/v3/ping', { timeout: 5000 }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    resolve({
                        reachable: res.statusCode === 200,
                        statusCode: res.statusCode,
                        response: data
                    });
                });
            });
            req.on('error', (err) => resolve({ reachable: false, error: err.message }));
            req.on('timeout', () => {
                req.destroy();
                resolve({ reachable: false, error: 'Timeout' });
            });
        });
    } catch (error) {
        return { reachable: false, error: error.message };
    }
}

async function checkDatabaseConnection() {
    try {
        const result = await dbGet('SELECT NOW() as now, version() as version');
        return {
            connected: true,
            timestamp: result.now,
            version: result.version?.substring(0, 50) || 'Unknown'
        };
    } catch (error) {
        return {
            connected: false,
            error: error.message
        };
    }
}

async function checkWebSocketActivity() {
    try {
        const recentUpdates = await dbGet(
            `SELECT COUNT(*) as count 
             FROM price_history 
             WHERE timestamp > NOW() - INTERVAL '1 hour'`
        );
        
        const veryRecentUpdates = await dbGet(
            `SELECT COUNT(*) as count 
             FROM price_history 
             WHERE timestamp > NOW() - INTERVAL '10 minutes'`
        );

        const lastUpdate = await dbGet(
            `SELECT MAX(timestamp) as last_update 
             FROM price_history`
        );

        return {
            updatesLastHour: parseInt(recentUpdates?.count || 0),
            updatesLast10Min: parseInt(veryRecentUpdates?.count || 0),
            lastUpdate: lastUpdate?.last_update || null,
            isActive: parseInt(veryRecentUpdates?.count || 0) > 0
        };
    } catch (error) {
        return { error: error.message, isActive: false };
    }
}

async function checkRecentKlinesUpdates() {
    try {
        const KLINE_INTERVAL = '15m';
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);

        const lastHour = await dbGet(
            `SELECT COUNT(*) as count 
             FROM klines 
             WHERE interval = $1 AND open_time >= $2`,
            [KLINE_INTERVAL, oneHourAgo]
        );

        const lastDay = await dbGet(
            `SELECT COUNT(*) as count 
             FROM klines 
             WHERE interval = $1 AND open_time >= $2`,
            [KLINE_INTERVAL, oneDayAgo]
        );

        const lastKline = await dbGet(
            `SELECT symbol, open_time 
             FROM klines 
             WHERE interval = $1 
             ORDER BY open_time DESC LIMIT 1`,
            [KLINE_INTERVAL]
        );

        return {
            lastHour: parseInt(lastHour?.count || 0),
            lastDay: parseInt(lastDay?.count || 0),
            lastKline: lastKline ? {
                symbol: lastKline.symbol,
                time: new Date(parseInt(lastKline.open_time)).toISOString(),
                hoursAgo: ((Date.now() - parseInt(lastKline.open_time)) / (1000 * 60 * 60)).toFixed(1)
            } : null
        };
    } catch (error) {
        return { error: error.message };
    }
}

async function checkSystemStatus() {
    try {
        const status = await dbGet(
            `SELECT status_value, last_updated 
             FROM system_status 
             WHERE status_key = 'klines_recovery_in_progress'`
        );
        return {
            recoveryInProgress: status?.status_value === 'true',
            lastUpdated: status?.last_updated || null
        };
    } catch (error) {
        return { error: error.message };
    }
}

async function main() {
    try {
        log.section('VERIFICA SISTEMA COMPLETA');

        // 1. PM2 Status
        log.section('1. STATO PM2 / BACKEND');
        const pm2Status = await checkPM2Status();
        if (pm2Status.available) {
            log.success('PM2 disponibile');
            if (pm2Status.hasBackend) {
                log.success('Backend trovato in PM2');
            } else {
                log.warn('Backend NON trovato in PM2');
            }
            console.log('\nOutput PM2:');
            console.log(pm2Status.output);
        } else {
            log.error('PM2 non disponibile o errore');
            console.log(`Errore: ${pm2Status.error}`);
        }

        // 2. Database Connection
        log.section('2. CONNESSIONE DATABASE');
        const dbStatus = await checkDatabaseConnection();
        if (dbStatus.connected) {
            log.success('Database connesso');
            console.log(`   • Timestamp: ${dbStatus.timestamp}`);
            console.log(`   • Versione: ${dbStatus.version}`);
        } else {
            log.error('Database NON connesso');
            console.log(`   • Errore: ${dbStatus.error}`);
        }

        // 3. Binance API
        log.section('3. CONNESSIONE BINANCE API');
        const binanceStatus = await checkBinanceAPI();
        if (binanceStatus.reachable) {
            log.success('Binance API raggiungibile');
            console.log(`   • Status Code: ${binanceStatus.statusCode}`);
        } else {
            log.error('Binance API NON raggiungibile');
            console.log(`   • Errore: ${binanceStatus.error}`);
        }

        // 4. WebSocket Activity
        log.section('4. ATTIVITÀ WEBSOCKET');
        const wsActivity = await checkWebSocketActivity();
        if (wsActivity.error) {
            log.error(`Errore verifica WebSocket: ${wsActivity.error}`);
        } else {
            if (wsActivity.isActive) {
                log.success('WebSocket ATTIVO');
            } else {
                log.warn('WebSocket NON ATTIVO');
            }
            console.log(`   • Aggiornamenti ultimi 10 minuti: ${wsActivity.updatesLast10Min}`);
            console.log(`   • Aggiornamenti ultima ora: ${wsActivity.updatesLastHour}`);
            if (wsActivity.lastUpdate) {
                const lastUpdateTime = new Date(wsActivity.lastUpdate).getTime();
                const hoursAgo = ((Date.now() - lastUpdateTime) / (1000 * 60 * 60)).toFixed(1);
                console.log(`   • Ultimo aggiornamento: ${wsActivity.lastUpdate} (${hoursAgo} ore fa)`);
            }
        }

        // 5. Klines Updates
        log.section('5. AGGIORNAMENTI KLINES');
        const klinesStatus = await checkRecentKlinesUpdates();
        if (klinesStatus.error) {
            log.error(`Errore verifica klines: ${klinesStatus.error}`);
        } else {
            console.log(`   • Klines ultima ora: ${klinesStatus.lastHour}`);
            console.log(`   • Klines ultime 24 ore: ${klinesStatus.lastDay}`);
            if (klinesStatus.lastKline) {
                console.log(`   • Ultima kline: ${klinesStatus.lastKline.symbol} - ${klinesStatus.lastKline.time} (${klinesStatus.lastKline.hoursAgo} ore fa)`);
                if (parseFloat(klinesStatus.lastKline.hoursAgo) > 24) {
                    log.warn('⚠️  Nessun aggiornamento klines da più di 24 ore!');
                }
            } else {
                log.warn('⚠️  Nessuna kline trovata nel database');
            }
        }

        // 6. System Status
        log.section('6. STATO SISTEMA');
        const systemStatus = await checkSystemStatus();
        if (systemStatus.error) {
            log.warn(`Errore lettura system_status: ${systemStatus.error}`);
        } else {
            if (systemStatus.recoveryInProgress) {
                log.warn('⚠️  Recovery in corso (aperture nuove posizioni bloccate)');
                console.log(`   • Ultimo aggiornamento: ${systemStatus.lastUpdated}`);
            } else {
                log.success('Sistema operativo (recovery non in corso)');
            }
        }

        // 7. Diagnosi finale
        log.section('7. DIAGNOSI FINALE');

        const issues = [];
        const recommendations = [];

        if (!dbStatus.connected) {
            issues.push('❌ Database non connesso');
            recommendations.push('→ Verifica connessione database e credenziali');
        }

        if (!binanceStatus.reachable) {
            issues.push('❌ Binance API non raggiungibile');
            recommendations.push('→ Verifica connessione internet o firewall');
        }

        if (!wsActivity.isActive) {
            issues.push('⚠️  WebSocket non attivo');
            recommendations.push('→ Verifica che il backend sia in esecuzione e che il WebSocket si connetta');
        }

        if (klinesStatus.lastKline && parseFloat(klinesStatus.lastKline.hoursAgo) > 24) {
            issues.push('⚠️  Nessun aggiornamento klines da più di 24 ore');
            recommendations.push('→ Il sistema di download klines è fermo - esegui recovery');
        }

        if (issues.length === 0) {
            log.success('✅ Nessun problema critico rilevato');
        } else {
            console.log('\n🔴 PROBLEMI RILEVATI:');
            issues.forEach(issue => console.log(`   ${issue}`));
        }

        if (recommendations.length > 0) {
            console.log('\n💡 RACCOMANDAZIONI:');
            recommendations.forEach(rec => console.log(`   ${rec}`));
        }

        // 8. Prossimi passi
        console.log('\n' + '='.repeat(80));
        console.log('📋 PROSSIMI PASSI:');
        console.log('='.repeat(80));
        console.log('\n1. Se WebSocket non attivo:');
        console.log('   → Verifica backend: pm2 status');
        console.log('   → Riavvia backend: pm2 restart ticketapp-backend');
        console.log('\n2. Se klines non aggiornate:');
        console.log('   → Esegui recovery: node backend/scripts/recupera-gap-immediato.js');
        console.log('\n3. Per monitoraggio continuo:');
        console.log('   → Attiva monitor: pm2 start ecosystem-klines-monitor.config.js');

        console.log('\n' + '='.repeat(80) + '\n');
        process.exit(0);
    } catch (error) {
        log.error(`Errore generale: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
    }
}

main();


