// Script per verificare quale file KeePass è configurato e scaricato
// Esegui: node backend/scripts/verifica-file-keepass-configurato.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function verificaFileKeepass() {
  console.log('🔍 VERIFICA FILE KEEPASS CONFIGURATO');
  console.log('='.repeat(60));
  console.log('');

  // 1. Verifica variabili d'ambiente
  console.log('📋 VARIABILI D\'AMBIENTE:');
  console.log('   KEEPASS_FILE_ID:', process.env.KEEPASS_FILE_ID || '(non configurato - usa ricerca per nome)');
  console.log('   KEEPASS_FILE_NAME:', process.env.KEEPASS_FILE_NAME || '(non configurato - usa default: keepass.kdbx)');
  console.log('   KEEPASS_PASSWORD:', process.env.KEEPASS_PASSWORD ? '***CONFIGURATA***' : 'NON configurata');
  console.log('');

  const keepassDriveService = require('../utils/keepassDriveService');
  const { google } = require('googleapis');

  try {
    // 2. Verifica autenticazione Google
    if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      console.error('❌ Credenziali Google Service Account non configurate');
      process.exit(1);
    }

    console.log('📧 Service Account:', process.env.GOOGLE_CLIENT_EMAIL);
    console.log('');

    // 3. Scarica il file usando il metodo del servizio (stesso codice usato dal sistema)
    console.log('📥 SCARICAMENTO FILE KEEPASS...');
    console.log('');

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
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });

    const authClient = await auth.getClient();
    const drive = google.drive({ version: 'v3', auth: authClient });

    let fileId;
    let fileName;
    let fileInfo;

    if (process.env.KEEPASS_FILE_ID) {
      fileId = process.env.KEEPASS_FILE_ID;
      console.log(`✅ Usando KEEPASS_FILE_ID: ${fileId}`);
      console.log('');

      // Ottieni info file
      fileInfo = await drive.files.get({
        fileId: fileId,
        fields: 'id, name, mimeType, createdTime, modifiedTime, size'
      });

      fileName = fileInfo.data.name;
      console.log(`📄 File ID: ${fileInfo.data.id}`);
      console.log(`📄 Nome: ${fileName}`);
      console.log(`📄 Creato: ${fileInfo.data.createdTime || 'N/A'}`);
      console.log(`📄 Modificato: ${fileInfo.data.modifiedTime || 'N/A'}`);
      if (fileInfo.data.size) {
        const sizeMB = (parseInt(fileInfo.data.size) / 1024 / 1024).toFixed(2);
        console.log(`📄 Dimensione: ${sizeMB} MB`);
      }
      console.log(`📄 Link: https://drive.google.com/file/d/${fileId}/view`);
      console.log('');

      // Verifica che sia il file corretto
      if (fileId === '17YVBJF7eDXAFio-ly8TO0k0goWei_lxA') {
        console.log('✅ Questo è il NUOVO file KeePass configurato');
      } else {
        console.log('⚠️  ATTENZIONE: Questo NON è il file ID del nuovo file KeePass!');
        console.log('   File ID atteso: 17YVBJF7eDXAFio-ly8TO0k0goWei_lxA');
      }
    } else {
      console.log('⚠️  KEEPASS_FILE_ID non configurato - usa ricerca per nome');
      const fileNameToSearch = process.env.KEEPASS_FILE_NAME || 'keepass.kdbx';
      console.log(`🔍 Cercando file per nome: ${fileNameToSearch}`);
      console.log('');

      const searchQuery = `name='${fileNameToSearch}' and trashed=false`;
      const response = await drive.files.list({
        q: searchQuery,
        fields: 'files(id, name, modifiedTime)',
        pageSize: 1
      });

      if (!response.data.files || response.data.files.length === 0) {
        console.error('❌ File non trovato su Google Drive');
        process.exit(1);
      }

      fileId = response.data.files[0].id;
      fileName = response.data.files[0].name;
      console.log(`📄 File trovato: ${fileName} (ID: ${fileId})`);
      console.log(`📄 Modificato: ${response.data.files[0].modifiedTime || 'N/A'}`);
      console.log(`📄 Link: https://drive.google.com/file/d/${fileId}/view`);
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('✅ Verifica completata!');
    console.log('');
    console.log('Se il file ID o la data di modifica non corrisponde a quello che ti aspetti,');
    console.log('verifica che KEEPASS_FILE_ID nel file .env sia corretto.');

  } catch (error) {
    console.error('');
    console.error('❌ ERRORE:', error.message);
    if (error.response) {
      console.error('   Dettagli:', error.response.data);
    }
    process.exit(1);
  }
}

verificaFileKeepass();
