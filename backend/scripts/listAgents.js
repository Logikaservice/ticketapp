// Script per elencare tutti gli agent e i loro dispositivi
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function listAgents() {
    try {
        const result = await pool.query(`
      SELECT 
        na.id,
        na.agent_name,
        u.azienda,
        COUNT(nd.id) as device_count
      FROM network_agents na
      LEFT JOIN users u ON na.azienda_id = u.id
      LEFT JOIN network_devices nd ON nd.agent_id = na.id
      WHERE na.deleted_at IS NULL
      GROUP BY na.id, na.agent_name, u.azienda
      ORDER BY device_count DESC
    `);

        console.log('\n📊 === ELENCO AGENT E DISPOSITIVI ===\n');
        result.rows.forEach(row => {
            console.log(`Agent ID: ${row.id} | Nome: ${row.agent_name} | Azienda: ${row.azienda || 'N/A'} | Dispositivi: ${row.device_count}`);
        });
        console.log('\n');

    } catch (error) {
        console.error('❌ Errore:', error);
    } finally {
        await pool.end();
    }
}

listAgents();
