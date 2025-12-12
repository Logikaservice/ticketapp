/**
 * Test dell'API dashboard per vedere cosa restituisce
 */

const https = require('https');
const http = require('http');

async function testDashboardAPI() {
    console.log('🔍 TEST API DASHBOARD\n');
    console.log('='.repeat(80));
    
    try {
        // Prova a chiamare l'API dashboard
        const apiBase = 'http://localhost:3001';
        const url = `${apiBase}/api/crypto/dashboard`;
        
        console.log(`Chiamando: ${url}\n`);
        
        const data = await new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const client = urlObj.protocol === 'https:' ? https : http;
            
            const req = client.get(url, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                        reject(new Error(`Parse error: ${e.message}`));
                    }
                });
            });
            
            req.on('error', reject);
            req.setTimeout(5000, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
        });
        
        console.log('✅ Risposta ricevuta\n');
        console.log('='.repeat(80));
        console.log('\n📊 OPEN POSITIONS dalla API:\n');
        
        if (data.open_positions && Array.isArray(data.open_positions)) {
            console.log(`Totale posizioni aperte dalla API: ${data.open_positions.length}\n`);
            
            data.open_positions.forEach((pos, idx) => {
                console.log(`${idx + 1}. ${pos.symbol?.toUpperCase() || 'N/A'} | ${pos.type?.toUpperCase() || 'N/A'}`);
                console.log(`   Ticket: ${pos.ticket_id || 'N/A'}`);
                console.log(`   Entry: $${parseFloat(pos.entry_price || 0).toFixed(8)}`);
                console.log(`   Current: $${parseFloat(pos.current_price || 0).toFixed(8)}`);
                console.log(`   Volume: ${parseFloat(pos.volume || 0).toLocaleString('it-IT', {maximumFractionDigits: 4})}`);
                console.log(`   P&L: ${parseFloat(pos.profit_loss_pct || 0).toFixed(2)}%`);
                console.log(`   Status: ${pos.status || 'N/A'}`);
                console.log('');
            });
        } else {
            console.log('⚠️  open_positions non presente o non è un array');
        }
        
        // Verifica anche le posizioni chiuse
        if (data.closed_positions && Array.isArray(data.closed_positions)) {
            console.log(`\n📋 CLOSED POSITIONS dalla API: ${data.closed_positions.length}\n`);
            
            // Mostra solo le ultime 5
            data.closed_positions.slice(0, 5).forEach((pos, idx) => {
                console.log(`${idx + 1}. ${pos.symbol?.toUpperCase() || 'N/A'} | ${pos.type?.toUpperCase() || 'N/A'} | ${pos.status?.toUpperCase() || 'N/A'}`);
                console.log(`   Ticket: ${pos.ticket_id || 'N/A'}`);
                console.log(`   Chiusa: ${pos.closed_at || 'N/A'}`);
                console.log('');
            });
        }
        
    } catch (error) {
        console.error('❌ Errore:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.log('\n⚠️  Il backend non è in esecuzione su localhost:3001');
            console.log('   → Prova a verificare direttamente sul server VPS');
        }
    }
}

testDashboardAPI().then(() => {
    console.log('\n✅ Test completato');
    process.exit(0);
}).catch(err => {
    console.error('❌ Errore:', err);
    process.exit(1);
});

