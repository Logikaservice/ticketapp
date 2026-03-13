const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://postgres:Logika2024!@185.17.106.2:5432/ticketapp' });
pool.query('SELECT table_name FROM information_schema.tables WHERE table_schema = $1', ['public'])
    .then(res => { console.log(res.rows.map(r => r.table_name)); pool.end(); })
    .catch(e => { console.error(e); pool.end(); });
