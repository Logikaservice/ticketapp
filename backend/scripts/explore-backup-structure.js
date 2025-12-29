// Script per esplorare la struttura completa dell'archivio
const fs = require('fs');
const { execSync } = require('child_process');

console.log('=== ESPLORAZIONE STRUTTURA ARCHIVIO ===\n');

const archivePath = '/var/backups/ticketapp/ticketapp_code_20251212_202509.tar.gz';

if (!fs.existsSync(archivePath)) {
  console.log('❌ Archivio non trovato!');
  process.exit(1);
}

console.log(`📦 Archivio: ${archivePath}\n`);

try {
  // Lista la struttura completa dell'archivio
  console.log('1. Struttura completa dell\'archivio (prime 100 righe):\n');
  const fullStructure = execSync(`tar -tzf "${archivePath}" | head -100`, {
    encoding: 'utf-8',
    timeout: 30000
  });
  console.log(fullStructure);
  
  // Cerca tutto ciò che contiene "upload"
  console.log('\n2. Tutti i path che contengono "upload":\n');
  try {
    const uploadPaths = execSync(`tar -tzf "${archivePath}" | grep -i upload | head -50`, {
      encoding: 'utf-8',
      timeout: 30000
    });
    if (uploadPaths.trim()) {
      console.log(uploadPaths);
    } else {
      console.log('❌ Nessun path con "upload" trovato');
    }
  } catch (e) {
    console.log('❌ Nessun path con "upload" trovato');
  }
  
  // Cerca il percorso base dell'archivio
  console.log('\n3. Percorso base dell\'archivio:\n');
  try {
    const firstLine = execSync(`tar -tzf "${archivePath}" | head -1`, {
      encoding: 'utf-8',
      timeout: 10000
    });
    const basePath = firstLine.trim().split('/')[0];
    console.log(`📁 Percorso base: ${basePath}\n`);
    
    // Cerca uploads rispetto al percorso base
    console.log('4. Cerca uploads nel percorso base:\n');
    try {
      const uploadsInBase = execSync(`tar -tzf "${archivePath}" | grep "^${basePath}/.*upload" | head -30`, {
        encoding: 'utf-8',
        timeout: 30000
      });
      if (uploadsInBase.trim()) {
        console.log(uploadsInBase);
      } else {
        console.log('❌ Nessun uploads trovato nel percorso base');
      }
    } catch (e) {
      console.log('❌ Nessun uploads trovato nel percorso base');
    }
    
    // Conta directory vs file in uploads
    console.log('\n5. Statistiche uploads:\n');
    try {
      const uploadDirs = execSync(`tar -tzf "${archivePath}" | grep "^${basePath}/.*upload.*/$" | wc -l`, {
        encoding: 'utf-8',
        timeout: 15000
      });
      console.log(`📁 Directory uploads: ${uploadDirs.trim()}`);
      
      const uploadFiles = execSync(`tar -tzf "${archivePath}" | grep "^${basePath}/.*upload" | grep -v "/$" | wc -l`, {
        encoding: 'utf-8',
        timeout: 15000
      });
      console.log(`📄 File uploads: ${uploadFiles.trim()}`);
    } catch (e) {}
    
  } catch (e) {
    console.log('⚠️  Errore determinazione percorso base');
  }
  
  // Suggerimento per estrarre e vedere
  console.log('\n=== SUGGERIMENTO ===\n');
  console.log('Per vedere meglio cosa c\'è nell\'archivio, estrailo temporaneamente:\n');
  console.log('mkdir -p /tmp/explore-backup');
  console.log('cd /tmp/explore-backup');
  console.log(`tar -xzf ${archivePath}`);
  console.log('find . -name "*upload*" -type d');
  console.log('find . -path "*/uploads/*" -type f | head -20');
  console.log('rm -rf /tmp/explore-backup\n');
  
} catch (error) {
  console.error(`❌ Errore: ${error.message}`);
  process.exit(1);
}
