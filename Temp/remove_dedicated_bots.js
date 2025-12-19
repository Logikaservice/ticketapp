require('dotenv').config();
const db = require('./crypto_db');

async function cleanup() {
  console.log('🗑️ ELIMINAZIONE BOT DEDICATI...\n');
  
  try {
    // Lista bot da eliminare
    const botsToRemove = [17, 18, 19];
    
    console.log('📋 Bot da eliminare:');
    for (const botId of botsToRemove) {
      const bot = await db.dbGet('SELECT * FROM bot_settings WHERE id = ?', [botId]);
      if (bot) {
        console.log(`   - Bot #${bot.id}: ${bot.symbol} (${bot.strategy_name})`);
      }
    }
    
    console.log('\n🔄 Eliminazione in corso...\n');
    
    // Elimina i bot
    for (const botId of botsToRemove) {
      await db.dbRun('DELETE FROM bot_settings WHERE id = ?', [botId]);
      console.log(`   ✅ Bot #${botId} eliminato`);
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ PULIZIA COMPLETATA!\n');
    
    // Verifica bot rimanenti
    const remainingBots = await db.dbAll('SELECT * FROM bot_settings');
    console.log(`📊 Bot rimanenti: ${remainingBots.length}\n`);
    
    remainingBots.forEach(bot => {
      console.log(`   🤖 Bot #${bot.id}: ${bot.symbol} - ${bot.is_active ? '🟢 ATTIVO' : '🔴 DISATTIVO'}`);
    });
    
    console.log('\n💡 Ora hai solo il bot GLOBAL che monitora TUTTI i simboli!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    process.exit(0);
  } catch (e) {
    console.error('❌ Errore:', e.message);
    process.exit(1);
  }
}

cleanup();

