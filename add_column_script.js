const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function run() {
    try {
        console.log('Adding column additional_ips...');
        await pool.query(`
      ALTER TABLE network_devices 
      ADD COLUMN IF NOT EXISTS additional_ips JSONB DEFAULT '[]'::jsonb;
    `);
        console.log('Column added successfully!');
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        pool.end();
    }
}

run();
