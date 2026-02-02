const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function updateScanInterval() {
    try {
        console.log('Aggiornamento intervallo scansione a 2 minuti per tutti gli agent...');
        const res = await pool.query('UPDATE network_agents SET scan_interval_minutes = 2');
        console.log(`✅ Aggiornati ${res.rowCount} agenti.`);
    } catch (err) {
        console.error('❌ Errore aggiornamento:', err);
    } finally {
        pool.end();
    }
}

updateScanInterval();
