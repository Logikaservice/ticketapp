
require('dotenv').config();
const { Pool } = require('pg');

async function testConnection() {
    console.log('--- TEST CONNESSIONE DATABASE ---');

    let poolConfig = {};
    const dbUrl = process.env.DATABASE_URL;

    if (!dbUrl) {
        console.error('❌ DATABASE_URL non trovato in .env');
        return;
    }

    console.log('URL configurato (masked):', dbUrl.replace(/:[^:@]*@/, ':****@'));

    try {
        const match = dbUrl.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
        if (match) {
            poolConfig.user = decodeURIComponent(match[1]);
            poolConfig.password = decodeURIComponent(match[2]);
            poolConfig.host = match[3];
            poolConfig.port = parseInt(match[4]);
            poolConfig.database = match[5];

            if (poolConfig.host === 'localhost' || poolConfig.host === '127.0.0.1') {
                poolConfig.ssl = false;
            } else {
                poolConfig.ssl = { rejectUnauthorized: false };
            }

            console.log(`Tentativo connessione a ${poolConfig.host}:${poolConfig.port} DB=${poolConfig.database} User=${poolConfig.user}`);
        } else {
            console.log('URL non matchato dalla regex, uso connectionString diretta.');
            poolConfig.connectionString = dbUrl;
            poolConfig.ssl = { rejectUnauthorized: false };
        }
    } catch (e) {
        console.error('Errore parsing URL:', e);
        return;
    }

    const pool = new Pool(poolConfig);

    try {
        const client = await pool.connect();
        console.log('✅ Connessione al pool riuscita!');

        const res = await client.query('SELECT NOW() as now, current_database() as db_name, inet_server_addr() as server_ip');
        console.log('✅ Query SELECT NOW() riuscita:', res.rows[0]);

        client.release();
        await pool.end();
        console.log('--- TEST COMPLETATO CON SUCCESSO ---');
    } catch (err) {
        console.error('❌ ERRORE DI CONNESSIONE:', err.message);
        console.error('Code:', err.code);
        if (err.message.includes('ETIMEDOUT')) {
            console.error('⚠️ TIMEOUT: Il server non risponde. Verifica IP, Porta e Firewall.');
        }
        await pool.end();
    }
}

testConnection();
