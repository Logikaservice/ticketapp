// Migration script to create contracts tables
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function createContractsTables() {
    const client = await pool.connect();

    try {
        console.log('\n🔧 MIGRAZIONE DATABASE: Creazione tabelle Contracts\n');

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
