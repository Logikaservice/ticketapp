/**
 * Script per verificare se la posizione SAND è nel database
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const cryptoDb = require('./crypto_db');
const dbAll = cryptoDb.dbAll;
const dbGet = cryptoDb.dbGet;

async function checkPosition() {
    try {
        console.log('🔍 Verifica posizione SAND...\n');

        // Verifica tutte le posizioni aperte
        const allPositions = await dbAll("SELECT * FROM open_positions WHERE status = 'open' ORDER BY opened_at DESC");
        
        console.log(`📊 Totale posizioni aperte: ${allPositions.length}\n`);
        
        if (allPositions.length === 0) {
            console.log('❌ Nessuna posizione aperta trovata');
            return;
        }

        // Mostra tutte le posizioni
        allPositions.forEach((pos, index) => {
            console.log(`\n${index + 1}. Posizione:`);
            console.log(`   Ticket ID: ${pos.ticket_id}`);
            console.log(`   Simbolo: ${pos.symbol}`);
            console.log(`   Tipo: ${pos.type}`);
            console.log(`   Volume: ${pos.volume}`);
            console.log(`   Entry Price: $${pos.entry_price}`);
            console.log(`   Current Price: $${pos.current_price}`);
            console.log(`   P&L: $${pos.profit_loss} (${pos.profit_loss_pct}%)`);
            console.log(`   Status: ${pos.status}`);
            console.log(`   Aperta il: ${pos.opened_at}`);
        });

        // Verifica specificamente SAND
        const sandPositions = allPositions.filter(p => p.symbol === 'sand' || p.symbol === 'SAND');
        console.log(`\n\n🎯 Posizioni SAND trovate: ${sandPositions.length}`);
        
        if (sandPositions.length > 0) {
            console.log('\n✅ Posizione SAND presente nel database!');
        } else {
            console.log('\n❌ Nessuna posizione SAND trovata');
            console.log('   Simboli presenti:', [...new Set(allPositions.map(p => p.symbol))]);
        }

    } catch (error) {
        console.error('❌ Errore:', error.message);
        console.error(error.stack);
    }
}

checkPosition().then(() => {
    process.exit(0);
}).catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});


