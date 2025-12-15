/**
 * 🔍 VERIFICA SETUP COMPLETO
 * 
 * Verifica che tutto sia configurato correttamente per sistema WebSocket Zero Ban
 */

const http = require('http');
const { dbGet, dbAll } = require('../crypto_db');

const log = {
    info: (msg) => console.log(`ℹ️  ${msg}`),
    success: (msg) => console.log(`✅ ${msg}`),
    warn: (msg) => console.warn(`⚠️  ${msg}`),
    error: (msg) => console.error(`❌ ${msg}`),
    section: (msg) => console.log(`\n${'='.repeat(80)}\n📊 ${msg}\n${'='.repeat(80)}`)
};

async function checkBackend() {
    return new Promise((resolve) => {
        const port = process.env.PORT || 3001;
        const url = `http://localhost:${port}/api/health`;
        
        const req = http.get(url, { timeout: 5000 }, (res) => {
            resolve({ running: res.statusCode === 200 });
        });
        
        req.on('error', () => resolve({ running: false }));
        req.on('timeout', () => { req.destroy(); resolve({ running: false }); });
    });
}

async function checkWebSocket() {
    try {
        const recentUpdates = await dbGet(
            `SELECT COUNT(*) as count 
             FROM price_history 
             WHERE timestamp > NOW() - INTERVAL '5 minutes'`
        );
        
        const lastUpdate = await dbGet(
            `SELECT symbol, price, timestamp 
             FROM price_history 
             ORDER BY timestamp DESC LIMIT 1`
        );
        
        return {
            active: parseInt(recentUpdates?.count || 0) > 0,
            updatesLast5Min: parseInt(recentUpdates?.count || 0),
            lastUpdate: lastUpdate
        };
    } catch (error) {
        return { active: false, error: error.message };
    }
}

async function checkAggregator() {
    try {
        const recentKlines = await dbGet(
            `SELECT COUNT(*) as count 
             FROM klines 
             WHERE interval = '15m' 
               AND open_time > $1`,
            [Date.now() - (24 * 60 * 60 * 1000)]
        );
        
        const lastKline = await dbGet(
            `SELECT symbol, open_time, close_price 
             FROM klines 
             WHERE interval = '15m' 
             ORDER BY open_time DESC LIMIT 1`
        );
        
        return {
            working: parseInt(recentKlines?.count || 0) > 0,
            klinesLast24h: parseInt(recentKlines?.count || 0),
            lastKline: lastKline
        };
    } catch (error) {
        return { working: false, error: error.message };
    }
}

