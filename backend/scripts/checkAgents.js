// Verifica agent
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function checkAgents() {
    try {
        const result = await pool.query(`
      SELECT id, agent_name, deleted_at, created_at, api_key, scan_interval_minutes, version, last_heartbeat
      FROM network_agents 
      ORDER BY id
    `);

        console.log('\n📊 === ELENCO AGENT ===\n');
        result.rows.forEach(row => {
            const status = row.deleted_at ? '❌ ELIMINATO' : '✅ ATTIVO';
            console.log(`${status} | ID: ${row.id} | Nome: ${row.agent_name} | Ver: ${row.version} | Int: ${row.scan_interval_minutes} | LastHB: ${row.last_heartbeat}`);
        });
        console.log('\n');

    } catch (error) {
        console.error('❌ Errore:', error);
    } finally {
        await pool.end();
    }
}

checkAgents();
