require('dotenv').config();
const db = require('./crypto_db');

async function cleanup() {
  try {
    // Elimina bot #27
    await db.dbRun('DELETE FROM bot_settings WHERE id = $1', [27]);
    console.log('✅ Bot #27 eliminato!\n');
    
    // Mostra configurazione finale
    const bots = await db.dbAll('SELECT * FROM bot_settings ORDER BY id');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 CONFIGURAZIONE FINALE:\n');
    console.log(`Bot totali: ${bots.length}\n`);
    
    bots.forEach(b => {
      console.log(`🤖 Bot #${b.id}: ${b.symbol}`);
      console.log(`   Strategy: ${b.strategy_name}`);
      console.log(`   Status: ${b.is_active ? '🟢 ATTIVO' : '🔴 DISATTIVO'}\n`);
    });
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ PERFETTO! Solo il bot GLOBAL rimasto!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    process.exit(0);
  } catch (e) {
    console.error('❌ Errore:', e.message);
    process.exit(1);
  }
}

cleanup();

