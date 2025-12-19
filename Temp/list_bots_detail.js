require('dotenv').config();
const db = require('./crypto_db');

async function listBots() {
  console.log('🤖 === BOT TRADING CONFIGURATI ===\n');
  
  const bots = await db.dbAll('SELECT * FROM bot_settings ORDER BY id');
  
  if (bots.length === 0) {
    console.log('❌ Nessun bot configurato');
    process.exit(0);
  }
  
  console.log(`Totale bot: ${bots.length}\n`);
  
  bots.forEach(bot => {
    const params = JSON.parse(bot.parameters || '{}');
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📌 BOT #${bot.id}`);
    console.log(`   Strategy: ${bot.strategy_name}`);
    console.log(`   Symbol: ${bot.symbol}`);
    console.log(`   Status: ${bot.is_active ? '🟢 ATTIVO' : '🔴 DISATTIVO'}`);
    console.log(`   Parametri:`);
    console.log(`     - RSI Period: ${params.rsi_period || 'N/A'}`);
    console.log(`     - RSI Oversold: ${params.rsi_oversold || 'N/A'}`);
    console.log(`     - RSI Overbought: ${params.rsi_overbought || 'N/A'}`);
    console.log(`     - Stop Loss: ${params.stop_loss_pct || 'N/A'}%`);
    console.log(`     - Take Profit: ${params.take_profit_pct || 'N/A'}%`);
    console.log(`     - Trade Size: $${params.trade_size_usdt || 'N/A'} USDT`);
    console.log(`     - Trailing Stop: ${params.trailing_stop_enabled ? 'SI' : 'NO'}`);
  });
  
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  const activeCount = bots.filter(b => b.is_active).length;
  const inactiveCount = bots.filter(b => !b.is_active).length;
  
  console.log(`📊 Riepilogo:`);
  console.log(`   🟢 Attivi: ${activeCount}`);
  console.log(`   🔴 Disattivi: ${inactiveCount}`);
  
  process.exit(0);
}

listBots().catch(e => {
  console.error('❌ Errore:', e.message);
  process.exit(1);
});

