require('dotenv').config();
const db = require('./crypto_db');

db.dbAll('SELECT id, strategy_name, symbol, is_active FROM bot_settings')
  .then(bots => {
    console.log('=== BOT CONFIGURATI ===');
    bots.forEach(bot => {
      console.log(`ID: ${bot.id} | Symbol: ${bot.symbol} | Active: ${bot.is_active} | Strategy: ${bot.strategy_name}`);
    });
    process.exit(0);
  })
  .catch(e => {
    console.error('Errore:', e.message);
    process.exit(1);
  });

