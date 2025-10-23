// routes/emailNotifications.js

const express = require('express');
const nodemailer = require('nodemailer');

module.exports = (pool) => {
  const router = express.Router();

  // Configurazione email transporter
  const createTransporter = () => {
    console.log('🔧 Creazione transporter email...');
    console.log('EMAIL_USER:', process.env.EMAIL_USER);
    console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? 'Configurato' : 'Mancante');
    
    // Supporta sia Gmail che Aruba
    const isGmail = process.env.EMAIL_USER?.includes('@gmail.com');
    const isAruba = process.env.EMAIL_USER?.includes('@logikaservice.it') || process.env.EMAIL_USER?.includes('@aruba.it');
    
    console.log('Provider rilevato:', { isGmail, isAruba });
    
    if (isGmail) {
      console.log('📧 Configurazione Gmail');
      return nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      });
    } else if (isAruba) {
      console.log('📧 Configurazione Aruba');
      // Prova prima con SSL (porta 465)
      return nodemailer.createTransport({
        host: 'smtps.aruba.it',
        port: 465,
        secure: true, // SSL
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        },
        tls: {
          rejectUnauthorized: false
        }
      });
    } else {
      console.log('📧 Configurazione generica');
      // Configurazione generica per altri provider
      return nodemailer.createTransport({
        host: 'smtp.gmail.com', // Fallback
        port: 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      });
    }
  };

  // ENDPOINT: Invia notifica email per nuovo ticket assegnato
  router.post('/notify-ticket-assigned', async (req, res) => {
    try {
      console.log('📧 === INVIO EMAIL TICKET ASSEGNATO ===');
      const { ticket, clientEmail, clientName } = req.body;
      
      console.log('Dati ricevuti:', { 
        ticketId: ticket?.id, 
        ticketNumero: ticket?.numero,
        clientEmail, 
        clientName 
      });
      
      if (!ticket || !clientEmail) {
        console.log('❌ Dati mancanti:', { ticket: !!ticket, clientEmail: !!clientEmail });
        return res.status(400).json({ error: 'Ticket e email cliente sono obbligatori' });
      }

      // Verifica che le credenziali email siano configurate
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
        console.log('⚠️ Credenziali email non configurate');
        return res.json({
          success: false,
          message: 'Sistema email non configurato'
        });
      }

      console.log('🔧 Creazione transporter...');
      const transporter = createTransporter();
      
      // Template email
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: clientEmail,
        subject: `🎫 Nuovo Ticket #${ticket.numero} - ${ticket.titolo}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #4caf50 0%, #45a049 100%); color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0;">🎫 TicketApp</h1>
              <p style="margin: 10px 0 0 0;">Nuovo Ticket di Assistenza Assegnato</p>
            </div>
            
            <div style="padding: 30px; background: #f8f9fa;">
              <h2 style="color: #333; margin-top: 0;">Ciao ${clientName || 'Cliente'}!</h2>
              
              <p>Ti è stato assegnato un nuovo ticket di assistenza:</p>
              
              <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #4caf50;">
                <h3 style="color: #4caf50; margin-top: 0;">📋 Dettagli Ticket</h3>
                <p><strong>Numero:</strong> ${ticket.numero}</p>
                <p><strong>Titolo:</strong> ${ticket.titolo}</p>
                <p><strong>Descrizione:</strong> ${ticket.descrizione}</p>
                <p><strong>Priorità:</strong> <span style="color: ${getPriorityColor(ticket.priorita)}">${ticket.priorita.toUpperCase()}</span></p>
                <p><strong>Stato:</strong> ${ticket.stato}</p>
                <p><strong>Data apertura:</strong> ${new Date(ticket.dataapertura).toLocaleDateString('it-IT')}</p>
              </div>
              
              <div style="background: #e8f5e8; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #2e7d32;">
                  <strong>✅ Il tuo ticket è stato aggiunto al calendario!</strong><br>
                  Puoi visualizzarlo nel tuo calendario personale.
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_URL || 'https://ticketapp-frontend-ton5.onrender.com'}" 
                   style="background: #4caf50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  🔗 Accedi al Sistema
                </a>
              </div>
              
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
              
              <p style="color: #666; font-size: 14px; margin: 0;">
                Questa email è stata inviata automaticamente dal sistema TicketApp.<br>
                Per assistenza, contatta il tuo tecnico di riferimento.
              </p>
            </div>
          </div>
        `
      };

      // Invia email
      console.log('📤 Invio email...');
      console.log('Mail options:', {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject
      });
      
      const info = await transporter.sendMail(mailOptions);
      console.log('✅ Email inviata con successo:', info.messageId);
      
      res.json({
        success: true,
        messageId: info.messageId,
        message: 'Email inviata con successo'
      });

    } catch (err) {
      console.error('❌ Errore invio email:', err);
      res.status(500).json({ 
        error: 'Errore invio email',
        details: err.message 
      });
    }
  });

  // ENDPOINT: Invia notifica per aggiornamento ticket
  router.post('/notify-ticket-updated', async (req, res) => {
    try {
      const { ticket, clientEmail, clientName, changes } = req.body;
      
      if (!ticket || !clientEmail) {
        return res.status(400).json({ error: 'Ticket e email cliente sono obbligatori' });
      }

      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
        return res.json({
          success: false,
          message: 'Sistema email non configurato'
        });
      }

      const transporter = createTransporter();
      
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: clientEmail,
        subject: `🔄 Aggiornamento Ticket #${ticket.numero} - ${ticket.titolo}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0;">🎫 TicketApp</h1>
              <p style="margin: 10px 0 0 0;">Aggiornamento sul tuo Ticket di Assistenza</p>
            </div>
            
            <div style="padding: 30px; background: #f8f9fa;">
              <h2 style="color: #333; margin-top: 0;">Ciao ${clientName || 'Cliente'}!</h2>
              
              <p>Il tuo ticket è stato aggiornato:</p>
              
              <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                <h3 style="color: #f59e0b; margin-top: 0;">📋 Dettagli Aggiornati</h3>
                <p><strong>Numero:</strong> ${ticket.numero}</p>
                <p><strong>Titolo:</strong> ${ticket.titolo}</p>
                <p><strong>Descrizione:</strong> ${ticket.descrizione}</p>
                <p><strong>Priorità:</strong> <span style="color: ${getPriorityColor(ticket.priorita)}">${ticket.priorita.toUpperCase()}</span></p>
                <p><strong>Stato:</strong> <span style="color: ${getPriorityColor(ticket.stato)}">${ticket.stato.toUpperCase()}</span></p>
                <p><strong>Data apertura:</strong> ${new Date(ticket.dataapertura).toLocaleDateString('it-IT')}</p>
                ${changes ? `<p><strong>Modifiche:</strong> ${changes}</p>` : ''}
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_URL || 'https://ticketapp-frontend-ton5.onrender.com'}" 
                   style="background: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  🔗 Accedi al Sistema
                </a>
              </div>
            </div>
          </div>
        `
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('✅ Email aggiornamento inviata:', info.messageId);
      
      res.json({
        success: true,
        messageId: info.messageId,
        message: 'Email aggiornamento inviata'
      });

    } catch (err) {
      console.error('❌ Errore invio email aggiornamento:', err);
      res.status(500).json({ 
        error: 'Errore invio email',
        details: err.message 
      });
    }
  });

  // Funzioni helper per i colori
  const getPriorityColor = (priorita) => {
    const colors = {
      'urgente': '#f44336',
      'alta': '#ff9800', 
      'media': '#2196f3',
      'bassa': '#9e9e9e'
    };
    return colors[priorita?.toLowerCase()] || '#9e9e9e';
  };

  const getStatusColor = (stato) => {
    const colors = {
      'aperto': '#2196f3',
      'in_lavorazione': '#ff9800',
      'risolto': '#4caf50',
      'chiuso': '#9e9e9e',
      'inviato': '#9c27b0',
      'fatturato': '#795548'
    };
    return colors[stato?.toLowerCase()] || '#9e9e9e';
  };

  // ENDPOINT: Invia notifica email per ticket creato dal cliente
  router.post('/notify-ticket-created', async (req, res) => {
    try {
      const { ticket, clientEmail, clientName, isSelfCreated } = req.body;
      
      if (!ticket || !clientEmail) {
        return res.status(400).json({ error: 'Ticket e email cliente sono obbligatori' });
      }

      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
        return res.json({
          success: false,
          message: 'Sistema email non configurato'
        });
      }

      const transporter = createTransporter();
      
      // Template email per ticket auto-creato
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: clientEmail,
        subject: `🎫 Ticket Creato #${ticket.numero} - ${ticket.titolo}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #4caf50 0%, #45a049 100%); color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0;">🎫 TicketApp</h1>
              <p style="margin: 10px 0 0 0;">Ticket Creato con Successo</p>
            </div>
            
            <div style="padding: 30px; background: #f8f9fa;">
              <h2 style="color: #333; margin-top: 0;">Ciao ${clientName || 'Cliente'}!</h2>
              
              <p>Hai creato con successo un nuovo ticket di assistenza:</p>
              
              <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #4caf50;">
                <h3 style="color: #4caf50; margin-top: 0;">📋 Dettagli Ticket</h3>
                <p><strong>Numero:</strong> ${ticket.numero}</p>
                <p><strong>Titolo:</strong> ${ticket.titolo}</p>
                <p><strong>Descrizione:</strong> ${ticket.descrizione}</p>
                <p><strong>Priorità:</strong> <span style="color: ${getPriorityColor(ticket.priorita)}">${ticket.priorita.toUpperCase()}</span></p>
                <p><strong>Stato:</strong> ${ticket.stato}</p>
                <p><strong>Data apertura:</strong> ${new Date(ticket.dataapertura).toLocaleDateString('it-IT')}</p>
              </div>
              
              <div style="background: #e8f5e8; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #2e7d32;">
                  <strong>✅ Il tuo ticket è stato creato e aggiunto al calendario!</strong><br>
                  Il nostro team tecnico lo esaminerà al più presto.
                </p>
              </div>
              
              <div style="background: #fff3e0; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #f57c00;">
                  <strong>📅 Il ticket è stato aggiunto al tuo calendario Google!</strong><br>
                  Puoi visualizzarlo nel tuo calendario personale.
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_URL || 'https://ticketapp-frontend-ton5.onrender.com'}" 
                   style="background: #4caf50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  🔗 Accedi al Sistema
                </a>
              </div>
              
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
              
              <p style="color: #666; font-size: 14px; margin: 0;">
                Questa email è stata inviata automaticamente dal sistema TicketApp.<br>
                Per assistenza, contatta il nostro team tecnico.
              </p>
            </div>
          </div>
        `
      };

      // Invia email
      const info = await transporter.sendMail(mailOptions);
      console.log('✅ Email ticket creato inviata con successo:', info.messageId);
      
      res.json({
        success: true,
        messageId: info.messageId,
        message: 'Email ticket creato inviata con successo'
      });

    } catch (err) {
      console.error('❌ Errore invio email ticket creato:', err);
      res.status(500).json({ 
        error: 'Errore invio email',
        details: err.message 
      });
    }
  });

  // ENDPOINT: Test configurazione email
  router.post('/test-email-config', async (req, res) => {
    try {
      const { testEmail } = req.body;
      
      if (!testEmail) {
        return res.status(400).json({ error: 'Email di test obbligatoria' });
      }

      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
        return res.json({
          success: false,
          message: 'Credenziali email non configurate',
          details: {
            EMAIL_USER: process.env.EMAIL_USER ? 'Configurato' : 'Mancante',
            EMAIL_PASSWORD: process.env.EMAIL_PASSWORD ? 'Configurato' : 'Mancante'
          }
        });
      }

      const transporter = createTransporter();
      
      // Email di test semplice
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: testEmail,
        subject: '🧪 Test Configurazione Email TicketApp',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #4caf50 0%, #45a049 100%); color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0;">🧪 TicketApp</h1>
              <p style="margin: 10px 0 0 0;">Test Configurazione Email</p>
            </div>
            
            <div style="padding: 30px; background: #f8f9fa;">
              <h2 style="color: #333; margin-top: 0;">Test Email Riuscito!</h2>
              
              <p>Se ricevi questa email, significa che la configurazione email funziona correttamente.</p>
              
              <div style="background: #e8f5e8; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #2e7d32;">
                  <strong>✅ Configurazione Email Funzionante</strong><br>
                  Il sistema può inviare notifiche ai clienti.
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_URL || 'https://ticketapp-frontend-ton5.onrender.com'}" 
                   style="background: #4caf50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  🔗 Accedi al Sistema
                </a>
              </div>
            </div>
          </div>
        `
      };

      // Invia email di test
      const info = await transporter.sendMail(mailOptions);
      console.log('✅ Email di test inviata con successo:', info.messageId);
      
      res.json({
        success: true,
        messageId: info.messageId,
        message: 'Email di test inviata con successo',
        from: process.env.EMAIL_USER,
        to: testEmail
      });

    } catch (err) {
      console.error('❌ Errore test email:', err);
      res.status(500).json({ 
        error: 'Errore test email',
        details: err.message,
        stack: err.stack
      });
    }
  });

  return router;
};
