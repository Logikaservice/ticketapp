// Script per verificare la formattazione delle credenziali Google nel file .env
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

console.log('=== VERIFICA CREDENZIALI GOOGLE ===\n');

const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
const privateKey = process.env.GOOGLE_PRIVATE_KEY;
const projectId = process.env.GOOGLE_PROJECT_ID;

console.log('1. GOOGLE_CLIENT_EMAIL:');
if (clientEmail) {
  console.log(`   ✅ Presente: ${clientEmail}`);
} else {
  console.log('   ❌ MANCANTE');
}

console.log('\n2. GOOGLE_PROJECT_ID:');
if (projectId) {
  console.log(`   ✅ Presente: ${projectId}`);
} else {
  console.log('   ⚠️  Mancante (userà default: ticketapp-b2a2a)');
}

console.log('\n3. GOOGLE_PRIVATE_KEY:');
if (!privateKey) {
  console.log('   ❌ MANCANTE');
  process.exit(1);
}

console.log(`   ✅ Presente (lunghezza: ${privateKey.length} caratteri)`);

// Verifica formattazione
const startsCorrect = privateKey.startsWith('"-----BEGIN PRIVATE KEY-----');
const endsCorrect = privateKey.endsWith('-----END PRIVATE KEY-----\\n"');
const hasQuotes = privateKey.startsWith('"') && privateKey.endsWith('"');

console.log(`   - Inizia con virgoletta e BEGIN: ${startsCorrect ? '✅' : '❌'}`);
console.log(`   - Termina con END e virgoletta: ${endsCorrect ? '✅' : '❌'}`);
console.log(`   - Ha virgolette: ${hasQuotes ? '✅' : '❌'}`);
console.log(`   - Contiene \\n: ${privateKey.includes('\\n') ? '✅' : '❌'}`);

// Verifica lunghezza approssimativa (dovrebbe essere ~1650-1700 caratteri con virgolette)
if (privateKey.length < 1600) {
  console.log('   ⚠️  ATTENZIONE: La chiave sembra troppo corta (potrebbe essere troncata)');
} else if (privateKey.length > 2000) {
  console.log('   ⚠️  ATTENZIONE: La chiave sembra troppo lunga (potrebbero esserci caratteri extra)');
} else {
  console.log('   ✅ Lunghezza corretta');
}

// Mostra primi e ultimi caratteri (senza mostrare tutta la chiave)
console.log(`\n   Prime 50 caratteri: ${privateKey.substring(0, 50)}...`);
console.log(`   Ultimi 50 caratteri: ...${privateKey.substring(privateKey.length - 50)}`);

// Prova a parsare
console.log('\n4. Test parsing chiave:');
try {
  // Rimuovi le virgolette esterne se ci sono
  let keyToTest = privateKey;
  if (keyToTest.startsWith('"') && keyToTest.endsWith('"')) {
    keyToTest = keyToTest.slice(1, -1);
  }
  
  // Sostituisci \n con newline reali
  keyToTest = keyToTest.replace(/\\n/g, '\n');
  
  // Verifica che inizi e finisca correttamente
  if (!keyToTest.startsWith('-----BEGIN PRIVATE KEY-----')) {
    throw new Error('La chiave non inizia con -----BEGIN PRIVATE KEY-----');
  }
  if (!keyToTest.endsWith('-----END PRIVATE KEY-----\n')) {
    throw new Error('La chiave non termina con -----END PRIVATE KEY-----\\n');
  }
  
  console.log('   ✅ Formattazione corretta');
} catch (err) {
  console.log(`   ❌ Errore parsing: ${err.message}`);
  console.log('\n💡 SUGGERIMENTO:');
  console.log('   La chiave deve essere:');
  console.log('   - Tra virgolette doppie "..."');
  console.log('   - Su una sola riga logica');
  console.log('   - Con \\n (backslash + n) non a capo reali');
  console.log('   - Iniziare con "-----BEGIN PRIVATE KEY-----');
  console.log('   - Terminare con -----END PRIVATE KEY-----\\n"');
  process.exit(1);
}

console.log('\n✅ Verifica completata! Le credenziali sembrano corrette.');









