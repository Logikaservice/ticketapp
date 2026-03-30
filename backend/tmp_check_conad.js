
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function checkConad() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to:', process.env.DATABASE_URL.replace(/:[^:@]*@/, ':****@'));
    console.log('--- NETWORK AGENTS ---');
    const agents = await pool.query("SELECT id, agent_name, last_heartbeat FROM network_agents WHERE agent_name ILIKE '%Conad Mercurio%'");
    console.log('Agents found:', agents.rows.length);
    console.table(agents.rows);

    if (agents.rows.length > 0) {
      const agentId = agents.rows[0].id;
      console.log(`--- SPEEDTEST RESULTS FOR AGENT ${agentId} ---`);
      const results = await pool.query("SELECT * FROM network_speedtest_results WHERE agent_id = $1 ORDER BY test_date DESC LIMIT 5", [agentId]);
      console.log('Speedtest results:', results.rows.length);
      console.table(results.rows);

      console.log('--- RECENT HEARTBEATS / SCANS ---');
      const scans = await pool.query("SELECT id, created_at, devices_count FROM network_scans WHERE agent_id = $1 ORDER BY created_at DESC LIMIT 5", [agentId]);
      console.log('Scans found:', scans.rows.length);
      console.table(scans.rows);
    } else {
      console.log('Agent "Conad Mercurio" not found.');
      // List last 5 agents to see what's there
      const lastAgents = await pool.query("SELECT id, agent_name, last_heartbeat FROM network_agents ORDER BY last_heartbeat DESC NULLS LAST LIMIT 5");
      console.log('Last heartbeat agents:');
      console.table(lastAgents.rows);
    }
  } catch (err) {
    console.error('FULL ERROR:', err);
  } finally {
    await pool.end();
  }
}

checkConad();
