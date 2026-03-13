const { Pool } = require('pg');
require('dotenv').config({ path: 'c:/TicketApp/backend/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkAgents() {
  try {
    const res = await pool.query(`
      SELECT version, status, COUNT(*) 
      FROM comm_agents 
      WHERE last_heartbeat < NOW() - INTERVAL '1 hour'
      GROUP BY version, status
    `);
    console.log('--- AGENTS OFFLINE (>1h) ---');
    console.table(res.rows);

    const res2 = await pool.query(`
      SELECT version, status, COUNT(*) 
      FROM comm_agents 
      WHERE last_heartbeat >= NOW() - INTERVAL '1 hour'
      GROUP BY version, status
    `);
    console.log('--- AGENTS ONLINE (<1h) ---');
    console.table(res2.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkAgents();
