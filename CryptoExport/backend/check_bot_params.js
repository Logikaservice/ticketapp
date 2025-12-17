const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./crypto.db');

db.all('SELECT symbol, is_active, parameters FROM bot_settings WHERE strategy_name = ?', ['RSI_Strategy'], (err, rows) => {
    if (err) {
        console.error('Error:', err);
    } else {
        console.log('\n=== CONFIGURAZIONE BOT SETTINGS ===\n');
        rows.forEach(r => {
            const p = JSON.parse(r.parameters);
            const status = r.is_active ? '✅ ATTIVO' : '❌ OFF';
            console.log(`${r.symbol.toUpperCase().padEnd(15)} ${status}`);
            console.log(`  RSI: Oversold=${p.rsi_oversold || 'N/A'} Overbought=${p.rsi_overbought || 'N/A'} Period=${p.rsi_period || 'N/A'}`);
            console.log(`  Risk: SL=${p.stop_loss_pct || 'N/A'}% TP=${p.take_profit_pct || 'N/A'}%`);
            console.log(`  Trailing: ${p.trailing_stop_enabled ? 'ON' : 'OFF'} (${p.trailing_stop_distance_pct || 'N/A'}%)`);
            console.log(`  Partial: ${p.partial_close_enabled ? 'ON' : 'OFF'} (TP1=${p.take_profit_1_pct || 'N/A'}% TP2=${p.take_profit_2_pct || 'N/A'}%)`);
            console.log(`  Trade Size: ${p.trade_size_eur || 'N/A'}€`);
            console.log('');
        });
    }
    db.close();
});
