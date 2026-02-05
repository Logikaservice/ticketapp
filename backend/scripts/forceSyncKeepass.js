// Script per sincronizzare forzatamente Hostname (Titolo) e Device Type con KeePass
// Se KeePass ha dati -> Sovrascrive DB
// Se KeePass NON ha dati -> SVUOTA Hostname nel DB
require('dotenv').config();
const { Pool } = require('pg');
const keepassDriveService = require('../utils/keepassDriveService');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function syncKeepass() {
    console.log('\n🔄 === SINCRONIZZAZIONE FORZATA KEEPASS -> DB ===\n');

    if (!process.env.KEEPASS_PASSWORD) {
        console.error('❌ KEEPASS_PASSWORD mancante nel .env');
        return;
    }

    try {
        // 1. Carica mappa KeePass (versione ottimizzata usando metodo pubblico)
        console.log('📥 Caricamento dati da KeePass...');
        const macMap = await keepassDriveService.getMacToTitleMap(process.env.KEEPASS_PASSWORD);

        console.log(`✅ Caricati ${macMap.size} MAC da KeePass`);

        // Debug MAC specifico
        const debugMac = 'F8BC12A3DA1C';
        if (macMap.has(debugMac)) {
            console.log(`🔍 DEBUG: MAC ${debugMac} trovato in KeePass!`, macMap.get(debugMac));
        } else {
            console.log(`❌ DEBUG: MAC ${debugMac} NON trovato nella mappa KeePass caricata.`);
        }

        // 2. Prendi tutti i dispositivi dal DB
        const devicesResult = await pool.query('SELECT id, mac_address, hostname, device_type, device_username, keepass_path FROM network_devices WHERE mac_address IS NOT NULL');
        console.log(`📊 Analisi di ${devicesResult.rows.length} dispositivi nel DB...`);

        let updatedCount = 0;
        let clearedCount = 0;

        for (const device of devicesResult.rows) {
            if (!device.mac_address) continue;

            const normalizedMacSearch = device.mac_address.trim().toUpperCase().replace(/[:\-\s.]/g, '');
            const keepassResult = macMap.get(normalizedMacSearch);

            let newHostname = null;
            let newDeviceType = device.device_type; // Mantieni vecchio se non cambia

            let needsUpdate = false;
            let updateReason = '';

            if (keepassResult) {
                // TROVATO IN KEEPASS

                // Titolo -> Hostname
                if (keepassResult.title && keepassResult.title.trim() !== '') {
                    newHostname = keepassResult.title.trim();
                }

                // Icon -> Device Type
                if (keepassResult.iconId !== undefined) {
                    switch (Number(keepassResult.iconId)) {
                        case 3: newDeviceType = 'server'; break;
                        case 4: newDeviceType = 'pc'; break;
                        case 18: newDeviceType = 'printer'; break;
                        case 19: newDeviceType = 'nas'; break;
                        case 22: newDeviceType = 'nas'; break;
                        case 27: newDeviceType = 'laptop'; break;
                        case 28: newDeviceType = 'smartphone'; break;
                        case 29: newDeviceType = 'firewall'; break;
                        case 34: newDeviceType = 'wifi'; break;
                        case 61: newDeviceType = 'switch'; break;
                    }
                }

                let newPath = keepassResult.path || '';
                let newUsername = keepassResult.username || '';

                // Verifica Hostname
                if (device.hostname !== newHostname) {
                    needsUpdate = true;
                    updateReason += `Hostname: "${device.hostname || 'NULL'}" -> "${newHostname || 'NULL'}". `;
                }

                // Verifica Device Type
                if (device.device_type !== newDeviceType) {
                    needsUpdate = true;
                    updateReason += `Type: "${device.device_type}" -> "${newDeviceType}". `;
                }

                // Verifica Path
                if (device.keepass_path !== newPath) {
                    needsUpdate = true;
                    updateReason += `Path: "${device.keepass_path || ''}" -> "${newPath}". `;
                }

                // Verifica Username
                if (device.device_username !== newUsername) {
                    needsUpdate = true;
                    updateReason += `Username: "${device.device_username || ''}" -> "${newUsername}". `;
                }

                if (needsUpdate) {
                    await pool.query(
                        'UPDATE network_devices SET hostname = $1, device_type = $2, keepass_path = $3, device_username = $4 WHERE id = $5',
                        [newHostname, newDeviceType, newPath, newUsername, device.id]
                    );
                    updatedCount++;
                }

            } else {
                // NON TROVATO IN KEEPASS -> SVUOTA HOSTNAME (se non è già null)
                if (device.hostname !== null) {
                    await pool.query(
                        'UPDATE network_devices SET hostname = NULL WHERE id = $1',
                        [device.id]
                    );
                    clearedCount++;
                }
            }
        }

        console.log(`\n✅ COMPLETATO:`);
        console.log(`   - Aggiornati con dati KeePass: ${updatedCount}`);
        console.log(`   - Hostname svuotati (no KeePass): ${clearedCount}`);

    } catch (error) {
        console.error('❌ Errore:', error);
    } finally {
        await pool.end();
    }
}

syncKeepass();
