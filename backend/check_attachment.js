require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  try {
    const res = await pool.query(`SELECT * FROM tickets WHERE numero = 'TKT-2026-330' LIMIT 1`);
    if (res.rows.length === 0) {
      console.log('Ticket not found');
      return;
    }
    const ticket = res.rows[0];
    console.log('Ticket found:', ticket.numero);
    
    // Check ticket photos (is there a separate table or a jsonb column?)
    const resPhotos = await pool.query(`SELECT * FROM ticket_photos WHERE ticket_id = $1`, [ticket.id]);
    console.log('Photos:', resPhotos.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

run();
