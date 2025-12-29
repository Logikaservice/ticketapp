// Script per cercare backup dei file uploads sul server
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== RICERCA BACKUP FILE UPLOADS ===\n');

// Lista di posizioni comuni per backup
const backupLocations = [
  '/var/backups',
  '/var/backups/ticketapp',
  '/var/www/ticketapp/backend/backups',
  '/root/backups',
  '/home/backups',
  '/tmp',
  '/var/tmp'
];

// Nomi file da cercare (basati sui nomi trovati)
const missingFiles = [
  'ticket-photo-1764242162408-805694451.jpg',
  'ticket-photo-1764242261704-984187090.png',
  'ticket-photo-1765802806450-289066004.jpg',
  'ticket-photo-1764242398488-968251179.jpg',
  'ticket-photo-1764243762193-667633146.pdf',
  'ticket-photo-1764243762195-427379381.pdf',
  'ticket-photo-1764242987591-358717303.jpg',
  'ticket-photo-1762543419904-805394195.jpg',
  'ticket-photo-1764788422002-315099954.png',
  'ticket-photo-1764788483574-754468663.png',
  'ticket-photo-1764788678829-268626054.png'
];

console.log('1. Verifica directory backup comuni:\n');
let foundBackups = [];

backupLocations.forEach(backupDir => {
  if (fs.existsSync(backupDir)) {
    console.log(`✅ ${backupDir} - ESISTE`);
    
    try {
      const items = fs.readdirSync(backupDir);
      if (items.length > 0) {
        console.log(`   Contenuto: ${items.length} elementi`);
        foundBackups.push(backupDir);
        
        // Cerca directory con "upload" o "photo" nel nome
        items.forEach(item => {
          const itemPath = path.join(backupDir, item);
          try {
            const stat = fs.statSync(itemPath);
            if (stat.isDirectory()) {
              if (item.toLowerCase().includes('upload') || 
                  item.toLowerCase().includes('photo') ||
                  item.toLowerCase().includes('ticket')) {
                console.log(`   📁 Directory interessante: ${item}`);
              }
            }
          } catch (e) {
            // Ignora errori
          }
        });
      }
    } catch (e) {
      console.log(`   ⚠️  Errore lettura: ${e.message}`);
    }
  } else {
    console.log(`❌ ${backupDir} - NON ESISTE`);
  }
});

console.log('\n2. Cerca file specifici in tutto il sistema:\n');
console.log('⚠️  Questo può richiedere tempo...\n');

let foundFiles = [];

missingFiles.slice(0, 3).forEach(filename => {
  try {
    console.log(`🔍 Cercando: ${filename}...`);
    const result = execSync(`find /var/www /var/backups /root /home -name "${filename}" 2>/dev/null | head -5`, {
      encoding: 'utf-8',
      timeout: 10000
    });
    
    if (result.trim()) {
      const paths = result.trim().split('\n').filter(p => p);
      paths.forEach(p => {
        console.log(`   ✅ TROVATO: ${p}`);
        foundFiles.push({ filename, path: p });
      });
    }
  } catch (e) {
    // Nessun file trovato
  }
});

console.log('\n3. Cerca archivi tar.gz o zip che potrebbero contenere uploads:\n');

try {
  const archiveResult = execSync(`find /var/www /var/backups /root -name "*.tar.gz" -o -name "*.zip" 2>/dev/null | grep -E "(backup|upload|ticket)" | head -10`, {
    encoding: 'utf-8',
    timeout: 15000
  });
  
  if (archiveResult.trim()) {
    const archives = archiveResult.trim().split('\n').filter(a => a);
    archives.forEach(arch => {
      console.log(`   📦 Archive: ${arch}`);
      try {
        const stat = fs.statSync(arch);
        const sizeMB = (stat.size / (1024 * 1024)).toFixed(2);
        const modDate = stat.mtime.toISOString().split('T')[0];
        console.log(`      Dimensione: ${sizeMB} MB, Modificato: ${modDate}`);
      } catch (e) {
        // Ignora
      }
    });
  } else {
    console.log('   ❌ Nessun archivio trovato');
  }
} catch (e) {
  console.log('   ⚠️  Errore ricerca archivi');
}

console.log('\n4. Verifica backup database per informazioni sui file:\n');
const backupDbDir = path.join(__dirname, '../backups');
if (fs.existsSync(backupDbDir)) {
  try {
    const dbBackups = fs.readdirSync(backupDbDir)
      .filter(f => f.endsWith('.sql'))
      .sort()
      .reverse()
      .slice(0, 3);
    
    if (dbBackups.length > 0) {
      console.log(`✅ Trovati ${dbBackups.length} backup database recenti:`);
      dbBackups.forEach(backup => {
        const backupPath = path.join(backupDbDir, backup);
        const stat = fs.statSync(backupPath);
        const sizeMB = (stat.size / (1024 * 1024)).toFixed(2);
        const modDate = stat.mtime.toISOString().split('T')[0];
        console.log(`   📄 ${backup} (${sizeMB} MB, ${modDate})`);
      });
      console.log('\n   💡 I backup database contengono i riferimenti ai file ma non i file stessi');
    }
  } catch (e) {
    console.log('   ⚠️  Errore lettura backup database');
  }
}

console.log('\n=== RIEPILOGO ===');
if (foundFiles.length > 0) {
  console.log(`✅ File trovati: ${foundFiles.length}`);
  foundFiles.forEach(f => {
    console.log(`   - ${f.filename}: ${f.path}`);
  });
} else {
  console.log('❌ Nessun file trovato');
}

if (foundBackups.length > 0) {
  console.log(`\n📁 Directory backup trovate: ${foundBackups.length}`);
  foundBackups.forEach(b => console.log(`   - ${b}`));
}

console.log('\n💡 Possibili opzioni:');
console.log('   1. Se hai backup del server completo, controlla se include /var/www/ticketapp/backend/uploads/');
console.log('   2. Se usi snapshot del filesystem, verifica se ci sono snapshot precedenti');
console.log('   3. Se hai backup remoti, controlla se includono i file di upload');
console.log('   4. I file potrebbero essere stati persi definitivamente se non c\'erano backup');
