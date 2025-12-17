/**
 * Script per verificare tutti i dettagli della posizione SAND
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const cryptoDb = require('./crypto_db');
const dbAll = cryptoDb.dbAll;
const dbGet = cryptoDb.dbGet;

async function verifyPosition() {
    try {
        console.log('🔍 Verifica dettagliata posizione SAND...\n');

        // Recupera la posizione SAND
        const sandPositions = await dbAll(
            "SELECT * FROM open_positions WHERE symbol = 'sand' AND status = 'open' ORDER BY opened_at DESC"
        );

        if (sandPositions.length === 0) {
            console.log('❌ Nessuna posizione SAND aperta trovata\n');
            return;
        }

        console.log(`✅ Trovate ${sandPositions.length} posizione/i SAND\n`);

        sandPositions.forEach((pos, idx) => {
            console.log(`\n📋 Posizione ${idx + 1}:`);
            console.log(`   Ticket ID: ${pos.ticket_id}`);
            console.log(`   Symbol: ${pos.symbol}`);
            console.log(`   Type: ${pos.type}`);
            console.log(`   Status: ${pos.status}`);
            console.log(`   Volume: ${pos.volume}`);
            console.log(`   Entry Price: ${pos.entry_price}`);
            console.log(`   Current Price: ${pos.current_price}`);
            console.log(`   Stop Loss: ${pos.stop_loss}`);
            console.log(`   Take Profit: ${pos.take_profit}`);
            console.log(`   Profit/Loss: ${pos.profit_loss}`);
            console.log(`   Profit/Loss %: ${pos.profit_loss_pct}`);
            console.log(`   Opened At: ${pos.opened_at}`);
            console.log(`   Strategy: ${pos.strategy}`);
            console.log(`   Signal Details: ${pos.signal_details || 'null'}`);
            
            // Verifica campi critici
            console.log(`\n   ✅ Validazione:`);
            console.log(`      - Status === 'open': ${pos.status === 'open'}`);
            console.log(`      - Ticket ID presente: ${!!pos.ticket_id}`);
            console.log(`      - Symbol presente: ${!!pos.symbol}`);
            console.log(`      - Type presente: ${!!pos.type}`);
            console.log(`      - Volume > 0: ${parseFloat(pos.volume) > 0}`);
            console.log(`      - Entry Price > 0: ${parseFloat(pos.entry_price) > 0}`);
        });

        // Verifica anche tutte le posizioni aperte
        const allOpen = await dbAll("SELECT ticket_id, symbol, status FROM open_positions WHERE status = 'open'");
        console.log(`\n\n📊 Totale posizioni aperte nel DB: ${allOpen.length}`);
        allOpen.forEach(p => {
            console.log(`   - ${p.symbol} (${p.ticket_id}) - status: ${p.status}`);
        });

    } catch (error) {
        console.error('❌ Errore:', error.message);
        console.error(error.stack);
    }
}

verifyPosition().then(() => {
    process.exit(0);
}).catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});

