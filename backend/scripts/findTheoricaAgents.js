// Trova tutti gli agent e dispositivi di Theorica
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function findTheoricaAgents() {
    try {
        // Trova tutti gli agent di Theorica
        const result = await pool.query(`
      SELECT na.id, na.agent_name, u.id as azienda_id, u.azienda, COUNT(nd.id) as device_count 
      FROM network_agents na 
      LEFT JOIN users u ON na.azienda_id = u.id 
      LEFT JOIN network_devices nd ON nd.agent_id = na.id 
      WHERE LOWER(u.azienda) LIKE '%theorica%' OR LOWER(na.agent_name) LIKE '%theorica%'
      GROUP BY na.id, na.agent_name, u.id, u.azienda 
      ORDER BY device_count DESC
    `);

        console.log('\n📊 === AGENT THEORICA ===\n');

        if (result.rows.length === 0) {
            console.log('❌ Nessun agent trovato per Theorica\n');
            return;
        }

        result.rows.forEach(row => {
            console.log(`Agent ID: ${row.id} | Nome: ${row.agent_name} | Azienda: ${row.azienda} (ID: ${row.azienda_id}) | Dispositivi: ${row.device_count}`);
        });

        console.log('\n');

        // Mostra alcuni dispositivi di esempio per ogni agent
        for (const agent of result.rows) {
            if (agent.device_count > 0) {
                console.log(`\n📱 Dispositivi per Agent ${agent.agent_name} (ID: ${agent.id}):\n`);

                const devices = await pool.query(`
          SELECT id, ip_address, mac_address, hostname 
          FROM network_devices 
          WHERE agent_id = $1 
          ORDER BY ip_address 
          LIMIT 5
        `, [agent.id]);

                devices.rows.forEach(d => {
                    console.log(`  - ID: ${d.id}, IP: ${d.ip_address}, MAC: ${d.mac_address}, Hostname: ${d.hostname || 'N/A'}`);
                });

                if (agent.device_count > 5) {
                    console.log(`  ... e altri ${agent.device_count - 5} dispositivi`);
                }
            }
        }

        console.log('\n');

    } catch (error) {
        console.error('❌ Errore:', error);
    } finally {
        await pool.end();
    }
}

findTheoricaAgents();
