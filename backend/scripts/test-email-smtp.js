#!/usr/bin/env node
// Script per testare la connessione SMTP

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const nodemailer = require('nodemailer');

const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS;

console.log('🧪 Test connessione SMTP...\n');

// Verifica se è configurato un relay SMTP esterno (priorità)
const smtpRelayHost = process.env.SMTP_RELAY_HOST;
const smtpRelayPort = process.env.SMTP_RELAY_PORT;
const smtpRelayUser = process.env.SMTP_RELAY_USER;
const smtpRelayPass = process.env.SMTP_RELAY_PASSWORD || process.env.SMTP_RELAY_PASS;
const smtpRelaySecure = process.env.SMTP_RELAY_SECURE === 'true' || process.env.SMTP_RELAY_SECURE === '1';

let smtpConfig;

// Se è configurato un relay SMTP esterno, usalo
if (smtpRelayHost && smtpRelayPort && smtpRelayUser && smtpRelayPass) {
  console.log('📧 Configurazione SMTP Relay esterno (provider VPS blocca porte SMTP)');
  console.log('SMTP_RELAY_HOST:', smtpRelayHost);
  console.log('SMTP_RELAY_PORT:', smtpRelayPort);
  console.log('SMTP_RELAY_USER:', smtpRelayUser);
  console.log('SMTP_RELAY_PASSWORD:', smtpRelayPass ? 'Configurato' : 'MANCANTE');
  console.log('');
  
  smtpConfig = {
    host: smtpRelayHost,
    port: parseInt(smtpRelayPort, 10),
    secure: smtpRelaySecure,
    auth: {
      user: smtpRelayUser,
      pass: smtpRelayPass
    },
    connectionTimeout: 60000,
    socketTimeout: 60000,
    greetingTimeout: 30000,
    tls: {
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2'
    },
    debug: true,
    logger: true
  };
} else {
  // Fallback alla configurazione normale
  console.log('📧 EMAIL_USER:', emailUser || 'MANCANTE');
  console.log('📧 EMAIL_PASSWORD:', emailPass ? 'Configurato' : 'MANCANTE');
  console.log('');
  
  if (!emailUser || !emailPass) {
    console.error('❌ Configurazione email mancante!');
    console.error('Verifica che EMAIL_USER e EMAIL_PASSWORD siano configurati nel file .env');
    console.error('Oppure configura SMTP_RELAY_* per usare un relay SMTP esterno');
    process.exit(1);
  }
  
  // Rileva provider in base al dominio email
  const isGmail = emailUser.includes('@gmail.com');
  const isAruba = emailUser.includes('@logikaservice.it') || emailUser.includes('@aruba.it') || emailUser.includes('aruba');

if (isAruba) {
  console.log('📧 Configurazione SMTP Aruba (smtps.aruba.it:465)');
  // Usa smtps.aruba.it porta 465 con SSL - più affidabile e meno soggetto a blocchi firewall
  smtpConfig = {
    host: 'smtps.aruba.it',
    port: 465,
    secure: true, // SSL per porta 465
    auth: {
      user: emailUser,
      pass: emailPass
    },
    connectionTimeout: 60000, // 60 secondi
    socketTimeout: 60000,
    greetingTimeout: 30000,
    tls: {
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2'
    },
    debug: true,
    logger: true
  };
} else if (isGmail) {
  console.log('📧 Configurazione SMTP Gmail');
  smtpConfig = {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: emailUser,
      pass: emailPass
    },
    connectionTimeout: 30000,
    socketTimeout: 30000,
    greetingTimeout: 30000,
    tls: {
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2'
    },
    debug: true,
    logger: true
  };
} else {
  console.log('📧 Configurazione SMTP generica');
  smtpConfig = {
    host: 'smtp.' + emailUser.split('@')[1],
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: emailUser,
      pass: emailPass
    },
    connectionTimeout: 30000,
    socketTimeout: 30000,
    greetingTimeout: 30000,
    tls: {
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2'
    },
    debug: true,
    logger: true
  };
  }
}

console.log('🔧 Creazione transporter...');
if (smtpRelayHost && smtpRelayPort && smtpRelayUser && smtpRelayPass) {
  console.log('📧 Provider: SMTP Relay esterno');
} else {
  const isGmail = emailUser.includes('@gmail.com');
  const isAruba = emailUser.includes('@logikaservice.it') || emailUser.includes('@aruba.it') || emailUser.includes('aruba');
  console.log('📧 Provider rilevato:', isAruba ? 'Aruba' : (isGmail ? 'Gmail' : 'Generico'));
}
console.log('📧 Configurazione:', {
  host: smtpConfig.host,
  port: smtpConfig.port,
  secure: smtpConfig.secure
});

const transporter = nodemailer.createTransport(smtpConfig);

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
      if (isAruba) {
        console.error('2. Verifica credenziali Aruba nel pannello di controllo');
        console.error('3. Assicurati che l\'account email sia attivo');
      } else if (isGmail) {
        console.error('2. Gmail richiede App Password (non password normale)');
        console.error('3. Account Gmail ha "Accesso meno sicuro" disabilitato');
        console.error('\nSoluzione Gmail:');
        console.error('1. Vai su https://myaccount.google.com/apppasswords');
        console.error('2. Crea una nuova App Password');
        console.error('3. Usa quella password in EMAIL_PASSWORD');
      }
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      console.error('\n⚠️  ERRORE CONNESSIONE!');
      console.error('Possibili cause:');
      const isArubaCheck = emailUser && (emailUser.includes('@logikaservice.it') || emailUser.includes('@aruba.it') || emailUser.includes('aruba'));
      if (isArubaCheck) {
        console.error('1. Firewall blocca porta 587 (TLS)');
        console.error('2. Problema di rete con Aruba');
        console.error('3. SMTP Aruba non raggiungibile');
        console.error('\nVerifica:');
        console.error('  telnet smtp.aruba.it 587');
        console.error('  oppure');
        console.error('  nc -zv smtp.aruba.it 587');
        console.error('\nSe la 587 non funziona, prova anche:');
        console.error('  telnet smtps.aruba.it 465');
      } else {
        console.error('1. Firewall blocca porta SMTP');
        console.error('2. Problema di rete');
        console.error('3. Server SMTP non raggiungibile');
        console.error('\nVerifica:');
        console.error(`  telnet ${smtpConfig.host} ${smtpConfig.port}`);
      }
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

