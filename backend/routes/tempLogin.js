// routes/tempLogin.js - Login temporaneo senza JWT per debug

const express = require('express');
const { verifyPassword, migratePassword } = require('../utils/passwordUtils');

module.exports = (pool) => {
  const router = express.Router();

  // ENDPOINT: Login temporaneo senza JWT (per debug)
  router.post('/temp-login', async (req, res) => {
    const { email, password } = req.body;
    console.log('🔍 TEMP LOGIN - Debug senza JWT');
    console.log('Email:', email);
    console.log('Password length:', password ? password.length : 0);
    
    try {
      const client = await pool.connect();
      
      // Prima cerca l'utente per email
      const result = await client.query('SELECT * FROM users WHERE email = $1', [email]);
      console.log('Utenti trovati:', result.rows.length);
      
      if (result.rows.length === 0) {
        client.release();
        console.log('❌ Utente non trovato');
        return res.status(401).json({ error: 'Credenziali non valide' });
      }
      
      const user = result.rows[0];
      const storedPassword = user.password;
      console.log('Password stored length:', storedPassword ? storedPassword.length : 0);
      console.log('Password is hashed:', storedPassword && storedPassword.startsWith('$2b$'));
      
      // Verifica se la password è già hashata
      let isValidPassword = false;
      
      if (storedPassword && storedPassword.startsWith('$2b$')) {
        // Password già hashata - verifica con bcrypt
        console.log('🔐 Verifica password hashata');
        isValidPassword = await verifyPassword(password, storedPassword);
      } else {
        // Password in chiaro (compatibilità con sistema esistente)
        console.log('🔓 Verifica password in chiaro');
        isValidPassword = password === storedPassword;
        
        // Se il login è valido, migra la password a hash
        if (isValidPassword) {
          try {
            console.log('🔄 Migrazione password a hash');
            const hashedPassword = await migratePassword(password);
            await client.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, user.id]);
            console.log(`✅ Password migrata per utente: ${email}`);
          } catch (migrateErr) {
            console.log('⚠️ Errore migrazione password:', migrateErr.message);
          }
        }
      }
      
      client.release();
      
      if (isValidPassword) {
        delete user.password;
        console.log(`✅ Login riuscito per: ${email}`);
        
        // Risposta semplice senza JWT
        res.json({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            ruolo: user.ruolo,
            nome: user.nome,
            cognome: user.cognome,
            telefono: user.telefono,
            azienda: user.azienda
          }
        });
      } else {
        console.log(`❌ Login fallito per: ${email}`);
        res.status(401).json({ error: 'Credenziali non valide' });
      }
    } catch (err) {
      console.error('❌ Errore durante il temp login:', err);
      console.error('❌ Stack trace:', err.stack);
      res.status(500).json({ 
        error: 'Errore interno del server',
        details: err.message,
        stack: err.stack
      });
    }
  });

  return router;
};
