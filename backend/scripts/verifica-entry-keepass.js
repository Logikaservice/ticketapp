// Script per verificare tutti i campi di una entry specifica in Keepass
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const keepassDriveService = require('../utils/keepassDriveService');

async function main() {
  try {
    const searchTerm = process.argv[2] || 'TIM-30277485';
    
    console.log('🔍 VERIFICA ENTRY IN KEEPASS');
    console.log('============================================================');
    console.log(`\nCerca entry contenente: "${searchTerm}"\n`);

    const keepassPassword = process.env.KEEPASS_PASSWORD;
    if (!keepassPassword) {
      console.error('❌ Errore: KEEPASS_PASSWORD non configurato nel file .env');
      process.exit(1);
    }

    // Carica Keepass
    console.log('📥 Caricamento file KeePass da Google Drive...');
    keepassDriveService.invalidateCache();
    
    // Usiamo il metodo privato per accedere direttamente al database
    const { google } = require('googleapis');
    const { Kdbx, Credentials, ProtectedValue } = require('kdbxweb');
    
    const authClient = await keepassDriveService.getDriveAuth();
    const drive = google.drive({ version: 'v3', auth: authClient });
    
    const fileId = process.env.KEEPASS_FILE_ID;
    const fileResponse = await drive.files.get({ fileId: fileId, alt: 'media' }, { responseType: 'arraybuffer' });
    const fileBuffer = Buffer.from(fileResponse.data);
    
    const credentials = new Credentials(ProtectedValue.fromString(keepassPassword));
    const db = await Kdbx.load(fileBuffer.buffer, credentials);
    
    console.log(`✅ File KDBX caricato: ${db.name || 'Senza nome'}\n`);
    
    // Funzione ricorsiva per cercare entry
    const searchEntry = (group, groupPath = '') => {
      const currentPath = groupPath ? `${groupPath} > ${group.name || 'Root'}` : (group.name || 'Root');
      
      // Cerca nelle entry
      if (group.entries && group.entries.length > 0) {
        for (const entry of group.entries) {
          const titleField = entry.fields && entry.fields['Title'];
          const titleStr = titleField instanceof ProtectedValue 
            ? titleField.getText() 
            : (titleField || '');
          
          // Verifica se il titolo contiene il termine di ricerca
          if (titleStr && titleStr.includes(searchTerm)) {
            console.log(`\n✅ ENTRY TROVATA:`);
            console.log(`   Titolo: "${titleStr}"`);
            console.log(`   Percorso: "${currentPath}"`);
            console.log(`\n   TUTTI I CAMPI:`);
            
            // Mostra tutti i campi
            if (entry.fields) {
              for (const [fieldName, fieldValue] of Object.entries(entry.fields)) {
                if (fieldValue instanceof ProtectedValue) {
                  const value = fieldValue.getText();
                  console.log(`   - ${fieldName}: "${value}"`);
                  
                  // Verifica se contiene un MAC
                  const macPattern = /([0-9A-F]{2}[:-]){5}[0-9A-F]{2}|[0-9A-F]{12}/i;
                  if (macPattern.test(value)) {
                    const match = value.match(macPattern);
                    console.log(`     ⚠️ CONTIENE MAC: ${match[0]}`);
                  }
                } else {
                  const value = String(fieldValue || '');
                  console.log(`   - ${fieldName}: "${value}"`);
                  
                  // Verifica se contiene un MAC
                  const macPattern = /([0-9A-F]{2}[:-]){5}[0-9A-F]{2}|[0-9A-F]{12}/i;
                  if (macPattern.test(value)) {
                    const match = value.match(macPattern);
                    console.log(`     ⚠️ CONTIENE MAC: ${match[0]}`);
                  }
                }
              }
            }
            
            // Verifica anche i campi personalizzati
            if (entry.customFields) {
              console.log(`\n   CAMPI PERSONALIZZATI:`);
              for (const [fieldName, fieldValue] of Object.entries(entry.customFields)) {
                if (fieldValue instanceof ProtectedValue) {
                  const value = fieldValue.getText();
                  console.log(`   - ${fieldName}: "${value}"`);
                  
                  // Verifica se contiene un MAC
                  const macPattern = /([0-9A-F]{2}[:-]){5}[0-9A-F]{2}|[0-9A-F]{12}/i;
                  if (macPattern.test(value)) {
                    const match = value.match(macPattern);
                    console.log(`     ⚠️ CONTIENE MAC: ${match[0]}`);
                  }
                } else {
                  const value = String(fieldValue || '');
                  console.log(`   - ${fieldName}: "${value}"`);
                  
                  // Verifica se contiene un MAC
                  const macPattern = /([0-9A-F]{2}[:-]){5}[0-9A-F]{2}|[0-9A-F]{12}/i;
                  if (macPattern.test(value)) {
                    const match = value.match(macPattern);
                    console.log(`     ⚠️ CONTIENE MAC: ${match[0]}`);
                  }
                }
              }
            }
            
            console.log('');
          }
        }
      }
      
      // Cerca nei sottogruppi
      if (group.groups && group.groups.length > 0) {
        for (const subGroup of group.groups) {
          searchEntry(subGroup, currentPath);
        }
      }
    };
    
    // Cerca in tutti i gruppi root
    if (db.groups && db.groups.length > 0) {
      for (const group of db.groups) {
        searchEntry(group);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Errore:', error);
    process.exit(1);
  }
}

main();
