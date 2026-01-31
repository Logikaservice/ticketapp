
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function deleteSpecificDevice() {
    const targetIp = 'virtual-1769874610806-721';
    const client = await pool.connect();
    try {
        console.log(`🧹 Tentativo eliminazione dispositivo: ${targetIp}...`);

        // 1. Elimina dalla tabella devices
        const res = await client.query(`
      DELETE FROM network_devices 
      WHERE ip_address = $1
      RETURNING id, ip_address, hostname, mac_address
    `, [targetIp]);

        if (res.rowCount > 0) {
            console.log(`✅ Eliminato dispositivo da network_devices:`, res.rows[0]);

            // 2. Se aveva un MAC (anche parziale), pulisci anche mappatura_nodes
            if (res.rows[0].mac_address) {
                const mac = res.rows[0].mac_address;
                // Normalizza MAC
                const normalizedMac = mac.replace(/[:-]/g, '').toUpperCase();
                await client.query(`
                DELETE FROM mappatura_nodes 
                WHERE REPLACE(REPLACE(REPLACE(REPLACE(UPPER(mac_address), ':', ''), '-', ''), '.', ''), ' ', '') = $1
            `, [normalizedMac]);
                console.log(`✅ Pulito anche mappatura_nodes per MAC: ${mac}`);
            }
        } else {
            console.log(`⚠️ Nessun dispositivo trovato con IP: ${targetIp}`);

            // Tentativo extra: cerca parziale
            const resList = await client.query(`
            SELECT ip_address FROM network_devices WHERE ip_address LIKE 'virtual-%'
        `);
            console.log('🔍 Dispositivi virtuali trovati nel DB:', resList.rows.map(r => r.ip_address));
        }

    } catch (err) {
        console.error('❌ Errore durante eliminazione:', err);
    } finally {
        client.release();
        pool.end();
    }
}

deleteSpecificDevice();
