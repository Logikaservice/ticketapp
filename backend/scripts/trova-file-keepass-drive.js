// Script per trovare tutti i file .kdbx su Google Drive
// Esegui: node backend/scripts/trova-file-keepass-drive.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { google } = require('googleapis');

async function trovaFileKeepass() {
  try {
    console.log('🔍 Ricerca file KeePass su Google Drive...\n');

    // Verifica credenziali
    if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      console.error('❌ Credenziali Google Service Account non configurate');
      console.log('⚠️  Assicurati di avere GOOGLE_CLIENT_EMAIL e GOOGLE_PRIVATE_KEY nel file .env');
      process.exit(1);
    }

    console.log(`📧 Service Account: ${process.env.GOOGLE_CLIENT_EMAIL}\n`);

    // Configura autenticazione
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
        'https://www.googleapis.com/auth/drive.readonly'
      ]
    });

    const authClient = await auth.getClient();
    const drive = google.drive({ version: 'v3', auth: authClient });

    console.log('🔐 Autenticazione completata\n');

    // Cerca tutti i file .kdbx
    console.log('📂 Cercando tutti i file .kdbx su Google Drive...\n');
    
    const searchQuery = "mimeType='application/x-keepass' or mimeType='application/octet-stream' and (name contains '.kdbx' or name contains 'keepass') and trashed=false";
    
    const response = await drive.files.list({
      q: searchQuery,
      fields: 'files(id, name, mimeType, createdTime, modifiedTime, webViewLink, size)',
      orderBy: 'modifiedTime desc',
      pageSize: 100
    });

    if (!response.data.files || response.data.files.length === 0) {
      console.log('❌ Nessun file .kdbx trovato su Google Drive');
      console.log('\n💡 Suggerimenti:');
      console.log('   1. Verifica che il file sia condiviso con:');
      console.log(`      ${process.env.GOOGLE_CLIENT_EMAIL}`);
      console.log('   2. Verifica che il file abbia estensione .kdbx');
      process.exit(1);
    }

    console.log(`✅ Trovati ${response.data.files.length} file .kdbx:\n`);
    console.log('='.repeat(80));
    
    response.data.files.forEach((file, index) => {
      console.log(`\n📄 File ${index + 1}:`);
      console.log(`   Nome: ${file.name}`);
      console.log(`   ID: ${file.id}`);
      console.log(`   Link: https://drive.google.com/file/d/${file.id}/view`);
      console.log(`   Modificato: ${file.modifiedTime || 'N/A'}`);
      console.log(`   Creato: ${file.createdTime || 'N/A'}`);
      if (file.size) {
        const sizeMB = (parseInt(file.size) / 1024 / 1024).toFixed(2);
        console.log(`   Dimensione: ${sizeMB} MB`);
      }
      console.log(`\n   Per usare questo file, aggiungi al .env:`);
      console.log(`   KEEPASS_FILE_ID=${file.id}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('\n📋 File attualmente configurato:');
    
    if (process.env.KEEPASS_FILE_ID) {
      const configuredFile = response.data.files.find(f => f.id === process.env.KEEPASS_FILE_ID);
      if (configuredFile) {
        console.log(`   ✅ ${configuredFile.name} (ID: ${process.env.KEEPASS_FILE_ID})`);
      } else {
        console.log(`   ⚠️  ${process.env.KEEPASS_FILE_ID} (file non trovato nella lista)`);
      }
    } else if (process.env.KEEPASS_FILE_NAME) {
      console.log(`   🔍 Cerca per nome: ${process.env.KEEPASS_FILE_NAME}`);
    } else {
      console.log(`   🔍 Default: keepass.kdbx (cerca per nome)`);
    }

    console.log('\n✅ Ricerca completata!');

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    if (error.response) {
      console.error('   Dettagli:', error.response.data);
    }
    console.error('\nStack:', error.stack);
    process.exit(1);
  }
}

trovaFileKeepass();
