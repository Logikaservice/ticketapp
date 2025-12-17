/**
 * Script per leggere total_balance dal database VPS via SSH e aprirlo nel browser
 * Esegui: node backend/scripts/read-total-balance-vps-and-open.js
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const VPS_HOST = '159.69.121.162';
const VPS_USER = 'root';
const VPS_PATH = '/var/www/ticketapp';

async function readTotalBalanceFromVPS() {
    try {
        console.log(`🔍 Connessione alla VPS ${VPS_USER}@${VPS_HOST}...\n`);
        
        console.log('📊 Lettura total_balance dal database VPS...\n');
        
        // Usa PGPASSWORD per autenticazione automatica
        const dbPassword = 'TicketApp2025!Secure';
        const psqlCommand = `ssh ${VPS_USER}@${VPS_HOST} "export PGPASSWORD='${dbPassword}' && psql -U postgres -d crypto_db -t -A -c \\"SELECT setting_value FROM general_settings WHERE setting_key = 'total_balance' LIMIT 1;\\""`;
        
        let totalBalanceValue;
        try {
            const { stdout, stderr } = await execAsync(psqlCommand, { timeout: 15000 });
            totalBalanceValue = stdout.trim();
            
            // Rimuovi eventuali spazi o caratteri di controllo
            totalBalanceValue = totalBalanceValue.replace(/\s+/g, ' ').trim();
            
            // Se psql fallisce o restituisce errore, prova con Node
            if (!totalBalanceValue || 
                totalBalanceValue.includes('error') || 
                totalBalanceValue.includes('ERROR') ||
                totalBalanceValue.includes('could not connect') ||
                stderr?.includes('error')) {
                throw new Error('psql failed, trying node');
            }
        } catch (psqlError) {
            console.log('⚠️  psql non disponibile o fallito, provo con Node.js...\n');
            
            // Usa lo script bash esistente get-total-balance-vps.sh
            // Prima copialo sulla VPS, poi eseguilo
            const tempScript = `/tmp/get-tb-${Date.now()}.sh`;
            const localScript = require('path').join(__dirname, 'get-total-balance-vps.sh');
            
            try {
                // Copia script sulla VPS
                const scpCommand = `scp "${localScript}" ${VPS_USER}@${VPS_HOST}:${tempScript}`;
                await execAsync(scpCommand, { timeout: 10000 });
                
                // Rendi eseguibile
                await execAsync(`ssh ${VPS_USER}@${VPS_HOST} "chmod +x ${tempScript}"`, { timeout: 5000 });
                
                // Esegui script
                const { stdout, stderr } = await execAsync(
                    `ssh ${VPS_USER}@${VPS_HOST} ${tempScript}`,
                    { timeout: 15000 }
                );
                
                // Rimuovi script temporaneo
                await execAsync(`ssh ${VPS_USER}@${VPS_HOST} "rm -f ${tempScript}"`, { timeout: 3000 }).catch(() => {});
                
                if (stderr && stderr.includes('ERROR:')) {
                    console.error('❌ Errore Node:', stderr);
                    throw new Error('Node execution failed');
                }
                
                totalBalanceValue = stdout.trim();
            } catch (nodeError) {
                console.error('❌ Errore nella lettura via Node.js');
                console.error('   Dettaglio:', nodeError.message);
                
                // Ultimo tentativo: usa API backend se disponibile
                console.log('\n💡 Tentativo con API backend...');
                try {
                    const apiUrl = `http://${VPS_HOST}:3001/api/crypto/general-settings`;
                    const { stdout } = await execAsync(`curl -s "${apiUrl}"`, { timeout: 10000 });
                    const settings = JSON.parse(stdout);
                    if (settings.total_balance) {
                        totalBalanceValue = settings.total_balance.toString();
                        console.log(`✅ Valore ottenuto tramite API: "${totalBalanceValue}"`);
                    } else {
                        throw new Error('API non restituisce total_balance');
                    }
                } catch (apiError) {
                    throw nodeError; // Rilancia errore originale
                }
            }
        }
        
        if (!totalBalanceValue || totalBalanceValue.startsWith('ERROR:')) {
            console.error('❌ Errore nella lettura:', totalBalanceValue || 'Valore non trovato');
            process.exit(1);
        }
        
        console.log(`✅ Valore trovato: "${totalBalanceValue}"\n`);
        
        // Prepara URL da aprire
        let urlToOpen = totalBalanceValue.trim();
        
        // Se non inizia con http:// o https://, prova ad aggiungere https://
        if (!urlToOpen.startsWith('http://') && !urlToOpen.startsWith('https://')) {
            // Se sembra un dominio o IP (contiene punto e non contiene spazi), aggiungi https://
            if (urlToOpen.includes('.') && !urlToOpen.includes(' ') && !/^\d+\.?\d*$/.test(urlToOpen)) {
                urlToOpen = `https://${urlToOpen}`;
                console.log(`🔗 Aggiunto https:// al valore: ${urlToOpen}`);
            } else {
                // Potrebbe essere un numero - mostra solo il valore
                console.log(`⚠️  Il valore non sembra un URL: ${urlToOpen}`);
                console.log(`📋 Valore total_balance: ${urlToOpen}`);
                console.log(`\n💡 Se dovesse essere un URL, aggiungi manualmente http:// o https://`);
                return;
            }
        }
        
        console.log(`\n🌐 Apertura nel browser: ${urlToOpen}\n`);
        
        // Apri nel browser in base al sistema operativo
        let browserCommand;
        const platform = process.platform;
        
        if (platform === 'win32') {
            browserCommand = `start "" "${urlToOpen}"`;
        } else if (platform === 'darwin') {
            browserCommand = `open "${urlToOpen}"`;
        } else {
            browserCommand = `xdg-open "${urlToOpen}"`;
        }
        
        try {
            await execAsync(browserCommand);
            console.log('✅ URL aperto nel browser con successo!');
        } catch (execError) {
            console.error('❌ Errore nell\'apertura del browser:', execError.message);
            console.log('\n💡 Puoi aprire manualmente il seguente URL:');
            console.log(`   ${urlToOpen}`);
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Errore:', error.message);
        if (error.message.includes('timeout')) {
            console.error('⏱️  Timeout nella connessione SSH. Verifica la connessione alla VPS.');
        }
        if (error.message.includes('Host key verification')) {
            console.error('🔑 Errore di autenticazione SSH. Verifica la chiave SSH.');
        }
        process.exit(1);
    }
}

// Esegui se chiamato direttamente
if (require.main === module) {
    readTotalBalanceFromVPS();
}

module.exports = { readTotalBalanceFromVPS };