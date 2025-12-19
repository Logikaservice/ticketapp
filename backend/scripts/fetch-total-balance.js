// Script semplice per leggere total_balance
// Prova prima ticketapp, poi crypto_db
require('dotenv').config();
const {Pool} = require('pg');

(async () => {
    // Prova prima con ticketapp
    const ticketappUrl = process.env.DATABASE_URL;
    const cryptoDbUrl = process.env.DATABASE_URL_CRYPTO || process.env.DATABASE_URL?.replace(/\/[^\/]+$/, '/crypto_db');
    
    const databases = [];
    if (ticketappUrl) databases.push({name: 'ticketapp', url: ticketappUrl});
    if (cryptoDbUrl) databases.push({name: 'crypto_db', url: cryptoDbUrl});
    
    for (const {name, url} of databases) {
        const pool = new Pool({connectionString: url, ssl: false});
        try {
            const client = await pool.connect();
            const r = await client.query("SELECT setting_value FROM general_settings WHERE setting_key = 'total_balance' LIMIT 1");
            client.release();
            await pool.end();
            if (r.rows && r.rows[0] && r.rows[0].setting_value) {
                console.log(r.rows[0].setting_value);
                process.exit(0);
            }
        } catch(e) {
            await pool.end();
            // Continua con il prossimo database
        }
    }
    console.error('ERROR: total_balance not found in any database');
    process.exit(1);
})();
