/**
 * Script di verifica connessione Hetzner VPS
 * Verifica se il sistema punta correttamente alla VPS e al database
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Pool } = require('pg');

console.log('🔍 VERIFICA CONFIGURAZIONE HETZNER VPS\n');
console.log('='.repeat(80));

// 1. Verifica variabili d'ambiente
console.log('\n📋 VARIABILI D\'AMBIENTE:');
console.log('-'.repeat(80));

const envVars = [
    'DATABASE_URL',
    'DATABASE_URL_CRYPTO',
    'DATABASE_URL_VIVALDI',
    'BINANCE_API_KEY',
    'BINANCE_API_SECRET',
    'BINANCE_MODE'
];

envVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
        // Maschera password e API keys
        let maskedValue = value;
        if (varName.includes('DATABASE')) {
            maskedValue = value.replace(/:[^:@]+@/, ':****@');
        } else if (varName.includes('API') || varName.includes('SECRET')) {
            maskedValue = value.substring(0, 8) + '****';
        }
        console.log(`✅ ${varName}: ${maskedValue}`);

        // Estrai host dal DATABASE_URL
        if (varName.includes('DATABASE')) {
            const match = value.match(/@([^:]+):(\d+)\//);
            if (match) {
                const host = match[1];
                const port = match[2];
                console.log(`   └─ Host: ${host}`);
                console.log(`   └─ Port: ${port}`);

                // Verifica se è localhost o remoto
                if (host === 'localhost' || host === '127.0.0.1') {
                    console.log(`   ⚠️  ATTENZIONE: Punta a LOCALHOST, non alla VPS!`);
                } else {
                    console.log(`   ✅ Punta a server remoto (VPS)`);
                }
            }
        }
    } else {
        console.log(`❌ ${varName}: NON CONFIGURATO`);
    }
});

// 2. Test connessione DATABASE_URL (principale)
console.log('\n🔌 TEST CONNESSIONE DATABASE PRINCIPALE:');
console.log('-'.repeat(80));

async function testDatabaseConnection(dbUrl, label) {
    if (!dbUrl) {
        console.log(`❌ ${label}: URL non configurato`);
        return false;
    }

    try {
        // Parsing URL
        const match = dbUrl.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
        if (!match) {
            console.log(`❌ ${label}: Formato URL non valido`);
            return false;
        }

        const [, user, password, host, port, database] = match;

        console.log(`\n📊 ${label}:`);
        console.log(`   Host: ${host}`);
        console.log(`   Port: ${port}`);
        console.log(`   Database: ${database}`);
        console.log(`   User: ${user}`);

        // Determina SSL
        const isLocalhost = host === 'localhost' || host === '127.0.0.1';
        const sslConfig = isLocalhost ? false : { rejectUnauthorized: false };

        console.log(`   SSL: ${isLocalhost ? 'Disabilitato (localhost)' : 'Abilitato (remoto)'}`);

        // Crea pool di connessione
        const pool = new Pool({
            user: decodeURIComponent(user),
            password: decodeURIComponent(password),
            host,
            port: parseInt(port),
            database,
            ssl: sslConfig,
            connectionTimeoutMillis: 5000
        });

        console.log(`\n   🔄 Tentativo di connessione...`);

        const client = await pool.connect();
        console.log(`   ✅ Connessione riuscita!`);

        // Test query
        const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
        console.log(`   ✅ Query test eseguita con successo`);
        console.log(`   └─ Server time: ${result.rows[0].current_time}`);
        console.log(`   └─ PostgreSQL: ${result.rows[0].pg_version.split(',')[0]}`);

        // Verifica tabelle crypto
        if (database.includes('crypto')) {
            const tables = await client.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                ORDER BY table_name
            `);
            console.log(`   ✅ Tabelle nel database: ${tables.rows.length}`);
            tables.rows.forEach(row => {
                console.log(`      - ${row.table_name}`);
            });
        }

        client.release();
        await pool.end();

        return true;
    } catch (error) {
        console.log(`   ❌ ERRORE: ${error.message}`);
        console.log(`   └─ Code: ${error.code}`);
        if (error.code === 'ENOTFOUND') {
            console.log(`   └─ Il server non è raggiungibile (DNS non risolto)`);
        } else if (error.code === 'ECONNREFUSED') {
            console.log(`   └─ Connessione rifiutata (server non in ascolto o firewall)`);
        } else if (error.code === 'ETIMEDOUT') {
            console.log(`   └─ Timeout connessione (firewall o rete)`);
        } else if (error.code === '28P01') {
            console.log(`   └─ Autenticazione fallita (credenziali errate)`);
        } else if (error.code === '3D000') {
            console.log(`   └─ Database non esistente`);
        }
        return false;
    }
}

async function runTests() {
    // Test DATABASE_URL
    await testDatabaseConnection(process.env.DATABASE_URL, 'DATABASE_URL (principale)');

    // Test DATABASE_URL_CRYPTO
    let cryptoDbUrl = process.env.DATABASE_URL_CRYPTO;
    if (!cryptoDbUrl && process.env.DATABASE_URL) {
        cryptoDbUrl = process.env.DATABASE_URL.replace(/\/[^\/]+$/, '/crypto_db');
        console.log(`\n📊 DATABASE_URL_CRYPTO non configurato, usando derivato: ${cryptoDbUrl.replace(/:[^:@]+@/, ':****@')}`);
    }
    await testDatabaseConnection(cryptoDbUrl, 'DATABASE_URL_CRYPTO (crypto bot)');

    // Test DATABASE_URL_VIVALDI
    if (process.env.DATABASE_URL_VIVALDI) {
        await testDatabaseConnection(process.env.DATABASE_URL_VIVALDI, 'DATABASE_URL_VIVALDI');
    }

    // 3. Riepilogo finale
    console.log('\n' + '='.repeat(80));
    console.log('📊 RIEPILOGO:');
    console.log('='.repeat(80));

    const mainDbHost = process.env.DATABASE_URL?.match(/@([^:]+):/)?.[1];
    if (mainDbHost) {
        if (mainDbHost === 'localhost' || mainDbHost === '127.0.0.1') {
            console.log('❌ PROBLEMA: Il sistema punta a LOCALHOST, non alla VPS Hetzner!');
            console.log('');
            console.log('💡 SOLUZIONE:');
            console.log('   1. Modifica il file .env');
            console.log('   2. Cambia DATABASE_URL per puntare all\'IP/hostname della tua VPS Hetzner');
            console.log('   3. Esempio: postgresql://user:password@YOUR_HETZNER_IP:5432/database');
            console.log('   4. Riavvia il backend con: pm2 restart all');
        } else {
            console.log(`✅ Il sistema punta correttamente a: ${mainDbHost}`);
            console.log('   Questo dovrebbe essere l\'IP o hostname della tua VPS Hetzner');
        }
    }

    console.log('');
    console.log('🔍 Per verificare l\'IP della tua VPS Hetzner:');
    console.log('   1. Accedi al pannello Hetzner Cloud');
    console.log('   2. Verifica l\'IP pubblico del server');
    console.log('   3. Confrontalo con l\'host nel DATABASE_URL');

    process.exit(0);
}

runTests().catch(err => {
    console.error('\n❌ ERRORE FATALE:', err.message);
    console.error(err.stack);
    process.exit(1);
});
