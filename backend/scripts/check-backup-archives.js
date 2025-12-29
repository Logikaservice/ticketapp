// Script per verificare se gli archivi di backup contengono i file uploads
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== VERIFICA CONTENUTO ARCHIVI BACKUP ===\n');

const backupDir = '/var/backups/ticketapp';
const archives = [
  'backup_pre_orari_20251121_184817/code_backup.tar.gz',
  'ticketapp_code_20251212_200124.tar.gz',
  'ticketapp_code_20251212_190955.tar.gz',
  'ticketapp_code_20251212_201604.tar.gz',
  'ticketapp_code_20251212_202509.tar.gz',
  'ticketapp_code_20251212_201718.tar.gz',
  'ticketapp_code_20251212_183423.tar.gz'
];

console.log('1. Lista completa directory backup:\n');
try {
  const items = fs.readdirSync(backupDir);
  items.forEach(item => {
    const itemPath = path.join(backupDir, item);
    try {
      const stat = fs.statSync(itemPath);
      if (stat.isDirectory()) {
        console.log(`📁 ${item}/`);
        const subItems = fs.readdirSync(itemPath);
        subItems.forEach(subItem => {
          const subPath = path.join(itemPath, subItem);
          try {
            const subStat = fs.statSync(subPath);
            if (subStat.isFile()) {
              const sizeMB = (subStat.size / (1024 * 1024)).toFixed(2);
              console.log(`   📄 ${subItem} (${sizeMB} MB)`);
            }
          } catch (e) {}
        });
      } else if (stat.isFile() && (item.endsWith('.tar.gz') || item.endsWith('.zip'))) {
        const sizeMB = (stat.size / (1024 * 1024)).toFixed(2);
        console.log(`📦 ${item} (${sizeMB} MB)`);
      }
    } catch (e) {}
  });
} catch (e) {
  console.log(`❌ Errore lettura directory: ${e.message}`);
}

console.log('\n2. Verifica se gli archivi contengono directory uploads:\n');

archives.forEach(archive => {
  const archivePath = path.join(backupDir, archive);
  
  if (!fs.existsSync(archivePath)) {
    console.log(`❌ ${archive} - NON TROVATO`);
    return;
  }
  
  console.log(`🔍 Analizzando: ${archive}`);
  
  try {
    // Lista il contenuto dell'archivio cercando uploads
    const result = execSync(`tar -tzf "${archivePath}" 2>/dev/null | grep -E "(uploads|tickets/photos)" | head -20`, {
      encoding: 'utf-8',
      timeout: 30000
    });
    
    if (result.trim()) {
      console.log(`   ✅ CONTIENE UPLOADS!`);
      const lines = result.trim().split('\n').slice(0, 10);
      lines.forEach(line => {
        console.log(`      ${line}`);
      });
      if (result.trim().split('\n').length > 10) {
        console.log(`      ... e altri file`);
      }
      
      // Conta quanti file uploads contiene
      try {
        const countResult = execSync(`tar -tzf "${archivePath}" 2>/dev/null | grep -c "uploads/tickets/photos"`, {
          encoding: 'utf-8',
          timeout: 30000
        });
        const count = parseInt(countResult.trim()) || 0;
        console.log(`   📊 File uploads trovati: ${count}`);
      } catch (e) {}
    } else {
      console.log(`   ❌ Non contiene uploads (o escluso)`);
    }
  } catch (e) {
    console.log(`   ⚠️  Errore analisi: ${e.message}`);
  }
  
  console.log('');
});

console.log('3. Cerca file specifici mancanti negli archivi:\n');

const missingFiles = [
  'ticket-photo-1764242162408-805694451.jpg',
  'ticket-photo-1764242261704-984187090.png',
  'ticket-photo-1765802806450-289066004.jpg'
];

missingFiles.forEach(filename => {
  console.log(`🔍 Cercando: ${filename}`);
  let found = false;
  
  archives.forEach(archive => {
    const archivePath = path.join(backupDir, archive);
    if (!fs.existsSync(archivePath)) return;
    
    try {
      const result = execSync(`tar -tzf "${archivePath}" 2>/dev/null | grep "${filename}"`, {
        encoding: 'utf-8',
        timeout: 15000
      });
      
      if (result.trim()) {
        console.log(`   ✅ TROVATO in: ${archive}`);
        console.log(`      Path: ${result.trim()}`);
        found = true;
      }
    } catch (e) {
      // File non trovato in questo archivio
    }
  });
  
  if (!found) {
    console.log(`   ❌ Non trovato in nessun archivio`);
  }
  console.log('');
});

console.log('=== ISTRUZIONI PER ESTRARRE I FILE ===');
console.log('\nSe trovi i file, usa questi comandi per estrarli:\n');
console.log('# Estrarre solo la directory uploads da un archivio:');
console.log('tar -xzf /var/backups/ticketapp/ARCHIVIO.tar.gz --strip-components=1 backend/uploads -C /var/www/ticketapp/backend/\n');
console.log('# Oppure estrarre tutto e poi copiare:');
console.log('cd /tmp');
console.log('tar -xzf /var/backups/ticketapp/ARCHIVIO.tar.gz');
console.log('cp -r backend/uploads/* /var/www/ticketapp/backend/uploads/');
console.log('chown -R www-data:www-data /var/www/ticketapp/backend/uploads');
console.log('chmod -R 755 /var/www/ticketapp/backend/uploads\n');
