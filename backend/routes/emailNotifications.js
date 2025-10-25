// routes/emailNotifications.js

const express = require('express');
const nodemailer = require('nodemailer');

module.exports = (pool) => {
  const router = express.Router();

  // Configurazione email transporter - Solo Gmail
  const createTransporter = () => {
    console.log('🔧 Creazione transporter email...');
    console.log('EMAIL_USER:', process.env.EMAIL_USER);
    console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? 'Configurato' : 'Mancante');
    
    console.log('📧 Configurazione Gmail');
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  };

  // ENDPOINT: Invia notifica email per nuovo ticket assegnato
  router.post('/notify-ticket-assigned', async (req, res) => {
    try {
      console.log('📧 === INVIO EMAIL TICKET ASSEGNATO ===');
      const { ticket, clientEmail, clientName, clientAzienda } = req.body;
      
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
              <h2 style="color: #333; margin-top: 0;">Ciao ${clientAzienda || 'Cliente'}!</h2>
              
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

  // ENDPOINT: Notifica tecnico ha preso in carico il ticket
  router.post('/notify-ticket-taken', async (req, res) => {
    try {
      const { ticket, clientEmail, clientName } = req.body;
      
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
        subject: `👨‍💻 Ticket ${ticket.numero} Preso in Carico - ${ticket.titolo}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0;">🎫 TicketApp</h1>
              <p style="margin: 10px 0 0 0;">Il tuo Ticket è stato Preso in Carico</p>
            </div>
            
            <div style="padding: 30px; background: #f8f9fa;">
              <h2 style="color: #333; margin-top: 0;">Ciao Cliente!</h2>
              
              <p>Il nostro tecnico ha preso in carico il tuo ticket di assistenza:</p>
              
              <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #3b82f6;">
                <h3 style="color: #3b82f6; margin-top: 0;">📋 Dettagli Ticket</h3>
                <p><strong>Numero:</strong> ${ticket.numero}</p>
                <p><strong>Titolo:</strong> ${ticket.titolo}</p>
                <p><strong>Stato:</strong> <span style="color: #3b82f6; font-weight: bold;">IN LAVORAZIONE</span></p>
                <p><strong>Priorità:</strong> ${ticket.priorita}</p>
              </div>
              
              <div style="background: #e0f2fe; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #0277bd;">
                  <strong>👨‍💻 Il tecnico sta lavorando sul tuo ticket!</strong><br>
                  Riceverai aggiornamenti non appena ci saranno novità.
                </p>
              </div>
            </div>
          </div>
        `
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('✅ Email "preso in carico" inviata:', info.messageId);
      
      res.json({
        success: true,
        messageId: info.messageId,
        message: 'Email "preso in carico" inviata con successo'
      });

    } catch (err) {
      console.error('❌ Errore invio email "preso in carico":', err);
      res.status(500).json({ 
        error: 'Errore invio email',
        details: err.message 
      });
    }
  });

  // ENDPOINT: Notifica tecnico ha risolto il ticket
  router.post('/notify-ticket-resolved', async (req, res) => {
    try {
      const { ticket, clientEmail, clientName } = req.body;
      
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
        subject: `✅ Ticket ${ticket.numero} Risolto - ${ticket.titolo}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0;">🎫 TicketApp</h1>
              <p style="margin: 10px 0 0 0;">Il tuo Ticket è stato Risolto!</p>
            </div>
            
            <div style="padding: 30px; background: #f8f9fa;">
              <h2 style="color: #333; margin-top: 0;">Ciao Cliente!</h2>
              
              <p>Il nostro tecnico ha risolto il tuo ticket di assistenza:</p>
              
              <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #10b981;">
                <h3 style="color: #10b981; margin-top: 0;">📋 Dettagli Ticket</h3>
                <p><strong>Numero:</strong> ${ticket.numero}</p>
                <p><strong>Titolo:</strong> ${ticket.titolo}</p>
                <p><strong>Stato:</strong> <span style="color: #10b981; font-weight: bold;">RISOLTO</span></p>
                <p><strong>Priorità:</strong> ${ticket.priorita}</p>
              </div>
              
              <div style="background: #d1fae5; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #065f46;">
                  <strong>✅ Il tuo problema è stato risolto!</strong><br>
                  Se hai bisogno di ulteriore assistenza, non esitare a contattarci.
                </p>
              </div>
            </div>
          </div>
        `
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('✅ Email "risolto" inviata:', info.messageId);
      
      res.json({
        success: true,
        messageId: info.messageId,
        message: 'Email "risolto" inviata con successo'
      });

    } catch (err) {
      console.error('❌ Errore invio email "risolto":', err);
      res.status(500).json({ 
        error: 'Errore invio email',
        details: err.message 
      });
    }
  });

  // ENDPOINT: Notifica tecnico ha chiuso il ticket
  router.post('/notify-ticket-closed', async (req, res) => {
    try {
      const { ticket, clientEmail, clientName } = req.body;
      
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
        subject: `🔒 Ticket ${ticket.numero} Chiuso - ${ticket.titolo}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #6b7280 0%, #374151 100%); color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0;">🎫 TicketApp</h1>
              <p style="margin: 10px 0 0 0;">Il tuo Ticket è stato Chiuso</p>
            </div>
            
            <div style="padding: 30px; background: #f8f9fa;">
              <h2 style="color: #333; margin-top: 0;">Ciao Cliente!</h2>
              
              <p>Il nostro tecnico ha chiuso il tuo ticket di assistenza:</p>
              
              <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #6b7280;">
                <h3 style="color: #6b7280; margin-top: 0;">📋 Dettagli Ticket</h3>
                <p><strong>Numero:</strong> ${ticket.numero}</p>
                <p><strong>Titolo:</strong> ${ticket.titolo}</p>
                <p><strong>Stato:</strong> <span style="color: #6b7280; font-weight: bold;">CHIUSO</span></p>
                <p><strong>Priorità:</strong> ${ticket.priorita}</p>
              </div>
              
              <div style="background: #f3f4f6; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #374151;">
                  <strong>🔒 Il ticket è stato chiuso definitivamente.</strong><br>
                  Se hai nuovi problemi, puoi sempre creare un nuovo ticket.
                </p>
              </div>
            </div>
          </div>
        `
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('✅ Email "chiuso" inviata:', info.messageId);
      
      res.json({
        success: true,
        messageId: info.messageId,
        message: 'Email "chiuso" inviata con successo'
      });

    } catch (err) {
      console.error('❌ Errore invio email "chiuso":', err);
      res.status(500).json({ 
        error: 'Errore invio email',
        details: err.message 
      });
    }
  });

  // ENDPOINT: Invia notifica per aggiornamento ticket
  router.post('/notify-ticket-updated', async (req, res) => {
    try {
      const { ticket, clientEmail, clientName, clientAzienda, changes } = req.body;
      
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
              <h2 style="color: #333; margin-top: 0;">Ciao ${clientAzienda || 'Cliente'}!</h2>
              
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
      const { ticket, clientEmail, clientName, clientAzienda, isSelfCreated } = req.body;
      
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
              <h2 style="color: #333; margin-top: 0;">Ciao ${clientAzienda || 'Cliente'}!</h2>
              
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

  // ENDPOINT: Invia notifica email al tecnico per nuovo ticket
  router.post('/notify-technician-new-ticket', async (req, res) => {
    try {
      console.log('📧 === INVIO EMAIL TECNICO NUOVO TICKET ===');
      const { ticket, technicianEmail, technicianName } = req.body;
      
      console.log('Dati ricevuti:', { 
        ticketId: ticket?.id, 
        ticketNumero: ticket?.numero,
        technicianEmail, 
        technicianName 
      });
      
      if (!ticket || !technicianEmail) {
        console.log('❌ Dati mancanti:', { ticket: !!ticket, technicianEmail: !!technicianEmail });
        return res.status(400).json({ error: 'Ticket e email tecnico sono obbligatori' });
      }

      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
        console.log('⚠️ Credenziali email non configurate');
        return res.json({
          success: false,
          message: 'Sistema email non configurato'
        });
      }

      console.log('🔧 Creazione transporter...');
      const transporter = createTransporter();
      
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: technicianEmail,
        subject: `🎫 Nuovo Ticket #${ticket.numero} - ${ticket.titolo}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0;">🎫 TicketApp</h1>
              <p style="margin: 10px 0 0 0;">Nuovo Ticket di Assistenza</p>
            </div>
            
            <div style="padding: 30px; background: #f8f9fa;">
              <h2 style="color: #333; margin-top: 0;">Ciao ${technicianName || 'Tecnico'}!</h2>
              
              <p>È stato creato un nuovo ticket di assistenza:</p>
              
              <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #3b82f6;">
                <h3 style="color: #3b82f6; margin-top: 0;">📋 Dettagli Ticket</h3>
                <p><strong>Numero:</strong> ${ticket.numero}</p>
                <p><strong>Titolo:</strong> ${ticket.titolo}</p>
                <p><strong>Descrizione:</strong> ${ticket.descrizione}</p>
                <p><strong>Priorità:</strong> <span style="color: ${getPriorityColor(ticket.priorita)}">${ticket.priorita.toUpperCase()}</span></p>
                <p><strong>Stato:</strong> ${ticket.stato}</p>
                <p><strong>Data apertura:</strong> ${new Date(ticket.dataapertura).toLocaleDateString('it-IT')}</p>
                <p><strong>Richiedente:</strong> ${ticket.nomerichiedente}</p>
              </div>
              
              <div style="background: #e0f2f7; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #0288d1;">
                  <strong>🔔 Nuovo ticket da gestire!</strong><br>
                  Il ticket è stato aggiunto al calendario e richiede la tua attenzione.
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_URL || 'https://ticketapp-frontend-ton5.onrender.com'}" 
                   style="background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  🔗 Accedi al Sistema
                </a>
              </div>
              
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
              
              <p style="color: #666; font-size: 14px; margin: 0;">
                Questa email è stata inviata automaticamente dal sistema TicketApp.<br>
                Per assistenza, contatta il supporto tecnico.
              </p>
            </div>
          </div>
        `
      };

      console.log('📤 Invio email tecnico...');
      console.log('Mail options:', {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject
      });
      
      const info = await transporter.sendMail(mailOptions);
      console.log('✅ Email tecnico inviata con successo:', info.messageId);
      
      res.json({
        success: true,
        messageId: info.messageId,
        message: 'Email tecnico inviata con successo'
      });

    } catch (err) {
      console.error('❌ Errore invio email tecnico:', err);
      res.status(500).json({ 
        error: 'Errore invio email tecnico',
        details: err.message 
      });
    }
  });

  // ENDPOINT: Controlla stato sistema email
  router.get('/status', async (req, res) => {
    try {
      const status = {
        emailConfigured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD),
        emailUser: process.env.EMAIL_USER,
        emailProvider: process.env.EMAIL_USER?.includes('@gmail.com') ? 'Gmail' : 'Aruba/Altro',
        googleCalendarDisabled: process.env.DISABLE_GOOGLE_CALENDAR === 'true',
        timestamp: new Date().toISOString()
      };
      
      console.log('📧 Stato sistema email:', status);
      res.json(status);
    } catch (err) {
      console.error('❌ Errore controllo stato email:', err);
      res.status(500).json({ 
        error: 'Errore controllo stato email',
        details: err.message 
      });
    }
  });

  // ENDPOINT: Test notifiche email
  router.post('/test-notifications', async (req, res) => {
    try {
      const { testEmail } = req.body;
      
      if (!testEmail) {
        return res.status(400).json({ error: 'Email di test richiesta' });
      }

      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
        console.log('❌ Configurazione email mancante:', {
          EMAIL_USER: process.env.EMAIL_USER ? 'Configurato' : 'MANCANTE',
          EMAIL_PASSWORD: process.env.EMAIL_PASSWORD ? 'Configurato' : 'MANCANTE'
        });
        return res.status(500).json({ 
          error: 'Sistema email non configurato',
          details: 'EMAIL_USER o EMAIL_PASSWORD mancanti nelle variabili d\'ambiente',
          config: {
            EMAIL_USER: process.env.EMAIL_USER ? 'Configurato' : 'MANCANTE',
            EMAIL_PASSWORD: process.env.EMAIL_PASSWORD ? 'Configurato' : 'MANCANTE'
          }
        });
      }

      console.log('🔧 Creazione transporter per test email...');
      const transporter = createTransporter();
      
      if (!transporter) {
        console.log('❌ Errore creazione transporter');
        return res.status(500).json({ 
          error: 'Errore configurazione email',
          details: 'Impossibile creare transporter email'
        });
      }
      
      console.log('✅ Transporter creato, invio email di test...');
      console.log('📧 Dettagli email test:', {
        from: process.env.EMAIL_USER,
        to: testEmail,
        provider: process.env.EMAIL_USER?.includes('@gmail.com') ? 'Gmail' : 'Aruba/Altro'
      });
      
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: testEmail,
        subject: '🧪 Test Notifiche TicketApp',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #4caf50 0%, #45a049 100%); color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0;">🧪 TicketApp - Test Notifiche</h1>
              <p style="margin: 10px 0 0 0;">Test Sistema Email</p>
            </div>
            
            <div style="padding: 30px; background: #f8f9fa;">
              <h2 style="color: #333; margin-top: 0;">Test Completato con Successo!</h2>
              
              <div style="background: #e8f5e8; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #2e7d32;">
                  <strong>✅ Le notifiche email funzionano correttamente!</strong><br>
                  Questo è un messaggio di test per verificare che il sistema di notifiche sia operativo.
                </p>
              </div>
              
              <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #856404;">
                  <strong>📧 Configurazione Email:</strong><br>
                  • Provider: ${process.env.EMAIL_USER?.includes('@gmail.com') ? 'Gmail' : 'Aruba/Altro'}<br>
                  • Da: ${process.env.EMAIL_USER}<br>
                  • A: ${testEmail}
                </p>
              </div>
              
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
              
              <p style="color: #666; font-size: 14px; margin: 0;">
                Questo messaggio è stato inviato automaticamente dal sistema TicketApp per testare le notifiche email.<br>
                Se ricevi questo messaggio, significa che le notifiche per i ticket funzionano correttamente.
              </p>
            </div>
          </div>
        `
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('✅ Email di test inviata con successo:', info.messageId);
      
      res.json({
        success: true,
        messageId: info.messageId,
        message: 'Email di test inviata con successo',
        details: {
          from: process.env.EMAIL_USER,
          to: testEmail,
          provider: process.env.EMAIL_USER?.includes('@gmail.com') ? 'Gmail' : 'Aruba/Altro'
        }
      });

    } catch (err) {
      console.error('❌ Errore test notifiche email:', err);
      console.error('❌ Stack trace:', err.stack);
      console.error('❌ Configurazione al momento dell\'errore:', {
        EMAIL_USER: process.env.EMAIL_USER ? 'Configurato' : 'MANCANTE',
        EMAIL_PASSWORD: process.env.EMAIL_PASSWORD ? 'Configurato' : 'MANCANTE',
        testEmail: testEmail
      });
      
      res.status(500).json({ 
        error: 'Errore test notifiche email',
        details: err.message,
        stack: err.stack,
        config: {
          EMAIL_USER: process.env.EMAIL_USER ? 'Configurato' : 'MANCANTE',
          EMAIL_PASSWORD: process.env.EMAIL_PASSWORD ? 'Configurato' : 'MANCANTE'
        }
      });
    }
  });

  return router;
};
