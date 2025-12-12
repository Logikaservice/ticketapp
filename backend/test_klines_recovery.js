#!/usr/bin/env node

/**
 * 🧪 TEST KLINES RECOVERY DAEMON
 * 
 * Testa le componenti del recovery daemon senza avviare il full recovery
 * 
 * Uso: node backend/test_klines_recovery.js
 */

const postgres = require('pg');

const DB_CONFIG = {
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'crypto_trading'
};

const log = {
    info: (msg) => console.log(`[${new Date().toISOString()}] ℹ️  ${msg}`),
    success: (msg) => console.log(`[${new Date().toISOString()}] ✅ ${msg}`),
    warn: (msg) => console.log(`[${new Date().toISOString()}] ⚠️  ${msg}`),
    error: (msg) => console.error(`[${new Date().toISOString()}] ❌ ${msg}`),
    test: (msg) => console.log(`[${new Date().toISOString()}] 🧪 ${msg}`)
};

async function main() {
    const pool = new postgres.Pool(DB_CONFIG);
    
    try {
        log.test('Connessione al database...');
        const client = await pool.connect();
        log.success('Connesso al database');
        client.release();

        // Test 1: Verifica tabella system_status
        log.test('\n1️⃣  Test: Verifica tabella system_status');
        try {
            const result = await pool.query(
                `SELECT * FROM system_status WHERE status_key = 'klines_recovery_in_progress'`
            );
            if (result.rows.length > 0) {
                log.success(`  system_status esiste: ${result.rows[0].status_value}`);
            } else {
                log.warn('  Tabella esiste ma no entry recovery - OK');
            }
        } catch (err) {
            if (err.message.includes('does not exist')) {
                log.warn('  Tabella system_status non esiste ancora (verrà creata al primo avvio)');
            } else {
                throw err;
            }
        }

        // Test 2: Conta simboli attivi
        log.test('\n2️⃣  Test: Conta simboli attivi');
        const activeResult = await pool.query(
            `SELECT COUNT(DISTINCT symbol) as count FROM bot_settings WHERE is_active = 1`
        );
        const activeCount = activeResult.rows[0].count;
        log.success(`  Simboli attivi: ${activeCount}`);
        if (activeCount === 0) {
            log.warn('  ⚠️  Nessun simbolo attivo! Lo script non farà nulla.');
        }

        // Test 3: Conta klines per intervallo
        log.test('\n3️⃣  Test: Conta klines per intervallo');
        const klinesResult = await pool.query(`
            SELECT interval, COUNT(*) as count 
            FROM klines 
            GROUP BY interval 
            ORDER BY interval
        `);
        log.success('  Klines per intervallo:');
        klinesResult.rows.forEach(row => {
            log.info(`    ${row.interval}: ${row.count} klines`);
        });

        // Test 4: Verifica gap ultimi 7 giorni (Bitcoin)
        log.test('\n4️⃣  Test: Analizza gap ultimi 7 giorni (Bitcoin)');
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const gapResult = await pool.query(`
            SELECT open_time, close_time
            FROM klines
            WHERE symbol = 'bitcoin' AND interval = '15m' AND open_time >= $1
            ORDER BY open_time ASC
        `, [sevenDaysAgo]);

        if (gapResult.rows.length > 0) {
            log.success(`  Bitcoin: ${gapResult.rows.length} klines trovate negli ultimi 7 giorni`);
            
            // Analizza gap
            let gaps = 0;
            for (let i = 1; i < gapResult.rows.length; i++) {
                const prevCloseTime = gapResult.rows[i - 1].close_time;
                const currentOpenTime = gapResult.rows[i].open_time;
                const expectedGap = 15 * 60 * 1000;
                const actualGap = currentOpenTime - prevCloseTime;
                
                if (actualGap > expectedGap * 1.5) {
                    gaps++;
                }
            }
            
            if (gaps === 0) {
                log.success(`  ✓ Nessun gap rilevato! Dati puliti.`);
            } else {
                log.warn(`  ⚠️  ${gaps} gap trovati nei dati`);
            }
        } else {
            log.warn('  Bitcoin: Nessuna kline trovata negli ultimi 7 giorni');
        }

        // Test 5: Verifica connettività Binance
        log.test('\n5️⃣  Test: Verifica connettività Binance');
        const https = require('https');
        const binanceUrl = 'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=15m&limit=1';
        
        const binanceTest = new Promise((resolve) => {
            const timeoutHandle = setTimeout(() => {
                log.warn('  Timeout contattando Binance');
                resolve(false);
            }, 5000);
            
            https.get(binanceUrl, (res) => {
                clearTimeout(timeoutHandle);
                if (res.statusCode === 200) {
                    log.success('  ✓ Binance API raggiungibile');
                    resolve(true);
                } else {
                    log.warn(`  Binance status: ${res.statusCode}`);
                    resolve(false);
                }
                res.resume();
            }).on('error', (err) => {
                clearTimeout(timeoutHandle);
                log.error(`  Errore Binance: ${err.message}`);
                resolve(false);
            });
        });

        await binanceTest;

        // Summary
        log.test('\n' + '='.repeat(60));
        log.success('✅ TUTTI I TEST COMPLETATI\n');
        log.info('Per avviare il recovery daemon, esegui:');
        log.info('  node backend/klines_recovery_daemon.js\n');
        log.info('Per avviare con PM2 pianificato (3:00 AM):');
        log.info('  pm2 start ecosystem-klines.config.js --only klines-recovery\n');

    } catch (err) {
        log.error(`Errore test: ${err.message}`);
        log.error(err.stack);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
