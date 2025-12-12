/**
 * Script per verificare le posizioni chiuse recenti e il motivo della chiusura
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

async function checkClosedPositions() {
    try {
        console.log('🔍 Verifica posizioni chiuse recenti...\n');
        
        // Recupera posizioni chiuse
        const positionsRes = await makeRequest(`${VPS_URL}/api/crypto/positions?status=closed`);
        const closedPositions = positionsRes.positions || [];
        
        // Filtra solo quelle di polkadot e ordina per data di chiusura (più recenti prima)
        const polkadotClosed = closedPositions
            .filter(p => p.symbol === 'polkadot')
            .sort((a, b) => new Date(b.closed_at || b.opened_at) - new Date(a.closed_at || a.opened_at))
            .slice(0, 5); // Ultime 5
        
        if (polkadotClosed.length === 0) {
            console.log('⚠️  Nessuna posizione polkadot chiusa trovata');
            return;
        }
        
        console.log(`📊 Trovate ${polkadotClosed.length} posizione/i polkadot chiusa/e:\n`);
        
        polkadotClosed.forEach((pos, index) => {
            console.log(`${index + 1}. Ticket ID: ${pos.ticket_id}`);
            console.log(`   Symbol: ${pos.symbol}`);
            console.log(`   Type: ${pos.type.toUpperCase()}`);
            console.log(`   Volume: ${parseFloat(pos.volume).toFixed(8)} DOT`);
            console.log(`   Entry Price: $${parseFloat(pos.entry_price).toFixed(6)} USDT`);
            console.log(`   Close Price: $${parseFloat(pos.current_price || 0).toFixed(6)} USDT`);
            console.log(`   P&L: $${parseFloat(pos.profit_loss || 0).toFixed(2)} USDT (${parseFloat(pos.profit_loss_pct || 0).toFixed(2)}%)`);
            console.log(`   Status: ${pos.status}`);
            console.log(`   Close Reason: ${pos.close_reason || 'N/A'}`);
            console.log(`   Aperta il: ${new Date(pos.opened_at).toLocaleString()}`);
            console.log(`   Chiusa il: ${pos.closed_at ? new Date(pos.closed_at).toLocaleString() : 'N/A'}`);
            
            // Calcola durata
            if (pos.opened_at && pos.closed_at) {
                const opened = new Date(pos.opened_at);
                const closed = new Date(pos.closed_at);
                const duration = closed - opened;
                const minutes = Math.floor(duration / 60000);
                const hours = Math.floor(minutes / 60);
                const days = Math.floor(hours / 24);
                let durationStr = '';
                if (days > 0) durationStr += `${days}d `;
                if (hours > 0) durationStr += `${hours % 24}h `;
                durationStr += `${minutes % 60}m`;
                console.log(`   Durata: ${durationStr}`);
            }
            
            console.log('');
        });
        
        // Verifica anche le posizioni aperte
        const openRes = await makeRequest(`${VPS_URL}/api/crypto/positions?status=open`);
        const openPositions = openRes.positions || [];
        const polkadotOpen = openPositions.filter(p => p.symbol === 'polkadot');
        
        console.log(`\n📊 Posizioni polkadot attualmente aperte: ${polkadotOpen.length}`);
        if (polkadotOpen.length > 0) {
            polkadotOpen.forEach((pos, index) => {
                console.log(`   ${index + 1}. Ticket ID: ${pos.ticket_id} | Entry: $${parseFloat(pos.entry_price).toFixed(6)} | Current: $${parseFloat(pos.current_price || 0).toFixed(6)}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Errore:', error.message);
    }
}

checkClosedPositions();

