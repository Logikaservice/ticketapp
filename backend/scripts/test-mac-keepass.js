// Script per testare se un MAC viene trovato in Keepass
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const keepassDriveService = require('../utils/keepassDriveService');

async function main() {
  try {
    const macAddress = process.argv[2] || '10:13:31:CD:FF:6C';
    
    console.log('🔍 TEST RICERCA MAC IN KEEPASS');
    console.log('============================================================');
    console.log(`\nMAC da verificare: ${macAddress}\n`);

    const keepassPassword = process.env.KEEPASS_PASSWORD;
    if (!keepassPassword) {
      console.error('❌ Errore: KEEPASS_PASSWORD non configurato nel file .env');
      process.exit(1);
    }

    console.log('📥 Caricamento mappa KeePass da Google Drive...');
    
    // Invalida la cache per forzare il ricaricamento
    keepassDriveService.invalidateCache();
    
    // Carica la mappa MAC -> {title, path}
    const macMap = await keepassDriveService.getMacToTitleMap(keepassPassword);
    
    console.log(`✅ File KeePass caricato: ${macMap.size} MAC address trovati\n`);

    // Normalizza il MAC per la ricerca
    const normalizedMac = macAddress.replace(/[:-]/g, '').toUpperCase();
    
    console.log(`🔍 Ricerca MAC normalizzato: ${normalizedMac}\n`);
    
    // Cerca nella mappa
    const result = macMap.get(normalizedMac);
    
    if (result) {
      const lastPathElement = result.path ? result.path.split(' > ').pop() : null;
      console.log(`✅ MAC TROVATO in KeePass:`);
      console.log(`   - Titolo: "${result.title}"`);
      console.log(`   - Percorso completo: "${result.path}"`);
      console.log(`   - Ultimo elemento percorso: "${lastPathElement}"`);
    } else {
      console.log(`❌ MAC NON TROVATO in KeePass`);
      console.log(`\n📋 Esempi MAC presenti nella mappa (primi 10):`);
      const sampleMacs = Array.from(macMap.keys()).slice(0, 10);
      sampleMacs.forEach((mac, idx) => {
        const entry = macMap.get(mac);
        console.log(`   ${idx + 1}. ${mac} -> "${entry.title}" (${entry.path})`);
      });
      
      // Cerca MAC simili (stessi ultimi caratteri)
      console.log(`\n🔍 Cerca MAC simili (stessi ultimi 6 caratteri):`);
      const last6 = normalizedMac.slice(-6);
      let foundSimilar = false;
      for (const [mac, entry] of macMap.entries()) {
        if (mac.slice(-6) === last6 && mac !== normalizedMac) {
          console.log(`   - ${mac} -> "${entry.title}" (${entry.path})`);
          foundSimilar = true;
        }
      }
      if (!foundSimilar) {
        console.log(`   Nessun MAC simile trovato`);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Errore:', error);
    process.exit(1);
  }
}

main();
