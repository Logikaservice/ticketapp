/**
 * Migrazione: crea la tabella comm_device_info (inventario dispositivi dagli agent).
 * Eseguire sul server: node backend/migrations/create_comm_device_info.js
 * Richiede DATABASE_URL (database principale dell'app).
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error('❌ DATABASE_URL non configurato. Imposta la variabile o usa .env');
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function run() {
    const client = await pool.connect();
    try {
        console.log('\n🔧 Migrazione: tabella comm_device_info (Dispositivi aziendali)\n');

        const check = await client.query(`
            SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'comm_device_info'
        `);
        if (check.rows.length > 0) {
            console.log('✅ La tabella comm_device_info esiste già.\n');
            return;
        }

        console.log('📝 Creazione tabella comm_device_info...');
        await client.query(`
            CREATE TABLE comm_device_info (
                id SERIAL PRIMARY KEY,
                agent_id INTEGER NOT NULL REFERENCES comm_agents(id) ON DELETE CASCADE UNIQUE,
                mac VARCHAR(48),
                device_name VARCHAR(255),
                ip_addresses TEXT,
                os_name VARCHAR(255),
                os_version VARCHAR(255),
                os_arch VARCHAR(32),
                os_install_date TIMESTAMPTZ,
                manufacturer VARCHAR(255),
                model VARCHAR(255),
                device_type VARCHAR(32),
                cpu_name VARCHAR(255),
                cpu_cores INTEGER,
                cpu_clock_mhz INTEGER,
                ram_total_gb NUMERIC(10,2),
                ram_free_gb NUMERIC(10,2),
                disks_json JSONB,
                current_user VARCHAR(255),
                battery_status VARCHAR(64),
                battery_percent INTEGER,
                battery_charging BOOLEAN,
                antivirus_name VARCHAR(255),
                antivirus_state VARCHAR(64),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        console.log('📝 Creazione indici...');
        await client.query(`CREATE INDEX IF NOT EXISTS idx_comm_device_info_agent ON comm_device_info(agent_id);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_comm_device_info_mac ON comm_device_info(mac);`);

        console.log('✅ Tabella comm_device_info creata con successo.\n');
    } catch (err) {
        console.error('❌ Errore:', err.message);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

run().catch(() => process.exit(1));
