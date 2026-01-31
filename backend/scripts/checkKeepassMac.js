// Script per verificare cosa c'è in KeePass per un MAC specifico
require('dotenv').config();
const keepassDriveService = require('../services/keepassDriveService');

const MAC_TO_CHECK = 'F8:BC:12:A3:DA:1C';

async function checkKeepass() {
    console.log(`\n🔍 === VERIFICA KEEPASS PER MAC ${MAC_TO_CHECK} ===\n`);

    try {
        if (!process.env.KEEPASS_PASSWORD) {
            console.log('❌ KEEPASS_PASSWORD non configurato\n');
            return;
        }

        const result = await keepassDriveService.findMacTitle(MAC_TO_CHECK, process.env.KEEPASS_PASSWORD);

        if (!result) {
            console.log('❌ Nessun risultato trovato in KeePass\n');
            return;
        }

        console.log('✅ Trovato in KeePass:\n');
        console.log(`   Title: ${result.title}`);
        console.log(`   Icon ID: ${result.iconId}`);
        console.log(`   Path: ${result.path}`);
        console.log(`   UUID: ${result.uuid}\n`);

        // Mappa Icon ID
        let deviceType = result.title;
        if (result.iconId !== undefined) {
            switch (Number(result.iconId)) {
                case 3: deviceType = 'server'; break;
                case 4: deviceType = 'pc'; break;
                case 18: deviceType = 'printer'; break;
                case 19: deviceType = 'nas'; break;
                case 22: deviceType = 'nas'; break;
                case 27: deviceType = 'laptop'; break;
                case 28: deviceType = 'smartphone'; break;
                case 29: deviceType = 'firewall'; break;
                case 34: deviceType = 'wifi'; break;
                case 61: deviceType = 'switch'; break;
            }
        }

        console.log(`📌 Device Type mappato: ${deviceType}\n`);

    } catch (error) {
        console.error('❌ Errore:', error.message);
    }
}

checkKeepass();
