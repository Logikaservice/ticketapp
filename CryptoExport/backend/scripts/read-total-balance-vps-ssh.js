/**
 * Script per leggere total_balance dalla VPS via SSH e aprirlo nel browser
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const VPS_HOST = '159.69.121.162';
const VPS_USER = 'root';
const VPS_PATH = '/var/www/ticketapp';

async function readTotalBalanceViaSSH() {
    try {
        console.log(`🔍 Connessione alla VPS ${VPS_USER}@${VPS_HOST}...\n`);
        
        // Crea script Node temporaneo da eseguire sulla VPS
        const nodeScript = `
const { Pool } = require('pg');
require('dotenv').config({ path: '/var/www/ticketapp/backend/.env' });

async function getTotalBalance() {
    try {
        // Usa crypto_db per leggere il valore
        const cryptoDb = require('/var/www/ticketapp/backend/crypto_db');
        const result = await cryptoDb.dbGet(
            "SELECT setting_value, updated_at FROM general_settings WHERE setting_key = 'total_balance' LIMIT 1"
        );
        
        if (!result || !result.setting_value) {
            console.error('ERROR: total_balance non trovato');
            process.exit(1);
        }
        
        console.log(result.setting_value.trim());
        process.exit(0);
    } catch (error) {
        console.error('ERROR:', error.message);
        process.exit(1);
    }
}

getTotalBalance();
`;
        
        // Salva script temporaneo sulla VPS
        const tempScriptPath = `/tmp/read-tb-${Date.now()}.js`;
        const nodeScriptEscaped = nodeScript.replace(/"/g, '\\"').replace(/\n/g, '\\n');
        
        const createScriptCmd = `ssh ${VPS_USER}@${VPS_HOST} "echo '${nodeScriptEscaped}' > ${tempScriptPath}"`;
        await execAsync(createScriptCmd, { timeout: 10000 });
        
        // Esegui script sulla VPS
        const executeCmd = `ssh ${VPS_USER}@${VPS_HOST} "cd ${VPS_PATH}/backend && node ${tempScriptPath}"`;
        const { stdout, stderr } = await execAsync(executeCmd, { timeout: 15000 });
        
        // Rimuovi script temporaneo
        await execAsync(`ssh ${VPS_USER}@${VPS_HOST} "rm -f ${tempScriptPath}"`, { timeout: 3000 }).catch(() => {});
        
        if (stderr && (stderr.includes('ERROR:') || stderr.includes('Error:'))) {
            console.error('❌ Errore:', stderr);
            process.exit(1);
        }
        
        const totalBalanceValue = stdout.trim();
        
        if (!totalBalanceValue || totalBalanceValue.startsWith('ERROR:')) {
            console.error('❌ Errore nella lettura:', totalBalanceValue || 'Valore non trovato');
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
                return urlToOpen; // Ritorna comunque per il browser MCP
            }
        }
        
        console.log(`\n🌐 URL pronto: ${urlToOpen}\n`);
        return urlToOpen;
        
    } catch (error) {
        console.error('❌ Errore:', error.message);
        if (error.message.includes('timeout')) {
            console.error('⏱️  Timeout nella connessione SSH. Verifica la connessione alla VPS.');
        }
        if (error.message.includes('Host key verification')) {
            console.error('🔑 Errore di autenticazione SSH. Verifica la chiave SSH.');
        }
        throw error;
    }
}

// Esegui se chiamato direttamente
if (require.main === module) {
    readTotalBalanceViaSSH()
        .then(url => {
            if (url) {
                // Output URL per browser MCP
                console.log(`\n✅ URL da aprire: ${url}`);
                process.stdout.write(`\nBROWSER_URL:${url}\n`);
            }
            process.exit(0);
        })
        .catch(error => {
            process.exit(1);
        });
}

module.exports = { readTotalBalanceViaSSH };


