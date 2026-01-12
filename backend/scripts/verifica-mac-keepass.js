// Script per verificare se un MAC specifico è presente in KeePass
// Esegui: node backend/scripts/verifica-mac-keepass.js <mac_address>

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const keepassDriveService = require('../utils/keepassDriveService');

async function verificaMac() {
  const macAddress = process.argv[2] || '90:09:D0:39:DC:35';

  if (!process.env.KEEPASS_PASSWORD) {
    console.error('❌ KEEPASS_PASSWORD non configurata nel file .env');
    process.exit(1);
  }

  console.log('🔍 VERIFICA MAC IN KEEPASS');
  console.log('='.repeat(50));
  console.log('');
  console.log(`MAC da cercare: ${macAddress}`);
  console.log('');

  try {
    // Normalizza il MAC
    const normalizedMac = keepassDriveService.normalizeMacForSearch(macAddress);
    console.log(`MAC normalizzato: ${normalizedMac}`);
    console.log('');

    // Carica la mappa completa (bypass cache per vedere tutto)
    console.log('📥 Caricamento mappa KeePass (bypass cache)...');
    const macMap = await keepassDriveService.loadMacToTitleMap(process.env.KEEPASS_PASSWORD);
    console.log(`✅ Mappa caricata: ${macMap.size} MAC address trovati`);
    console.log('');

    // Cerca il MAC
    const title = macMap.get(normalizedMac);
    
    if (title) {
      console.log(`✅ MAC TROVATO!`);
      console.log(`   MAC: ${macAddress}`);
      console.log(`   MAC normalizzato: ${normalizedMac}`);
      console.log(`   Titolo: "${title}"`);
    } else {
      console.log(`❌ MAC NON TROVATO nella mappa`);
      console.log(`   MAC: ${macAddress}`);
      console.log(`   MAC normalizzato: ${normalizedMac}`);
      console.log('');

      // Cerca varianti del MAC
      const variants = [
        macAddress.replace(/:/g, '-'),
        macAddress.replace(/-/g, ':'),
        macAddress.replace(/[:-]/g, ''),
        macAddress.toUpperCase(),
        macAddress.toLowerCase()
      ].filter(v => v !== macAddress);

      console.log('🔍 Cercando varianti del MAC:');
      let foundVariant = null;
      for (const variant of variants) {
        const variantNormalized = keepassDriveService.normalizeMacForSearch(variant);
        const variantTitle = macMap.get(variantNormalized);
        if (variantTitle) {
          console.log(`   ✅ Variante "${variant}" (normalizzato: ${variantNormalized}) -> Titolo: "${variantTitle}"`);
          foundVariant = { variant, normalized: variantNormalized, title: variantTitle };
          break;
        } else {
          console.log(`   ❌ Variante "${variant}" (normalizzato: ${variantNormalized}) -> Non trovato`);
        }
      }
      console.log('');

      // Mostra alcuni esempi di MAC nella mappa
      console.log('📋 Esempi MAC nella mappa (primi 20):');
      const examples = Array.from(macMap.entries()).slice(0, 20);
      examples.forEach(([mac, title]) => {
        const highlight = mac.includes(normalizedMac.slice(0, 6)) || normalizedMac.includes(mac.slice(0, 6));
        const marker = highlight ? '🔍' : '  ';
        console.log(`${marker} ${mac} -> "${title}"`);
      });
    }

    console.log('');
    console.log('='.repeat(50));

    process.exit(title ? 0 : 1);
  } catch (error) {
    console.error('');
    console.error('❌ ERRORE:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

verificaMac();
