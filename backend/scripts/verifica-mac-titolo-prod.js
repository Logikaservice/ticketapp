/**
 * Script per verificare Titolo e Prod. di un MAC specifico nel file KeePass
 * Uso: node backend/scripts/verifica-mac-titolo-prod.js <MAC>
 * Esempio: node backend/scripts/verifica-mac-titolo-prod.js 90:09:D0:39:DC:35
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const keepassDriveService = require('../utils/keepassDriveService');

async function main() {
  try {
    const macAddress = process.argv[2];
    
    if (!macAddress) {
      console.error('❌ Errore: Specifica un MAC address come parametro');
      console.log('   Uso: node backend/scripts/verifica-mac-titolo-prod.js <MAC>');
      console.log('   Esempio: node backend/scripts/verifica-mac-titolo-prod.js 90:09:D0:39:DC:35');
      process.exit(1);
    }

    const keepassPassword = process.env.KEEPASS_PASSWORD;
    if (!keepassPassword) {
      console.error('❌ Errore: KEEPASS_PASSWORD non configurato nel file .env');
      process.exit(1);
    }

    console.log('🔍 VERIFICA MAC NEL FILE KEEPASS');
    console.log('============================================================');
    console.log(`\nMAC da verificare: ${macAddress}\n`);

    console.log('📥 Caricamento file KeePass da Google Drive...');
    
    // Carica la mappa MAC -> {title, path}
    const macMap = await keepassDriveService.loadMacToTitleMap(keepassPassword);
    
    console.log(`✅ File KeePass caricato: ${macMap.size} MAC address trovati\n`);

    // Normalizza il MAC per la ricerca
    const normalizedMac = macAddress.replace(/[:-]/g, '').toUpperCase();
    
    console.log(`🔍 Ricerca MAC normalizzato: ${normalizedMac}\n`);
    
    // Cerca nella mappa
    const result = macMap.get(normalizedMac);
    
    if (result) {
      // Estrai solo l'ultimo elemento del percorso (come fa il codice)
      const lastPathElement = result.path ? result.path.split(' > ').pop() : null;
      
      console.log('============================================================');
      console.log('✅ MAC TROVATO!');
      console.log('============================================================');
      console.log(`\nMAC: ${macAddress}`);
      console.log(`MAC Normalizzato: ${normalizedMac}`);
      console.log(`\n📋 RISULTATO:`);
      console.log(`   Titolo: "${result.title}"`);
      console.log(`   Percorso completo: "${result.path || '-'}"`);
      console.log(`   Prod. (ultimo elemento): "${lastPathElement || '-'}"`);
      console.log('\n============================================================\n');
    } else {
      console.log('============================================================');
      console.log('❌ MAC NON TROVATO');
      console.log('============================================================');
      console.log(`\nIl MAC ${macAddress} (normalizzato: ${normalizedMac}) non è presente nel file KeePass.\n`);
      console.log('Suggerimenti:');
      console.log('  1. Verifica che il MAC sia presente nel file KeePass');
      console.log('  2. Verifica che il file su Google Drive sia aggiornato');
      console.log('  3. Controlla il formato del MAC (es: 90:09:D0:39:DC:35 o 90-09-D0-39-DC-35)');
      console.log('\n============================================================\n');
    }

    process.exit(0);
  } catch (err) {
    console.error('\n❌ Errore:', err.message);
    if (err.stack) {
      console.error('\nStack trace:');
      console.error(err.stack);
    }
    process.exit(1);
  }
}

main();
