const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkUser() {
  try {
    const res = await pool.query('SELECT id, email, password, ruolo FROM users WHERE email = $1', ['support@logikaservice.it']);
    console.log('User check results:', JSON.stringify(res.rows, null, 2));
    
    if (res.rows.length > 0) {
        const user = res.rows[0];
        const isHashed = user.password && user.password.startsWith('$2b$');
        console.log('Password is hashed:', isHashed);
    } else {
        console.log('User support@logikaservice.it NOT FOUND');
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

checkUser();