async function main() {
    try {
        log.section('VERIFICA SETUP SISTEMA WEBSOCKET ZERO BAN');

        // 1. Backend
        log.section('1. BACKEND');
        const backend = await checkBackend();
        if (backend.running) {
            log.success('Backend in esecuzione');
        } else {
            log.error('Backend NON in esecuzione');
            console.log('   ❌ BLOCCO: WebSocket e Aggregatore non possono funzionare senza backend');
        }

        // 2. WebSocket
        log.section('2. WEBSOCKET');
        const ws = await checkWebSocket();
        if (ws.error) {
            log.error(`Errore: ${ws.error}`);
        } else if (ws.active) {
            log.success('WebSocket ATTIVO e salva dati');
            console.log(`   • Aggiornamenti ultimi 5 minuti: ${ws.updatesLast5Min}`);
            if (ws.lastUpdate) {
                console.log(`   • Ultimo: ${ws.lastUpdate.symbol} = $${parseFloat(ws.lastUpdate.price).toFixed(2)}`);
                console.log(`   • Quando: ${ws.lastUpdate.timestamp}`);
            }
        } else {
            log.warn('WebSocket NON attivo');
            console.log(`   • Aggiornamenti ultimi 5 minuti: ${ws.updatesLast5Min}`);
            if (ws.lastUpdate) {
                const lastTime = new Date(ws.lastUpdate.timestamp).getTime();
                const hoursAgo = ((Date.now() - lastTime) / (1000 * 60 * 60)).toFixed(1);
                console.log(`   • Ultimo aggiornamento: ${hoursAgo} ore fa`);
            }
        }

        // 3. Aggregatore Klines
        log.section('3. AGGREGATORE KLINES');
        const agg = await checkAggregator();
        if (agg.error) {
            log.error(`Errore: ${agg.error}`);
        } else if (agg.working) {
            log.success('Aggregatore FUNZIONA e crea klines');
            console.log(`   • Klines create ultime 24 ore: ${agg.klinesLast24h}`);
            if (agg.lastKline) {
                const klineTime = parseInt(agg.lastKline.open_time);
                const hoursAgo = ((Date.now() - klineTime) / (1000 * 60 * 60)).toFixed(1);
                console.log(`   • Ultima kline: ${agg.lastKline.symbol} @ ${new Date(klineTime).toISOString()}`);
                console.log(`   • Età: ${hoursAgo} ore fa`);
            }
        } else {
            log.warn('Aggregatore non ha creato klines recenti');
            console.log(`   • Klines ultime 24 ore: ${agg.klinesLast24h}`);
            if (agg.lastKline) {
                const klineTime = parseInt(agg.lastKline.open_time);
                const hoursAgo = ((Date.now() - klineTime) / (1000 * 60 * 60)).toFixed(1);
                console.log(`   • Ultima kline: ${hoursAgo} ore fa`);
            }
        }

        // 4. Diagnosi
        log.section('4. DIAGNOSI SISTEMA');

        if (!backend.running) {
            console.log('🔴 PROBLEMA PRINCIPALE: Backend non in esecuzione\n');
            console.log('   Senza backend:');
            console.log('   ❌ WebSocket non può connettersi');
            console.log('   ❌ Aggregatore non può funzionare');
            console.log('   ❌ Sistema non può evitare ban (dipende da REST API)\n');
            console.log('   SOLUZIONE:');
            console.log('   → Avvia backend: pm2 start ecosystem.config.js --only ticketapp-backend');
        } else if (!ws.active) {
            console.log('⚠️  Backend attivo ma WebSocket non salva dati\n');
            console.log('   Possibili cause:');
            console.log('   1. WebSocket non connesso (verifica log)');
            console.log('   2. Problema salvataggio database\n');
            console.log('   SOLUZIONE:');
            console.log('   → Verifica log: pm2 logs ticketapp-backend | grep WEBSOCKET');
            console.log('   → Riavvia backend: pm2 restart ticketapp-backend');
        } else if (!agg.working) {
            console.log('⚠️  WebSocket attivo ma Aggregatore non crea klines\n');
            console.log('   Possibili cause:');
            console.log('   1. Aggregatore non avviato (verifica log)');
            console.log('   2. Price_history insufficienti (attendi 15 minuti)\n');
            console.log('   SOLUZIONE:');
            console.log('   → Attendi 15 minuti dopo avvio');
            console.log('   → Verifica log: pm2 logs ticketapp-backend | grep AGGREGATOR');
        } else {
            console.log('🎉 TUTTO FUNZIONA PERFETTAMENTE!\n');
            console.log('   Sistema WebSocket Zero Ban attivo:');
            console.log('   ✅ Backend in esecuzione');
            console.log('   ✅ WebSocket salva prezzi');
            console.log('   ✅ Aggregatore crea klines');
            console.log('   ✅ Zero chiamate REST API');
            console.log('   ✅ Zero possibilità di ban\n');
            console.log('   Il bot può operare completamente senza REST API!');
        }

        // 5. Statistiche
        log.section('5. STATISTICHE');
        
        const totalPriceHistory = await dbGet(`SELECT COUNT(*) as count FROM price_history`);
        const totalKlines = await dbGet(`SELECT COUNT(*) as count FROM klines WHERE interval = '15m'`);
        
        console.log(`   • Prezzi salvati (price_history): ${parseInt(totalPriceHistory?.count || 0).toLocaleString()}`);
        console.log(`   • Klines create (15m): ${parseInt(totalKlines?.count || 0).toLocaleString()}`);

        console.log('\n' + '='.repeat(80) + '\n');
        process.exit(0);
    } catch (error) {
        log.error(`Errore: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
    }
}

main();



