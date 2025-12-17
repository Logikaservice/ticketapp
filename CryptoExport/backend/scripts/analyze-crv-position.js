const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./crypto.db');

console.log('🔍 Analisi TUTTE le posizioni CRV...\n');

// Cerca in tutte le posizioni (aperte e chiuse)
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
    WHERE symbol = 'crv' 
    ORDER BY opened_at DESC 
    LIMIT 5
`, (err, positions) => {
    if (err) {
        console.error('❌ Errore:', err);
        db.close();
        return;
    }

    if (positions.length === 0) {
        console.log('⚠️ Nessuna posizione CRV trovata nel database');

        // Cerca anche con LIKE per sicurezza
        db.all(`
            SELECT ticket_id, symbol, type, status, entry_price, profit_loss
            FROM open_positions 
            WHERE symbol LIKE '%crv%' 
            ORDER BY opened_at DESC 
            LIMIT 5
        `, (err2, positions2) => {
            if (err2) {
                console.error('❌ Errore ricerca LIKE:', err2);
            } else if (positions2.length > 0) {
                console.log('\n✅ Trovate posizioni con LIKE:');
                positions2.forEach(p => {
                    console.log(`   - ${p.symbol} (${p.status}): €${parseFloat(p.profit_loss).toFixed(2)}`);
                });
            } else {
                console.log('\n❌ Nessuna posizione trovata nemmeno con LIKE');
            }
            db.close();
        });
        return;
    }

    console.log(`✅ Trovate ${positions.length} posizioni CRV:\n`);

    positions.forEach((pos, idx) => {
        console.log(`\n📊 Posizione ${idx + 1}:`);
        console.log(`   Ticket ID: ${pos.ticket_id}`);
        console.log(`   Status: ${pos.status}`);
        console.log(`   Tipo: ${pos.type}`);
        console.log(`   Entry Price: €${parseFloat(pos.entry_price).toFixed(4)}`);
        console.log(`   Current Price: €${parseFloat(pos.current_price).toFixed(4)}`);
        console.log(`   Volume: ${parseFloat(pos.volume).toFixed(4)}`);
        console.log(`   Volume Closed: ${parseFloat(pos.volume_closed || 0).toFixed(4)}`);
        console.log(`   P&L: €${parseFloat(pos.profit_loss).toFixed(2)}`);
        console.log(`   Opened: ${pos.opened_at}`);
        console.log(`   Closed: ${pos.closed_at || 'N/A'}`);
        console.log(`   Stop Loss: €${pos.stop_loss ? parseFloat(pos.stop_loss).toFixed(4) : 'N/A'}`);
        console.log(`   Take Profit: €${pos.take_profit ? parseFloat(pos.take_profit).toFixed(4) : 'N/A'}`);

        // Calcola P&L manualmente
        const entryPrice = parseFloat(pos.entry_price);
        const closePrice = parseFloat(pos.current_price);
        const volume = parseFloat(pos.volume);
        const volumeClosed = parseFloat(pos.volume_closed || 0);
        const actualVolume = volumeClosed > 0 ? volumeClosed : volume;

        let calculatedPnL = 0;
        if (pos.type === 'buy') {
            calculatedPnL = (closePrice - entryPrice) * actualVolume;
        } else {
            calculatedPnL = (entryPrice - closePrice) * actualVolume;
        }

        console.log(`\n   ✅ Verifica Calcolo:`);
        console.log(`      Entry: €${entryPrice.toFixed(4)}`);
        console.log(`      Current: €${closePrice.toFixed(4)}`);
        console.log(`      Diff: €${(closePrice - entryPrice).toFixed(4)} (${((closePrice - entryPrice) / entryPrice * 100).toFixed(2)}%)`);
        console.log(`      Volume: ${actualVolume.toFixed(4)}`);
        console.log(`      P&L Calcolato: €${calculatedPnL.toFixed(2)}`);
        console.log(`      P&L Database: €${parseFloat(pos.profit_loss).toFixed(2)}`);
        console.log(`      Match: ${Math.abs(calculatedPnL - parseFloat(pos.profit_loss)) < 0.01 ? '✅' : '❌'}`);
    });

    db.close();
});
