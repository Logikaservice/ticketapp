/**
 * 🔍 VERIFICA WEBSOCKET BACKEND
 * 
 * Verifica se il backend è in esecuzione e se il WebSocket è attivo
 */

const http = require('http');

const log = {
    info: (msg) => console.log(`ℹ️  ${msg}`),
    success: (msg) => console.log(`✅ ${msg}`),
    warn: (msg) => console.warn(`⚠️  ${msg}`),
    error: (msg) => console.error(`❌ ${msg}`),
    section: (msg) => console.log(`\n${'='.repeat(80)}\n📊 ${msg}\n${'='.repeat(80)}`)
};

async function checkBackendHealth() {
    return new Promise((resolve) => {
        const port = process.env.PORT || 3001;
        const url = `http://localhost:${port}/api/health`;
        
        const req = http.get(url, { timeout: 5000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    running: res.statusCode === 200,
                    statusCode: res.statusCode,
                    response: data
                });
            });
        });
        
        req.on('error', (err) => {
            resolve({ running: false, error: err.message });
        });
        
        req.on('timeout', () => {
            req.destroy();
            resolve({ running: false, error: 'Timeout' });
        });
    });
}

async function checkWebSocketInBackend() {
    try {
        const { dbGet } = require('../crypto_db');
        
        // Verifica se ci sono aggiornamenti recenti da WebSocket
        const recentUpdates = await dbGet(
            `SELECT COUNT(*) as count 
             FROM price_history 
             WHERE timestamp > NOW() - INTERVAL '10 minutes'`
        );
        
        const lastUpdate = await dbGet(
            `SELECT MAX(timestamp) as last_update 
             FROM price_history`
        );
        
        return {
            updatesLast10Min: parseInt(recentUpdates?.count || 0),
            lastUpdate: lastUpdate?.last_update || null,
            isActive: parseInt(recentUpdates?.count || 0) > 0
        };
    } catch (error) {
        return { error: error.message, isActive: false };
    }
}

async function main() {
    try {
        log.section('VERIFICA WEBSOCKET E BACKEND');

        // 1. Verifica backend
        log.section('1. STATO BACKEND');
        const backendStatus = await checkBackendHealth();
        if (backendStatus.running) {
            log.success('Backend in esecuzione');
            console.log(`   • Status Code: ${backendStatus.statusCode}`);
        } else {
            log.error('Backend NON in esecuzione');
            console.log(`   • Errore: ${backendStatus.error || 'Sconosciuto'}`);
            console.log(`   • Il WebSocket non può essere attivo se il backend non è in esecuzione`);
        }

        // 2. Verifica WebSocket activity
        log.section('2. ATTIVITÀ WEBSOCKET');
        const wsActivity = await checkWebSocketInBackend();
        if (wsActivity.error) {
            log.error(`Errore verifica WebSocket: ${wsActivity.error}`);
        } else {
            if (wsActivity.isActive) {
                log.success('WebSocket ATTIVO');
            } else {
                log.warn('WebSocket NON ATTIVO');
            }
            console.log(`   • Aggiornamenti ultimi 10 minuti: ${wsActivity.updatesLast10Min}`);
            if (wsActivity.lastUpdate) {
                const lastUpdateTime = new Date(wsActivity.lastUpdate).getTime();
                const hoursAgo = ((Date.now() - lastUpdateTime) / (1000 * 60 * 60)).toFixed(1);
                console.log(`   • Ultimo aggiornamento: ${wsActivity.lastUpdate} (${hoursAgo} ore fa)`);
            }
        }

        // 3. Diagnosi
        log.section('3. DIAGNOSI');
        
        if (!backendStatus.running) {
            console.log('🔴 PROBLEMA: Backend non in esecuzione');
            console.log('   → Il WebSocket viene inizializzato solo quando il backend è attivo');
            console.log('   → Avvia il backend: pm2 start ecosystem.config.js --only ticketapp-backend');
            console.log('   → Oppure: node backend/index.js');
        } else if (!wsActivity.isActive) {
            console.log('⚠️  PROBLEMA: Backend attivo ma WebSocket non aggiorna dati');
            console.log('   → Possibili cause:');
            console.log('     1. WebSocket non si connette (verifica log backend)');
            console.log('     2. WebSocket connesso ma non riceve dati');
            console.log('     3. Problema salvataggio nel database');
            console.log('   → Verifica log: pm2 logs ticketapp-backend | grep WEBSOCKET');
        } else {
            console.log('✅ Tutto OK: Backend attivo e WebSocket funziona');
        }

        console.log('\n' + '='.repeat(80) + '\n');
        process.exit(0);
    } catch (error) {
        log.error(`Errore generale: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
    }
}

main();

