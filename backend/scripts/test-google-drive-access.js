// Script per testare l'accesso a Google Drive e cercare keepass.kdbx
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

async function testGoogleDriveAccess() {
  try {
    console.log('🔍 Test accesso Google Drive...\n');

    // Verifica credenziali
    if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      console.error('❌ Credenziali Google Service Account non configurate');
      console.log('⚠️  Assicurati di avere le seguenti variabili d\'ambiente:');
      console.log('   - GOOGLE_CLIENT_EMAIL');
      console.log('   - GOOGLE_PRIVATE_KEY');
      return;
    }

    console.log('✅ Credenziali trovate');
    console.log(`📧 Service Account: ${process.env.GOOGLE_CLIENT_EMAIL}\n`);

    // Configura autenticazione con scope per Google Drive
    const auth = new google.auth.GoogleAuth({
      credentials: {
        type: "service_account",
        project_id: process.env.GOOGLE_PROJECT_ID || "ticketapp-b2a2a",
        private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        client_id: process.env.GOOGLE_CLIENT_ID,
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL,
        universe_domain: "googleapis.com"
      },
      scopes: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/drive.file'
      ]
    });

    const authClient = await auth.getClient();
    const drive = google.drive({ version: 'v3', auth: authClient });

    console.log('🔐 Autenticazione completata\n');

    // Cerca il file keepass.kdbx
    console.log('📂 Cercando file "keepass.kdbx"...\n');
    
    const searchQuery = "name='keepass.kdbx' and trashed=false";
    
    const response = await drive.files.list({
      q: searchQuery,
      fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink)',
      pageSize: 10
    });

    if (response.data.files && response.data.files.length > 0) {
      console.log(`✅ Trovato ${response.data.files.length} file(s) corrispondente/i:\n`);
      
      response.data.files.forEach((file, index) => {
        console.log(`📄 File ${index + 1}:`);
        console.log(`   ID: ${file.id}`);
        console.log(`   Nome: ${file.name}`);
        console.log(`   Tipo: ${file.mimeType}`);
        console.log(`   Dimensione: ${file.size ? (parseInt(file.size) / 1024).toFixed(2) + ' KB' : 'N/A'}`);
        console.log(`   Modificato: ${file.modifiedTime || 'N/A'}`);
        console.log(`   Link: ${file.webViewLink || 'N/A'}`);
        console.log('');
      });

      // Prova a scaricare il primo file trovato (solo per test)
      const firstFile = response.data.files[0];
      console.log(`📥 Test download del file "${firstFile.name}"...\n`);
      
      const fileResponse = await drive.files.get(
        { fileId: firstFile.id, alt: 'media' },
        { responseType: 'stream' }
      );

      const chunks = [];
      fileResponse.data.on('data', (chunk) => chunks.push(chunk));
      
      await new Promise((resolve, reject) => {
        fileResponse.data.on('end', resolve);
        fileResponse.data.on('error', reject);
      });

      const fileBuffer = Buffer.concat(chunks);
      console.log(`✅ File scaricato con successo!`);
      console.log(`   Dimensione scaricata: ${(fileBuffer.length / 1024).toFixed(2)} KB`);
      console.log(`   Primi 50 bytes (hex): ${fileBuffer.slice(0, 50).toString('hex')}`);
      
      // Verifica che sia un file KDBX (magic bytes: 03 D9 A2 9A 67 FB 4B B5)
      const kdbxMagicBytes = Buffer.from([0x03, 0xD9, 0xA2, 0x9A, 0x67, 0xFB, 0x4B, 0xB5]);
      const isKdbx = fileBuffer.slice(0, 8).equals(kdbxMagicBytes);
      
      if (isKdbx) {
        console.log(`✅ Il file è un archivio KDBX valido!`);
      } else {
        console.log(`⚠️  Il file potrebbe non essere un KDBX valido (magic bytes non corrispondono)`);
      }

    } else {
      console.log('❌ File "keepass.kdbx" non trovato su Google Drive');
      console.log('\n💡 Possibili cause:');
      console.log('   1. Il file non esiste con questo nome');
      console.log('   2. Il file è nella cartella cestino');
      console.log('   3. Il Service Account non ha accesso al file');
      console.log('   4. Il file è in una cartella condivisa a cui il Service Account non ha accesso');
      console.log('\n🔍 Cercando altri file KDBX...\n');
      
      // Cerca tutti i file KDBX
      const allKdbxResponse = await drive.files.list({
        q: "name contains 'keepass' and trashed=false",
        fields: 'files(id, name, mimeType, size, modifiedTime)',
        pageSize: 20
      });

      if (allKdbxResponse.data.files && allKdbxResponse.data.files.length > 0) {
        console.log(`📋 Trovati ${allKdbxResponse.data.files.length} file contenenti "keepass":\n`);
        allKdbxResponse.data.files.forEach((file, index) => {
          console.log(`   ${index + 1}. ${file.name} (${file.mimeType})`);
        });
      } else {
        console.log('❌ Nessun file contenente "keepass" trovato');
      }
    }

    console.log('\n✅ Test completato!');

  } catch (error) {
    console.error('\n❌ Errore durante il test:');
    console.error(`   Messaggio: ${error.message}`);
    
    if (error.code === 403) {
      console.error('\n⚠️  Errore 403 - Accesso negato');
      console.error('   Possibili soluzioni:');
      console.error('   1. Abilita Google Drive API su Google Cloud Console');
      console.error('   2. Condividi il file con il Service Account email');
      console.error('   3. Verifica che gli scope siano corretti');
    } else if (error.code === 404) {
      console.error('\n⚠️  Errore 404 - File non trovato');
    }
    
    console.error(`\n   Stack: ${error.stack}`);
    process.exit(1);
  }
}

