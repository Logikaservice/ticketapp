const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:TicketApp2025!Secure@159.69.121.162:5432/ticketapp',
    ssl: false
});

async function run() {
    const client = await pool.connect();
    try {
        console.log('Adding ip_history column to network_devices...');
        await client.query(`
      ALTER TABLE network_devices 
      ADD COLUMN IF NOT EXISTS ip_history JSONB DEFAULT '[]'::jsonb
    `);
        console.log('Success: ip_history column added (or already existed).');
    } catch (err) {
        console.error('Error adding ip_history column:', err);
    } finally {
        client.release();
        pool.end();
    }
}

run();
