// Script per esplorare meglio il contenuto degli archivi e potenzialmente estrarre i file
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== ANALISI DETTAGLIATA ARCHIVI BACKUP ===\n');

const backupDir = '/var/www/ticketapp/backend';
const archivePath = '/var/backups/ticketapp/ticketapp_code_20251212_202509.tar.gz'; // Più recente

console.log(`📦 Analizzando archivio più recente: ${archivePath}\n`);

if (!fs.existsSync(archivePath)) {
  console.log('❌ Archivio non trovato!');
  process.exit(1);
}

console.log('1. Contenuto directory uploads/tickets nell\'archivio:\n');

try {
  // Lista tutto il contenuto di uploads/tickets
  const result = execSync(`tar -tzf "${archivePath}" | grep "uploads/tickets" | head -50`, {
    encoding: 'utf-8',
    timeout: 30000
  });
  
  if (result.trim()) {
    const lines = result.trim().split('\n');
    console.log(`Trovati ${lines.length} elementi in uploads/tickets:\n`);
    
    const photos = lines.filter(l => l.includes('photos'));
    const offerte = lines.filter(l => l.includes('offerte'));
    const alerts = lines.filter(l => l.includes('alerts'));
    const keepass = lines.filter(l => l.includes('keepass'));
    
    console.log(`📸 uploads/tickets/photos: ${photos.length} elementi`);
    if (photos.length > 0) {
      photos.slice(0, 10).forEach(p => console.log(`   ${p}`));
      if (photos.length > 10) console.log(`   ... e altri ${photos.length - 10} file`);
    }
    
    console.log(`\n📄 uploads/tickets/offerte: ${offerte.length} elementi`);
    if (offerte.length > 0) {
      offerte.slice(0, 5).forEach(o => console.log(`   ${o}`));
      if (offerte.length > 5) console.log(`   ... e altri ${offerte.length - 5} file`);
    }
    
    console.log(`\n🚨 uploads/alerts: ${alerts.length} elementi`);
    console.log(`\n🔐 uploads/keepass: ${keepass.length} elementi`);
    
    // Cerca file che corrispondono ai pattern dei file mancanti
    console.log('\n2. Cerca file che corrispondono ai pattern dei file mancanti:\n');
    
    const missingPatterns = [
      '1764242162408', // timestamp dal primo file
      '1764242261704', // timestamp dal secondo file
      '1765802806450', // timestamp dal terzo file
      '1764242398488',
      '1764243762193',
      '1764243762195',
      '1764242987591',
      '1762543419904',
      '1764788422002',
      '1764788483574',
      '1764788678829'
    ];
    
    missingPatterns.forEach(pattern => {
      try {
        const searchResult = execSync(`tar -tzf "${archivePath}" | grep "${pattern}"`, {
          encoding: 'utf-8',
          timeout: 10000
        });
        
        if (searchResult.trim()) {
          console.log(`✅ Trovato pattern ${pattern}:`);
          searchResult.trim().split('\n').forEach(line => {
            console.log(`   ${line}`);
          });
        }
      } catch (e) {
        // Pattern non trovato
      }
    });
    
    // Conta totale file foto
    try {
      const photoCount = execSync(`tar -tzf "${archivePath}" | grep "uploads/tickets/photos/" | grep -v "/$" | wc -l`, {
        encoding: 'utf-8',
        timeout: 15000
      });
      console.log(`\n📊 Totale file foto trovati: ${photoCount.trim()}`);
    } catch (e) {}
    
  } else {
    console.log('❌ Nessun contenuto trovato in uploads/tickets');
  }
} catch (e) {
  console.log(`❌ Errore analisi: ${e.message}`);
}

console.log('\n3. Estrazione file (dry-run):\n');
console.log('Per estrarre i file, esegui questi comandi:\n');
console.log(`# Crea directory temporanea`);
console.log(`mkdir -p /tmp/backup-restore`);
console.log(`\n# Estrai l'archivio`);
console.log(`cd /tmp/backup-restore`);
console.log(`tar -xzf ${archivePath}`);
console.log(`\n# Verifica cosa c'è`);
console.log(`ls -la ticketapp/backend/uploads/tickets/photos/ | head -20`);
console.log(`\n# Copia i file (se esistono)`);
console.log(`cp -r ticketapp/backend/uploads/* ${backupDir}/uploads/`);
console.log(`chown -R www-data:www-data ${backupDir}/uploads`);
console.log(`chmod -R 755 ${backupDir}/uploads`);
console.log(`\n# Pulisci`);
console.log(`rm -rf /tmp/backup-restore`);
