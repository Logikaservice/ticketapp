/**
 * Script per invalidare manualmente la cache KeePass
 * Uso: node backend/scripts/invalida-cache-keepass.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const keepassDriveService = require('../utils/keepassDriveService');

async function main() {
  try {
    console.log('🔄 Invalidazione cache KeePass...');
    
    // Invalida la cache
    keepassDriveService.invalidateCache();
    
    console.log('✅ Cache KeePass invalidata con successo!');
    console.log('   Il prossimo caricamento ricaricherà i dati da Google Drive.');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Errore invalidazione cache:', err.message);
    process.exit(1);
  }
}

main();
