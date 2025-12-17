const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mainDbUrl = process.env.DATABASE_URL;
const packvisionDbName = 'packvision_db';

if (!mainDbUrl) {
    console.error('❌ DATABASE_URL non definita nel file .env');
    process.exit(1);
}

// Mask password for logging
const maskedUrl = mainDbUrl.replace(/:([^:@]+)@/, ':****@');
console.log(`Tentativo di connessione a: ${maskedUrl}`);

// Estrai la base URL senza il nome del database per connettersi al server (postgres default db)
// Assumiamo che la connection string finisca con /nome_db
const baseUrl = mainDbUrl.replace(/\/[^\/]+$/, '');
// Costruiamo la URL per il database di default (spesso 'postgres') per lanciare il comando CREATE DATABASE
// Se la stringa originale ha query params (es ?sslmode=require), dobbiamo gestirli.
// Per semplicità, proviamo a connetterci allo stesso DB della stringa principale per lanciare il comando,
// sperando che l'utente abbia i permessi di creare DB.
const maintenanceDbUrl = mainDbUrl;

async function createDatabase() {
    // Configurazione SSL come nell'app principale
    const isLocal = mainDbUrl.includes('localhost') || mainDbUrl.includes('127.0.0.1');
    const poolConfig = {
        connectionString: mainDbUrl, // Ci connettiamo al DB esistente per crearne uno nuovo
        ssl: isLocal ? false : { rejectUnauthorized: false }
    };

    const pool = new Pool(poolConfig);

    try {
        const client = await pool.connect();
        console.log('✅ Connessione al database principale riuscita.');

        // Verifica se il database esiste
        const checkRes = await client.query(`SELECT 1 FROM pg_database WHERE datname = '${packvisionDbName}'`);

        if (checkRes.rowCount === 0) {
            console.log(`Database ${packvisionDbName} non trovato. Tentativo di creazione...`);
            try {
                // CREATE DATABASE non può essere eseguito in una transazione
                await client.query(`CREATE DATABASE "${packvisionDbName}"`);
                console.log(`✅ Database ${packvisionDbName} creato con successo.`);
            } catch (e) {
                console.error(`❌ Errore creazione database: ${e.message}`);
                console.log('⚠️  Se non hai i permessi per creare database, chiedi all\'amministratore o crea il DB manualmente.');
                console.log('⚠️  Nome DB richiesto: ' + packvisionDbName);
                process.exit(1);
            }
        } else {
            console.log(`Database ${packvisionDbName} già esistente.`);
        }

        client.release();
        await pool.end();

        // Ora inizializziamo le tabelle nel nuovo DB
        await initTables();

    } catch (err) {
        console.error('❌ Errore connessione al database principale:', err.message);
        if (err.message.includes('password authentication failed')) {
            console.error('Suggerimento: Verifica le credenziali nel file .env');
        }
        process.exit(1);
    }
}

async function initTables() {
    // Costruisci la stringa di connessione per il nuovo DB
    // Sostituiamo il nome del DB nella stringa originale
    // Questo è un po' fragile se ci sono parametri, ma proviamo
    let packvisionDbUrl;
    const dbNameMatch = mainDbUrl.match(/\/([^\/?]+)(\?.*)?$/);
    if (dbNameMatch) {
        const currentDbName = dbNameMatch[1];
        packvisionDbUrl = mainDbUrl.replace(`/${currentDbName}`, `/${packvisionDbName}`);
    } else {
        // Fallback semplice
        packvisionDbUrl = `${baseUrl}/${packvisionDbName}`;
    }

    console.log(`Connessione a ${packvisionDbName} per inizializzare le tabelle...`);

    const isLocal = packvisionDbUrl.includes('localhost') || packvisionDbUrl.includes('127.0.0.1');
    const poolConfig = {
        connectionString: packvisionDbUrl,
        ssl: isLocal ? false : { rejectUnauthorized: false }
    };

    const pool = new Pool(poolConfig);

    try {
        const client = await pool.connect();

        // Tabella Messaggi
        await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        priority VARCHAR(50) DEFAULT 'info',
        display_mode VARCHAR(50) DEFAULT 'single',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        active BOOLEAN DEFAULT TRUE
      )
    `);
        console.log('✅ Tabella messages verificata/creata.');

        // Tabella Impostazioni
        await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(50) PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
        console.log('✅ Tabella settings verificata/creata.');

        // Default settings
        await client.query(`
      INSERT INTO settings (key, value) 
      VALUES ('view_mode', 'single') 
      ON CONFLICT (key) DO NOTHING
    `);

        client.release();
        await pool.end();
        console.log('✅ Inizializzazione PackVision DB completata con successo!');

    } catch (err) {
        console.error('❌ Errore inizializzazione tabelle:', err.message);
    }
}

createDatabase();
