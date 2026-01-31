// Trova tutti i dispositivi con IP 192.168.1.x
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function findDevices() {
    try {
        const result = await pool.query(`
      SELECT nd.id, nd.agent_id, na.agent_name, nd.ip_address, nd.mac_address, nd.hostname
      FROM network_devices nd
      LEFT JOIN network_agents na ON nd.agent_id = na.id
      WHERE nd.ip_address LIKE '192.168.1%'
      ORDER BY nd.ip_address, nd.mac_address
    `);

        console.log(`\n📊 Trovati ${result.rows.length} dispositivi con IP 192.168.1.x\n`);

        // Raggruppa per IP+MAC
        const byIpMac = new Map();

        for (const device of result.rows) {
            const key = `${device.ip_address}|${device.mac_address}`;
            if (!byIpMac.has(key)) {
                byIpMac.set(key, []);
            }
            byIpMac.get(key).push(device);
        }

        console.log('🔍 === DUPLICATI (stesso IP e MAC) ===\n');
        let duplicateCount = 0;
        for (const [key, devices] of byIpMac.entries()) {
            if (devices.length > 1) {
                const [ip, mac] = key.split('|');
                console.log(`IP: ${ip}, MAC: ${mac}`);
                devices.forEach(d => {
                    console.log(`  - ID: ${d.id}, Agent: ${d.agent_name} (${d.agent_id}), Hostname: ${d.hostname || 'N/A'}`);
                });
                duplicateCount += devices.length - 1;
                console.log('');
            }
        }

        console.log(`Totale duplicati: ${duplicateCount}\n`);

    } catch (error) {
        console.error('❌ Errore:', error);
    } finally {
        await pool.end();
    }
}

findDevices();
