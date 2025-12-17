const { dbAll } = require('./crypto_db_postgresql.js');

async function checkSymbolsTable() {
  try {
    console.log('🔍 Verifico tabella symbols...\n');
    
    const symbols = await dbAll('SELECT * FROM symbols WHERE symbol IN (?, ?, ?, ?, ?, ?)', 
      ['optimism', 'the_sandbox', 'decentraland', 'axie_infinity', 'sand', 'mana']);
    
    console.log('📊 Simboli trovati:', symbols.length);
    symbols.forEach(s => {
      console.log(`   ${s.symbol}: ${s.base_currency}/${s.quote_currency}`);
    });
    
    const missing = ['optimism', 'the_sandbox', 'decentraland', 'axie_infinity'].filter(
      sym => !symbols.find(s => s.symbol === sym)
    );
    
    if (missing.length > 0) {
      console.log('\n❌ Simboli mancanti nella tabella symbols:');
      missing.forEach(m => console.log(`   - ${m}`));
      console.log('\n💡 Questi simboli devono essere aggiunti alla tabella symbols!');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Errore:', error.message);
    process.exit(1);
  }
}

checkSymbolsTable();
