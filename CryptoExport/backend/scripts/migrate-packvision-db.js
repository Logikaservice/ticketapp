// Script per migrare il database PackVision e aggiungere colonne mancanti
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const packvisionDbUrl = process.env.DATABASE_URL?.replace(/\/[^\/]+$/, '/packvision_db');

if (!packvisionDbUrl) {
    console.error('❌ DATABASE_URL non definita nel file .env');
    process.exit(1);
}

const pool = new Pool({
    connectionString: packvisionDbUrl,
    ssl: packvisionDbUrl.includes('localhost') || packvisionDbUrl.includes('127.0.0.1') 
        ? false 
        : { rejectUnauthorized: false }
});

async function migratePackVisionDatabase() {
    let client = null;
    
    try {
        console.log('🔄 Inizio migrazione database PackVision...');
        console.log(`📡 Connessione a: ${packvisionDbUrl.replace(/:[^:@]+@/, ':****@')}`);
        
        client = await pool.connect();
        console.log('✅ Connessione al database riuscita');
        
        // Verifica che la tabella messages esista
        const tableCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'messages'
            )
        `);
        
        if (!tableCheck.rows[0]?.exists) {
            console.error('❌ La tabella messages non esiste!');
            console.log('💡 Esegui prima: node backend/scripts/init_packvision_db.js');
            process.exit(1);
        }
        
        console.log('✅ Tabella messages trovata');
        
        // Aggiungi colonne se non esistono
        console.log('📝 Aggiunta colonne mancanti...');
        
        // duration_hours
        try {
            await client.query(`
                ALTER TABLE messages 
                ADD COLUMN IF NOT EXISTS duration_hours INTEGER
            `);
            console.log('✅ Colonna duration_hours verificata/aggiunta');
        } catch (err) {
            console.warn('⚠️ Errore aggiunta colonna duration_hours:', err.message);
        }
        
        // expires_at
        try {
            await client.query(`
                ALTER TABLE messages 
                ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ
            `);
            console.log('✅ Colonna expires_at verificata/aggiunta');
        } catch (err) {
            console.warn('⚠️ Errore aggiunta colonna expires_at:', err.message);
        }
        
        // updated_at
        try {
            await client.query(`
                ALTER TABLE messages 
                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()
            `);
            console.log('✅ Colonna updated_at verificata/aggiunta');
        } catch (err) {
            console.warn('⚠️ Errore aggiunta colonna updated_at:', err.message);
        }
        
        // order_index (opzionale, per drag & drop)
        try {
            await client.query(`
                ALTER TABLE messages 
                ADD COLUMN IF NOT EXISTS order_index INTEGER
            `);
            
            // Se ci sono messaggi senza order_index, inizializzali
            await client.query(`
                WITH ranked_messages AS (
                    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) - 1 as rn 
                    FROM messages 
                    WHERE order_index IS NULL
                )
                UPDATE messages 
                SET order_index = rm.rn 
                FROM ranked_messages rm 
                WHERE messages.id = rm.id
            `);
            
            console.log('✅ Colonna order_index verificata/aggiunta');
        } catch (err) {
            console.warn('⚠️ Errore aggiunta colonna order_index:', err.message);
        }
        
        // Crea indice per expires_at
        try {
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_messages_expires_at 
                ON messages(expires_at)
            `);
            console.log('✅ Indice expires_at verificato/creato');
        } catch (err) {
            console.warn('⚠️ Errore creazione indice expires_at:', err.message);
        }
        
        // Verifica struttura finale
        const columns = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'messages' 
            ORDER BY ordinal_position
        `);
        
        console.log('\n📊 Struttura tabella messages:');
        columns.rows.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type}`);
        });
        
        console.log('\n✅ Migrazione completata con successo!');
        
    } catch (err) {
        console.error('❌ Errore durante la migrazione:', err);
        console.error('Stack:', err.stack);
        process.exit(1);
    } finally {
        if (client) {
            client.release();
        }
        await pool.end();
    }
}

migratePackVisionDatabase();

