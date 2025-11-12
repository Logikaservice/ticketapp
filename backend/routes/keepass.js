// backend/routes/keepass.js

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const xml2js = require('xml2js');
const crypto = require('crypto');

module.exports = function createKeepassRouter(pool) {
  const router = express.Router();

  // Configurazione multer per upload file XML
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(__dirname, '..', 'uploads', 'keepass');
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, `keepass-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  });

  const upload = multer({
    storage: storage,
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype === 'application/xml' || file.mimetype === 'text/xml' || 
          file.originalname.toLowerCase().endsWith('.xml')) {
        cb(null, true);
      } else {
        cb(new Error('Solo file XML sono permessi!'), false);
      }
    }
  });

  // Chiave di cifratura (in produzione dovrebbe essere in variabile d'ambiente)
  // Usa una chiave fissa per permettere la decifratura (in produzione usa variabile d'ambiente)
  const ENCRYPTION_KEY = process.env.KEEPASS_ENCRYPTION_KEY || 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2';
  const ALGORITHM = 'aes-256-cbc';
  
  // Assicurati che la chiave sia esattamente 32 bytes (64 caratteri hex)
  const getEncryptionKey = () => {
    const key = ENCRYPTION_KEY.length >= 64 ? ENCRYPTION_KEY.slice(0, 64) : ENCRYPTION_KEY.padEnd(64, '0');
    return Buffer.from(key.slice(0, 64), 'hex');
  };

  // Helper: Cifra password con AES (reversibile per visualizzazione)
  const encryptPassword = (password) => {
    if (!password) return null;
    try {
      const iv = crypto.randomBytes(16);
      const key = getEncryptionKey();
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      let encrypted = cipher.update(password, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return iv.toString('hex') + ':' + encrypted;
    } catch (err) {
      console.error('Errore cifratura password:', err);
      return null;
    }
  };

  // Helper: Decifra password (per visualizzazione)
  const decryptPassword = (encryptedPassword) => {
    if (!encryptedPassword) return null;
    try {
      const parts = encryptedPassword.split(':');
      if (parts.length !== 2) return null;
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      const key = getEncryptionKey();
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err) {
      console.error('Errore decifratura password:', err);
      return null;
    }
  };

  // Helper: Estrae valore da String array nel XML
  const getStringValue = (strings, key) => {
    if (!strings || !Array.isArray(strings)) return '';
    const found = strings.find(s => s.Key && s.Key[0] === key);
    return found && found.Value && found.Value[0] ? found.Value[0] : '';
  };

  // Helper: Processa ricorsivamente i gruppi
  const processGroup = async (groupNode, parentId, clientId, client) => {
    const groupName = groupNode.Name && groupNode.Name[0] ? groupNode.Name[0] : 'Senza nome';
    const groupUuid = groupNode.UUID && groupNode.UUID[0] ? groupNode.UUID[0] : null;
    const groupNotes = groupNode.Notes && groupNode.Notes[0] ? groupNode.Notes[0] : '';

    // Inserisci il gruppo
    const groupResult = await client.query(
      `INSERT INTO keepass_groups (name, parent_id, client_id, uuid, notes) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [groupName, parentId, clientId, groupUuid, groupNotes]
    );
    const groupId = groupResult.rows[0].id;

    // Processa le entry del gruppo
    if (groupNode.Entry && Array.isArray(groupNode.Entry)) {
      for (const entry of groupNode.Entry) {
        const title = getStringValue(entry.String, 'Title');
        const username = getStringValue(entry.String, 'UserName');
        const password = getStringValue(entry.String, 'Password');
        const url = getStringValue(entry.String, 'URL');
        const notes = getStringValue(entry.String, 'Notes');
        const entryUuid = entry.UUID && entry.UUID[0] ? entry.UUID[0] : null;

        // Cifra la password
        const encryptedPassword = password ? encryptPassword(password) : null;

        await client.query(
          `INSERT INTO keepass_entries (group_id, title, username, password_encrypted, url, notes, uuid) 
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [groupId, title, username, encryptedPassword, url, notes, entryUuid]
        );
      }
    }

    // Processa i sottogruppi ricorsivamente
    if (groupNode.Group && Array.isArray(groupNode.Group)) {
      for (const subGroup of groupNode.Group) {
        await processGroup(subGroup, groupId, clientId, client);
      }
    }

    return groupId;
  };

  // POST /api/keepass/import - Importa file XML KeePass (solo tecnico)
  router.post('/import', upload.single('xmlFile'), async (req, res) => {
    try {
      // Verifica ruolo tecnico
      const role = (req.headers['x-user-role'] || req.body?.role || '').toString();
      if (role !== 'tecnico') {
        return res.status(403).json({ error: 'Solo i tecnici possono importare file KeePass' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'File XML mancante' });
      }

      const { clientId } = req.body;
      if (!clientId) {
        return res.status(400).json({ error: 'ID cliente mancante' });
      }

      // Verifica che il cliente esista
      const clientCheck = await pool.query('SELECT id, email FROM users WHERE id = $1 AND ruolo = $2', 
        [clientId, 'cliente']);
      if (clientCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Cliente non trovato' });
      }

      // Leggi e parsea il file XML
      const xmlContent = fs.readFileSync(req.file.path, 'utf8');
      const parser = new xml2js.Parser({ explicitArray: true, mergeAttrs: false });
      const result = await parser.parseStringPromise(xmlContent);

      if (!result.KeePassFile || !result.KeePassFile.Root || !result.KeePassFile.Root[0]) {
        return res.status(400).json({ error: 'Formato XML non valido' });
      }

      const root = result.KeePassFile.Root[0];
      if (!root.Group || !root.Group[0]) {
        return res.status(400).json({ error: 'Nessun gruppo trovato nel file XML' });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Elimina eventuali dati esistenti per questo cliente
        await client.query('DELETE FROM keepass_entries WHERE group_id IN (SELECT id FROM keepass_groups WHERE client_id = $1)', [clientId]);
        await client.query('DELETE FROM keepass_groups WHERE client_id = $1', [clientId]);

        // Processa tutti i gruppi dalla root
        const rootGroup = root.Group[0];
        await processGroup(rootGroup, null, clientId, client);

        await client.query('COMMIT');

        // Elimina il file temporaneo
        fs.unlinkSync(req.file.path);

        res.json({ 
          message: 'File KeePass importato con successo',
          clientEmail: clientCheck.rows[0].email
        });
      } catch (dbErr) {
        await client.query('ROLLBACK');
        throw dbErr;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('Errore import KeePass:', err);
      
      // Elimina il file temporaneo in caso di errore
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkErr) {
          console.error('Errore eliminazione file:', unlinkErr);
        }
      }

      res.status(500).json({ 
        error: 'Errore durante l\'importazione del file KeePass',
        details: err.message 
      });
    }
  });

  // GET /api/keepass/credentials - Ottieni credenziali per il cliente loggato
  router.get('/credentials', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'];
      const role = (req.headers['x-user-role'] || '').toString();

      if (!userId) {
        return res.status(401).json({ error: 'Utente non autenticato' });
      }

      // I tecnici possono vedere tutte le credenziali, i clienti solo le proprie
      let query, params;
      if (role === 'tecnico') {
        // Se è un tecnico, può specificare un clientId opzionale
        const clientId = req.query.clientId;
        if (clientId) {
          query = `
            SELECT 
              g.id as group_id,
              g.name as group_name,
              g.parent_id,
              g.client_id,
              e.id as entry_id,
              e.title,
              e.username,
              e.password_encrypted,
              e.url,
              e.notes
            FROM keepass_groups g
            LEFT JOIN keepass_entries e ON e.group_id = g.id
            WHERE g.client_id = $1
            ORDER BY g.name, e.title
          `;
          params = [clientId];
        } else {
          query = `
            SELECT 
              g.id as group_id,
              g.name as group_name,
              g.parent_id,
              g.client_id,
              u.email as client_email,
              e.id as entry_id,
              e.title,
              e.username,
              e.password_encrypted,
              e.url,
              e.notes
            FROM keepass_groups g
            LEFT JOIN keepass_entries e ON e.group_id = g.id
            LEFT JOIN users u ON u.id = g.client_id
            ORDER BY u.email, g.name, e.title
          `;
          params = [];
        }
      } else {
        // Cliente vede solo le proprie credenziali
        query = `
          SELECT 
            g.id as group_id,
            g.name as group_name,
            g.parent_id,
            e.id as entry_id,
            e.title,
            e.username,
            e.password_encrypted,
            e.url,
            e.notes
          FROM keepass_groups g
          LEFT JOIN keepass_entries e ON e.group_id = g.id
          WHERE g.client_id = $1
          ORDER BY g.name, e.title
        `;
        params = [userId];
      }

      const result = await pool.query(query, params);
      
      // Organizza i dati in una struttura gerarchica
      const groupsMap = new Map();
      const entries = [];

      result.rows.forEach(row => {
        if (!groupsMap.has(row.group_id)) {
          groupsMap.set(row.group_id, {
            id: row.group_id,
            name: row.group_name,
            parent_id: row.parent_id,
            client_id: row.client_id,
            client_email: row.client_email || null,
            entries: []
          });
        }

        if (row.entry_id) {
          groupsMap.get(row.group_id).entries.push({
            id: row.entry_id,
            title: row.title || 'Senza titolo',
            username: row.username || '',
            password_encrypted: row.password_encrypted, // Password cifrata, non decifrata
            url: row.url || '',
            notes: row.notes || ''
          });
        }
      });

      const groups = Array.from(groupsMap.values());

      res.json({ groups });
    } catch (err) {
      console.error('Errore recupero credenziali:', err);
      res.status(500).json({ error: 'Errore nel recupero delle credenziali' });
    }
  });

  // POST /api/keepass/decrypt-password - Decifra password per visualizzazione (solo per il cliente proprietario)
  router.post('/decrypt-password', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'];
      const role = (req.headers['x-user-role'] || '').toString();
      const { entryId } = req.body;

      if (!userId || !entryId) {
        return res.status(400).json({ error: 'Parametri mancanti' });
      }

      // Verifica che l'entry appartenga al cliente (o che sia un tecnico)
      let query, params;
      if (role === 'tecnico') {
        query = `SELECT e.password_encrypted 
                 FROM keepass_entries e
                 WHERE e.id = $1`;
        params = [entryId];
      } else {
        query = `SELECT e.password_encrypted 
                 FROM keepass_entries e
                 JOIN keepass_groups g ON g.id = e.group_id
                 WHERE e.id = $1 AND g.client_id = $2`;
        params = [entryId, userId];
      }

      const entryCheck = await pool.query(query, params);

      if (entryCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Credenziale non trovata o non autorizzata' });
      }

      const decryptedPassword = decryptPassword(entryCheck.rows[0].password_encrypted);

      if (!decryptedPassword) {
        return res.status(500).json({ error: 'Errore nella decifratura della password' });
      }

      res.json({ password: decryptedPassword });
    } catch (err) {
      console.error('Errore decifratura password:', err);
      res.status(500).json({ error: 'Errore nella decifratura della password' });
    }
  });

  return router;
};

