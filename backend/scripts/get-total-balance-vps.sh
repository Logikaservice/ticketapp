#!/bin/bash
# Script bash semplice per leggere total_balance dalla VPS
# Prova prima crypto_db, poi ticketapp

cd /var/www/ticketapp/backend

node -e "
require('dotenv').config();
const {Pool} = require('pg');

async function getTotalBalance() {
    // Prova prima con crypto_db
    const cryptoDb = process.env.DATABASE_URL_CRYPTO || process.env.DATABASE_URL?.replace(/\/[^\/]+$/, '/crypto_db');
    
    const pools = [];
    if (cryptoDb) pools.push({name: 'crypto_db', url: cryptoDb});
    if (process.env.DATABASE_URL) pools.push({name: 'ticketapp', url: process.env.DATABASE_URL});
    
    for (const {name, url} of pools) {
        const pool = new Pool({connectionString: url, ssl: false});
        try {
            const client = await pool.connect();
            const r = await client.query(\"SELECT setting_value FROM general_settings WHERE setting_key = 'total_balance' LIMIT 1\");
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
}

getTotalBalance();
"
