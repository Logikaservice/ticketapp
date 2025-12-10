/**
 * Verifica approfondita delle posizioni nel database
 */

const { dbGet, dbAll } = require('./backend/crypto_db');

async function verificaPosizioniOra() {
    console.log('🔍 VERIFICA APPROFONDITA POSIZIONI\n');
    console.log('='.repeat(80));
    
    try {
        // Query RAW per vedere tutto
        console.log('\n1. TUTTE LE POSIZIONI (raw query)\n');
        console.log('-'.repeat(80));
        
        const tutte = await dbAll(
            "SELECT ticket_id, symbol, type, status, opened_at, closed_at, entry_price, current_price, volume, profit_loss_pct FROM open_positions ORDER BY opened_at DESC"
        );
        
        console.log(`Totale record: ${tutte.length}\n`);
        
        tutte.forEach((pos, idx) => {
            console.log(`${idx + 1}. Ticket: ${pos.ticket_id}`);
            console.log(`   Symbol: ${pos.symbol}`);
            console.log(`   Type: ${pos.type} | Status: ${pos.status}`);
            console.log(`   Entry: $${parseFloat(pos.entry_price || 0).toFixed(8)} | Current: $${parseFloat(pos.current_price || 0).toFixed(8)}`);
            console.log(`   Volume: ${parseFloat(pos.volume || 0).toLocaleString('it-IT', {maximumFractionDigits: 4})}`);
            console.log(`   P&L: ${parseFloat(pos.profit_loss_pct || 0).toFixed(2)}%`);
            console.log(`   Aperta: ${pos.opened_at || 'N/A'}`);
            console.log(`   Chiusa: ${pos.closed_at || 'N/A'}`);
            console.log('');
        });
        
        // Posizioni con status = 'open'
        console.log('\n2. POSIZIONI CON STATUS = "open"\n');
        console.log('-'.repeat(80));
        
        const aperte = await dbAll(
            "SELECT * FROM open_positions WHERE status = 'open' ORDER BY opened_at DESC"
        );
        
        console.log(`Totale aperte: ${aperte.length}\n`);
        aperte.forEach((pos, idx) => {
            console.log(`${idx + 1}. ${pos.symbol} | ${pos.type} | Ticket: ${pos.ticket_id}`);
            console.log(`   Entry: $${parseFloat(pos.entry_price || 0).toFixed(8)} | Current: $${parseFloat(pos.current_price || 0).toFixed(8)}`);
        });
        
        // Cerca BNB
        console.log('\n3. CERCA BNB\n');
        console.log('-'.repeat(80));
        
        const bnb = await dbAll(
            "SELECT * FROM open_positions WHERE symbol ILIKE '%bnb%' ORDER BY opened_at DESC"
        );
        
        console.log(`Trovate: ${bnb.length}\n`);
        bnb.forEach((pos, idx) => {
            console.log(`${idx + 1}. ${pos.symbol} | ${pos.type} | Status: ${pos.status} | Ticket: ${pos.ticket_id}`);
            console.log(`   Entry: $${parseFloat(pos.entry_price || 0).toFixed(8)}`);
        });
        
        // Cerca BONK
        console.log('\n4. CERCA BONK\n');
        console.log('-'.repeat(80));
        
        const bonk = await dbAll(
            "SELECT * FROM open_positions WHERE symbol ILIKE '%bonk%' ORDER BY opened_at DESC"
        );
        
        console.log(`Trovate: ${bonk.length}\n`);
        bonk.forEach((pos, idx) => {
            console.log(`${idx + 1}. ${pos.symbol} | ${pos.type} | Status: ${pos.status} | Ticket: ${pos.ticket_id}`);
            console.log(`   Entry: $${parseFloat(pos.entry_price || 0).toFixed(8)}`);
            console.log(`   Aperta: ${pos.opened_at || 'N/A'}`);
            console.log(`   Chiusa: ${pos.closed_at || 'N/A'}`);
        });
        
        // Cerca SHIBA
        console.log('\n5. CERCA SHIBA\n');
        console.log('-'.repeat(80));
        
        const shiba = await dbAll(
            "SELECT * FROM open_positions WHERE symbol ILIKE '%shib%' ORDER BY opened_at DESC"
        );
        
        console.log(`Trovate: ${shiba.length}\n`);
        shiba.forEach((pos, idx) => {
            console.log(`${idx + 1}. ${pos.symbol} | ${pos.type} | Status: ${pos.status} | Ticket: ${pos.ticket_id}`);
            console.log(`   Entry: $${parseFloat(pos.entry_price || 0).toFixed(8)}`);
        });
        
        // Cerca tutte le posizioni chiuse oggi dopo le 20:00
        console.log('\n6. POSIZIONI CHIUSE OGGI DOPO LE 20:00\n');
        console.log('-'.repeat(80));
        
        const oggi = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const chiuseOggi = await dbAll(
            "SELECT * FROM open_positions WHERE status IN ('closed', 'stopped', 'taken') AND closed_at >= $1 ORDER BY closed_at DESC",
            [`${oggi} 20:00:00`]
        );
        
        console.log(`Trovate: ${chiuseOggi.length}\n`);
        chiuseOggi.forEach((pos, idx) => {
            console.log(`${idx + 1}. ${pos.symbol} | ${pos.type} | Ticket: ${pos.ticket_id}`);
            console.log(`   Chiusa: ${pos.closed_at || 'N/A'}`);
            console.log(`   Entry: $${parseFloat(pos.entry_price || 0).toFixed(8)} | Close: $${parseFloat(pos.current_price || 0).toFixed(8)}`);
        });
        
        // Verifica tutti i simboli unici
        console.log('\n7. TUTTI I SIMBOLI UNICI NEL DATABASE\n');
        console.log('-'.repeat(80));
        
        const simboli = await dbAll(
            "SELECT DISTINCT symbol, COUNT(*) as count FROM open_positions GROUP BY symbol ORDER BY symbol"
        );
        
        simboli.forEach(s => {
            console.log(`${s.symbol}: ${s.count} posizioni`);
        });
        
    } catch (error) {
        console.error('❌ Errore:', error);
        console.error(error.stack);
    }
}

verificaPosizioniOra().then(() => {
    console.log('\n✅ Verifica completata');
    process.exit(0);
}).catch(err => {
    console.error('❌ Errore:', err);
    process.exit(1);
});

