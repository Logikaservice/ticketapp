/**
 * Script per leggere total_balance via API e aprirlo nel browser MCP
 */

const https = require('https');
const http = require('http');

const VPS_HOST = '159.69.121.162';
const VPS_PORT = 3001;

async function readViaAPI() {
    return new Promise((resolve, reject) => {
        const url = `http://${VPS_HOST}:${VPS_PORT}/api/crypto/general-settings`;
        
        http.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const settings = JSON.parse(data);
                    if (settings.total_balance) {
                        resolve(settings.total_balance.toString().trim());
                    } else {
                        reject(new Error('total_balance non trovato nella risposta API'));
                    }
                } catch (error) {
                    reject(new Error(`Errore parsing JSON: ${error.message}`));
                }
            });
        }).on('error', (error) => {
            reject(error);
        });
    });
}

async function main() {
    try {
        console.log(`🔍 Lettura total_balance via API da ${VPS_HOST}:${VPS_PORT}...\n`);
        
        const totalBalanceValue = await readViaAPI();
        
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
                return urlToOpen;
            }
        }
        
        console.log(`\n🌐 URL da aprire: ${urlToOpen}\n`);
        return urlToOpen;
        
    } catch (error) {
        console.error('❌ Errore:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.error('⚠️  Backend non raggiungibile. Verifica che sia attivo sulla VPS.');
        }
        process.exit(1);
    }
}

// Esegui
if (require.main === module) {
    main()
        .then(url => {
            if (url) {
                console.log(`✅ URL pronto: ${url}`);
                return url;
            }
        })
        .catch(() => process.exit(1));
}

module.exports = { readViaAPI };


