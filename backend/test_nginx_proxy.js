/**
 * Test connessione al backend tramite dominio con Nginx
 */

const https = require('https');
const http = require('http');

const DOMAIN = 'ticket.logikaservice.it';

console.log('🔍 TEST CONNESSIONE TRAMITE NGINX REVERSE PROXY\n');
console.log('='.repeat(80));
console.log(`Dominio: ${DOMAIN}\n`);

// Test HTTPS
async function testHttpsConnection() {
    console.log('🔒 Test HTTPS...');
    console.log('-'.repeat(80));

    return new Promise((resolve) => {
        const url = `https://${DOMAIN}/api`;

        console.log(`   🔄 GET ${url}`);

        const req = https.get(url, {
            timeout: 5000,
            rejectUnauthorized: false // Accetta certificati self-signed
        }, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                console.log(`   ✅ CONNESSIONE HTTPS RIUSCITA!`);
                console.log(`   └─ Status Code: ${res.statusCode}`);
                console.log(`   └─ Response: ${data.substring(0, 200)}`);
                resolve({ success: true, protocol: 'https' });
            });
        });

        req.on('error', (err) => {
            console.log(`   ❌ HTTPS fallito: ${err.message}`);
            resolve({ success: false, protocol: 'https' });
        });

        req.on('timeout', () => {
            console.log(`   ❌ HTTPS timeout`);
            req.destroy();
            resolve({ success: false, protocol: 'https' });
        });
    });
}

// Test HTTP (fallback)
async function testHttpConnection() {
    console.log('\n📡 Test HTTP...');
    console.log('-'.repeat(80));

    return new Promise((resolve) => {
        const url = `http://${DOMAIN}/api`;

        console.log(`   🔄 GET ${url}`);

        const req = http.get(url, { timeout: 5000 }, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                console.log(`   ✅ CONNESSIONE HTTP RIUSCITA!`);
                console.log(`   └─ Status Code: ${res.statusCode}`);
                console.log(`   └─ Response: ${data.substring(0, 200)}`);
                resolve({ success: true, protocol: 'http' });
            });
        });

        req.on('error', (err) => {
            console.log(`   ❌ HTTP fallito: ${err.message}`);
            resolve({ success: false, protocol: 'http' });
        });

        req.on('timeout', () => {
            console.log(`   ❌ HTTP timeout`);
            req.destroy();
            resolve({ success: false, protocol: 'http' });
        });
    });
}

// Test WebSocket
async function testWebSocket() {
    console.log('\n🔌 Test WebSocket...');
    console.log('-'.repeat(80));

    const WebSocket = require('ws');

    return new Promise((resolve) => {
        const wsUrl = `wss://${DOMAIN}`;

        console.log(`   🔄 Connessione a ${wsUrl}`);

        try {
            const ws = new WebSocket(wsUrl, {
                handshakeTimeout: 5000,
                rejectUnauthorized: false
            });

            ws.on('open', () => {
                console.log(`   ✅ WebSocket WSS connesso!`);
                ws.close();
                resolve({ success: true, protocol: 'wss' });
            });

            ws.on('error', (err) => {
                console.log(`   ⚠️  WSS fallito: ${err.message}`);
                // Prova WS normale
                resolve({ success: false, protocol: 'wss' });
            });
        } catch (err) {
            console.log(`   ❌ Errore WSS: ${err.message}`);
            resolve({ success: false, protocol: 'wss' });
        }
    });
}

async function runTests() {
    const httpsResult = await testHttpsConnection();
    const httpResult = await testHttpConnection();
    const wsResult = await testWebSocket();

    console.log('\n' + '='.repeat(80));
    console.log('📊 RIEPILOGO:');
    console.log('='.repeat(80));

    if (httpsResult.success) {
        console.log('✅ Il backend è raggiungibile tramite HTTPS!');
        console.log(`   URL corretto: https://${DOMAIN}`);
        console.log('\n💡 File .env.production già aggiornato con:');
        console.log(`   REACT_APP_API_URL=https://${DOMAIN}`);
        console.log('\n📋 Prossimi passi:');
        console.log('   1. Ricostruisci il frontend: npm run build');
        console.log('   2. Carica il build sulla VPS');
        console.log('   3. Riavvia Nginx: sudo systemctl restart nginx');
    } else if (httpResult.success) {
        console.log('⚠️  Il backend è raggiungibile solo tramite HTTP (non HTTPS)');
        console.log(`   URL: http://${DOMAIN}`);
        console.log('\n💡 Aggiorna .env.production con:');
        console.log(`   REACT_APP_API_URL=http://${DOMAIN}`);
        console.log('\n⚠️  Consiglio: Configura certificato SSL per HTTPS');
    } else {
        console.log('❌ Il backend NON è raggiungibile tramite il dominio');
        console.log('\n💡 Possibili cause:');
        console.log('   1. Backend non in esecuzione sulla VPS');
        console.log('   2. Nginx non configurato correttamente');
        console.log('   3. DNS non punta all\'IP corretto');
        console.log('\n📋 Verifica sulla VPS:');
        console.log('   ssh root@159.69.121.162');
        console.log('   pm2 list');
        console.log('   sudo nginx -t');
        console.log('   sudo systemctl status nginx');
    }

    if (wsResult.success) {
        console.log('\n✅ WebSocket funziona correttamente!');
    } else {
        console.log('\n⚠️  WebSocket potrebbe non funzionare');
        console.log('   Verifica configurazione Nginx per WebSocket upgrade');
    }

    process.exit(0);
}

runTests().catch(err => {
    console.error('\n❌ ERRORE:', err.message);
    process.exit(1);
});
