// Script per inizializzare il database Vivaldi
// Crea il database e le tabelle necessarie

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function initVivaldiDatabase() {
  try {
    // Prima connettiti al database postgres per creare il database vivaldi_db
    const adminPool = new Pool({
      connectionString: process.env.DATABASE_URL?.replace(/\/[^\/]+$/, '/postgres') || 
                        process.env.DATABASE_URL?.replace(/\/[^\/]+$/, '/template1'),
      ssl: {
        rejectUnauthorized: false
      }
    });

    try {
    console.log('🔄 Connessione al database admin...');
    await adminPool.connect();
    console.log('✅ Connesso al database admin');

    // Crea database vivaldi_db se non esiste
    console.log('🔄 Creazione database vivaldi_db...');
    try {
      await adminPool.query('CREATE DATABASE vivaldi_db');
      console.log('✅ Database vivaldi_db creato');
    } catch (err) {
      if (err.code === '42P04') {
        console.log('ℹ️  Database vivaldi_db già esistente');
      } else {
        throw err;
      }
    }

    await adminPool.end();
    console.log('✅ Disconnesso dal database admin');
    console.log('🔄 Procedo con la creazione delle tabelle...');

    // Ora connettiti al database vivaldi_db per creare le tabelle
    // .env già caricato all'inizio dello script
    
    const vivaldiUrl = process.env.DATABASE_URL_VIVALDI || 
                       process.env.DATABASE_URL?.replace(/\/[^\/]+$/, '/vivaldi_db');
    
    console.log('🔍 DATABASE_URL_VIVALDI:', vivaldiUrl ? 'Configurato' : 'NON CONFIGURATO');
    
    if (!vivaldiUrl) {
      console.error('❌ DATABASE_URL_VIVALDI non configurato!');
      console.error('   Configura DATABASE_URL_VIVALDI nel file .env oppure');
      console.error('   usa DATABASE_URL come base (verrà sostituito il nome database)');
      throw new Error('DATABASE_URL_VIVALDI non configurato. Impostalo nel file .env');
    }

    const vivaldiPool = new Pool({
      connectionString: vivaldiUrl,
      ssl: {
        rejectUnauthorized: false
      }
    });

    console.log('🔄 Connessione al database vivaldi_db...');
    try {
      await vivaldiPool.connect();
      console.log('✅ Connesso al database vivaldi_db');
    } catch (connErr) {
      console.error('❌ Errore connessione al database vivaldi_db:', connErr.message);
      console.error('   Verifica che DATABASE_URL_VIVALDI sia corretto nel file .env');
      throw connErr;
    }

    // Crea tabelle
    console.log('🔄 Creazione tabelle...');

    // Tabella configurazione
    await vivaldiPool.query(`
      CREATE TABLE IF NOT EXISTS vivaldi_config (
        id SERIAL PRIMARY KEY,
        chiave VARCHAR(100) UNIQUE NOT NULL,
        valore TEXT,
        descrizione TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Tabella vivaldi_config creata');

    // Tabella annunci
    await vivaldiPool.query(`
      CREATE TABLE IF NOT EXISTS annunci (
        id SERIAL PRIMARY KEY,
        contenuto TEXT NOT NULL,
        contenuto_pulito TEXT,
        speaker VARCHAR(50) DEFAULT 'Giulia',
        velocita DECIMAL(3,2) DEFAULT 1.0,
        tono DECIMAL(3,2) DEFAULT 1.0,
        audio_file_path VARCHAR(255),
        audio_url TEXT,
        tipo VARCHAR(20) DEFAULT 'testuale' CHECK (tipo IN ('testuale', 'audio')),
        priorita VARCHAR(20) DEFAULT 'Media' CHECK (priorita IN ('Bassa', 'Media', 'Alta', 'Urgente')),
        azienda_id INTEGER NOT NULL,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Tabella annunci creata');

    // Tabella schedulazione
    await vivaldiPool.query(`
      CREATE TABLE IF NOT EXISTS annunci_schedule (
        id SERIAL PRIMARY KEY,
        annuncio_id INTEGER REFERENCES annunci(id) ON DELETE CASCADE,
        priorita VARCHAR(20) DEFAULT 'Media' CHECK (priorita IN ('Bassa', 'Media', 'Alta', 'Urgente')),
        schedulazione JSONB NOT NULL DEFAULT '{}',
        stato VARCHAR(20) DEFAULT 'attivo' CHECK (stato IN ('attivo', 'pausa', 'completato', 'cancellato')),
        esecuzioni_totali INTEGER DEFAULT 0,
        esecuzioni_completate INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Tabella annunci_schedule creata');

    // Tabella coda
    await vivaldiPool.query(`
      CREATE TABLE IF NOT EXISTS annunci_queue (
        id SERIAL PRIMARY KEY,
        annuncio_id INTEGER REFERENCES annunci(id) ON DELETE CASCADE,
        schedule_id INTEGER REFERENCES annunci_schedule(id) ON DELETE CASCADE,
        priorita VARCHAR(20) DEFAULT 'Media' CHECK (priorita IN ('Bassa', 'Media', 'Alta', 'Urgente')),
        azienda_id INTEGER NOT NULL,
        stato VARCHAR(20) DEFAULT 'pending' CHECK (stato IN ('pending', 'playing', 'completed', 'failed')),
        scheduled_for TIMESTAMP NOT NULL,
        executed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Tabella annunci_queue creata');

    // Tabella storico
    await vivaldiPool.query(`
      CREATE TABLE IF NOT EXISTS annunci_history (
        id SERIAL PRIMARY KEY,
        annuncio_id INTEGER REFERENCES annunci(id) ON DELETE CASCADE,
        schedule_id INTEGER REFERENCES annunci_schedule(id) ON DELETE SET NULL,
        azienda_id INTEGER NOT NULL,
        priorita VARCHAR(20),
        eseguito_at TIMESTAMP DEFAULT NOW(),
        audio_url TEXT,
        durata_secondi INTEGER,
        stato VARCHAR(20) DEFAULT 'success' CHECK (stato IN ('success', 'failed', 'cancelled'))
      )
    `);
    console.log('✅ Tabella annunci_history creata');

    // Indici
    await vivaldiPool.query(`CREATE INDEX IF NOT EXISTS idx_annunci_azienda ON annunci(azienda_id)`);
    await vivaldiPool.query(`CREATE INDEX IF NOT EXISTS idx_annunci_priorita ON annunci(priorita)`);
    await vivaldiPool.query(`CREATE INDEX IF NOT EXISTS idx_schedule_stato ON annunci_schedule(stato)`);
    await vivaldiPool.query(`CREATE INDEX IF NOT EXISTS idx_queue_pending ON annunci_queue(stato, azienda_id, scheduled_for)`);
    await vivaldiPool.query(`CREATE INDEX IF NOT EXISTS idx_history_azienda ON annunci_history(azienda_id, eseguito_at)`);
    console.log('✅ Indici creati');

    // Inserisci configurazione default
    const configCheck = await vivaldiPool.query('SELECT COUNT(*) FROM vivaldi_config WHERE chiave = $1', ['speechgen_api_key']);
    if (parseInt(configCheck.rows[0].count) === 0) {
      await vivaldiPool.query(`
        INSERT INTO vivaldi_config (chiave, valore, descrizione) VALUES
        ('speechgen_api_key', '', 'API Key per SpeechGen.io'),
        ('speechgen_email', '', 'Email per SpeechGen.io'),
        ('gemini_api_key', '', 'API Key per Google Gemini')
      `);
      console.log('✅ Configurazione default inserita');
    }

    await vivaldiPool.end();
    console.log('');
    console.log('✅ Database Vivaldi inizializzato con successo!');
    console.log('');
    console.log('📝 Prossimi passi:');
    console.log('1. ✅ DATABASE_URL_VIVALDI già configurato nel file .env');
    console.log('2. Configura le API keys in Vivaldi (SpeechGen.io e Gemini)');
    console.log('3. Riavvia il backend per attivare il sistema Vivaldi');
    } catch (poolErr) {
      console.error('❌ Errore durante creazione tabelle:', poolErr.message);
      throw poolErr;
    }
  } catch (error) {
    console.error('❌ Errore inizializzazione database Vivaldi:', error.message);
    console.error('❌ Stack:', error.stack);
    process.exit(1);
  }
}

initVivaldiDatabase();

