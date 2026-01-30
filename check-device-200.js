// Script per verificare se 192.168.100.200 esiste nel database
const { Pool } = require('pg');

// Usa la stessa connessione del backend
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://ticketapp_user:your_password@localhost:5432/ticketapp_db'
});

async function checkDevice() {
    try {
        console.log('Cercando 192.168.100.200 nel database...\n');

        const result = await pool.query(`
      SELECT id, ip_address, mac_address, status, agent_id, last_seen, is_static
      FROM network_devices 
      WHERE ip_address = '192.168.100.200'
      ORDER BY id DESC 
      LIMIT 5
    `);

        if (result.rows.length === 0) {
            console.log('❌ Nessun dispositivo trovato con IP 192.168.100.200');
        } else {
            console.log(`✅ Trovati ${result.rows.length} record(i):\n`);
            result.rows.forEach((row, i) => {
                console.log(`Record ${i + 1}:`);
                console.log(`  ID: ${row.id}`);
                console.log(`  IP: ${row.ip_address}`);
                console.log(`  MAC: ${row.mac_address}`);
                console.log(`  Status: ${row.status}`);
                console.log(`  Agent ID: ${row.agent_id}`);
                console.log(`  Last Seen: ${row.last_seen}`);
                console.log(`  Is Static: ${row.is_static}`);
                console.log('');
            });
        }

    } catch (err) {
        console.error('Errore:', err.message);
    } finally {
        await pool.end();
    }
}

checkDevice();
