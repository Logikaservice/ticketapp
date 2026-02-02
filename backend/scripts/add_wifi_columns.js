require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function run() {
    try {
        await pool.query(`
      ALTER TABLE network_devices 
      ADD COLUMN IF NOT EXISTS wifi_sync_status VARCHAR(50), 
      ADD COLUMN IF NOT EXISTS wifi_sync_msg TEXT, 
      ADD COLUMN IF NOT EXISTS wifi_sync_last_at TIMESTAMPTZ;
    `);
        console.log("✅ Colonne aggiunte correttamente.");
    } catch (e) {
        console.error("❌ Errore:", e);
    } finally {
        pool.end();
    }
}

run();
