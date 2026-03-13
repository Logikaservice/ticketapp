require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');

const poolConfig = {};

if (process.env.DATABASE_URL) {
    try {
        const dbUrl = process.env.DATABASE_URL;
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
        } else {
            poolConfig.connectionString = process.env.DATABASE_URL;
        }
    } catch (e) {
        poolConfig.connectionString = process.env.DATABASE_URL;
    }
} else {
    console.error("DATABASE_URL non trovato");
    process.exit(1);
}

const pool = new Pool(poolConfig);

async function fixVirtualSwitches() {
    try {
        const res = await pool.query(`
      UPDATE network_devices 
      SET status = 'online'
      WHERE ip_address LIKE 'virtual-%' OR (is_static = true AND device_type = 'unmanaged_switch')
    `);
        console.log(`Aggiornati ${res.rowCount} switch virtuali a status = 'online'`);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

fixVirtualSwitches();
