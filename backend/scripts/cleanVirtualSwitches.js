
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function cleanVirtualSwitches() {
    const client = await pool.connect();
    try {
        console.log('🧹 Inizio pulizia switch virtuali senza MAC...');

        // Elimina device che sono unmanaged_switch E hanno mac_address NULL o vuoto o 'N/A'
        const res = await client.query(`
      DELETE FROM network_devices 
      WHERE device_type = 'unmanaged_switch' 
      AND (mac_address IS NULL OR mac_address = '' OR mac_address = 'N/A')
      RETURNING id, ip_address, hostname
    `);

        console.log(`✅ Eliminati ${res.rowCount} switch virtuali corrotti.`);
        res.rows.forEach(r => console.log(` - Eliminato: ${r.hostname} (${r.ip_address})`));

    } catch (err) {
        console.error('❌ Errore durante la pulizia:', err);
    } finally {
        client.release();
        pool.end();
    }
}

cleanVirtualSwitches();
