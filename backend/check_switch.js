const { Pool } = require('pg');

// Usa la connection string recuperata dal file .env
const connectionString = 'postgresql://postgres:TicketApp2025!Secure@159.69.121.162:5432/ticketapp';

const pool = new Pool({
    connectionString: connectionString,
});

async function checkSwitchData() {
    try {
        const sw = await pool.query("SELECT id, ip, name FROM managed_switches WHERE ip = '192.168.1.115'");

        if (sw.rows.length === 0) {
            console.log("❌ Switch 192.168.1.115 NON trovato nella tabella managed_switches.");
            return;
        }

        const switchId = sw.rows[0].id;
        console.log(`✅ Switch trovato: ID=${switchId}, IP=${sw.rows[0].ip}, Nome=${sw.rows[0].name}`);

        const macs = await pool.query("SELECT COUNT(*) as count FROM switch_mac_port_cache WHERE managed_switch_id = $1", [switchId]);
        console.log(`📊 MAC totali in cache per questo switch: ${macs.rows[0].count}`);

        if (parseInt(macs.rows[0].count) > 0) {
            const sample = await pool.query("SELECT mac_address, port FROM switch_mac_port_cache WHERE managed_switch_id = $1 LIMIT 5", [switchId]);
            console.log("📝 Esempi di dati (MAC -> Porta):");
            sample.rows.forEach(r => console.log(`   - ${r.mac_address} -> Porta ${r.port}`));
        } else {
            console.log("⚠️ Nessun dato SNMP (MAC address) presente in cache. L'agent deve ancora inviare i dati o SNMP non risponde.");
        }

    } catch (err) {
        console.error('❌ Errore:', err);
    } finally {
        await pool.end();
    }
}

checkSwitchData();
