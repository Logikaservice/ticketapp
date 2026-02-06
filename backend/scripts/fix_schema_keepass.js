require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function run() {
    try {
        console.log('Adding keepass_path column...');
        await pool.query(`ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS keepass_path TEXT;`);
        console.log('✅ Column keepass_path added successfully');
    } catch (e) {
        console.error('❌ Error adding column:', e);
    } finally {
        pool.end();
    }
}

run();
