// Script semplice per verificare la chiave Google
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const privateKey = process.env.GOOGLE_PRIVATE_KEY;

if (!privateKey) {
  console.log('❌ GOOGLE_PRIVATE_KEY non trovata');
  process.exit(1);
}

console.log(`✅ Chiave trovata (lunghezza: ${privateKey.length} caratteri)\n`);

console.log('Prime 100 caratteri:');
console.log(privateKey.substring(0, 100));
console.log('\n...\n');
console.log('Ultimi 100 caratteri:');
console.log(privateKey.substring(privateKey.length - 100));

console.log('\n\nVerifica formattazione:');
console.log(`- Inizia con ": ${privateKey.startsWith('"') ? '✅' : '❌'}`);
console.log(`- Termina con ": ${privateKey.endsWith('"') ? '✅' : '❌'}`);
console.log(`- Contiene BEGIN: ${privateKey.includes('BEGIN PRIVATE KEY') ? '✅' : '❌'}`);
console.log(`- Contiene END: ${privateKey.includes('END PRIVATE KEY') ? '✅' : '❌'}`);
console.log(`- Contiene \\n: ${privateKey.includes('\\n') ? '✅' : '❌'}`);

// Lunghezza attesa: ~1650-1700 caratteri
if (privateKey.length < 1600) {
  console.log(`\n⚠️  ATTENZIONE: La chiave è troppo corta (${privateKey.length} caratteri). Dovrebbe essere ~1650-1700 caratteri.`);
  console.log('   Probabilmente è stata troncata durante l\'incollamento.');
}
