// Script per testare la connessione al database Vivaldi
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function testConnection() {
  const vivaldiUrl = process.env.DATABASE_URL_VIVALDI;
  
  if (!vivaldiUrl) {
    console.error('❌ DATABASE_URL_VIVALDI non configurato');
    process.exit(1);
  }

  console.log('🔍 Connection string:', vivaldiUrl.replace(/:[^:@]+@/, ':***@'));
  
  const pool = new Pool({
    connectionString: vivaldiUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    const client = await pool.connect();
    console.log('✅ Connessione riuscita');

    // Verifica database
    const dbResult = await client.query('SELECT current_database()');
    console.log('📊 Database corrente:', dbResult.rows[0].current_database);

    // Verifica schema
    const schemaResult = await client.query('SELECT current_schema()');
    console.log('📊 Schema corrente:', schemaResult.rows[0].current_schema);

    // Verifica se la tabella esiste
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'annunci_queue'
    `);
    
    if (tableCheck.rows.length > 0) {
      console.log('✅ Tabella annunci_queue trovata nello schema public');
    } else {
      console.error('❌ Tabella annunci_queue NON trovata nello schema public');
      
      // Cerca in altri schemi
      const allTables = await client.query(`
        SELECT table_schema, table_name 
        FROM information_schema.tables 
        WHERE table_name = 'annunci_queue'
      `);
      
      if (allTables.rows.length > 0) {
        console.log('⚠️ Tabella trovata in altri schemi:', allTables.rows);
      } else {
        console.error('❌ Tabella annunci_queue non trovata in nessuno schema');
      }
    }

    // Prova query diretta
    try {
      const testQuery = await client.query('SELECT COUNT(*) FROM annunci_queue');
      console.log('✅ Query SELECT su annunci_queue riuscita:', testQuery.rows[0].count);
    } catch (queryErr) {
      console.error('❌ Errore query SELECT:', queryErr.message);
      console.error('   Codice:', queryErr.code);
    }

    // Lista tutte le tabelle
    const allTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log('📋 Tabelle nello schema public:');
    allTables.rows.forEach(row => {
      console.log('   -', row.table_name);
    });

    client.release();
    await pool.end();
    console.log('✅ Test completato');
  } catch (error) {
    console.error('❌ Errore:', error.message);
    console.error('   Codice:', error.code);
    process.exit(1);
  }
}

testConnection();

