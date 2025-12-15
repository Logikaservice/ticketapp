/**
 * Script per testare l'accesso AI al database
 * Esegui questo script per verificare che gli endpoint /ai-db funzionino
 */

const https = require('https');

const SERVER_URL = 'https://ticket.logikaservice.it';

async function testAIDBAccess() {
    console.log('🔍 TEST ACCESSO AI AL DATABASE\n');
    console.log('='.repeat(60));
    
    // Test 1: Total Balance
    console.log('\n📊 1. TEST: Total Balance');
    try {
        const url = `${SERVER_URL}/ai-db/execute?command=total-balance`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            console.log(`   ✅ Total Balance: $${data.data.totalBalance.toFixed(2)}`);
        } else {
            console.log(`   ❌ Errore: ${data.error}`);
        }
    } catch (error) {
        console.log(`   ❌ Errore connessione: ${error.message}`);
    }
    
    // Test 2: Summary
    console.log('\n📊 2. TEST: Summary');
    try {
        const url = `${SERVER_URL}/ai-db/execute?command=summary`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            console.log(`   ✅ Total Balance: $${data.data.totalBalance.toFixed(2)}`);
            console.log(`   ✅ Cash: $${data.data.cash.toFixed(2)}`);
            console.log(`   ✅ Posizioni aperte: ${data.data.openPositions}`);
            console.log(`   ✅ P&L totale: $${data.data.totalPnL.toFixed(2)}`);
        } else {
            console.log(`   ❌ Errore: ${data.error}`);
        }
    } catch (error) {
        console.log(`   ❌ Errore connessione: ${error.message}`);
    }
    
    // Test 3: Modifica Total Balance
    console.log('\n🔄 3. TEST: Modifica Total Balance');
    try {
        const testValue = 1234.56;
        const url = `${SERVER_URL}/ai-db/update`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                field: 'total_balance',
                value: testValue
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log(`   ✅ Modificato: $${parseFloat(data.oldValue || 0).toFixed(2)} → $${parseFloat(data.newValue || 0).toFixed(2)}`);
            
            // Verifica che sia stato salvato
            const verifyResponse = await fetch(`${SERVER_URL}/ai-db/execute?command=total-balance`);
            const verifyData = await verifyResponse.json();
            
            if (Math.abs(parseFloat(verifyData.data.totalBalance) - testValue) < 0.01) {
                console.log(`   ✅ Verifica riuscita: $${verifyData.data.totalBalance.toFixed(2)}`);
            } else {
                console.log(`   ❌ Verifica fallita: atteso $${testValue.toFixed(2)}, trovato $${verifyData.data.totalBalance.toFixed(2)}`);
            }
        } else {
            console.log(`   ❌ Errore: ${data.error}`);
        }
    } catch (error) {
        console.log(`   ❌ Errore connessione: ${error.message}`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ TEST COMPLETATO\n');
}

// Usa fetch se disponibile (Node 18+), altrimenti usa https
if (typeof fetch === 'undefined') {
    // Polyfill per fetch usando https
    global.fetch = async (url, options = {}) => {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const opts = {
                hostname: urlObj.hostname,
                port: urlObj.port || 443,
                path: urlObj.pathname + urlObj.search,
                method: options.method || 'GET',
                headers: options.headers || {}
            };
            
            const req = https.request(opts, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    resolve({
                        ok: res.statusCode >= 200 && res.statusCode < 300,
                        status: res.statusCode,
                        json: async () => JSON.parse(data),
                        text: async () => data
                    });
                });
            });
            
            req.on('error', reject);
            
            if (options.body) {
                req.write(options.body);
            }
            
            req.end();
        });
    };
}

testAIDBAccess().catch(console.error);

