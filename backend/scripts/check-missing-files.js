// Script per verificare quali file allegati mancano sul server
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : {
    rejectUnauthorized: false
  }
});

async function checkMissingFiles() {
  try {
    console.log('=== VERIFICA FILE ALLEGATI MANCANTI ===\n');
    
    const client = await pool.connect();
    
    // Recupera tutti i ticket con photos
    const result = await client.query(`
      SELECT id, numero, photos 
      FROM tickets 
      WHERE photos IS NOT NULL 
        AND photos::text != '[]'
        AND photos::text != ''
        AND photos::text != 'null'
    `);
    
    client.release();
    
    const tickets = result.rows;
    console.log(`📋 Trovati ${tickets.length} ticket con foto allegate\n`);
    
    const uploadPath = path.join(__dirname, '../uploads/tickets/photos');
    const uploadOffertePath = path.join(__dirname, '../uploads/tickets/offerte');
    
    let totalFiles = 0;
    let missingFiles = 0;
    const missingFilesList = [];
    
    for (const ticket of tickets) {
      let photos = [];
      try {
        if (ticket.photos) {
          photos = typeof ticket.photos === 'string' 
            ? JSON.parse(ticket.photos) 
            : ticket.photos;
          if (!Array.isArray(photos)) photos = [];
        }
      } catch (e) {
        console.warn(`⚠️  Ticket #${ticket.numero || ticket.id}: errore parsing photos`);
        continue;
      }
      
      for (const photo of photos) {
        totalFiles++;
        const filePath = photo.path;
        
        if (!filePath) {
          console.warn(`⚠️  Ticket #${ticket.numero || ticket.id}: photo senza path`);
          continue;
        }
        
        // Determina il percorso fisico
        let physicalPath;
        if (filePath.includes('/offerte/')) {
          const filename = filePath.replace('/uploads/tickets/offerte/', '');
          physicalPath = path.join(uploadOffertePath, filename);
        } else {
          const filename = filePath.replace('/uploads/tickets/photos/', '');
          physicalPath = path.join(uploadPath, filename);
        }
        
        // Verifica se il file esiste
        if (!fs.existsSync(physicalPath)) {
          missingFiles++;
          missingFilesList.push({
            ticketId: ticket.id,
            ticketNumero: ticket.numero,
            filename: photo.filename || path.basename(physicalPath),
            path: filePath,
            physicalPath: physicalPath,
            originalName: photo.originalName
          });
          console.log(`❌ File mancante: Ticket #${ticket.numero} - ${photo.originalName || photo.filename}`);
          console.log(`   Path DB: ${filePath}`);
          console.log(`   Path fisico: ${physicalPath}\n`);
        }
      }
    }
    
    console.log('\n=== RIEPILOGO ===');
    console.log(`📊 Totale file nel database: ${totalFiles}`);
    console.log(`❌ File mancanti: ${missingFiles}`);
    console.log(`✅ File presenti: ${totalFiles - missingFiles}`);
    
    if (missingFiles > 0) {
      console.log('\n⚠️  Lista file mancanti:');
      missingFilesList.forEach((item, idx) => {
        console.log(`\n${idx + 1}. Ticket #${item.ticketNumero} (ID: ${item.ticketId})`);
        console.log(`   Nome originale: ${item.originalName}`);
        console.log(`   Filename DB: ${item.filename}`);
        console.log(`   Path DB: ${item.path}`);
      });
      
      console.log('\n💡 Possibili cause:');
      console.log('   - File caricati con metodo diverso (es. Google Drive)');
      console.log('   - File eliminati manualmente dal server');
      console.log('   - Nome file modificato dopo il caricamento');
      console.log('   - Percorso di upload cambiato');
    } else {
      console.log('\n✅ Tutti i file sono presenti sul server!');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Errore:', err);
    process.exit(1);
  }
}

checkMissingFiles();
