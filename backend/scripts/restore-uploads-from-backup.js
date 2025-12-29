// Script per ripristinare i file uploads dal backup
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== RIPRISTINO FILE UPLOADS DAL BACKUP ===\n');

const backupArchive = '/var/backups/ticketapp/ticketapp_code_20251212_202509.tar.gz';
const targetDir = '/var/www/ticketapp/backend/uploads';
const tempDir = '/tmp/backup-restore-uploads';

// Verifica archivio
if (!fs.existsSync(backupArchive)) {
  console.log('❌ Archivio backup non trovato!');
  process.exit(1);
}

console.log(`📦 Archivio: ${backupArchive}`);
console.log(`📁 Destinazione: ${targetDir}\n`);

try {
  // Pulisci directory temporanea se esiste
  if (fs.existsSync(tempDir)) {
    execSync(`rm -rf "${tempDir}"`, { timeout: 10000 });
  }
  
  // Crea directory temporanea
  fs.mkdirSync(tempDir, { recursive: true });
  console.log('✅ Directory temporanea creata\n');
  
  // Estrai l'archivio
  console.log('📦 Estrazione archivio...');
  execSync(`cd "${tempDir}" && tar -xzf "${backupArchive}"`, {
    timeout: 120000,
    stdio: 'inherit'
  });
  console.log('✅ Estrazione completata\n');
  
  // Verifica cosa c'è
  const uploadsBackupPath = path.join(tempDir, 'ticketapp/backend/uploads');
  if (!fs.existsSync(uploadsBackupPath)) {
    console.log('❌ Directory uploads non trovata nell\'archivio');
    execSync(`rm -rf "${tempDir}"`, { timeout: 10000 });
    process.exit(1);
  }
  
  console.log('📋 Contenuto backup uploads:\n');
  try {
    execSync(`ls -la "${uploadsBackupPath}"`, { stdio: 'inherit' });
  } catch (e) {}
  
  // Verifica directory tickets/photos
  const photosBackupPath = path.join(uploadsBackupPath, 'tickets/photos');
  if (fs.existsSync(photosBackupPath)) {
    console.log('\n📸 File in tickets/photos:\n');
    try {
      const photoList = execSync(`ls -lh "${photosBackupPath}" | head -20`, {
        encoding: 'utf-8',
        timeout: 10000
      });
      console.log(photoList);
      
      const totalPhotos = execSync(`find "${photosBackupPath}" -type f | wc -l`, {
        encoding: 'utf-8',
        timeout: 10000
      });
      console.log(`\n📊 Totale file foto nel backup: ${totalPhotos.trim()}\n`);
    } catch (e) {
      console.log('⚠️  Errore lettura file foto');
    }
  }
  
  // Verifica directory tickets/offerte
  const offerteBackupPath = path.join(uploadsBackupPath, 'tickets/offerte');
  if (fs.existsSync(offerteBackupPath)) {
    try {
      const totalOfferte = execSync(`find "${offerteBackupPath}" -type f | wc -l`, {
        encoding: 'utf-8',
        timeout: 10000
      });
      console.log(`📄 File offerte nel backup: ${totalOfferte.trim()}\n`);
    } catch (e) {}
  }
  
  // Copia i file
  console.log('📋 Copia file dal backup...\n');
  
  // Assicurati che le directory target esistano
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  // Copia tutto il contenuto
  execSync(`cp -r "${uploadsBackupPath}"/* "${targetDir}"/`, {
    timeout: 60000,
    stdio: 'inherit'
  });
  
  console.log('\n✅ File copiati\n');
  
  // Imposta permessi
  console.log('🔐 Impostazione permessi...');
  execSync(`chown -R www-data:www-data "${targetDir}"`, {
    timeout: 30000,
    stdio: 'inherit'
  });
  execSync(`chmod -R 755 "${targetDir}"`, {
    timeout: 30000,
    stdio: 'inherit'
  });
  console.log('✅ Permessi impostati\n');
  
  // Verifica file ripristinati
  console.log('📊 Verifica file ripristinati:\n');
  try {
    const restoredPhotos = execSync(`find "${targetDir}/tickets/photos" -type f 2>/dev/null | wc -l`, {
      encoding: 'utf-8',
      timeout: 10000
    });
    console.log(`✅ File foto ripristinati: ${restoredPhotos.trim()}`);
  } catch (e) {}
  
  try {
    const restoredOfferte = execSync(`find "${targetDir}/tickets/offerte" -type f 2>/dev/null | wc -l`, {
      encoding: 'utf-8',
      timeout: 10000
    });
    console.log(`✅ File offerte ripristinati: ${restoredOfferte.trim()}`);
  } catch (e) {}
  
  // Pulisci directory temporanea
  console.log('\n🧹 Pulizia directory temporanea...');
  execSync(`rm -rf "${tempDir}"`, { timeout: 10000 });
  console.log('✅ Pulizia completata\n');
  
  console.log('=== RIPRISTINO COMPLETATO ===');
  console.log('\n💡 I file sono stati ripristinati da:');
  console.log(`   ${backupArchive}`);
  console.log(`\n📁 Directory: ${targetDir}`);
  console.log('\n⚠️  Verifica che i file siano accessibili dal browser');
  
} catch (error) {
  console.error('\n❌ ERRORE durante il ripristino:');
  console.error(error.message);
  
  // Pulisci in caso di errore
  try {
    if (fs.existsSync(tempDir)) {
      execSync(`rm -rf "${tempDir}"`, { timeout: 10000 });
    }
  } catch (e) {}
  
  process.exit(1);
}
