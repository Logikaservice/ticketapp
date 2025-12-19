/**
 * Script per leggere total_balance dalla VPS via SSH e aprirlo nel browser MCP
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const fs = require('fs');
const path = require('path');

const VPS_HOST = '159.69.121.162';
const VPS_USER = 'root';

async function readTotalBalance() {
    try {
        console.log(`🔍 Connessione alla VPS ${VPS_USER}@${VPS_HOST}...\n`);
        
        // Crea script bash locale temporaneo
        const bashScript = `#!/bin/bash
cd /var/www/ticketapp/backend
export NODE_PATH=/var/www/ticketapp/backend/node_modules
node << 'EOF'
require('dotenv').config({ path: '/var/www/ticketapp/backend/.env' });
const { Pool } = require('pg');

async function getTotalBalance() {
    // Prova prima con crypto_db, poi con ticketapp
    const databases = [
        process.env.DATABASE_URL_CRYPTO || (process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/\\/[^\\/]+$/, '/crypto_db') : null),
        process.env.DATABASE_URL
    ].filter(Boolean);
    
    for (const dbUrl of databases) {
        const pool = new Pool({ connectionString: dbUrl, ssl: false });
        try {
            const client = await pool.connect();
            const r = await client.query("SELECT setting_value FROM general_settings WHERE setting_key = 'total_balance' LIMIT 1");
            client.release();
            await pool.end();
            if (r.rows && r.rows[0] && r.rows[0].setting_value) {
                console.log(r.rows[0].setting_value.trim());
                process.exit(0);
            }
        } catch(e) {
            await pool.end();
            // Continua con il prossimo database
        }
    }
    console.error('ERROR: total_balance not found in any database');
    process.exit(1);
}

getTotalBalance();
EOF
`;
        
        // Salva script locale temporaneo
        const tempScript = path.join(__dirname, `temp-read-tb-${Date.now()}.sh`);
        fs.writeFileSync(tempScript, bashScript);
        
        try {
            // Copia script sulla VPS
            await execAsync(`scp "${tempScript}" ${VPS_USER}@${VPS_HOST}:/tmp/read-tb.sh`, { timeout: 10000 });
            
            // Esegui script sulla VPS
            const { stdout, stderr } = await execAsync(
                `ssh ${VPS_USER}@${VPS_HOST} "chmod +x /tmp/read-tb.sh && bash /tmp/read-tb.sh && rm -f /tmp/read-tb.sh"`,
                { timeout: 20000 }
            );
            
            // Rimuovi script locale
            fs.unlinkSync(tempScript);
            
            // Mostra output completo per debug
            if (stdout) console.log('📤 stdout:', stdout);
            if (stderr && !stderr.includes('Warning: Permanently added')) {
                console.log('📤 stderr:', stderr);
                if (stderr.includes('ERROR') || stderr.includes('Error')) {
                    console.error('❌ Errore:', stderr);
                    process.exit(1);
                }
            }
            
            const totalBalanceValue = stdout.trim();
            
            if (!totalBalanceValue || totalBalanceValue.startsWith('ERROR')) {
                console.error('❌ Valore non trovato:', totalBalanceValue);
                process.exit(1);
            }
            
            console.log(`✅ Valore trovato: "${totalBalanceValue}"\n`);
            return totalBalanceValue;
            
        } catch (error) {
            // Pulisci script locale anche in caso di errore
            try {
                if (fs.existsSync(tempScript)) {
                    fs.unlinkSync(tempScript);
                }
            } catch {}
            throw error;
        }
        
    } catch (error) {
        console.error('❌ Errore:', error.message);
        if (error.message.includes('timeout')) {
            console.error('⏱️  Timeout nella connessione SSH');
        }
        throw error;
    }
}

async function main() {
    try {
        const totalBalanceValue = await readTotalBalance();
        
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
                return urlToOpen;
            }
        }
        
        console.log(`\n🌐 URL da aprire: ${urlToOpen}\n`);
        return urlToOpen;
        
    } catch (error) {
        process.exit(1);
    }
}

// Esegui
if (require.main === module) {
    main()
        .then(url => {
            if (url) {
                console.log(`✅ URL pronto per browser MCP: ${url}`);
                return url;
            }
        })
        .catch(() => process.exit(1));
}

module.exports = { readTotalBalance };

