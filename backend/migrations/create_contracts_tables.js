// Migration script to create contracts tables
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

console.log('🔍 Tentativo lettura DATABASE_URL...');
let poolConfig = {};

if (process.env.DATABASE_URL) {
    try {
        const dbUrl = process.env.DATABASE_URL;
        // Regex per parsing manuale (gestione password con caratteri speciali)
        const match = dbUrl.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);

        if (match) {
            poolConfig.user = decodeURIComponent(match[1]);
            poolConfig.password = decodeURIComponent(match[2]);
            poolConfig.host = match[3];
            poolConfig.port = parseInt(match[4]);
            poolConfig.database = match[5];

            if (poolConfig.host === 'localhost' || poolConfig.host === '127.0.0.1') {
                poolConfig.ssl = false;
            } else {
                poolConfig.ssl = { rejectUnauthorized: false };
            }
        } else {
            console.warn('⚠️ Regex URL non corrispondente, uso connectionString standard');
            poolConfig.connectionString = dbUrl;
            poolConfig.ssl = { rejectUnauthorized: false };
        }
    } catch (e) {
        console.error('❌ Errore parsing URL:', e);
        poolConfig.connectionString = process.env.DATABASE_URL;
    }
} else {
    // Fallback hardcoded per VPS se necessario (per sicurezza) o defaults
    console.error('❌ DATABASE_URL non trovato nel file .env (../.env)');
    process.exit(1);
}

const pool = new Pool(poolConfig);

async function createContractsTables() {
    const client = await pool.connect();

    try {
        console.log('\n🔧 MIGRAZIONE DATABASE: Creazione tabelle Contracts\n');

        // ... Logica esistente ...

        // Create contracts table
        console.log('📝 Creazione tabella contracts...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS contracts (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                client_name VARCHAR(255),
                start_date DATE NOT NULL,
                end_date DATE,
                billing_frequency VARCHAR(50) DEFAULT 'monthly',
                amount DECIMAL(10, 2),
                contract_file_path VARCHAR(500),
                active BOOLEAN DEFAULT TRUE,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Create contract_events table
        console.log('📝 Creazione tabella contract_events...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS contract_events (
                id SERIAL PRIMARY KEY,
                contract_id INTEGER REFERENCES contracts(id) ON DELETE CASCADE,
                event_date DATE NOT NULL,
                event_type VARCHAR(50) NOT NULL,
                title VARCHAR(255),
                description TEXT,
                status VARCHAR(50) DEFAULT 'pending',
                amount DECIMAL(10, 2),
                is_processed BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Indices
        await client.query(`CREATE INDEX IF NOT EXISTS idx_contracts_user_id ON contracts(user_id);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_contract_events_contract_id ON contract_events(contract_id);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_contract_events_date ON contract_events(event_date);`);

        console.log('\n✅ MIGRAZIONE COMPLETATA CON SUCCESSO!\n');

    } catch (error) {
        console.error('\n❌ ERRORE DURANTE LA MIGRAZIONE:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

createContractsTables().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
