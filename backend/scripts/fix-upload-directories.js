// Script per creare le directory uploads mancanti
const fs = require('fs');
const path = require('path');

const directories = [
  path.join(__dirname, '../uploads/tickets/photos'),
  path.join(__dirname, '../uploads/tickets/offerte'),
  path.join(__dirname, '../uploads/alerts'),
  path.join(__dirname, '../uploads/keepass')
];

console.log('=== CREAZIONE DIRECTORY UPLOADS ===\n');

let created = 0;
let existing = 0;
let errors = 0;

directories.forEach(dir => {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✅ Creata: ${dir}`);
      created++;
    } else {
      console.log(`ℹ️  Già esistente: ${dir}`);
      existing++;
    }
    
    // Verifica permessi di scrittura
    try {
      fs.accessSync(dir, fs.constants.W_OK);
      console.log(`   ✅ Scrivibile`);
    } catch (accessErr) {
      console.log(`   ⚠️  Non scrivibile: ${accessErr.message}`);
      errors++;
    }
  } catch (err) {
    console.error(`❌ Errore creazione ${dir}: ${err.message}`);
    errors++;
  }
});

console.log('\n=== RIEPILOGO ===');
console.log(`✅ Directory create: ${created}`);
console.log(`ℹ️  Directory esistenti: ${existing}`);
console.log(`❌ Errori: ${errors}`);

if (created > 0) {
  console.log('\n💡 IMPORTANTE: Se il server è in esecuzione con PM2, potrebbe essere necessario:');
  console.log('   1. Verificare i permessi: chown -R www-data:www-data /var/www/ticketapp/backend/uploads');
  console.log('   2. Riavviare il backend: pm2 restart ticketapp-backend');
}
