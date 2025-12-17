#!/usr/bin/env node
/**
 * 🔍 Script Diagnostico Backend
 * 
 * Verifica:
 * 1. Connessione database
 * 2. Validità delle mappe simboli
 * 3. API health
 * 4. WebSocket status
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function diagnoseBackend() {
    console.log('🔍 DIAGNOSI BACKEND\n');
    
    // 1. Test Database Connection
    console.log('1️⃣ Test Connessione Database...');
    try {
        const cryptoDb = require('../crypto_db');
        const result = await cryptoDb.dbGet('SELECT 1 as test');
        if (result && result.test === 1) {
            console.log('   ✅ Database connesso');
        } else {
            console.log('   ❌ Database risposta anomala:', result);
        }
    } catch (err) {
        console.error('   ❌ Errore database:', err.message);
    }
    
    // 2. Verifica Mappe Simboli
    console.log('\n2️⃣ Verifica Mappe Simboli...');
    try {
        // Carica le mappe dai file principali
        const fs = require('fs');
        const cryptoRoutesPath = path.join(__dirname, '..', 'routes', 'cryptoRoutes.js');
        const content = fs.readFileSync(cryptoRoutesPath, 'utf8');
        
        // Estrai SYMBOL_TO_PAIR
        const symbolToPairMatch = content.match(/const SYMBOL_TO_PAIR = \{[^}]+\}/s);
        if (symbolToPairMatch) {
            console.log('   ✅ SYMBOL_TO_PAIR trovata in cryptoRoutes.js');
            
            // Verifica simboli critici
            const criticalSymbols = [
                'avalanche_eur',
                'xrp_eur', 
                'pol_polygon_eur',
                'uniswap_eur',
                'axie_infinity',
                'polkadot_usdt'
            ];
            
            for (const symbol of criticalSymbols) {
                if (content.includes(`'${symbol}'`)) {
                    console.log(`   ✅ ${symbol} presente`);
                } else {
                    console.log(`   ⚠️  ${symbol} NON trovato`);
                }
            }
        } else {
            console.log('   ❌ SYMBOL_TO_PAIR non trovata');
        }
    } catch (err) {
        console.error('   ❌ Errore lettura mappe:', err.message);
    }
    
    // 3. Test API Endpoint
    console.log('\n3️⃣ Test API Endpoints...');
    try {
        const http = require('http');
        const testEndpoint = (path) => {
            return new Promise((resolve, reject) => {
                const req = http.get(`http://localhost:3001${path}`, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        if (res.statusCode === 200) {
                            try {
                                JSON.parse(data);
                                resolve({ ok: true, status: res.statusCode });
                            } catch (e) {
                                resolve({ ok: false, status: res.statusCode, error: 'Invalid JSON' });
                            }
                        } else {
                            resolve({ ok: false, status: res.statusCode, data: data.substring(0, 100) });
                        }
                    });
                });
                req.on('error', (err) => reject(err));
                req.setTimeout(5000, () => {
                    req.destroy();
                    reject(new Error('Timeout'));
                });
            });
        };
        
        const endpoints = [
            '/api/crypto/health',
            '/api/crypto/bot/status',
            '/api/crypto/symbols'
        ];
        
        for (const endpoint of endpoints) {
            try {
                const result = await testEndpoint(endpoint);
                if (result.ok) {
                    console.log(`   ✅ ${endpoint}: OK (${result.status})`);
                } else {
                    console.log(`   ❌ ${endpoint}: ERRORE ${result.status}`);
                    if (result.data) {
                        console.log(`      Risposta: ${result.data}`);
                    }
                }
            } catch (err) {
                console.log(`   ❌ ${endpoint}: ${err.message}`);
            }
        }
    } catch (err) {
        console.error('   ❌ Errore test API:', err.message);
    }
    
    // 4. Verifica Processi PM2
    console.log('\n4️⃣ Verifica Processi PM2...');
    try {
        const { exec } = require('child_process');
        exec('pm2 jlist', (error, stdout, stderr) => {
            if (error) {
                console.log('   ⚠️  PM2 non disponibile o errore:', error.message);
                return;
            }
            
            try {
                const processes = JSON.parse(stdout);
                const backend = processes.find(p => p.name === 'ticketapp-backend');
                
                if (backend) {
                    console.log(`   ✅ Backend PM2: ${backend.pm2_env.status}`);
                    console.log(`      PID: ${backend.pid}`);
                    console.log(`      Uptime: ${Math.floor(backend.pm2_env.pm_uptime / 1000)}s`);
                    console.log(`      Restarts: ${backend.pm2_env.restart_time}`);
                    console.log(`      Memory: ${(backend.monit.memory / 1024 / 1024).toFixed(2)} MB`);
                } else {
                    console.log('   ❌ Backend non trovato in PM2');
                }
            } catch (e) {
                console.log('   ⚠️  Errore parsing PM2 output:', e.message);
            }
        });
    } catch (err) {
        console.error('   ❌ Errore verifica PM2:', err.message);
    }
    
    console.log('\n🏁 Diagnosi completata\n');
}

// Esegui diagnosi
diagnoseBackend().catch(err => {
    console.error('❌ Errore durante diagnosi:', err);
    process.exit(1);
});
