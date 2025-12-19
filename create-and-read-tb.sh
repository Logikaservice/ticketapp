#!/bin/bash
cd /var/www/ticketapp/backend
export NODE_PATH=/var/www/ticketapp/backend/node_modules
node << 'ENDOFNODE'
require('dotenv').config({ path: '/var/www/ticketapp/backend/.env' });
const { Pool } = require('pg');

async function createTableAndRead() {
    const cryptoDbUrl = process.env.DATABASE_URL_CRYPTO || process.env.DATABASE_URL?.replace(/\/[^\/]+$/, '/crypto_db') || process.env.DATABASE_URL;
    
    if (!cryptoDbUrl) {
        console.error('ERROR: No database URL');
        process.exit(1);
    }
    
    const pool = new Pool({ connectionString: cryptoDbUrl, ssl: false });
    
    try {
        // Crea tabella se non esiste
        await pool.query(`
            CREATE TABLE IF NOT EXISTS general_settings (
                setting_key TEXT PRIMARY KEY,
                setting_value TEXT,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Leggi valore
        const result = await pool.query(
            "SELECT setting_value FROM general_settings WHERE setting_key = 'total_balance' LIMIT 1"
        );
        
        if (result.rows && result.rows[0] && result.rows[0].setting_value) {
            console.log(result.rows[0].setting_value.trim());
        } else {
            console.error('ERROR: total_balance not found (table created but empty)');
            process.exit(1);
        }
        
        await pool.end();
        process.exit(0);
    } catch (e) {
        await pool.end();
        console.error('ERROR:', e.message);
        process.exit(1);
    }
}

createTableAndRead();
ENDOFNODE




