// routes/googleAuth.js

const express = require('express');
const { google } = require('googleapis');

module.exports = (pool) => {
  const router = express.Router();

  // ENDPOINT: Scambia codice OAuth con token
  router.post('/google-auth', async (req, res) => {
    try {
      console.log('Google Auth request received:', req.body);
      const { code } = req.body;

      if (!code) {
        console.log('No OAuth code provided');
        return res.status(400).json({ error: 'Codice OAuth non fornito' });
      }

      console.log('OAuth code received:', code);

      // Configura OAuth2 client
      console.log('Configuring OAuth2 client with:', {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ? '***' : 'MISSING',
        redirectUri: process.env.GOOGLE_REDIRECT_URI || 'https://ticketapp-frontend-ton5.onrender.com'
      });

      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI || 'https://ticketapp-frontend-ton5.onrender.com'
      );

      // Scambia il codice con i token
      console.log('Exchanging code for tokens...');
      const { tokens } = await oauth2Client.getToken(code);
      console.log('Tokens received:', { 
        access_token: tokens.access_token ? '***' : 'MISSING',
        refresh_token: tokens.refresh_token ? '***' : 'MISSING',
        scope: tokens.scope
      });
      
      // Salva i token (opzionale - per sessioni persistenti)
      oauth2Client.setCredentials(tokens);

      // Testa l'accesso al Calendar API
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      const calendarList = await calendar.calendarList.list();

      console.log('Google Calendar accesso riuscito per utente');

      res.json({
        success: true,
        message: 'Autenticazione Google completata',
        tokens: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          scope: tokens.scope,
          token_type: tokens.token_type,
          expiry_date: tokens.expiry_date
        }
      });

    } catch (err) {
      console.error('Errore scambio codice OAuth:', err);
      res.status(500).json({ 
        error: 'Errore durante l\'autenticazione con Google',
        details: err.message 
      });
    }
  });

  return router;
};
