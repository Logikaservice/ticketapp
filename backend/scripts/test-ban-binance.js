/**
 * 🔍 TEST BAN BINANCE E WEBSOCKET
 * 
 * Verifica se c'è un ban attivo e perché il WebSocket non funziona
 */

const https = require('https');
const WebSocket = require('ws');

const log = {
    info: (msg) => console.log(`ℹ️  ${msg}`),
    success: (msg) => console.log(`✅ ${msg}`),
    warn: (msg) => console.warn(`⚠️  ${msg}`),
    error: (msg) => console.error(`❌ ${msg}`),
    section: (msg) => console.log(`\n${'='.repeat(80)}\n📊 ${msg}\n${'='.repeat(80)}`)
};

async function testBinanceRESTAPI() {
    return new Promise((resolve) => {
        log.info('Test connessione REST API Binance...');
        
        const url = 'https://api.binance.com/api/v3/ping';
        const req = https.get(url, { timeout: 10000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    log.success(`REST API OK - Status: ${res.statusCode}`);
                    resolve({ banned: false, statusCode: res.statusCode });
                } else if (res.statusCode === 418) {
                    log.error(`🚫 IP BANNATO - Status: ${res.statusCode} (HTTP 418)`);
                    resolve({ banned: true, statusCode: res.statusCode, reason: 'HTTP 418' });
                } else {
                    log.warn(`Status inaspettato: ${res.statusCode}`);
                    resolve({ banned: false, statusCode: res.statusCode, warning: true });
                }
            });
        });
        
        req.on('error', (err) => {
            log.error(`Errore connessione: ${err.message}`);
            resolve({ banned: false, error: err.message });
        });
        
        req.on('timeout', () => {
            req.destroy();
            log.error('Timeout connessione REST API');
            resolve({ banned: false, error: 'Timeout' });
        });
    });
}

async function testBinanceKlinesAPI() {
    return new Promise((resolve) => {
        log.info('Test API Klines (endpoint che potrebbe essere bannato)...');
        
        const url = 'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=15m&limit=1';
        const req = https.get(url, { timeout: 10000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    
                    if (res.statusCode === 200 && Array.isArray(parsed)) {
                        log.success(`Klines API OK - Status: ${res.statusCode}`);
                        resolve({ banned: false, statusCode: res.statusCode });
                    } else if (res.statusCode === 418) {
                        log.error(`🚫 IP BANNATO su Klines - Status: ${res.statusCode} (HTTP 418)`);
                        resolve({ banned: true, statusCode: res.statusCode, reason: 'HTTP 418' });
                    } else if (parsed.code && parsed.msg) {
                        log.error(`Errore Binance: ${parsed.msg} (code: ${parsed.code})`);
                        if (parsed.code === -1022 || parsed.msg.includes('IP') || parsed.msg.includes('ban')) {
                            resolve({ banned: true, statusCode: res.statusCode, reason: parsed.msg });
                        } else {
                            resolve({ banned: false, statusCode: res.statusCode, error: parsed.msg });
                        }
                    } else {
                        log.warn(`Risposta inaspettata - Status: ${res.statusCode}`);
                        resolve({ banned: false, statusCode: res.statusCode, warning: true });
                    }
                } catch (e) {
                    log.error(`Errore parsing risposta: ${e.message}`);
                    resolve({ banned: false, error: e.message });
                }
            });
        });
        
        req.on('error', (err) => {
            log.error(`Errore connessione: ${err.message}`);
            resolve({ banned: false, error: err.message });
        });
        
        req.on('timeout', () => {
            req.destroy();
            log.error('Timeout connessione Klines API');
            resolve({ banned: false, error: 'Timeout' });
        });
    });
}

async function testBinanceWebSocket() {
    return new Promise((resolve) => {
        log.info('Test connessione WebSocket Binance...');
        
        let resolved = false;
        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                log.error('Timeout connessione WebSocket (10 secondi)');
                resolve({ connected: false, error: 'Timeout' });
            }
        }, 10000);
        
        try {
            const ws = new WebSocket('wss://stream.binance.com:9443/ws/!ticker@arr');
            
            ws.on('open', () => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    log.success('WebSocket CONNESSO!');
                    ws.close();
                    resolve({ connected: true });
                }
            });
            
            ws.on('error', (err) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    log.error(`Errore WebSocket: ${err.message}`);
                    resolve({ connected: false, error: err.message });
                }
            });
            
            ws.on('close', (code, reason) => {
                if (!resolved && code !== 1000) {
                    resolved = true;
                    clearTimeout(timeout);
                    log.warn(`WebSocket chiuso: ${code} - ${reason}`);
                    resolve({ connected: false, error: `Close code: ${code}` });
                }
            });
            
            ws.on('message', (data) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    log.success('WebSocket CONNESSO e riceve dati!');
                    try {
                        const tickers = JSON.parse(data.toString());
                        if (Array.isArray(tickers) && tickers.length > 0) {
                            log.success(`Ricevuti ${tickers.length} ticker`);
                        }
                    } catch (e) {
                        // Ignora errori parsing
                    }
                    ws.close();
                    resolve({ connected: true, receiving: true });
                }
            });
        } catch (error) {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                log.error(`Errore creazione WebSocket: ${error.message}`);
                resolve({ connected: false, error: error.message });
            }
        }
    });
}

