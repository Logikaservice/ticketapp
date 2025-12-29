// Script per elencare i file nella directory uploads
const fs = require('fs');
const path = require('path');

const uploadPath = path.join(__dirname, '../uploads/tickets/photos');
const uploadOffertePath = path.join(__dirname, '../uploads/tickets/offerte');

console.log('=== ELENCO FILE NELLA DIRECTORY UPLOADS ===\n');

function listFiles(dirPath, label) {
  console.log(`\n📁 ${label}: ${dirPath}\n`);
  
  if (!fs.existsSync(dirPath)) {
    console.log(`❌ Directory non esiste!\n`);
    return [];
  }
  
  try {
    const files = fs.readdirSync(dirPath);
    
    if (files.length === 0) {
      console.log('   (directory vuota)');
      return [];
    }
    
    const fileList = files.map(filename => {
      const fullPath = path.join(dirPath, filename);
      const stats = fs.statSync(fullPath);
      return {
        filename,
        size: stats.size,
        modified: stats.mtime,
        isFile: stats.isFile()
      };
    });
    
    fileList.forEach((file, idx) => {
      if (file.isFile) {
        const sizeKB = (file.size / 1024).toFixed(2);
        console.log(`   ${idx + 1}. ${file.filename} (${sizeKB} KB, modificato: ${file.modified.toISOString()})`);
      }
    });
    
    console.log(`\n   Totale: ${fileList.filter(f => f.isFile).length} file`);
    
    return fileList;
  } catch (err) {
    console.error(`   ❌ Errore lettura directory: ${err.message}`);
    return [];
  }
}

const photosFiles = listFiles(uploadPath, 'FOTO TICKET');
const offerteFiles = listFiles(uploadOffertePath, 'OFFERTE TICKET');

console.log('\n=== RIEPILOGO ===');
console.log(`📊 File foto: ${photosFiles.filter(f => f.isFile).length}`);
console.log(`📊 File offerte: ${offerteFiles.filter(f => f.isFile).length}`);
console.log(`📊 Totale: ${photosFiles.filter(f => f.isFile).length + offerteFiles.filter(f => f.isFile).length}`);
