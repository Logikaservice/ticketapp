/**
 * Script per leggere total_balance dalla VPS e aprirlo nel browser MCP
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const VPS_HOST = '159.69.121.162';
const VPS_USER = 'root';
const VPS_PATH = '/var/www/ticketapp';

async function readAndOpenInBrowser() {
    try {
        console.log(`🔍 Connessione alla VPS ${VPS_USER}@${VPS_HOST}...\n`);
        
        // Usa lo script bash esistente
        const scriptPath = `${VPS_PATH}/backend/scripts/get-total-balance-vps.sh`;
        const command = `ssh ${VPS_USER}@${VPS_HOST} "bash ${scriptPath}"`;
        
        const { stdout, stderr } = await execAsync(command, { timeout: 15000 });
        
        if (stderr && (stderr.includes('ERROR') || stderr.includes('Error'))) {
            console.error('❌ Errore:', stderr);
            process.exit(1);
        }
        
        const totalBalanceValue = stdout.trim();
        
        if (!totalBalanceValue || totalBalanceValue.startsWith('ERROR')) {
            console.error('❌ Valore non trovato o errore');
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
        throw error;
    }
}

// Esegui
if (require.main === module) {
    readAndOpenInBrowser()
        .then(url => {
            if (url) {
                console.log(`✅ URL pronto per browser: ${url}`);
                // Output per cattura dall'esterno
                process.stdout.write(`\n===BROWSER_URL_START===\n${url}\n===BROWSER_URL_END===\n`);
            }
        })
        .catch(() => process.exit(1));
}

module.exports = { readAndOpenInBrowser };




