const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./crypto.db');

console.log('🔍 Analisi posizioni chiuse negli ultimi 10 minuti...\n');

const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
console.log(`Cerco posizioni chiuse dopo: ${tenMinutesAgo}\n`);

db.all(`
    SELECT 
        ticket_id,
        symbol,
        type,
        status,
        entry_price,
        current_price,
        volume,
        volume_closed,
        profit_loss,
        opened_at,
        closed_at,
        stop_loss,
        take_profit
    FROM open_positions 
    WHERE closed_at > ?
    ORDER BY closed_at DESC 
    LIMIT 10
`, [tenMinutesAgo], (err, positions) => {
    if (err) {
        console.error('❌ Errore:', err);
        db.close();
        return;
    }

    if (positions.length === 0) {
        console.log('⚠️ Nessuna posizione chiusa negli ultimi 10 minuti');

        // Cerca TUTTE le posizioni chiuse (ultime 20)
        console.log('\n📊 Cerco ultime 20 posizioni chiuse (qualsiasi data)...\n');
        db.all(`
            SELECT 
                ticket_id,
                symbol,
                type,
                status,
                entry_price,
                current_price,
                volume,
                profit_loss,
                opened_at,
                closed_at
            FROM open_positions 
            WHERE status = 'closed'
            ORDER BY closed_at DESC 
            LIMIT 20
        `, (err2, allClosed) => {
            if (err2) {
                console.error('❌ Errore:', err2);
            } else if (allClosed.length === 0) {
                console.log('❌ NESSUNA posizione chiusa trovata nel database!');
                console.log('   Questo è un BUG GRAVE: le posizioni chiuse non vengono salvate!');
            } else {
                console.log(`✅ Trovate ${allClosed.length} posizioni chiuse:\n`);
                allClosed.forEach((pos, idx) => {
                    const pnl = parseFloat(pos.profit_loss);
                    const pnlColor = pnl >= 0 ? '✅' : '❌';
                    console.log(`${idx + 1}. ${pos.symbol.toUpperCase()} (${pos.type}) - ${pnlColor} €${pnl.toFixed(2)} - Closed: ${pos.closed_at}`);
                });
            }
            db.close();
        });
        return;
    }

    console.log(`✅ Trovate ${positions.length} posizioni chiuse negli ultimi 10 minuti:\n`);

    positions.forEach((pos, idx) => {
        console.log(`\n📊 Posizione ${idx + 1}:`);
        console.log(`   Ticket ID: ${pos.ticket_id}`);
        console.log(`   Symbol: ${pos.symbol.toUpperCase()}`);
        console.log(`   Status: ${pos.status}`);
        console.log(`   Tipo: ${pos.type}`);
        console.log(`   Entry: €${parseFloat(pos.entry_price).toFixed(4)}`);
        console.log(`   Close: €${parseFloat(pos.current_price).toFixed(4)}`);
        console.log(`   Volume: ${parseFloat(pos.volume).toFixed(4)}`);
        console.log(`   P&L: €${parseFloat(pos.profit_loss).toFixed(2)}`);
        console.log(`   Opened: ${pos.opened_at}`);
        console.log(`   Closed: ${pos.closed_at}`);

        // Analisi motivo chiusura
        const entryPrice = parseFloat(pos.entry_price);
        const closePrice = parseFloat(pos.current_price);
        const stopLoss = pos.stop_loss ? parseFloat(pos.stop_loss) : null;
        const takeProfit = pos.take_profit ? parseFloat(pos.take_profit) : null;

        console.log(`\n   🔍 Motivo Chiusura:`);
        if (stopLoss && closePrice <= stopLoss) {
            console.log(`      ⚠️ STOP LOSS (SL: €${stopLoss.toFixed(4)})`);
        } else if (takeProfit && closePrice >= takeProfit) {
            console.log(`      ✅ TAKE PROFIT (TP: €${takeProfit.toFixed(4)})`);
        } else {
            const priceChange = ((closePrice - entryPrice) / entryPrice * 100);
            console.log(`      ℹ️ Altro motivo (Price change: ${priceChange.toFixed(2)}%)`);
        }
    });

    db.close();
});
