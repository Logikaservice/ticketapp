require('dotenv').config();
const db = require('./crypto_db');

async function check() {
  console.log('=== RICERCA BINANCE_COIN NEL DATABASE ===\n');
  
  const tables = ['trades', 'open_positions', 'klines', 'price_history', 'closed_positions'];
  
  for (const table of tables) {
    try {
      const query = `SELECT COUNT(*) as count FROM ${table} WHERE symbol LIKE '%binance_coin%' OR symbol LIKE '%BINANCE_COIN%'`;
      const result = await db.dbGet(query);
      if (result && result.count > 0) {
        console.log(`✅ ${table}: ${result.count} record con binance_coin`);
      } else {
        console.log(`❌ ${table}: 0 record`);
      }
    } catch (e) {
      console.log(`⚠️ ${table}: Tabella non esiste o errore`);
    }
  }
  
  process.exit(0);
}

check();

