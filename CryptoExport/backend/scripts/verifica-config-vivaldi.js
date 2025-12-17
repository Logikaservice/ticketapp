// Script per verificare la configurazione Vivaldi nel database
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function verificaConfig() {
  const vivaldiUrl = process.env.DATABASE_URL_VIVALDI;
  
  if (!vivaldiUrl) {
    console.error('❌ DATABASE_URL_VIVALDI non configurato');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: vivaldiUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    const client = await pool.connect();
    
    const result = await client.query('SELECT chiave, valore, descrizione FROM vivaldi_config ORDER BY chiave');
    
    console.log('📋 Configurazione Vivaldi nel database:');
    console.log('');
    
    result.rows.forEach(row => {
      const valore = row.chiave.includes('key') || row.chiave.includes('api') 
        ? (row.valore ? `${row.valore.substring(0, 20)}...` : '(vuoto)')
        : row.valore || '(vuoto)';
      console.log(`  ${row.chiave}: ${valore}`);
      console.log(`    ${row.descrizione}`);
      console.log('');
    });

    client.release();
    await pool.end();
  } catch (error) {
    console.error('❌ Errore:', error.message);
    process.exit(1);
  }
}

verificaConfig();

