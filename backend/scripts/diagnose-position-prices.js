/**
 * Script di diagnostica per verificare discrepanze EUR/USDT nelle posizioni
 * Verifica se entry_price e current_price sono coerenti con TradingView
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'crypto.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Errore apertura database:', err.message);
        process.exit(1);
    }
    console.log('✅ Database aperto');
});

db.all("SELECT ticket_id, symbol, type, entry_price, current_price, opened_at, status FROM open_positions WHERE status = 'open' ORDER BY opened_at DESC", [], (err, rows) => {
    if (err) {
        console.error('❌ Errore query:', err.message);
        db.close();
        process.exit(1);
    }

    console.log('\n📊 ANALISI POSIZIONI APERTE\n');
    console.log(`Trovate ${rows.length} posizioni aperte\n`);

    rows.forEach((pos, index) => {
        const entryPrice = parseFloat(pos.entry_price);
        const currentPrice = parseFloat(pos.current_price);
        const priceDiff = currentPrice - entryPrice;
        const priceDiffPct = entryPrice > 0 ? ((priceDiff / entryPrice) * 100) : 0;

        console.log(`\n${index + 1}. ${pos.symbol.toUpperCase()} (${pos.type.toUpperCase()})`);
        console.log(`   Ticket ID: ${pos.ticket_id}`);
        console.log(`   Aperta: ${pos.opened_at}`);
        console.log(`   Entry Price: $${entryPrice.toFixed(6)}`);
        console.log(`   Current Price: $${currentPrice.toFixed(6)}`);
        console.log(`   Differenza: $${priceDiff.toFixed(6)} (${priceDiffPct >= 0 ? '+' : ''}${priceDiffPct.toFixed(2)}%)`);

        // Verifica se i prezzi sembrano ragionevoli
        if (entryPrice > 100000 && pos.symbol !== 'bitcoin') {
            console.log(`   ⚠️  WARNING: Entry price molto alto, potrebbe essere in EUR invece di USDT`);
        }
        if (currentPrice > 100000 && pos.symbol !== 'bitcoin') {
            console.log(`   ⚠️  WARNING: Current price molto alto, potrebbe essere in EUR invece di USDT`);
        }
        if (Math.abs(priceDiffPct) > 50) {
            console.log(`   ⚠️  WARNING: Differenza prezzo molto alta (>50%), possibile problema di conversione`);
        }
    });

    console.log('\n✅ Analisi completata\n');
    db.close();
});

















