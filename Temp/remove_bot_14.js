require('dotenv').config();
const db = require('./crypto_db');

async function removeBitcoinBot() {
  console.log('🗑️ ELIMINAZIONE BOT #14 (Bitcoin)...\n');
  
  try {
    // Verifica bot prima di eliminare
    const bot = await db.dbGet('SELECT * FROM bot_settings WHERE id = $1', [14]);
    
    if (!bot) {
      console.log('⚠️ Bot #14 non trovato (già eliminato?)');
      process.exit(0);
    }
    
    console.log('📋 Bot da eliminare:');
    console.log(`   ID: ${bot.id}`);
    console.log(`   Symbol: ${bot.symbol}`);
    console.log(`   Strategy: ${bot.strategy_name}`);
    console.log(`   Status: ${bot.is_active ? '🟢 ATTIVO' : '🔴 DISATTIVO'}\n`);
    
    // Elimina
    await db.dbRun('DELETE FROM bot_settings WHERE id = $1', [14]);
    console.log('✅ Bot #14 eliminato con successo!\n');
    
    // Verifica risultato finale
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 CONFIGURAZIONE FINALE:\n');
    
    const remainingBots = await db.dbAll('SELECT * FROM bot_settings ORDER BY id');
    
    if (remainingBots.length === 0) {
      console.log('⚠️ Nessun bot configurato!');
    } else {
      console.log(`Bot totali: ${remainingBots.length}\n`);
      remainingBots.forEach(b => {
        console.log(`   🤖 Bot #${b.id}: ${b.symbol}`);
        console.log(`      Strategy: ${b.strategy_name}`);
        console.log(`      Status: ${b.is_active ? '🟢 ATTIVO' : '🔴 DISATTIVO'}\n`);
      });
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Ora hai SOLO il bot GLOBAL attivo!');
    console.log('💡 Monitora automaticamente TUTTI i simboli');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    process.exit(0);
  } catch (e) {
    console.error('❌ Errore:', e.message);
    process.exit(1);
  }
}

removeBitcoinBot();

