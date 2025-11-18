// backend/routes/supremo.js

const express = require('express');
const router = express.Router();

module.exports = () => {
  // ENDPOINT: Ottiene le credenziali Supremo dal registro Windows
  router.get('/credentials', async (req, res) => {
    try {
      // Verifica se siamo su Windows
      if (process.platform !== 'win32') {
        return res.json({ 
          installed: false, 
          message: 'Supremo può essere rilevato solo su sistemi Windows' 
        });
      }

      // Prova a leggere il registro Windows
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      // Leggi ID Supremo dal registro
      let supremoId = null;
      let supremoPassword = null;

      try {
        // Leggi HKCU\Software\Supremo\IdUser
        const { stdout: idOutput } = await execAsync(
          'reg query "HKCU\\Software\\Supremo" /v IdUser 2>nul'
        );
        const idMatch = idOutput.match(/IdUser\s+REG_SZ\s+(.+)/);
        if (idMatch) {
          supremoId = idMatch[1].trim();
        }
      } catch (err) {
        // Supremo non installato o chiave non trovata
        console.log('Supremo ID non trovato nel registro');
      }

      try {
        // Leggi HKCU\Software\Supremo\PwdUser
        const { stdout: pwdOutput } = await execAsync(
          'reg query "HKCU\\Software\\Supremo" /v PwdUser 2>nul'
        );
        const pwdMatch = pwdOutput.match(/PwdUser\s+REG_SZ\s+(.+)/);
        if (pwdMatch) {
          supremoPassword = pwdMatch[1].trim();
        }
      } catch (err) {
        // Password non trovata
        console.log('Supremo Password non trovata nel registro');
      }

      // Se abbiamo almeno l'ID, Supremo è installato
      if (supremoId) {
        return res.json({
          installed: true,
          id: supremoId,
          password: supremoPassword || null
        });
      } else {
        return res.json({
          installed: false,
          message: 'Supremo non trovato nel registro Windows'
        });
      }
    } catch (error) {
      console.error('Errore lettura registro Supremo:', error);
      return res.json({
        installed: false,
        message: 'Errore nel rilevare Supremo',
        error: error.message
      });
    }
  });

  return router;
};

