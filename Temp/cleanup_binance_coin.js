require('dotenv').config();
const db = require('./crypto_db');

async function cleanup() {
  console.log('🧹 PULIZIA DATI BINANCE_COIN...\n');
  
  try {
    // Elimina da klines
    const klinesResult = await db.dbRun("DELETE FROM klines WHERE symbol LIKE '%binance_coin%' OR symbol LIKE '%BINANCE_COIN%'");
    console.log('✅ Klines: record eliminati');
    
    // Elimina da price_history
    const priceResult = await db.dbRun("DELETE FROM price_history WHERE symbol LIKE '%binance_coin%' OR symbol LIKE '%BINANCE_COIN%'");
    console.log('✅ Price history: record eliminati');
    
    console.log('\n✅ PULIZIA COMPLETATA! binance_coin rimosso dal database.');
    process.exit(0);
  } catch (e) {
    console.error('❌ Errore:', e.message);
    process.exit(1);
  }
}

cleanup();