// Test con password KeePass
async function testKeepassIntegration() {
  const password = process.argv[2] || process.env.KEEPASS_PASSWORD;
  
  if (!password) {
    console.error('\n❌ Password KeePass non fornita!');
    console.log('Uso: node test-google-drive-access.js <password>');
    console.log('Oppure imposta KEEPASS_PASSWORD come variabile d\'ambiente');
    process.exit(1);
  }

  try {
    console.log('\n🔐 Test integrazione KeePass con Google Drive...\n');
    
    const keepassDriveService = require('../utils/keepassDriveService');
    
    // Test ricerca MAC
    const testMacs = [
      '60-83-E7-BF-4C-AF',  // IP 100.1 dall'immagine
      '00-50-56-C0-00-01',  // IP 100.200 dall'immagine
      '34-29-8F-18-88-DE'   // IP 100.2 dall'immagine
    ];

    console.log('📋 Test ricerca MAC address nel file KeePass:\n');
    
    for (const mac of testMacs) {
      console.log(`🔍 Cercando MAC: ${mac}...`);
      const title = await keepassDriveService.findMacTitle(mac, password);
      if (title) {
        console.log(`   ✅ Trovato -> Titolo: "${title}"\n`);
      } else {
        console.log(`   ❌ Non trovato\n`);
      }
    }

    console.log('✅ Test completato!');
  } catch (err) {
    console.error('\n❌ Errore test integrazione:', err);
    process.exit(1);
  }
}

// Esegui il test
if (require.main === module) {
  // Carica variabili d'ambiente
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  
  // Se viene passata una password come argomento, testa l'integrazione KeePass
  if (process.argv[2] || process.env.KEEPASS_PASSWORD) {
    testKeepassIntegration()
      .then(() => {
        console.log('\n✅ Script completato con successo');
        process.exit(0);
      })
      .catch((err) => {
        console.error('\n❌ Errore fatale:', err);
        process.exit(1);
      });
  } else {
    // Altrimenti esegui il test base di Google Drive
    testGoogleDriveAccess()
      .then(() => {
        console.log('\n✅ Script completato con successo');
        process.exit(0);
      })
      .catch((err) => {
        console.error('\n❌ Errore fatale:', err);
        process.exit(1);
      });
  }
}

module.exports = { testGoogleDriveAccess, testKeepassIntegration };
