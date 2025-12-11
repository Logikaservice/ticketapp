/**
 * Script per testare se l'API dashboard restituisce la posizione SAND
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const https = require('https');

const httpsGet = (url) => {
    return new Promise((resolve, reject) => {
        const req = https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Failed to parse JSON: ${e.message}`));
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        req.end();
    });
};

async function testDashboard() {
    try {
        console.log('🔍 Test API Dashboard...\n');
        
        // Determina URL API
        const apiBase = process.env.API_BASE_URL || 'http://localhost:3001';
        const url = `${apiBase}/api/crypto/dashboard`;
        
        console.log(`📡 Chiamata a: ${url}\n`);
        
        const data = await httpsGet(url);
        
        console.log(`✅ Risposta ricevuta\n`);
        console.log(`📊 Posizioni aperte: ${data.open_positions?.length || 0}\n`);
        
        if (data.open_positions && data.open_positions.length > 0) {
            console.log('📋 Dettagli posizioni:\n');
            data.open_positions.forEach((pos, idx) => {
                console.log(`${idx + 1}. ${pos.symbol.toUpperCase()} - ${pos.type.toUpperCase()}`);
                console.log(`   Ticket: ${pos.ticket_id}`);
                console.log(`   Entry: $${pos.entry_price}`);
                console.log(`   Volume: ${pos.volume}`);
                console.log(`   Status: ${pos.status}`);
                console.log('');
            });
            
            const sandPos = data.open_positions.find(p => p.symbol === 'sand');
            if (sandPos) {
                console.log('✅ Posizione SAND trovata nell\'API!\n');
            } else {
                console.log('❌ Posizione SAND NON trovata nell\'API\n');
                console.log('Simboli presenti:', data.open_positions.map(p => p.symbol));
            }
        } else {
            console.log('❌ Nessuna posizione aperta restituita dall\'API\n');
        }
        
    } catch (error) {
        console.error('❌ Errore:', error.message);
        if (error.message.includes('localhost')) {
            console.error('\n💡 Suggerimento: Lo script sta cercando di connettersi a localhost.');
            console.error('   Se stai testando sulla VPS, modifica API_BASE_URL nel .env');
        }
    }
}

testDashboard().then(() => {
    process.exit(0);
}).catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});


