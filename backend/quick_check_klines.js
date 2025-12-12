const { dbAll } = require('./crypto_db_postgresql.js');

dbAll('SELECT symbol, COUNT(*) as cnt FROM klines GROUP BY symbol ORDER BY symbol')
  .then(rows => {
    console.log('\n📊 Klines nel database VPS:\n');
    rows.forEach(row => {
      const icon = parseInt(row.cnt) >= 5000 ? '✅' : parseInt(row.cnt) > 0 ? '⚠️' : '❌';
      console.log(`${icon} ${row.symbol.padEnd(25)} ${row.cnt} klines`);
    });
    console.log(`\n📈 Totale: ${rows.length} simboli`);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Errore:', err.message);
    process.exit(1);
  });
