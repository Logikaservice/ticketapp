const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function run() {
    try {
        const res = await pool.query(`
      SELECT id, ip_address, mac_address, additional_ips 
      FROM network_devices 
      WHERE mac_address LIKE '%A4:02:B9:1E:52:21%' OR mac_address LIKE '%A4-02-B9-1E-52-21%'
    `);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

run();
