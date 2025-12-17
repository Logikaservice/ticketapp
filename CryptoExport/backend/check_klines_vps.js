// Verifica klines presenti nel database VPS PostgreSQL
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL_CRYPTO,
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkKlines() {
  try {
    console.log('🔍 Verifico klines nel database VPS...\n');
    
    const symbols = [
      'bitcoin', 'ethereum', 'polkadot', 'polygon', 'chainlink', 'litecoin',
      'stellar', 'monero', 'tron', 'cosmos', 'near', 'uniswap',
      'optimism', 'the_sandbox', 'decentraland', 'axie_infinity',
      'gala', 'avalanche', 'binance_coin', 'sand', 'mana', 'axs'
    ];
    
    const result = await pool.query(
      `SELECT symbol, COUNT(*) as klines_count 
       FROM klines 
       WHERE symbol = ANY($1)
       GROUP BY symbol 
       ORDER BY symbol`,
      [symbols]
    );
    
    console.log('📊 Klines presenti nel database:\n');
    
    const foundSymbols = result.rows.map(r => r.symbol);
    const missingSymbols = symbols.filter(s => !foundSymbols.includes(s));
    
    result.rows.forEach(row => {
      const icon = row.klines_count >= 5000 ? '✅' : row.klines_count > 0 ? '⚠️' : '❌';
      console.log(`${icon} ${row.symbol.padEnd(20)} ${row.klines_count} klines`);
    });
    
    if (missingSymbols.length > 0) {
      console.log('\n❌ Simboli senza klines:');
      missingSymbols.forEach(s => console.log(`   - ${s}`));
    }
    
    console.log(`\n📈 Totale simboli con klines: ${result.rows.length}/${symbols.length}`);
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
  } finally {
    await pool.end();
  }
}

checkKlines();
