/**
 * Script per forzare aggiornamento P&L sulla VPS e vedere i log
 */

const https = require('https');

const VPS_URL = 'https://ticket.logikaservice.it';

function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const requestOptions = {
            hostname: urlObj.hostname,
            port: 443,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            rejectUnauthorized: false
        };

        const req = https.request(requestOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(jsonData);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${jsonData.error || data}`));
                    }
                } catch (e) {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(data);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                }
            });
        });

        req.on('error', reject);
        if (options.body) {
            req.write(JSON.stringify(options.body));
        }
        req.end();
    });
}

async function forceUpdatePnL() {
    try {
        console.log('🔄 Forzo aggiornamento P&L sulla VPS...\n');
        
        // Chiama l'endpoint di aggiornamento P&L
        const result = await makeRequest(`${VPS_URL}/api/crypto/positions/update-pnl`, {
            method: 'POST'
        });
        
        console.log('✅ Risposta:', JSON.stringify(result, null, 2));
        
        // Attendi 2 secondi e controlla le posizioni
        console.log('\n⏳ Attendo 2 secondi e ricontrollo posizioni...\n');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const positions = await makeRequest(`${VPS_URL}/api/crypto/positions?status=open`);
        
        if (positions.positions && positions.positions.length > 0) {
            positions.positions.forEach((pos, i) => {
                console.log(`${i + 1}. ${pos.symbol} (${pos.ticket_id}):`);
                console.log(`   Entry: $${parseFloat(pos.entry_price).toFixed(6)}`);
                console.log(`   Current (DB): $${parseFloat(pos.current_price || 0).toFixed(6)}`);
                console.log(`   P&L: $${parseFloat(pos.profit_loss || 0).toFixed(2)} (${parseFloat(pos.profit_loss_pct || 0).toFixed(2)}%)`);
            });
        }
        
    } catch (error) {
        console.error('❌ Errore:', error.message);
    }
}

forceUpdatePnL();

