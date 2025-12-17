/**
 * Script per testare la connessione al database crypto
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function testConnection() {
    console.log('🔍 TEST CONNESSIONE DATABASE CRYPTO\n');
    console.log('='.repeat(70));

    // Leggi configurazione
    let cryptoDbUrl = process.env.DATABASE_URL_CRYPTO;

    if (!cryptoDbUrl && process.env.DATABASE_URL) {
        cryptoDbUrl = process.env.DATABASE_URL.replace(/\/[^\/]+$/, '/crypto_db');
        console.log('📊 Usando DATABASE_URL derivato');
    } else if (cryptoDbUrl) {
        console.log('📊 Usando DATABASE_URL_CRYPTO');
    } else {
        console.error('❌ DATABASE_URL o DATABASE_URL_CRYPTO non configurato!');
        process.exit(1);
    }

    // Mostra connection string (nascosta password)
    const maskedUrl = cryptoDbUrl.replace(/:[^:@]+@/, ':***@');
    console.log(`🔗 Connection string: ${maskedUrl}\n`);

    // Crea pool con timeout più lungo
    const isLocalhost = cryptoDbUrl.includes('localhost') || cryptoDbUrl.includes('127.0.0.1');
    const pool = new Pool({
        connectionString: cryptoDbUrl,
        ssl: isLocalhost ? false : {
            rejectUnauthorized: false
        },
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000, // 10 secondi invece di 2
    });

    let client = null;
    try {
        console.log('⏳ Tentativo di connessione (timeout: 10s)...');
        
        // Test connessione con timeout
        const connectPromise = pool.connect();
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout connessione dopo 10 secondi')), 10000)
        );
        
        client = await Promise.race([connectPromise, timeoutPromise]);
        console.log('✅ Connessione riuscita!\n');

        // Test 1: Query semplice
        console.log('📊 TEST 1: Query semplice (SELECT 1)');
        const test1 = await client.query('SELECT 1 as test, current_database() as db, version() as pg_version');
        console.log(`   ✅ Database: ${test1.rows[0].db}`);
        console.log(`   ✅ PostgreSQL: ${test1.rows[0].pg_version.split(',')[0]}\n`);

        // Test 2: Verifica tabella klines
        console.log('📊 TEST 2: Verifica tabella klines');
        const tableCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'klines'
            )
        `);
        
        if (tableCheck.rows[0].exists) {
            console.log('   ✅ Tabella klines trovata\n');
            
            // Test 3: Conta totale klines
            console.log('📊 TEST 3: Conta totale klines');
            const totalKlines = await client.query('SELECT COUNT(*) as count FROM klines');
            console.log(`   ✅ Totale klines nel database: ${parseInt(totalKlines.rows[0].count).toLocaleString()}\n`);

            // Test 4: Verifica simboli disponibili
            console.log('📊 TEST 4: Simboli disponibili');
            const symbols = await client.query(`
                SELECT DISTINCT symbol, COUNT(*) as count 
                FROM klines 
                GROUP BY symbol 
                ORDER BY count DESC 
                LIMIT 10
            `);
            console.log(`   ✅ Trovati ${symbols.rows.length} simboli (top 10):`);
            symbols.rows.forEach(row => {
                console.log(`      - ${row.symbol}: ${parseInt(row.count).toLocaleString()} klines`);
            });
            console.log('');

            // Test 5: Conta klines per bitcoin_eur
            console.log('📊 TEST 5: Klines per BTC/EUR (bitcoin_eur)');
            const btcEurKlines = await client.query(`
                SELECT 
                    COUNT(*) as total,
                    interval,
                    COUNT(*) as count_per_interval
                FROM klines 
                WHERE symbol = $1
                GROUP BY interval
                ORDER BY interval
            `, ['bitcoin_eur']);
            
            if (btcEurKlines.rows.length > 0) {
                const total = btcEurKlines.rows.reduce((sum, row) => sum + parseInt(row.count_per_interval), 0);
                console.log(`   ✅ Totale klines BTC/EUR: ${total.toLocaleString()}`);
                btcEurKlines.rows.forEach(row => {
                    console.log(`      - ${row.interval}: ${parseInt(row.count_per_interval).toLocaleString()} klines`);
                });
            } else {
                console.log('   ⚠️  Nessuna kline trovata per bitcoin_eur');
            }
            console.log('');

        } else {
            console.log('   ⚠️  Tabella klines non trovata\n');
        }

        // Test 6: Range temporale BTC/EUR
        if (tableCheck.rows[0].exists) {
            console.log('📊 TEST 6: Range temporale BTC/EUR');
            const timeRange = await client.query(`
                SELECT 
                    MIN(open_time) as first_candle,
                    MAX(open_time) as last_candle,
                    COUNT(*) as count
                FROM klines 
                WHERE symbol = $1
            `, ['bitcoin_eur']);
            
            if (timeRange.rows[0].count > 0) {
                const first = new Date(Number(timeRange.rows[0].first_candle));
                const last = new Date(Number(timeRange.rows[0].last_candle));
                const days = (Number(timeRange.rows[0].last_candle) - Number(timeRange.rows[0].first_candle)) / (1000 * 60 * 60 * 24);
                console.log(`   ✅ Prima kline: ${first.toISOString()}`);
                console.log(`   ✅ Ultima kline: ${last.toISOString()}`);
                console.log(`   ✅ Giorni coperti: ${days.toFixed(1)}`);
            }
            console.log('');
        }

        console.log('='.repeat(70));
        console.log('✅ TUTTI I TEST COMPLETATI CON SUCCESSO\n');

        client.release();
        await pool.end();
        process.exit(0);

    } catch (error) {
        if (client) {
            try {
                client.release();
            } catch (e) {}
        }
        
        console.error('\n❌ ERRORE DI CONNESSIONE');
        console.error('='.repeat(70));
        console.error(`Messaggio: ${error.message}`);
        
        if (error.code) {
            console.error(`Codice errore: ${error.code}`);
        }
        
        if (error.message.includes('timeout') || error.message.includes('Connection terminated')) {
            console.error('\n💡 POSSIBILI CAUSE:');
            console.error('   1. Database non raggiungibile (firewall, rete)');
            console.error('   2. Database non in esecuzione');
            console.error('   3. Credenziali errate');
            console.error('   4. Connection string non valida');
            console.error('   5. Timeout troppo breve (attualmente 10s)');
        }
        
        if (error.stack) {
            console.error('\n📋 Stack trace:');
            console.error(error.stack);
        }
        
        await pool.end();
        process.exit(1);
    }
}

testConnection();
