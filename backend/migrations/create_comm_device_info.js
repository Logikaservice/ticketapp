/**
 * Migrazione: crea la tabella comm_device_info (inventario dispositivi dagli agent).
 * Eseguire dalla root progetto: node backend/migrations/create_comm_device_info.js
 * Carica DATABASE_URL da .env (cerca in root, backend, o cwd) oppure passalo: DATABASE_URL="..." node ...
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const possibleEnvPaths = [
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../.env'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'backend/.env')
];
for (const envPath of possibleEnvPaths) {
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
        break;
    }
}

// Fallback: se DATABASE_URL non è ancora impostato, leggi backend/.env manualmente (utile quando .env è in backend/)
if (!process.env.DATABASE_URL) {
    const backendEnv = path.resolve(__dirname, '../.env');
    if (fs.existsSync(backendEnv)) {
        const content = fs.readFileSync(backendEnv, 'utf8');
        const match = content.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/m);
        if (match) {
            process.env.DATABASE_URL = match[1].trim().replace(/^["']|["']$/g, '');
        }
    }
}

const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error('❌ DATABASE_URL non configurato.');
    console.error('   Opzioni:');
    console.error('   1. Crea un file .env nella root del progetto (/var/www/ticketapp/.env) con riga: DATABASE_URL=postgresql://user:password@host:5432/nome_db');
    console.error('   2. Oppure esegui: DATABASE_URL="postgresql://user:password@host:5432/nome_db" node backend/migrations/create_comm_device_info.js');
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
