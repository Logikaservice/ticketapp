#!/usr/bin/env node
// Script per testare la connessione SMTP

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const nodemailer = require('nodemailer');

const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS;

console.log('🧪 Test connessione SMTP Gmail...\n');
console.log('📧 EMAIL_USER:', emailUser || 'MANCANTE');
console.log('📧 EMAIL_PASSWORD:', emailPass ? 'Configurato' : 'MANCANTE');
console.log('');

if (!emailUser || !emailPass) {
  console.error('❌ Configurazione email mancante!');
  console.error('Verifica che EMAIL_USER e EMAIL_PASSWORD siano configurati nel file .env');
  process.exit(1);
}

console.log('🔧 Creazione transporter...');
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: emailUser,
    pass: emailPass
  },
  connectionTimeout: 30000,
  socketTimeout: 30000,
  greetingTimeout: 30000,
  tls: {
    rejectUnauthorized: false,
    ciphers: 'SSLv3'
  },
  debug: true, // Abilita debug per vedere cosa succede
  logger: true
});

console.log('📤 Tentativo connessione e verifica credenziali...\n');

transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Errore verifica SMTP:');
    console.error('  Code:', error.code);
    console.error('  Command:', error.command);
    console.error('  Message:', error.message);
    console.error('  Stack:', error.stack);
    
    if (error.code === 'EAUTH') {
      console.error('\n⚠️  ERRORE AUTENTICAZIONE!');
      console.error('Possibili cause:');
      console.error('1. Password errata');
      console.error('2. Gmail richiede App Password (non password normale)');
      console.error('3. Account Gmail ha "Accesso meno sicuro" disabilitato');
      console.error('\nSoluzione:');
      console.error('1. Vai su https://myaccount.google.com/apppasswords');
      console.error('2. Crea una nuova App Password');
      console.error('3. Usa quella password in EMAIL_PASSWORD');
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      console.error('\n⚠️  ERRORE CONNESSIONE!');
      console.error('Possibili cause:');
      console.error('1. Firewall blocca porta 587');
      console.error('2. Problema di rete');
      console.error('3. Gmail SMTP non raggiungibile');
      console.error('\nVerifica:');
      console.error('  telnet smtp.gmail.com 587');
    }
    
    process.exit(1);
  } else {
    console.log('✅ Connessione SMTP verificata con successo!');
    console.log('✅ Credenziali valide');
    console.log('\n📧 Test invio email...');
    
    const mailOptions = {
      from: emailUser,
      to: emailUser, // Invia a se stesso per test
      subject: '🧪 Test Email TicketApp',
      text: 'Questa è una email di test per verificare la configurazione SMTP.',
      html: '<p>Questa è una <strong>email di test</strong> per verificare la configurazione SMTP.</p>'
    };
    
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('❌ Errore invio email:', error);
        process.exit(1);
      } else {
        console.log('✅ Email inviata con successo!');
        console.log('📧 Message ID:', info.messageId);
        console.log('📧 Response:', info.response);
        console.log('\n✅ Test completato con successo!');
        process.exit(0);
      }
    });
  }
});

