/**
 * Test connessione al backend sulla VPS Hetzner
 * Verifica se il backend Node.js è raggiungibile sulla porta 3001
 */

const http = require('http');
const https = require('https');

const VPS_IP = '159.69.121.162';
const BACKEND_PORT = 3001;

console.log('🔍 TEST CONNESSIONE BACKEND VPS HETZNER\n');
console.log('='.repeat(80));
console.log(`IP VPS: ${VPS_IP}`);
console.log(`Porta Backend: ${BACKEND_PORT}\n`);

// Test HTTP
async function testHttpConnection() {
    console.log('📡 Test connessione HTTP...');
    console.log('-'.repeat(80));

    return new Promise((resolve) => {
        const url = `http://${VPS_IP}:${BACKEND_PORT}/api`;

        console.log(`   🔄 GET ${url}`);

        const req = http.get(url, { timeout: 5000 }, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                console.log(`   ✅ CONNESSIONE RIUSCITA!`);
                console.log(`   └─ Status Code: ${res.statusCode}`);
                console.log(`   └─ Headers:`, JSON.stringify(res.headers, null, 2));
                console.log(`   └─ Response: ${data.substring(0, 200)}`);
                resolve(true);
            });
        });

        req.on('error', (err) => {
            console.log(`   ❌ ERRORE: ${err.message}`);
            if (err.code === 'ECONNREFUSED') {
                console.log(`   └─ Il backend non è in ascolto sulla porta ${BACKEND_PORT}`);
                console.log(`   └─ Verifica che il backend sia avviato sulla VPS con: pm2 list`);
            } else if (err.code === 'ETIMEDOUT') {
                console.log(`   └─ Timeout connessione`);
                console.log(`   └─ Il firewall potrebbe bloccare la porta ${BACKEND_PORT}`);
            } else if (err.code === 'EHOSTUNREACH') {
                console.log(`   └─ Host non raggiungibile`);
            }
            resolve(false);
        });

        req.on('timeout', () => {
            console.log(`   ❌ TIMEOUT dopo 5 secondi`);
            req.destroy();
            resolve(false);
        });
    });
}

// Test WebSocket
async function testWebSocketConnection() {
    console.log('\n🔌 Test connessione WebSocket...');
    console.log('-'.repeat(80));

    const WebSocket = require('ws');

    return new Promise((resolve) => {
        const wsUrl = `ws://${VPS_IP}:${BACKEND_PORT}`;

        console.log(`   🔄 Connessione a ${wsUrl}`);

        try {
            const ws = new WebSocket(wsUrl, {
                handshakeTimeout: 5000
            });

            ws.on('open', () => {
                console.log(`   ✅ WebSocket connesso!`);
                ws.close();
                resolve(true);
            });

            ws.on('error', (err) => {
                console.log(`   ❌ ERRORE WebSocket: ${err.message}`);
                if (err.code === 'ECONNREFUSED') {
                    console.log(`   └─ WebSocket server non disponibile`);
                }
                resolve(false);
            });

            ws.on('close', () => {
                console.log(`   └─ Connessione chiusa`);
            });
        } catch (err) {
            console.log(`   ❌ ERRORE: ${err.message}`);
            resolve(false);
        }
    });
}

// Test porte comuni
async function testCommonPorts() {
    console.log('\n🔍 Test porte comuni...');
    console.log('-'.repeat(80));

    const net = require('net');
    const ports = [80, 443, 3000, 3001, 8080];

    for (const port of ports) {
        await new Promise((resolve) => {
            const socket = new net.Socket();
            socket.setTimeout(2000);

            socket.on('connect', () => {
                console.log(`   ✅ Porta ${port}: APERTA`);
                socket.destroy();
                resolve();
            });

            socket.on('timeout', () => {
                console.log(`   ❌ Porta ${port}: TIMEOUT`);
                socket.destroy();
                resolve();
            });

            socket.on('error', (err) => {
                if (err.code === 'ECONNREFUSED') {
                    console.log(`   ⚠️  Porta ${port}: CHIUSA (nessun servizio in ascolto)`);
                } else {
                    console.log(`   ❌ Porta ${port}: ${err.code}`);
                }
                resolve();
            });

            socket.connect(port, VPS_IP);
        });
    }
}

async function runTests() {
    const httpOk = await testHttpConnection();

    if (httpOk) {
        await testWebSocketConnection();
    } else {
        await testCommonPorts();
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 RIEPILOGO:');
    console.log('='.repeat(80));

    if (httpOk) {
        console.log('✅ Il backend sulla VPS è raggiungibile!');
        console.log('\n💡 Prossimi passi:');
        console.log('   1. Il file .env.production è già stato aggiornato');
        console.log('   2. Ricostruisci il frontend: npm run build');
        console.log('   3. Riavvia il frontend sulla VPS');
    } else {
        console.log('❌ Il backend sulla VPS NON è raggiungibile');
        console.log('\n💡 Possibili soluzioni:');
        console.log('   1. Verifica che il backend sia avviato sulla VPS:');
        console.log('      ssh root@159.69.121.162');
        console.log('      pm2 list');
        console.log('      pm2 logs');
        console.log('');
        console.log('   2. Verifica che il backend ascolti sulla porta 3001:');
        console.log('      netstat -tlnp | grep 3001');
        console.log('');
        console.log('   3. Apri la porta 3001 nel firewall:');
        console.log('      sudo ufw allow 3001/tcp');
        console.log('      sudo ufw reload');
        console.log('');
        console.log('   4. Configura il firewall Hetzner Cloud:');
        console.log('      https://console.hetzner.cloud/');
        console.log('      Firewall > Aggiungi regola > TCP > Porta 3001');
    }

    process.exit(0);
}

runTests().catch(err => {
    console.error('\n❌ ERRORE:', err.message);
    process.exit(1);
});
