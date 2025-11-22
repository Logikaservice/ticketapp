// Script per ripristinare i codici orari nel database
// Include tutti i codici di default + quelli personalizzati che erano presenti

const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const pool = new Pool({
  host: process.env.DB_ORARI_HOST || process.env.DB_HOST,
  port: process.env.DB_ORARI_PORT || process.env.DB_PORT || 5432,
  database: process.env.DB_ORARI_DATABASE || process.env.DB_NAME,
  user: process.env.DB_ORARI_USER || process.env.DB_USER,
  password: process.env.DB_ORARI_PASSWORD || process.env.DB_PASSWORD,
});

async function ripristinaCodiciOrari() {
  try {
    console.log('🔍 Controllo codici orari nel database...');
    
    // Ottieni il record più recente
    const result = await pool.query('SELECT id, data FROM orari_data ORDER BY id DESC LIMIT 1');
    
    if (result.rows.length === 0) {
      console.log('❌ Nessun record trovato nel database!');
      process.exit(1);
    }
    
    const currentData = result.rows[0].data;
    const recordId = result.rows[0].id;
    
    console.log('📋 Codici orari attuali:', currentData.timeCodes || 'NON PRESENTI');
    console.log('📋 Ordine attuale:', currentData.timeCodesOrder || 'NON PRESENTE');
    
    // Codici orari completi da ripristinare (basati su quelli che erano presenti)
    const codiciCompleti = {
      'R': 'Riposo',
      'F': 'Ferie',
      'M': 'Malattia',
      'P': 'Permesso',
      'I': 'Infortunio',
      'AT': 'Atripalda',
      'AV': 'Avellino',
      'L': 'Lioni'
    };
    
    const ordineCompleto = ['R', 'F', 'M', 'P', 'I', 'AT', 'AV', 'L'];
    
    // Aggiorna i dati mantenendo tutto il resto
    const updatedData = {
      ...currentData,
      timeCodes: codiciCompleti,
      timeCodesOrder: ordineCompleto
    };
    
    // Salva nel database
    await pool.query(
      'UPDATE orari_data SET data = $1::jsonb, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(updatedData), recordId]
    );
    
    console.log('✅ Codici orari ripristinati con successo!');
    console.log('📋 Codici ripristinati:', Object.keys(codiciCompleti));
    console.log('📋 Ordine ripristinato:', ordineCompleto);
    console.log('💾 Record ID aggiornato:', recordId);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Errore durante il ripristino:', error);
    process.exit(1);
  }
}

ripristinaCodiciOrari();

