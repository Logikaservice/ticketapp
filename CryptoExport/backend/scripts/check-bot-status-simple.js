/**
 * Script semplice per verificare lo stato del bot
 */

const db = require('../crypto_db');

db.all("SELECT * FROM bot_settings WHERE strategy_name = 'RSI_Strategy'", (err, rows) => {
    if (err) {
        console.error('❌ Errore:', err.message);
        db.close();
        return;
    }
    
    console.log('\n🔍 STATO BOT:\n');
    console.log(`Totale bot configurati: ${rows.length}`);
    
    if (rows.length === 0) {
        console.log('⚠️  NESSUN BOT CONFIGURATO!');
        console.log('   → Il bot è in pausa (nessun bot attivo)');
    } else {
        const active = rows.filter(r => r.is_active === 1);
        const paused = rows.filter(r => r.is_active === 0);
        
        console.log(`✅ Bot ATTIVI: ${active.length}`);
        active.forEach(b => console.log(`   • ${b.symbol}`));
        
        console.log(`\n⏸️  Bot IN PAUSA: ${paused.length}`);
        paused.forEach(b => console.log(`   • ${b.symbol}`));
        
        console.log(`\n📊 STATO GENERALE: ${active.length > 0 ? '✅ ATTIVO' : '⏸️  IN PAUSA'}`);
    }
    
    db.close();
});
