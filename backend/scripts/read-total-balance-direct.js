/**
 * Script per leggere total_balance dalla VPS e aprirlo nel browser MCP
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const VPS_HOST = '159.69.121.162';
const VPS_USER = 'root';

async function readAndOpenInBrowser() {
    try {
        console.log(`🔍 Connessione alla VPS ${VPS_USER}@${VPS_HOST}...\n`);
        
        // Comando diretto per leggere total_balance
        const command = `ssh ${VPS_USER}@${VPS_HOST} "cd /var/www/ticketapp/backend && node -e \\"require('dotenv').config(); const cryptoDb = require('./crypto_db'); cryptoDb.dbGet(\\\"SELECT setting_value FROM general_settings WHERE setting_key = 'total_balance' LIMIT 1\\\").then(r => { if(r && r.setting_value) console.log(r.setting_value.trim()); else { console.error('ERROR: not found'); process.exit(1); } }).catch(e => { console.error('ERROR:', e.message); process.exit(1); });\\""`;
        
        const { stdout, stderr } = await execAsync(command, { 
            timeout: 20000,
            shell: true
        });
        
        if (stderr && !stderr.includes('Warning: Permanently added')) {
            // Ignora solo i warning di SSH key
            if (stderr.includes('ERROR') || stderr.includes('Error')) {
                console.error('❌ Errore:', stderr);
                process.exit(1);
            }
        }
        
        const lines = stdout.trim().split('\n');
        const totalBalanceValue = lines[lines.length - 1].trim(); // Ultima riga (ignora eventuali log)
        
        if (!totalBalanceValue || totalBalanceValue.startsWith('ERROR')) {
            console.error('❌ Valore non trovato o errore:', totalBalanceValue);
            process.exit(1);
        }
        
        console.log(`✅ Valore trovato: "${totalBalanceValue}"\n`);
        
        // Prepara URL
        let urlToOpen = totalBalanceValue;
        
        // Se non inizia con http:// o https://, aggiungi https://
        if (!urlToOpen.startsWith('http://') && !urlToOpen.startsWith('https://')) {
            if (urlToOpen.includes('.') && !urlToOpen.includes(' ') && !/^\d+\.?\d*$/.test(urlToOpen)) {
                urlToOpen = `https://${urlToOpen}`;
                console.log(`🔗 Aggiunto https://: ${urlToOpen}`);
            } else {
                console.log(`⚠️  Il valore non sembra un URL: ${urlToOpen}`);
                console.log(`📋 Valore total_balance: ${urlToOpen}`);
                return urlToOpen; // Ritorna comunque
            }
        }
        
        console.log(`\n🌐 URL da aprire: ${urlToOpen}\n`);
        return urlToOpen;
        
    } catch (error) {
        console.error('❌ Errore:', error.message);
        if (error.message.includes('timeout')) {
            console.error('⏱️  Timeout nella connessione SSH');
        }
        throw error;
    }
}

// Esegui
if (require.main === module) {
    readAndOpenInBrowser()
        .then(url => {
            if (url) {
                console.log(`✅ URL pronto per browser: ${url}`);
                return url;
            }
        })
        .catch(() => process.exit(1));
}

module.exports = { readAndOpenInBrowser };




