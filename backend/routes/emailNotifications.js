// routes/emailNotifications.js

const express = require('express');
const nodemailer = require('nodemailer');

module.exports = (pool) => {
  const router = express.Router();

  // Configurazione email transporter
  const createTransporter = () => {
    return nodemailer.createTransporter({
      service: 'gmail', // Puoi cambiare con altri provider
      auth: {
        user: process.env.EMAIL_USER, // Email del mittente
        pass: process.env.EMAIL_PASSWORD // Password app specifica
      }
    });
  };

  // ENDPOINT: Invia notifica email per nuovo ticket assegnato
  router.post('/notify-ticket-assigned', async (req, res) => {
    try {
      const { ticket, clientEmail, clientName } = req.body;
      
      if (!ticket || !clientEmail) {
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

      const transporter = createTransporter();
      
      // Template email
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: clientEmail,
        subject: `🎫 Nuovo Ticket #${ticket.numero} - ${ticket.titolo}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0;">🎫 TicketApp</h1>
              <p style="margin: 10px 0 0 0;">Sistema Gestione Ticket</p>
            </div>
            
            <div style="padding: 30px; background: #f8f9fa;">
              <h2 style="color: #333; margin-top: 0;">Ciao ${clientName || 'Cliente'}!</h2>
              
              <p>Ti è stato assegnato un nuovo ticket di assistenza:</p>
              
              <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #667eea;">
                <h3 style="color: #667eea; margin-top: 0;">📋 Dettagli Ticket</h3>
                <p><strong>Numero:</strong> ${ticket.numero}</p>
                <p><strong>Titolo:</strong> ${ticket.titolo}</p>
                <p><strong>Descrizione:</strong> ${ticket.descrizione}</p>
                <p><strong>Priorità:</strong> <span style="color: ${getPriorityColor(ticket.priorita)}">${ticket.priorita.toUpperCase()}</span></p>
                <p><strong>Stato:</strong> ${ticket.stato}</p>
                <p><strong>Data apertura:</strong> ${new Date(ticket.dataapertura).toLocaleDateString('it-IT')}</p>
              </div>
              
              <div style="background: #e3f2fd; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #1976d2;">
                  <strong>📅 Il ticket è stato aggiunto al tuo calendario Google!</strong><br>
                  Puoi visualizzarlo nel tuo calendario personale.
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_URL || 'https://ticketapp-frontend-ton5.onrender.com'}" 
                   style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
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
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0;">🔄 TicketApp</h1>
              <p style="margin: 10px 0 0 0;">Aggiornamento Ticket</p>
            </div>
            
            <div style="padding: 30px; background: #f8f9fa;">
              <h2 style="color: #333; margin-top: 0;">Ciao ${clientName || 'Cliente'}!</h2>
              
              <p>Il tuo ticket è stato aggiornato:</p>
              
              <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #ff9800;">
                <h3 style="color: #ff9800; margin-top: 0;">📋 Ticket #${ticket.numero}</h3>
                <p><strong>Titolo:</strong> ${ticket.titolo}</p>
                <p><strong>Stato attuale:</strong> <span style="color: ${getStatusColor(ticket.stato)}">${ticket.stato.toUpperCase()}</span></p>
                ${changes ? `<p><strong>Modifiche:</strong> ${changes}</p>` : ''}
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_URL || 'https://ticketapp-frontend-ton5.onrender.com'}" 
                   style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  🔗 Visualizza Ticket
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

  return router;
};
