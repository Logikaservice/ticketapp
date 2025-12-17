/**
 * Script per leggere total_balance dal database e aprirlo nel browser
 * Esegui: node backend/scripts/read-total-balance-and-open.js
 */

const { dbGet } = require('../crypto_db');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function readAndOpenTotalBalance() {
    try {
        console.log('🔍 Lettura total_balance dal database...\n');
        
        // Leggi total_balance dal database
        const result = await dbGet(
            "SELECT setting_value, updated_at FROM general_settings WHERE setting_key = 'total_balance'"
        );
        
        if (!result || !result.setting_value) {
            console.error('❌ total_balance non trovato nel database');
            process.exit(1);
        }
        
        const totalBalanceValue = result.setting_value.trim();
        console.log(`📊 Valore trovato: "${totalBalanceValue}"`);
        console.log(`📅 Ultimo aggiornamento: ${result.updated_at || 'N/A'}\n`);
        
        // Verifica se è un URL valido
        let urlToOpen = totalBalanceValue;
        
        // Se non inizia con http:// o https://, prova ad aggiungere https://
        if (!urlToOpen.startsWith('http://') && !urlToOpen.startsWith('https://')) {
            // Se sembra un dominio o IP, aggiungi https://
            if (urlToOpen.includes('.') && !urlToOpen.includes(' ')) {
                urlToOpen = `https://${urlToOpen}`;
                console.log(`🔗 Aggiunto https:// al valore: ${urlToOpen}`);
            } else {
                // Potrebbe essere un numero o altro - prova comunque come URL
                urlToOpen = `https://${urlToOpen}`;
                console.log(`🔗 Tentativo di apertura come URL: ${urlToOpen}`);
            }
        }
        
        console.log(`\n🌐 Apertura nel browser: ${urlToOpen}\n`);
        
        // Apri nel browser in base al sistema operativo
        let command;
        const platform = process.platform;
        
        if (platform === 'win32') {
            // Windows
            command = `start ${urlToOpen}`;
        } else if (platform === 'darwin') {
            // macOS
            command = `open ${urlToOpen}`;
        } else {
            // Linux
            command = `xdg-open ${urlToOpen}`;
        }
        
        try {
            await execAsync(command);
            console.log('✅ URL aperto nel browser con successo!');
        } catch (execError) {
            console.error('❌ Errore nell\'apertura del browser:', execError.message);
            console.log('\n💡 Puoi aprire manualmente il seguente URL:');
            console.log(`   ${urlToOpen}`);
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Errore:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Esegui se chiamato direttamente
if (require.main === module) {
    readAndOpenTotalBalance();
}

module.exports = { readAndOpenTotalBalance };
