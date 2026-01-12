// Script per testare la ricerca MAC in KeePass
// Esegui: node test-keepass-mac-search.js <password> <mac_address>

const keepassDriveService = require('./backend/utils/keepassDriveService');

async function testMacSearch() {
  const password = process.argv[2];
  const macAddress = process.argv[3] || '90:09:D0:39:DC:35';

  if (!password) {
    console.error('❌ Password KeePass richiesta!');
    console.log('Uso: node test-keepass-mac-search.js <password> [mac_address]');
    console.log('Esempio: node test-keepass-mac-search.js miapassword 90:09:D0:39:DC:35');
    process.exit(1);
  }

  console.log('🔍 Test ricerca MAC in KeePass');
  console.log('==============================\n');
  console.log(`MAC da cercare: ${macAddress}\n`);

  try {
    // Test normalizzazione
    const normalizedMac = keepassDriveService.normalizeMacForSearch(macAddress);
    console.log(`MAC normalizzato: ${normalizedMac}\n`);

    // Test ricerca
    console.log('🔍 Avvio ricerca in KeePass...\n');
    const title = await keepassDriveService.findMacTitle(macAddress, password);

    if (title) {
      console.log(`\n✅ RISULTATO: MAC trovato!`);
      console.log(`   MAC: ${macAddress}`);
      console.log(`   Titolo: "${title}"`);
    } else {
      console.log(`\n❌ RISULTATO: MAC non trovato in KeePass`);
      console.log(`   MAC: ${macAddress}`);
      console.log(`   MAC normalizzato: ${normalizedMac}`);
      
      // Prova a vedere cosa c'è nella mappa
      console.log('\n📊 Caricamento mappa completa...');
      const macMap = await keepassDriveService.getMacToTitleMap(password);
      console.log(`   Totale MAC nella mappa: ${macMap.size}`);
      
      if (macMap.size > 0) {
        console.log('\n   Esempi MAC nella mappa (primi 10):');
        const first10 = Array.from(macMap.entries()).slice(0, 10);
        first10.forEach(([mac, title]) => {
          console.log(`     - ${mac} -> "${title}"`);
        });
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testMacSearch();
