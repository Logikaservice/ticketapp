/**
 * Script per testare direttamente loadMacToTitleMap (bypassando cache)
 * e cercare un MAC specifico con output dettagliato
 * Uso: node backend/scripts/test-load-mac-map-directly.js <MAC>
 * Esempio: node backend/scripts/test-load-mac-map-directly.js 90:09:D0:39:DC:35
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const keepassDriveService = require('../utils/keepassDriveService');

async function main() {
  try {
    const macAddress = process.argv[2] || '90:09:D0:39:DC:35';
    
    const keepassPassword = process.env.KEEPASS_PASSWORD;
    if (!keepassPassword) {
      console.error('❌ Errore: KEEPASS_PASSWORD non configurato nel file .env');
      process.exit(1);
    }

    console.log('🧪 TEST DIRETTO loadMacToTitleMap');
    console.log('============================================================');
    console.log(`\nMAC da testare: ${macAddress}\n`);

    // Normalizza il MAC
    const normalizedMac = keepassDriveService.normalizeMacForSearch(macAddress);
    console.log(`MAC normalizzato: ${normalizedMac}\n`);

    // Carica la mappa direttamente (bypassando cache)
    console.log('📥 Caricamento mappa MAC->Titolo direttamente (bypassando cache)...\n');
    const macMap = await keepassDriveService.loadMacToTitleMap(keepassPassword);

    console.log(`\n✅ Mappa caricata: ${macMap.size} MAC trovati\n`);

    // Cerca il MAC nella mappa
    console.log(`🔍 Ricerca MAC "${normalizedMac}" nella mappa...\n`);
    const result = macMap.get(normalizedMac);

    if (result) {
      const lastPathElement = result.path ? result.path.split(' > ').pop() : null;
      console.log('============================================================');
      console.log('✅ MAC TROVATO!');
      console.log('============================================================');
      console.log(`   Titolo: "${result.title}"`);
      console.log(`   Percorso completo: "${result.path}"`);
      console.log(`   Prod. (ultimo elemento): "${lastPathElement}"`);
    } else {
      console.log('============================================================');
      console.log('❌ MAC NON TROVATO');
      console.log('============================================================');
      console.log(`Il MAC ${macAddress} (normalizzato: ${normalizedMac}) non è presente nella mappa.\n`);
      
      // Mostra alcuni MAC simili
      console.log('🔍 Cercando MAC simili (stesso prefisso)...\n');
      const prefix = normalizedMac.substring(0, 6);
      const similarMacs = Array.from(macMap.entries()).filter(([mac, data]) => mac.startsWith(prefix));
      
      if (similarMacs.length > 0) {
        console.log(`📋 MAC con prefisso "${prefix}" (${similarMacs.length} trovati):`);
        similarMacs.forEach(([mac, data]) => {
          const lastPathElement = data.path ? data.path.split(' > ').pop() : null;
          console.log(`   - ${mac} -> Titolo: "${data.title}", Prod.: "${lastPathElement}"`);
        });
      } else {
        console.log(`❌ Nessun MAC con prefisso "${prefix}" trovato`);
      }
      
      console.log('\n📋 Primi 10 MAC nella mappa (per riferimento):');
      const first10 = Array.from(macMap.entries()).slice(0, 10);
      first10.forEach(([mac, data]) => {
        const lastPathElement = data.path ? data.path.split(' > ').pop() : null;
        console.log(`   - ${mac} -> Titolo: "${data.title}", Prod.: "${lastPathElement}"`);
      });
    }

    console.log('\n============================================================');
    console.log('✅ Test completato!');
    console.log('============================================================\n');

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
