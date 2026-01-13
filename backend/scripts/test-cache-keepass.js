/**
 * Script di test per verificare il comportamento della cache KeePass
 * Uso: node backend/scripts/test-cache-keepass.js <MAC>
 * Esempio: node backend/scripts/test-cache-keepass.js 90:09:D0:39:DC:35
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const keepassDriveService = require('../utils/keepassDriveService');

async function main() {
  try {
    const macAddress = process.argv[2] || '90:09:D0:39:DC:35';
    
    const keepassPassword = process.env.KEEPASS_PASSWORD;
    if (!keepassPassword) {
      console.error('❌ Errore: KEEPASS_PASSWORD non configurato nel file .env');
      process.exit(1);
    }

    console.log('🧪 TEST CACHE KEEPASS');
    console.log('============================================================');
    console.log(`\nMAC da testare: ${macAddress}\n`);

    // STEP 1: Cancella la cache
    console.log('📋 STEP 1: Cancellazione cache...');
    keepassDriveService.invalidateCache();
    console.log('✅ Cache invalidata\n');

    // STEP 2: Verifica che la cache sia vuota (prima caricamento)
    console.log('📋 STEP 2: Prima chiamata (cache vuota - dovrebbe caricare da Drive)...');
    const result1 = await keepassDriveService.getMacToTitleMap(keepassPassword);
    const mac1 = result1.get(macAddress.replace(/[:-]/g, '').toUpperCase());
    console.log(`✅ Dati caricati: ${result1.size} MAC trovati`);
    if (mac1) {
      console.log(`   MAC ${macAddress}:`);
      console.log(`     Titolo: "${mac1.title}"`);
      console.log(`     Prod.: "${mac1.path ? mac1.path.split(' > ').pop() : '-'}"`);
    } else {
      console.log(`   ❌ MAC ${macAddress} NON TROVATO`);
    }
    console.log('');

    // STEP 3: Seconda chiamata (cache dovrebbe essere valida)
    console.log('📋 STEP 3: Seconda chiamata (cache valida - dovrebbe usare cache)...');
    const result2 = await keepassDriveService.getMacToTitleMap(keepassPassword);
    const mac2 = result2.get(macAddress.replace(/[:-]/g, '').toUpperCase());
    console.log(`✅ Dati caricati: ${result2.size} MAC trovati`);
    if (mac2) {
      console.log(`   MAC ${macAddress}:`);
      console.log(`     Titolo: "${mac2.title}"`);
      console.log(`     Prod.: "${mac2.path ? mac2.path.split(' > ').pop() : '-'}"`);
    } else {
      console.log(`   ❌ MAC ${macAddress} NON TROVATO`);
    }
    console.log('');

    // STEP 4: Verifica se i dati sono gli stessi (dovrebbero essere identici se usa cache)
    console.log('📋 STEP 4: Verifica coerenza dati...');
    if (mac1 && mac2) {
      if (mac1.title === mac2.title && mac1.path === mac2.path) {
        console.log('✅ I dati sono identici (cache funziona correttamente)');
      } else {
        console.log('⚠️ I dati sono DIVERSI (cache non funziona correttamente!)');
        console.log(`   Prima chiamata: Titolo="${mac1.title}", Prod="${mac1.path ? mac1.path.split(' > ').pop() : '-'}"`);
        console.log(`   Seconda chiamata: Titolo="${mac2.title}", Prod="${mac2.path ? mac2.path.split(' > ').pop() : '-'}"`);
      }
    } else if (!mac1 && !mac2) {
      console.log('⚠️ MAC non trovato in entrambe le chiamate');
    } else {
      console.log('❌ MAC trovato solo in una chiamata (problema!)');
    }
    console.log('');

    // STEP 5: Verifica data modifica file
    console.log('📋 STEP 5: Verifica data modifica file su Google Drive...');
    const currentModifiedTime = await keepassDriveService.checkFileModified(keepassPassword);
    console.log(`✅ Data modifica file su Google Drive: ${currentModifiedTime || 'NON DISPONIBILE'}`);
    console.log('');

    // STEP 6: Cancella cache e ricarica (dovrebbe ricaricare da Drive)
    console.log('📋 STEP 6: Cancellazione cache e ricaricamento (dovrebbe ricaricare da Drive)...');
    keepassDriveService.invalidateCache();
    const result3 = await keepassDriveService.getMacToTitleMap(keepassPassword);
    const mac3 = result3.get(macAddress.replace(/[:-]/g, '').toUpperCase());
    console.log(`✅ Dati caricati: ${result3.size} MAC trovati`);
    if (mac3) {
      console.log(`   MAC ${macAddress}:`);
      console.log(`     Titolo: "${mac3.title}"`);
      console.log(`     Prod.: "${mac3.path ? mac3.path.split(' > ').pop() : '-'}"`);
      
      // Confronta con il primo risultato
      if (mac1 && mac1.title === mac3.title && mac1.path === mac3.path) {
        console.log(`   ✅ Dati identici al primo caricamento (OK)`);
      } else {
        console.log(`   ⚠️ Dati DIVERSI dal primo caricamento (problema!)`);
      }
    } else {
      console.log(`   ❌ MAC ${macAddress} NON TROVATO`);
    }
    console.log('');

    console.log('============================================================');
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
