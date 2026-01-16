// Script per aggiornare un MAC specifico da Keepass nel database
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Pool } = require('pg');
const keepassDriveService = require('../utils/keepassDriveService');

async function main() {
  try {
    const macAddress = process.argv[2] || '10:13:31:CD:FF:6C';
    
    console.log('🔄 AGGIORNAMENTO MAC DA KEEPASS NEL DATABASE');
    console.log('============================================================');
    console.log(`\nMAC da aggiornare: ${macAddress}\n`);

    // Connessione al database
    const pool = new Pool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });

    const keepassPassword = process.env.KEEPASS_PASSWORD;
    if (!keepassPassword) {
      console.error('❌ Errore: KEEPASS_PASSWORD non configurato nel file .env');
      process.exit(1);
    }

    // Normalizza il MAC
    const normalizedMac = macAddress.replace(/[:-]/g, '').toUpperCase();
    console.log(`📝 MAC normalizzato: ${normalizedMac}\n`);

    // 1. Verifica se il dispositivo esiste nel database
    console.log('🔍 Verifica dispositivo nel database...');
    const deviceResult = await pool.query(
      `SELECT id, mac_address, device_type, device_path, ip_address 
       FROM network_devices 
       WHERE mac_address = $1 OR mac_address = $2 OR mac_address = $3`,
      [macAddress, normalizedMac, macAddress.replace(/[:-]/g, '-').toUpperCase()]
    );

    if (deviceResult.rows.length === 0) {
      console.log('❌ Dispositivo non trovato nel database');
      console.log('   Prova con altri formati del MAC o verifica che il dispositivo sia stato rilevato da un agent');
      process.exit(1);
    }

    const device = deviceResult.rows[0];
    console.log(`✅ Dispositivo trovato:`);
    console.log(`   - ID: ${device.id}`);
    console.log(`   - IP: ${device.ip_address}`);
    console.log(`   - MAC nel DB: ${device.mac_address}`);
    console.log(`   - device_type attuale: "${device.device_type || 'NULL'}"`);
    console.log(`   - device_path attuale: "${device.device_path || 'NULL'}"`);
    console.log('');

    // 2. Carica Keepass
    console.log('📥 Caricamento mappa KeePass da Google Drive...');
    keepassDriveService.invalidateCache();
    const macMap = await keepassDriveService.getMacToTitleMap(keepassPassword);
    console.log(`✅ Mappa KeePass caricata: ${macMap.size} MAC address disponibili\n`);

    // 3. Cerca il MAC in Keepass
    console.log(`🔍 Ricerca MAC ${normalizedMac} in Keepass...`);
    const keepassResult = macMap.get(normalizedMac);
    
    if (!keepassResult) {
      console.log(`❌ MAC ${normalizedMac} NON trovato in Keepass`);
      console.log('\n📋 Esempi MAC presenti in Keepass (primi 10):');
      const sampleMacs = Array.from(macMap.keys()).slice(0, 10);
      sampleMacs.forEach((mac, idx) => {
        const entry = macMap.get(mac);
        console.log(`   ${idx + 1}. ${mac} -> "${entry.title}" (${entry.path})`);
      });
      
      // Cerca MAC simili
      console.log(`\n🔍 Cerca MAC simili (ultimi 6 caratteri: ${normalizedMac.slice(-6)}):`);
      let foundSimilar = false;
      for (const [mac, entry] of macMap.entries()) {
        if (mac.slice(-6) === normalizedMac.slice(-6) && mac !== normalizedMac) {
          console.log(`   - ${mac} -> "${entry.title}" (${entry.path})`);
          foundSimilar = true;
        }
      }
      if (!foundSimilar) {
        console.log(`   Nessun MAC simile trovato`);
      }
      
      process.exit(1);
    }

    const lastPathElement = keepassResult.path ? keepassResult.path.split(' > ').pop() : null;
    console.log(`✅ MAC trovato in Keepass:`);
    console.log(`   - Titolo: "${keepassResult.title}"`);
    console.log(`   - Percorso completo: "${keepassResult.path}"`);
    console.log(`   - Ultimo elemento percorso: "${lastPathElement}"`);
    console.log('');

    // 4. Verifica se serve aggiornare
    const needsUpdate = 
      device.device_type !== keepassResult.title || 
      device.device_path !== lastPathElement ||
      (device.device_type === null && keepassResult.title !== null) ||
      (device.device_path === null && lastPathElement !== null);

    if (!needsUpdate) {
      console.log('ℹ️ Dispositivo già aggiornato, nessuna modifica necessaria');
      process.exit(0);
    }

    // 5. Aggiorna il database
    console.log('💾 Aggiornamento database...');
    const updateResult = await pool.query(
      `UPDATE network_devices 
       SET device_type = $1, device_path = $2 
       WHERE id = $3
       RETURNING id, device_type, device_path`,
      [keepassResult.title, lastPathElement, device.id]
    );

    if (updateResult.rows.length > 0) {
      const updated = updateResult.rows[0];
      console.log('✅ Dispositivo aggiornato con successo!');
      console.log(`   - device_type: "${updated.device_type}"`);
      console.log(`   - device_path: "${updated.device_path}"`);
    } else {
      console.log('❌ Errore: aggiornamento non riuscito');
      process.exit(1);
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Errore:', error);
    process.exit(1);
  }
}

main();
