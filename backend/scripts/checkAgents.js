// Verifica agent
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function checkAgents() {
    try {
        const result = await pool.query(`
      SELECT id, agent_name, deleted_at, created_at 
      FROM network_agents 
      ORDER BY id
    `);

        console.log('\n📊 === ELENCO AGENT ===\n');
        result.rows.forEach(row => {
            const status = row.deleted_at ? '❌ ELIMINATO' : '✅ ATTIVO';
            console.log(`${status} | ID: ${row.id} | Nome: ${row.agent_name} | Creato: ${row.created_at} | Eliminato: ${row.deleted_at || 'N/A'}`);
        });
        console.log('\n');

    } catch (error) {
        console.error('❌ Errore:', error);
    } finally {
        await pool.end();
    }
}

checkAgents();