async function checkDatabaseBanStatus() {
    try {
        const { dbGet } = require('./crypto_db');
        
        // Verifica se c'è un ban salvato nel sistema (se esiste una tabella per questo)
        // Per ora controlliamo solo se il sistema ha rilevato un ban
        log.info('Verifica stato ban nel sistema...');
        
        // Il ban è salvato in memoria in rateLimitErrors, non nel DB
        // Quindi non possiamo verificarlo direttamente dal DB
        log.warn('Ban status è salvato in memoria (rateLimitErrors) - non verificabile da script standalone');
        
        return { found: false, note: 'Ban status in memoria' };
    } catch (error) {
        log.error(`Errore verifica DB: ${error.message}`);
        return { found: false, error: error.message };
    }
}

async function main() {
    try {
        log.section('TEST BAN BINANCE E WEBSOCKET');

        // 1. Test REST API Ping
        log.section('1. TEST REST API PING');
        const pingResult = await testBinanceRESTAPI();
        
        // 2. Test REST API Klines
        log.section('2. TEST REST API KLINES');
        const klinesResult = await testBinanceKlinesAPI();
        
        // 3. Test WebSocket
        log.section('3. TEST WEBSOCKET');
        const wsResult = await testBinanceWebSocket();
        
        // 4. Verifica Database
        log.section('4. VERIFICA STATO BAN NEL SISTEMA');
        const dbBanStatus = await checkDatabaseBanStatus();
        
        // 5. Diagnosi finale
        log.section('5. DIAGNOSI FINALE');
        
        const isBanned = pingResult.banned || klinesResult.banned;
        
        if (isBanned) {
            log.error('🚫 IP BANNATO DA BINANCE');
            console.log(`   • REST API Ping: ${pingResult.banned ? 'BANNATO' : 'OK'}`);
            console.log(`   • REST API Klines: ${klinesResult.banned ? 'BANNATO' : 'OK'}`);
        } else {
            log.success('✅ IP NON BANNATO (REST API funzionanti)');
        }
        
        if (wsResult.connected) {
            log.success('✅ WEBSOCKET FUNZIONA');
            console.log(`   • WebSocket può essere usato anche con ban IP`);
        } else {
            log.error('❌ WEBSOCKET NON FUNZIONA');
            console.log(`   • Errore: ${wsResult.error || 'Sconosciuto'}`);
            console.log(`   • Possibili cause:`);
            console.log(`     - Firewall blocca WebSocket`);
            console.log(`     - Problema connessione internet`);
            console.log(`     - Binance WebSocket temporaneamente down`);
        }
        
        // Raccomandazioni
        console.log('\n💡 RACCOMANDAZIONI:');
        
        if (isBanned && !wsResult.connected) {
            console.log('   ⚠️  CRITICO: IP bannato E WebSocket non funziona');
            console.log('   → Il sistema non può recuperare dati da Binance');
            console.log('   → Usa solo dati dal database esistente');
            console.log('   → Considera cambio IP o VPN');
        } else if (isBanned && wsResult.connected) {
            console.log('   ✅ IP bannato MA WebSocket funziona');
            console.log('   → Il sistema può usare WebSocket per dati real-time');
            console.log('   → Gli script di recovery NON possono usare REST API');
            console.log('   → Modifica script per usare solo WebSocket o dati esistenti');
        } else if (!isBanned && !wsResult.connected) {
            console.log('   ⚠️  IP non bannato MA WebSocket non funziona');
            console.log('   → Verifica firewall/connessione');
            console.log('   → Gli script di recovery possono usare REST API');
        } else {
            console.log('   ✅ Tutto OK: IP non bannato e WebSocket funziona');
            console.log('   → Sistema completamente operativo');
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

