// backend/routes/keepass.js

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const xml2js = require('xml2js');
const crypto = require('crypto');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const keepassDriveService = require('../utils/keepassDriveService');
const telegramService = require('../utils/telegramService');

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
  // AES-256 richiede una chiave di 32 bytes (64 caratteri hex)
  // IMPORTANTE: La chiave deve essere esattamente 64 caratteri hex (0-9, a-f)
  const ENCRYPTION_KEY = process.env.KEEPASS_ENCRYPTION_KEY || 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567890ab';
  const ALGORITHM = 'aes-256-cbc';
  
  // Assicurati che la chiave sia esattamente 32 bytes (64 caratteri hex)
  const getEncryptionKey = () => {
    let keyHex = ENCRYPTION_KEY;
    
    // Se la chiave non è in formato hex valido, genera una chiave valida
    if (!/^[0-9a-fA-F]+$/.test(keyHex)) {
      console.warn('⚠️ Chiave di cifratura non valida, genero una nuova chiave');
      // Genera una chiave hex valida di 64 caratteri
      keyHex = crypto.randomBytes(32).toString('hex');
    }
    
    // Assicurati che sia esattamente 64 caratteri hex (32 bytes)
    if (keyHex.length < 64) {
      keyHex = keyHex.padEnd(64, '0');
    } else if (keyHex.length > 64) {
      keyHex = keyHex.slice(0, 64);
    }
    
    const keyBuffer = Buffer.from(keyHex, 'hex');
    
    // Verifica che la chiave sia esattamente 32 bytes
    if (keyBuffer.length !== 32) {
      console.error('❌ Errore: chiave di cifratura non è 32 bytes, lunghezza:', keyBuffer.length);
      // Genera una chiave valida come fallback
      return crypto.randomBytes(32);
    }
    
    return keyBuffer;
  };

  // Helper: Cifra password con AES (reversibile per visualizzazione)
  // IMPORTANTE: Cifra anche password vuote per mantenere il formato corretto
  const encryptPassword = (password) => {
    // Gestisci anche password vuote/null/undefined come stringa vuota
    const passwordToEncrypt = password || '';
    
    try {
      const iv = crypto.randomBytes(16);
      const key = getEncryptionKey();
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      let encrypted = cipher.update(passwordToEncrypt, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const result = iv.toString('hex') + ':' + encrypted;
      return result;
    } catch (err) {
      console.error('❌ Errore cifratura password:', err);
      console.error('Stack:', err.stack);
      return null;
    }
  };

  // Helper: Decifra password (per visualizzazione)
  const decryptPassword = (encryptedPassword) => {
    if (!encryptedPassword) {
      return null;
    }
    
    // Se la password è una stringa vuota cifrata, potrebbe essere solo ':'
    if (encryptedPassword === '' || encryptedPassword.trim() === '') {
      return '';
    }
    
    try {
      const parts = encryptedPassword.split(':');
      
      if (parts.length !== 2) {
        console.error('❌ decryptPassword: formato errato, parts.length =', parts.length);
        console.error('❌ encryptedPassword (primi 100 caratteri):', encryptedPassword.substring(0, 100));
        return null;
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      const key = getEncryptionKey();
      
      
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (err) {
      console.error('❌ Errore decifratura password:', err.message);
      console.error('❌ Stack:', err.stack);
      return null;
    }
  };

  // Helper: Estrae valore da String array nel XML
  const getStringValue = (strings, key) => {
    if (!strings) return '';
    
    // Gestisci sia array che oggetto singolo
    const stringArray = Array.isArray(strings) ? strings : [strings];
    
    for (const s of stringArray) {
      // Gestisci diverse strutture XML
      let stringKey = '';
      let stringValue = '';
      
      // Estrai la chiave
      if (s.Key) {
        const keyValue = Array.isArray(s.Key) ? s.Key[0] : s.Key;
        stringKey = typeof keyValue === 'string' ? keyValue : (keyValue?._ || keyValue?.$?.Key || String(keyValue || ''));
      } else if (s.$ && s.$.Key) {
        stringKey = s.$.Key;
      }
      
      // Estrai il valore - xml2js può restituire diversi formati:
      // 1. Stringa semplice: "valore"
      // 2. Oggetto con testo: { "_": "valore", "$": {...} }
      // 3. Solo attributi: { "$": {...} }
      if (s.Value) {
        const value = Array.isArray(s.Value) ? s.Value[0] : s.Value;
        
        if (typeof value === 'string') {
          // Caso 1: stringa semplice
          stringValue = value;
        } else if (value && typeof value === 'object') {
          // Caso 2 o 3: oggetto XML
          // xml2js mette il testo in "_" quando ci sono attributi
          if (value._ !== undefined) {
            stringValue = typeof value._ === 'string' ? value._ : String(value._ || '');
          } else if (value.$ && value.$.Value) {
            // Alcuni parser mettono il valore negli attributi
            stringValue = value.$.Value;
          } else {
            // Se non c'è testo, è probabilmente vuoto (solo attributi)
            stringValue = '';
          }
        } else {
          stringValue = String(value || '');
        }
      } else if (s._ !== undefined) {
        // Valore diretto senza attributi
        stringValue = typeof s._ === 'string' ? s._ : String(s._ || '');
      }
      
      if (stringKey === key) {
        // Assicurati di restituire sempre una stringa
        const result = stringValue || '';
        return typeof result === 'string' ? result : String(result);
      }
    }
    
    return '';
  };

  // Helper: Processa ricorsivamente i gruppi
  const processGroup = async (groupNode, parentId, clientId, client) => {
    try {
      // Estrai nome gruppo (gestisci sia array che oggetto)
      let groupName = 'Senza nome';
      if (groupNode.Name) {
        groupName = Array.isArray(groupNode.Name) ? groupNode.Name[0] : groupNode.Name;
      }
      
      // Estrai UUID gruppo
      let groupUuid = null;
      if (groupNode.UUID) {
        groupUuid = Array.isArray(groupNode.UUID) ? groupNode.UUID[0] : groupNode.UUID;
      }
      
      // Estrai note gruppo
      let groupNotes = '';
      if (groupNode.Notes) {
        groupNotes = Array.isArray(groupNode.Notes) ? groupNode.Notes[0] : groupNode.Notes;
      }

      // Inserisci il gruppo
      const groupResult = await client.query(
        `INSERT INTO keepass_groups (name, parent_id, client_id, uuid, notes) 
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [groupName, parentId, clientId, groupUuid, groupNotes]
      );
      const groupId = groupResult.rows[0].id;

      // Processa le entry del gruppo (gestisci sia array che oggetto singolo)
      if (groupNode.Entry) {
        const entries = Array.isArray(groupNode.Entry) ? groupNode.Entry : [groupNode.Entry];
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          try {
            // Prova prima con 'Title', poi con 'Name' se Title è vuoto
            let title = getStringValue(entry.String, 'Title');
            if (!title || title.trim() === '') {
              title = getStringValue(entry.String, 'Name');
            }
            
            const username = getStringValue(entry.String, 'UserName');
            let password = getStringValue(entry.String, 'Password');
            const url = getStringValue(entry.String, 'URL');
            const notes = getStringValue(entry.String, 'Notes');
            
            if (typeof password !== 'string') {
              if (password && typeof password === 'object') {
                password = password._ !== undefined ? String(password._ || '') : '';
              } else {
                password = String(password || '');
              }
            }

            // Estrai UUID entry
            let entryUuid = null;
            if (entry.UUID) {
              entryUuid = Array.isArray(entry.UUID) ? entry.UUID[0] : entry.UUID;
            }
            
            // Estrai IconID entry (default 0 se non presente)
            let iconId = 0;
            if (entry.IconID !== undefined) {
              const iconIdValue = Array.isArray(entry.IconID) ? entry.IconID[0] : entry.IconID;
              iconId = parseInt(iconIdValue) || 0;
            }

            // Estrai e verifica la password
            // Assicurati che password sia sempre una stringa
            let passwordString = '';
            if (typeof password === 'string') {
              passwordString = password;
            } else if (password && typeof password === 'object') {
              // Se è un oggetto, estrai il testo da _ (xml2js mette il testo qui quando ci sono attributi)
              // Se _ non esiste, il valore è vuoto (solo attributi come ProtectInMemory)
              passwordString = password._ !== undefined ? String(password._ || '') : '';
            } else {
              passwordString = password ? String(password) : '';
            }
            
            // Se la password è vuota, salta questa entry
            if (!passwordString || passwordString.trim() === '') {
              continue;
            }

            const encryptedPassword = encryptPassword(passwordString);
            if (!encryptedPassword) {
              throw new Error(`Errore nella cifratura della password per entry: ${title || 'Senza titolo'}`);
            }

            await client.query(
              `INSERT INTO keepass_entries (group_id, title, username, password_encrypted, url, notes, uuid, icon_id) 
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [groupId, title || 'Senza titolo', username || '', encryptedPassword, url || '', notes || '', entryUuid, iconId]
            );
          } catch (entryErr) {
            console.error(`    ❌ Errore inserimento entry ${i + 1}:`, entryErr);
            console.error(`    Stack:`, entryErr.stack);
            // Rilancia l'errore per abortire la transazione
            // Non continuiamo se c'è un errore di database
            throw entryErr;
          }
        }
      }

      // Processa i sottogruppi ricorsivamente (gestisci sia array che oggetto singolo)
      if (groupNode.Group) {
        const subGroups = Array.isArray(groupNode.Group) ? groupNode.Group : [groupNode.Group];
        for (const subGroup of subGroups) {
          await processGroup(subGroup, groupId, clientId, client);
        }
      }

      return groupId;
    } catch (groupErr) {
      console.error('Errore processamento gruppo:', groupErr);
      throw groupErr;
    }
  };

  // POST /api/keepass/import - Importa file XML KeePass (solo tecnico)
  router.post('/import', upload.single('xmlFile'), async (req, res) => {
    try {
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

      const clientCheck = await pool.query('SELECT id, email FROM users WHERE id = $1 AND ruolo = $2', 
        [clientId, 'cliente']);
      if (clientCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Cliente non trovato' });
      }

      let xmlContent;
      try {
        if (req.file.path && fs.existsSync(req.file.path)) {
          xmlContent = fs.readFileSync(req.file.path, 'utf8');
        } else if (req.file.buffer) {
          xmlContent = req.file.buffer.toString('utf8');
        } else {
          return res.status(400).json({ error: 'Impossibile leggere il file XML' });
        }
      } catch (readErr) {
        console.error('❌ Errore lettura file XML:', readErr);
        return res.status(400).json({ error: 'Errore nella lettura del file XML: ' + readErr.message });
      }

      let result;
      try {
        const parser = new xml2js.Parser({ 
          explicitArray: true, 
          mergeAttrs: false,
          ignoreAttrs: false,
          trim: true,
          explicitCharkey: true,  // Usa _ per il testo quando ci sono attributi
          explicitRoot: false
        });
        result = await parser.parseStringPromise(xmlContent);
      } catch (parseErr) {
        console.error('❌ Errore parsing XML:', parseErr);
        console.error('Stack:', parseErr.stack);
        return res.status(400).json({ error: 'Errore nel parsing del file XML: ' + parseErr.message });
      }

      // Gestisci diversi formati possibili del risultato XML
      // Con explicitRoot: false, potrebbe essere direttamente KeePassFile o contenere altri wrapper
      let keePassFile = null;
      
      if (result.KeePassFile) {
        keePassFile = result.KeePassFile;
      } else if (result.Root) {
        // Se c'è direttamente Root, wrappa in KeePassFile
        keePassFile = { Root: result.Root };
      } else {
        const keys = Object.keys(result);
        for (const key of keys) {
          if (key.toLowerCase().includes('keepass') || result[key]?.Root) {
            keePassFile = result[key];
            break;
          }
        }
      }

      if (!keePassFile) {
        console.error('❌ Struttura XML non riconosciuta. Chiavi disponibili:', Object.keys(result));
        return res.status(400).json({ 
          error: 'Formato XML non valido: manca tag KeePassFile',
          details: `Chiavi trovate: ${Object.keys(result).join(', ')}`
        });
      }

      // Gestisci sia Root come array che come oggetto
      const rootElement = Array.isArray(keePassFile.Root) 
        ? keePassFile.Root[0] 
        : keePassFile.Root;
      
      if (!rootElement) {
        return res.status(400).json({ error: 'Formato XML non valido: manca tag Root' });
      }

      // Gestisci sia Group come array che come oggetto
      const rootGroup = Array.isArray(rootElement.Group) 
        ? rootElement.Group[0] 
        : rootElement.Group;
      
      if (!rootGroup) {
        return res.status(400).json({ error: 'Nessun gruppo trovato nel file XML' });
      }

      
      // Verifica che le tabelle esistano
      try {
        const tableCheck = await pool.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name IN ('keepass_groups', 'keepass_entries')
        `);
        if (tableCheck.rows.length < 2) {
          console.error('❌ Tabelle keepass mancanti! Chiama /api/init-db per crearle.');
          return res.status(500).json({ 
            error: 'Tabelle database non inizializzate',
            details: 'Le tabelle keepass_groups e keepass_entries non esistono. Contatta l\'amministratore.'
          });
        }
      } catch (tableErr) {
        console.error('❌ Errore verifica tabelle:', tableErr);
        return res.status(500).json({ 
          error: 'Errore verifica database',
          details: tableErr.message
        });
      }
      
      const client = await pool.connect();
      let transactionStarted = false;
      try {
        await client.query('BEGIN');
        transactionStarted = true;

        // Elimina eventuali dati esistenti per questo cliente
        try {
          await client.query('DELETE FROM keepass_entries WHERE group_id IN (SELECT id FROM keepass_groups WHERE client_id = $1)', [clientId]);
          await client.query('DELETE FROM keepass_groups WHERE client_id = $1', [clientId]);
        } catch (deleteErr) {
          console.error('❌ Errore eliminazione dati esistenti:', deleteErr);
          throw deleteErr;
        }

        // Processa tutti i gruppi dalla root
        try {
          await processGroup(rootGroup, null, clientId, client);
        } catch (processErr) {
          console.error('❌ Errore processamento gruppi:', processErr);
          throw processErr;
        }

        await client.query('COMMIT');
        transactionStarted = false;

        // Elimina il file temporaneo se esiste
        if (req.file.path && fs.existsSync(req.file.path)) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (unlinkErr) {
            console.warn('Impossibile eliminare file temporaneo:', unlinkErr);
          }
        }

        res.json({ 
          message: 'File KeePass importato con successo',
          clientEmail: clientCheck.rows[0].email
        });
      } catch (dbErr) {
        console.error('❌ Errore database durante transazione:', dbErr);
        console.error('Stack:', dbErr.stack);
        if (transactionStarted) {
          try {
            await client.query('ROLLBACK');
          } catch (rollbackErr) {
            console.error('❌ Errore durante rollback:', rollbackErr);
          }
        }
        throw dbErr;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('❌ Errore import KeePass:', err);
      console.error('Stack trace:', err.stack);
      
      // Elimina il file temporaneo in caso di errore
      if (req.file) {
        if (req.file.path && fs.existsSync(req.file.path)) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (unlinkErr) {
            console.warn('Impossibile eliminare file temporaneo:', unlinkErr);
          }
        }
      }

      // Fornisci un messaggio di errore più dettagliato
      const errorMessage = err.message || 'Errore sconosciuto durante l\'importazione';
      res.status(500).json({ 
        error: 'Errore durante l\'importazione del file KeePass',
        details: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
    }
  });

  // GET /api/keepass/credentials - Ottieni credenziali per il cliente loggato
  router.get('/credentials', async (req, res) => {
    try {
      // Usa req.user.id dal middleware authenticateToken invece di req.headers
      const userId = req.user?.id || req.headers['x-user-id'];
      const role = req.user?.ruolo || (req.headers['x-user-role'] || '').toString();

      if (!userId) {
        console.error('❌ Utente non autenticato - req.user:', req.user, 'headers:', req.headers['x-user-id']);
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
              e.notes,
              e.icon_id
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
              e.notes,
              e.icon_id
            FROM keepass_groups g
            LEFT JOIN keepass_entries e ON e.group_id = g.id
            LEFT JOIN users u ON u.id = g.client_id
            ORDER BY u.email, g.name, e.title
          `;
          params = [];
        }
      } else if (role === 'cliente') {
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
            e.notes,
            e.icon_id
          FROM keepass_groups g
          LEFT JOIN keepass_entries e ON e.group_id = g.id
          WHERE g.client_id = $1
          ORDER BY g.name, e.title
        `;
        params = [userId];
      } else {
        return res.status(403).json({ error: 'Ruolo non autorizzato' });
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
            entries: [],
            children: [] // Aggiungi array per i figli
          });
        }

        if (row.entry_id) {
          // Helper per estrarre stringa da campo che potrebbe essere JSON
          const extractString = (value) => {
            if (!value) return '';
            if (typeof value === 'string') {
              if (value.trim().startsWith('{')) {
                try {
                  const parsed = JSON.parse(value);
                  return parsed._ !== undefined ? String(parsed._ || '') : value;
                } catch {
                  return value;
                }
              }
              return value;
            }
            if (typeof value === 'object') {
              return value._ !== undefined ? String(value._ || '') : JSON.stringify(value);
            }
            return String(value || '');
          };
          
          groupsMap.get(row.group_id).entries.push({
            id: row.entry_id,
            title: extractString(row.title) || 'Senza titolo',
            username: extractString(row.username) || '',
            password_encrypted: row.password_encrypted, // Password cifrata, non decifrata
            url: extractString(row.url) || '',
            notes: extractString(row.notes) || '',
            icon_id: row.icon_id || 0
          });
        }
      });

      // Costruisci la struttura ad albero
      const rootGroups = [];
      const allGroups = Array.from(groupsMap.values());
      
      allGroups.forEach(group => {
        if (group.parent_id === null) {
          // Gruppo root
          rootGroups.push(group);
        } else {
          // Trova il gruppo padre e aggiungi questo come figlio
          const parent = allGroups.find(g => g.id === group.parent_id);
          if (parent) {
            if (!parent.children) {
              parent.children = [];
            }
            parent.children.push(group);
          } else {
            // Se il padre non esiste, è comunque un root
            rootGroups.push(group);
          }
        }
      });
      
      // Helper per estrarre stringa (riutilizzato)
      const extractString = (value) => {
        if (!value) return '';
        if (typeof value === 'string') {
          if (value.trim().startsWith('{')) {
            try {
              const parsed = JSON.parse(value);
              return parsed._ !== undefined ? String(parsed._ || '') : value;
            } catch {
              return value;
            }
          }
          return value;
        }
        if (typeof value === 'object') {
          return value._ !== undefined ? String(value._ || '') : JSON.stringify(value);
        }
        return String(value || '');
      };
      
      // Ordina ricorsivamente i gruppi e le entry
      const sortGroups = (groups) => {
        groups.sort((a, b) => {
          const nameA = extractString(a.name).toLowerCase();
          const nameB = extractString(b.name).toLowerCase();
          return nameA.localeCompare(nameB);
        });
        
        groups.forEach(group => {
          if (group.children && group.children.length > 0) {
            sortGroups(group.children);
          }
          if (group.entries && group.entries.length > 0) {
            group.entries.sort((a, b) => {
              const titleA = extractString(a.title).toLowerCase();
              const titleB = extractString(b.title).toLowerCase();
              return titleA.localeCompare(titleB);
            });
          }
        });
      };
      
      sortGroups(rootGroups);

      res.json({ groups: rootGroups });
    } catch (err) {
      console.error('Errore recupero credenziali:', err);
      res.status(500).json({ error: 'Errore nel recupero delle credenziali' });
    }
  });

  // POST /api/keepass/decrypt-password - Decifra password per visualizzazione
  // Accetta sia entryId (per entry del database) che password_encrypted (per entry da Drive)
  router.post('/decrypt-password', async (req, res) => {
    try {
      // Usa req.user.id dal middleware authenticateToken invece di req.headers
      const userId = req.user?.id || req.headers['x-user-id'];
      const role = req.user?.ruolo || (req.headers['x-user-role'] || '').toString();
      const { entryId, password_encrypted } = req.body;

      if (!userId) {
        console.error('❌ Parametri mancanti - userId:', userId);
        return res.status(400).json({ error: 'Parametri mancanti: userId' });
      }

      let encryptedPassword = null;

      // Se viene fornita password_encrypted direttamente (entry da Drive), usala
      if (password_encrypted) {
        encryptedPassword = password_encrypted;
      } else if (entryId) {
        // Se viene fornito entryId (entry del database), caricala dal database

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
          console.error('❌ Credenziale non trovata o non autorizzata - entryId:', entryId, 'userId:', userId);
          return res.status(404).json({ error: 'Credenziale non trovata o non autorizzata' });
        }

        encryptedPassword = entryCheck.rows[0].password_encrypted;
      } else {
        console.error('❌ Parametri mancanti - entryId o password_encrypted richiesti');
        return res.status(400).json({ error: 'Parametri mancanti: entryId o password_encrypted richiesti' });
      }
      
      // Se la password è un oggetto (JSON salvato come stringa), prova a parsarla
      if (typeof encryptedPassword === 'object' && encryptedPassword !== null) {
        encryptedPassword = JSON.stringify(encryptedPassword);
      }

      if (typeof encryptedPassword === 'string' && encryptedPassword.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(encryptedPassword);
          // Se è un oggetto con campo _, estrai il valore
          if (parsed._ !== undefined) {
            encryptedPassword = String(parsed._ || '');
          } else {
            encryptedPassword = '';
          }
        } catch (parseErr) {
          console.error('❌ Errore parsing JSON password:', parseErr);
          encryptedPassword = '';
        }
      }
      
      if (!encryptedPassword || encryptedPassword.trim() === '') {
        return res.json({ 
          password: '',
          warning: 'Password vuota o non cifrata. Reimporta il file XML per correggere.'
        });
      }

      // Verifica che sia nel formato corretto (iv:encrypted)
      if (!encryptedPassword.includes(':')) {
        return res.json({ 
          password: '',
          warning: 'Password in formato non supportato. Reimporta il file XML per correggere.'
        });
      }

      const decryptedPassword = decryptPassword(encryptedPassword);

      if (decryptedPassword === null) {
        return res.json({ 
          password: '',
          warning: 'Errore nella decifratura. La password potrebbe essere in un formato non supportato. Reimporta il file XML.'
        });
      }

      res.json({ password: decryptedPassword });
    } catch (err) {
      console.error('❌ Errore decifratura password:', err);
      console.error('Stack:', err.stack);
      res.status(500).json({ error: 'Errore nella decifratura della password', details: err.message });
    }
  });

  // POST /api/keepass/migrate - Migra e corregge tutte le credenziali esistenti (solo tecnici)
  // GET /api/keepass/search - Ricerca veloce credenziali nel database
  router.get('/search', async (req, res) => {
    try {
      const userId = req.user?.id || req.headers['x-user-id'];
      const role = req.user?.ruolo || (req.headers['x-user-role'] || '').toString();
      const searchTerm = req.query.q || '';

      if (!userId) {
        return res.status(401).json({ error: 'Utente non autenticato' });
      }

      if (!searchTerm || searchTerm.trim().length < 2) {
        return res.json({ results: [] });
      }

      const cleanTerm = searchTerm.trim().toLowerCase();

      // Query più semplice: carica tutti i dati e filtra in JavaScript
      // Questo evita problemi con JSON nel database
      let query, params;
      if (role === 'tecnico') {
        query = `
          SELECT 
            e.id,
            e.title,
            e.username,
            e.url,
            e.notes,
            g.id as group_id,
            g.name as group_name,
            g.parent_id as group_parent_id,
            g.client_id,
            u.email as client_email
          FROM keepass_entries e
          JOIN keepass_groups g ON g.id = e.group_id
          LEFT JOIN users u ON u.id = g.client_id
          WHERE e.title IS NOT NULL
          ORDER BY e.id
          LIMIT 100
        `;
        params = [];
      } else if (role === 'cliente') {
        query = `
          SELECT 
            e.id,
            e.title,
            e.username,
            e.url,
            e.notes,
            g.id as group_id,
            g.name as group_name,
            g.parent_id as group_parent_id,
            g.client_id
          FROM keepass_entries e
          JOIN keepass_groups g ON g.id = e.group_id
          WHERE g.client_id = $1
          AND e.title IS NOT NULL
          ORDER BY e.id
          LIMIT 100
        `;
        params = [userId];
      } else {
        return res.status(403).json({ error: 'Ruolo non autorizzato' });
      }

      let result;
      try {
        result = await pool.query(query, params);
      } catch (sqlError) {
        console.error('Errore SQL ricerca KeePass:', sqlError.message);
        throw sqlError;
      }
      
      // Helper per estrarre stringa da campo che potrebbe essere JSON
      const extractString = (value) => {
        if (!value) return '';
        if (typeof value === 'string') {
          if (value.trim().startsWith('{')) {
            try {
              const parsed = JSON.parse(value);
              return parsed._ !== undefined ? String(parsed._ || '') : value;
            } catch {
              return value;
            }
          }
          return value;
        }
        if (typeof value === 'object') {
          return value._ !== undefined ? String(value._ || '') : JSON.stringify(value);
        }
        return String(value || '');
      };
      
      // Carica tutti i gruppi per costruire la mappa dei percorsi
      const groupsQuery = role === 'tecnico'
        ? 'SELECT id, name, parent_id FROM keepass_groups'
        : 'SELECT id, name, parent_id FROM keepass_groups WHERE client_id = $1';
      const groupsParams = role === 'tecnico' ? [] : [userId];
      const groupsResult = await pool.query(groupsQuery, groupsParams);
      
      // Crea una mappa di tutti i gruppi per accesso rapido
      const groupsMap = new Map();
      groupsResult.rows.forEach(group => {
        groupsMap.set(group.id, {
          id: group.id,
          name: group.name,
          parent_id: group.parent_id
        });
      });
      
      // Funzione per costruire il percorso completo di un gruppo
      const buildGroupPath = (groupId) => {
        const path = [];
        let currentGroupId = groupId;
        
        while (currentGroupId) {
          const group = groupsMap.get(currentGroupId);
          if (!group) break;
          
          const groupName = extractString(group.name);
          if (groupName) {
            path.unshift(groupName); // Aggiungi all'inizio
          }
          
          currentGroupId = group.parent_id;
        }
        
        return path.join('>');
      };

      // Estrai tutti i valori e filtra in JavaScript
      const allResults = result.rows.map(row => {
        const title = extractString(row.title);
        const username = extractString(row.username);
        const url = extractString(row.url);
        const notes = extractString(row.notes);
        const groupName = extractString(row.group_name);
        const groupPath = buildGroupPath(row.group_id);
        
        return {
          id: row.id,
          title,
          username,
          url,
          notes,
          groupName,
          groupPath,
          client_id: row.client_id,
          client_email: row.client_email || null
        };
      });

      // Filtra i risultati in base al termine di ricerca
      const searchLower = cleanTerm.toLowerCase();
      const results = allResults.filter(row => {
        // Cerca nel titolo, username, url, notes, groupName
        const titleMatch = row.title && row.title.toLowerCase().includes(searchLower);
        const usernameMatch = row.username && row.username.toLowerCase().includes(searchLower);
        const urlMatch = row.url && row.url.toLowerCase().includes(searchLower);
        const notesMatch = row.notes && row.notes.toLowerCase().includes(searchLower);
        const groupMatch = row.groupName && row.groupName.toLowerCase().includes(searchLower);
        
        // Se trova una corrispondenza, includi il risultato (anche se title è "Senza titolo")
        if (titleMatch || usernameMatch || urlMatch || notesMatch || groupMatch) {
          // Filtra solo se il titolo è completamente vuoto o null, non se è "Senza titolo"
          // perché "Senza titolo" potrebbe essere un titolo valido se la ricerca è in altri campi
          if (!row.title || row.title.trim() === '') {
            return false; // Escludi solo se title è completamente vuoto
          }
          return true;
        }
        
        return false;
      }).slice(0, 15); // Limita a 15 risultati

      res.json({ results });
    } catch (err) {
      console.error('❌ Errore ricerca KeePass:', err);
      res.status(500).json({ error: 'Errore durante la ricerca' });
    }
  });

  // GET /api/keepass/search-drive - Ricerca password da Keepass Drive filtrata per azienda
  // Legge direttamente da Google Drive senza bisogno di import XML
  router.get('/search-drive', async (req, res) => {
    try {
      const userId = req.user?.id || req.headers['x-user-id'];
      const role = req.user?.ruolo || (req.headers['x-user-role'] || '').toString();
      const searchTerm = req.query.q || '';

      if (!userId) {
        return res.status(401).json({ error: 'Utente non autenticato' });
      }

      // Ottieni il nome azienda dell'utente se è cliente
      let aziendaName = null;
      if (role === 'cliente') {
        const userResult = await pool.query('SELECT azienda FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length > 0 && userResult.rows[0].azienda) {
          aziendaName = userResult.rows[0].azienda;
        }
      } else if (role === 'tecnico') {
        // I tecnici possono specificare un'azienda opzionalmente
        aziendaName = req.query.azienda || null;
      } else {
        return res.status(403).json({ error: 'Ruolo non autorizzato' });
      }

      if (!aziendaName) {
        return res.status(400).json({ error: 'Nome azienda non specificato' });
      }

      // Ottieni la password Keepass dall'environment
      const keepassPassword = process.env.KEEPASS_PASSWORD;
      if (!keepassPassword) {
        return res.status(500).json({ error: 'Password Keepass non configurata' });
      }

      // Carica tutte le entry Keepass filtrate per azienda
      const allEntries = await keepassDriveService.getAllEntriesByAzienda(keepassPassword, aziendaName);

      // Se c'è un termine di ricerca, filtra i risultati
      const cleanTerm = searchTerm.trim().toLowerCase();
      let filteredEntries = allEntries;

      if (cleanTerm && cleanTerm.length >= 2) {
        filteredEntries = allEntries.filter(entry => {
          // Ricerca SOLO nel campo "Nome utente" (username)
          // Match "inizia con" (startsWith) invece di "contiene" (includes)
          // Es. "francesco" trova "francesco", "francesco123" ma NON "fran" o "alfran"
          if (!entry.username) return false;
          const usernameLower = entry.username.toLowerCase();
          return usernameLower.startsWith(cleanTerm);
        });
      }

      // Cripta le password prima di inviarle
      const results = filteredEntries.slice(0, 15).map(entry => ({
        title: entry.title || 'Senza titolo',
        username: entry.username || '',
        password_encrypted: encryptPassword(entry.password), // Cripta la password
        url: entry.url || '',
        notes: entry.notes || '',
        groupPath: entry.groupPath || '',
        icon_id: entry.icon_id || 0
      }));

      res.json({ results });
    } catch (err) {
      console.error('❌ Errore ricerca KeePass Drive:', err);
      res.status(500).json({ error: 'Errore durante la ricerca', details: err.message });
    }
  });

  router.post('/migrate', async (req, res) => {
    // Verifica manuale del ruolo (requireRole potrebbe non funzionare correttamente)
    if (!req.user) {
      console.error('❌ Migrazione: utente non autenticato');
      return res.status(401).json({ error: 'Utente non autenticato' });
    }
    
    if (req.user.ruolo !== 'tecnico') {
      console.error(`❌ Migrazione: accesso negato per ${req.user.email} (ruolo: ${req.user.ruolo})`);
      return res.status(403).json({ error: 'Accesso negato: solo tecnici possono eseguire la migrazione' });
    }
    
    
    const client = await pool.connect();
    try {
      
      // Estrai tutte le entry dal database
      const allEntries = await client.query(`
        SELECT 
          e.id,
          e.group_id,
          e.title,
          e.username,
          e.password_encrypted,
          e.url,
          e.notes,
          g.client_id
        FROM keepass_entries e
        JOIN keepass_groups g ON g.id = e.group_id
        ORDER BY e.id
      `);
      
      
      let updated = 0;
      let errors = 0;
      const errorsList = [];
      
      // Helper: Estrae stringa da campo che potrebbe essere oggetto JSON
      const extractString = (value) => {
        if (!value) return '';
        if (typeof value === 'string') {
          // Se è una stringa JSON, prova a parsarla
          if (value.trim().startsWith('{')) {
            try {
              const parsed = JSON.parse(value);
              return parsed._ !== undefined ? String(parsed._ || '') : value;
            } catch {
              return value;
            }
          }
          return value;
        }
        if (typeof value === 'object') {
          // Se è un oggetto, estrai il valore da _
          return value._ !== undefined ? String(value._ || '') : JSON.stringify(value);
        }
        return String(value || '');
      };
      
      // Helper: Verifica se password è vuota o in formato non valido
      const isPasswordEmpty = (encryptedPassword) => {
        if (!encryptedPassword || encryptedPassword.trim() === '') {
          return true;
        }
        
        // Se è un oggetto JSON, è vuota
        if (typeof encryptedPassword === 'object') {
          // Se è un oggetto PostgreSQL, potrebbe essere un oggetto JSON
          // Controlla se ha solo attributi senza valore
          if (encryptedPassword.$ && Object.keys(encryptedPassword).length === 1) {
            return true; // Solo attributi, nessun valore
          }
          return true;
        }
        
        // Se è una stringa JSON, prova a parsarla
        if (typeof encryptedPassword === 'string' && encryptedPassword.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(encryptedPassword);
            // Se ha solo attributi senza valore (come {"$":{"ProtectInMemory":"True"}}), è vuota
            if (parsed.$ && Object.keys(parsed).length === 1) {
              return true; // Solo attributi, nessun valore
            }
            // Se ha campo _ ma è vuoto, è vuota
            if (parsed._ === undefined || parsed._ === '') {
              return true;
            }
            return false;
          } catch {
            // Se non è JSON valido, potrebbe essere una password cifrata
            // Ma se non contiene ':', non è nel formato corretto
            return !encryptedPassword.includes(':');
          }
        }
        
        // Se non è nel formato iv:encrypted, potrebbe essere vuota
        if (!encryptedPassword.includes(':')) {
          return true;
        }
        
        return false;
      };
      
      for (const entry of allEntries.rows) {
        try {
          let needsUpdate = false;
          const updates = {};
          
          // 1. Verifica password vuota (solo per logging, non eliminiamo)
          const isEmpty = isPasswordEmpty(entry.password_encrypted);
          if (isEmpty) {
          }
          
          // 2. Verifica e correggi titolo
          const titleString = extractString(entry.title);
          if (titleString !== entry.title) {
            updates.title = titleString;
            needsUpdate = true;
          }
          
          // 3. Verifica e correggi username
          const usernameString = extractString(entry.username);
          if (usernameString !== entry.username) {
            updates.username = usernameString;
            needsUpdate = true;
          }
          
          // 4. Verifica e correggi URL
          const urlString = extractString(entry.url);
          if (urlString !== entry.url) {
            updates.url = urlString;
            needsUpdate = true;
          }
          
          // 5. Verifica e correggi notes
          const notesString = extractString(entry.notes);
          if (notesString !== entry.notes) {
            updates.notes = notesString;
            needsUpdate = true;
          }
          
          // Esegui aggiornamento (NON eliminiamo entry con password vuote)
          if (needsUpdate) {
            const updateFields = Object.keys(updates).map((key, idx) => `${key} = $${idx + 2}`).join(', ');
            const updateValues = Object.values(updates);
            await client.query(
              `UPDATE keepass_entries SET ${updateFields} WHERE id = $1`,
              [entry.id, ...updateValues]
            );
            updated++;
          }
        } catch (err) {
          errors++;
          errorsList.push({ entryId: entry.id, error: err.message });
          console.error(`❌ Errore processamento entry ${entry.id}:`, err.message);
        }
      }
      
      // Aggiorna anche i nomi dei gruppi
      const allGroups = await client.query('SELECT id, name FROM keepass_groups ORDER BY id');
      
      let groupsUpdated = 0;
      for (const group of allGroups.rows) {
        const nameString = extractString(group.name);
        if (nameString !== group.name) {
          await client.query('UPDATE keepass_groups SET name = $1 WHERE id = $2', [nameString, group.id]);
          groupsUpdated++;
        }
      }
      
      
      res.json({
        success: true,
        summary: {
          entriesUpdated: updated,
          groupsUpdated: groupsUpdated,
          errors: errors,
          totalProcessed: allEntries.rows.length
        },
        errors: errorsList.length > 0 ? errorsList : undefined
      });
    } catch (err) {
      console.error('❌ Errore migrazione:', err);
      console.error('Stack:', err.stack);
      res.status(500).json({ 
        error: 'Errore durante la migrazione',
        details: err.message 
      });
    } finally {
      client.release();
    }
  });

  // GET /api/keepass/has-credentials/:clientId - Verifica se un cliente ha già credenziali
  router.get('/has-credentials/:clientId', async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Utente non autenticato' });
      }

      const role = req.user?.ruolo || (req.headers['x-user-role'] || '').toString();
      if (role !== 'tecnico') {
        return res.status(403).json({ error: 'Solo i tecnici possono verificare le credenziali' });
      }

      const clientId = parseInt(req.params.clientId, 10);
      if (isNaN(clientId)) {
        return res.status(400).json({ error: 'ID cliente non valido' });
      }

      const result = await pool.query(
        'SELECT COUNT(*) as count FROM keepass_groups WHERE client_id = $1',
        [clientId]
      );

      const hasCredentials = parseInt(result.rows[0].count, 10) > 0;
      
      res.json({ 
        hasCredentials,
        count: parseInt(result.rows[0].count, 10)
      });
    } catch (err) {
      console.error('❌ Errore verifica credenziali:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // DELETE /api/keepass/credentials/:clientId - Cancella tutte le credenziali di un cliente
  router.delete('/credentials/:clientId', async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Utente non autenticato' });
      }

      const role = req.user?.ruolo || (req.headers['x-user-role'] || '').toString();
      if (role !== 'tecnico') {
        return res.status(403).json({ error: 'Solo i tecnici possono cancellare le credenziali' });
      }

      const clientId = parseInt(req.params.clientId, 10);
      if (isNaN(clientId)) {
        return res.status(400).json({ error: 'ID cliente non valido' });
      }

      // Verifica che il cliente esista
      const clientCheck = await pool.query('SELECT id, email FROM users WHERE id = $1 AND ruolo = $2', [clientId, 'cliente']);
      if (clientCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Cliente non trovato' });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Elimina prima le entry (per via del foreign key constraint)
        const deleteEntries = await client.query(
          'DELETE FROM keepass_entries WHERE group_id IN (SELECT id FROM keepass_groups WHERE client_id = $1)',
          [clientId]
        );

        // Poi elimina i gruppi
        const deleteGroups = await client.query(
          'DELETE FROM keepass_groups WHERE client_id = $1',
          [clientId]
        );

        await client.query('COMMIT');


        res.json({ 
          message: 'Credenziali eliminate con successo',
          groupsDeleted: deleteGroups.rowCount,
          entriesDeleted: deleteEntries.rowCount,
          clientEmail: clientCheck.rows[0].email
        });
      } catch (dbErr) {
        await client.query('ROLLBACK');
        throw dbErr;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('❌ Errore cancellazione credenziali:', err);
      res.status(500).json({ error: 'Errore interno del server', details: err.message });
    }
  });

  // Configurazione multer per allegati segnalazioni
  const reportStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(__dirname, '..', 'uploads', 'keepass-reports');
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
      cb(null, `report-${uniqueSuffix}-${baseName}${ext}`);
    }
  });

  const uploadReportFiles = multer({
    storage: reportStorage,
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB per file
      files: 10 // Max 10 files
    }
  });

  /**
   * POST /api/keepass/report-issue
   * Crea una segnalazione/problema dalla sezione KeePass
   * Può essere associata a una credenziale specifica o essere una segnalazione generica
   */
  router.post('/report-issue', uploadReportFiles.any(), async (req, res) => {
    try {
      const userId = req.user?.id || parseInt(req.headers['x-user-id']);
      const userRole = req.user?.ruolo || req.headers['x-user-role'];

      if (!userId) {
        return res.status(401).json({ error: 'Utente non autenticato' });
      }

      const {
        titolo,
        descrizione,
        tipo, // 'informazione', 'avviso', 'critico'
        fonte, // 'keepass'
        credenziale_titolo,
        credenziale_username,
        credenziale_url,
        credenziale_path
      } = req.body;

      // Validazione
      if (!titolo || !descrizione) {
        return res.status(400).json({ error: 'Titolo e descrizione sono obbligatori' });
      }

      const tipiValidi = ['informazione', 'avviso', 'critico'];
      if (tipo && !tipiValidi.includes(tipo)) {
        return res.status(400).json({ error: 'Tipo non valido. Usa: informazione, avviso, critico' });
      }

      // Prepara i percorsi degli allegati
      const allegatiPaths = req.files ? req.files.map(file => file.path) : [];
      const allegatiNames = req.files ? req.files.map(file => file.originalname) : [];

      // Crea una entry nella tabella keepass_reports
      // Prima verifica se la tabella esiste, altrimenti creala
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS keepass_reports (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          titolo TEXT NOT NULL,
          descrizione TEXT NOT NULL,
          tipo VARCHAR(50) DEFAULT 'informazione',
          fonte VARCHAR(50) DEFAULT 'keepass',
          credenziale_titolo TEXT,
          credenziale_username TEXT,
          credenziale_url TEXT,
          credenziale_path TEXT,
          allegati_paths TEXT[],
          allegati_names TEXT[],
          stato VARCHAR(50) DEFAULT 'aperto',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          resolved_at TIMESTAMP,
          resolved_by INTEGER,
          note_risoluzione TEXT
        )
      `;
      await pool.query(createTableQuery);

      // Inserisci la segnalazione
      const insertQuery = `
        INSERT INTO keepass_reports (
          user_id, titolo, descrizione, tipo, fonte,
          credenziale_titolo, credenziale_username, credenziale_url, credenziale_path,
          allegati_paths, allegati_names
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `;
      
      const result = await pool.query(insertQuery, [
        userId,
        titolo,
        descrizione,
        tipo || 'informazione',
        fonte || 'keepass',
        credenziale_titolo || null,
        credenziale_username || null,
        credenziale_url || null,
        credenziale_path || null,
        allegatiPaths.length > 0 ? allegatiPaths : null,
        allegatiNames.length > 0 ? allegatiNames : null
      ]);

      const reportId = result.rows[0].id;


      // Crea anche un avviso nella tabella alerts per renderlo visibile negli "Avvisi Importanti"
      try {
        // Mappa il tipo della segnalazione al level dell'avviso
        const tipoToLevel = {
          'informazione': 'info',
          'avviso': 'warning',
          'critico': 'danger'
        };
        const alertLevel = tipoToLevel[tipo] || 'info';

        // Costruisci il body dell'avviso con i dettagli della segnalazione
        let alertBody = descrizione;
        
        // Se è associata a una credenziale, aggiungi i dettagli
        if (credenziale_titolo || credenziale_username || credenziale_url || credenziale_path) {
          alertBody += '\n\n📋 Credenziale associata:\n';
          if (credenziale_path) alertBody += `📁 Percorso: ${credenziale_path}\n`;
          if (credenziale_titolo) alertBody += `🏷️ Titolo: ${credenziale_titolo}\n`;
          if (credenziale_username) alertBody += `👤 Username: ${credenziale_username}\n`;
          if (credenziale_url) alertBody += `🔗 URL: ${credenziale_url}\n`;
        }

        // Aggiungi info sugli allegati
        if (allegatiNames.length > 0) {
          alertBody += `\n📎 Allegati (${allegatiNames.length}): ${allegatiNames.join(', ')}`;
        }

        // Inserisci l'avviso nella tabella alerts
        // L'avviso è destinato solo al cliente che ha creato la segnalazione
        const alertQuery = `
          INSERT INTO alerts (
            title, body, level, clients, is_permanent, days_to_expire, created_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `;
        
        const alertResult = await pool.query(alertQuery, [
          `🔐 ${titolo}`, // Aggiungi emoji per distinguere le segnalazioni KeePass
          alertBody,
          alertLevel,
          JSON.stringify([userId]), // Solo per il cliente che ha creato la segnalazione
          false, // Non permanente
          7, // Scade dopo 7 giorni
          userId.toString() // Salva l'ID del cliente come created_by per permettergli di modificarlo/eliminarlo
        ]);

        const alertId = alertResult.rows[0].id;

      } catch (alertErr) {
        console.error('⚠️ Errore creazione avviso (segnalazione comunque salvata):', alertErr);
        // Non bloccare la risposta se la creazione dell'avviso fallisce
      }

      // Invia notifica Telegram al tecnico
      try {
        const clientResult = await pool.query(
          'SELECT nome, cognome, email, azienda FROM users WHERE id = $1',
          [userId]
        );
        const cliente = clientResult.rows[0];

        await telegramService.notifyKeePassReport({
          reportId,
          titolo,
          tipo: tipo || 'informazione',
          descrizione,
          cliente: cliente || { nome: 'Sconosciuto', cognome: '', azienda: '' },
          credenziale: {
            title: credenziale_titolo,
            username: credenziale_username,
            url: credenziale_url,
            groupPath: credenziale_path
          }
        });
      } catch (telegramErr) {
        console.error('⚠️ Errore invio notifica Telegram (segnalazione comunque salvata):', telegramErr.message);
      }

      // Invia email al tecnico
      try {
        const nodemailer = require('nodemailer');
        const emailUser = process.env.EMAIL_USER;
        const emailPass = process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS;

        if (emailUser && emailPass) {
          // Recupera informazioni cliente
          const clientResult = await pool.query(
            'SELECT nome, cognome, email, azienda FROM users WHERE id = $1',
            [userId]
          );
          const cliente = clientResult.rows[0];

          // Recupera email di tutti i tecnici
          const tecniciResult = await pool.query(
            'SELECT email, nome, cognome FROM users WHERE ruolo = $1 AND email IS NOT NULL',
            ['tecnico']
          );

          if (tecniciResult.rows.length > 0) {
            // Configurazione trasporter (rileva automaticamente Gmail/Aruba)
            const isAruba = emailUser.includes('@logikaservice.it') || emailUser.includes('@aruba.it');
            const isGmail = emailUser.includes('@gmail.com');
            
            let smtpConfig;
            if (isAruba) {
              smtpConfig = {
                host: 'smtps.aruba.it',
                port: 465,
                secure: true,
                auth: { user: emailUser, pass: emailPass },
                tls: { rejectUnauthorized: false, minVersion: 'TLSv1.2' }
              };
            } else if (isGmail) {
              smtpConfig = {
                service: 'gmail',
                auth: { user: emailUser, pass: emailPass }
              };
            } else {
              smtpConfig = {
                host: 'smtp.' + emailUser.split('@')[1],
                port: 587,
                secure: false,
                auth: { user: emailUser, pass: emailPass }
              };
            }

            const transporter = nodemailer.createTransport(smtpConfig);

            // Mappa tipo per emoji e colore
            const tipoEmoji = {
              'informazione': 'ℹ️',
              'avviso': '⚠️',
              'critico': '🚨'
            };
            const tipoColor = {
              'informazione': '#3b82f6',
              'avviso': '#f59e0b',
              'critico': '#ef4444'
            };

            // Componi email HTML
            let emailBody = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, ${tipoColor[tipo] || '#3b82f6'} 0%, ${tipoColor[tipo] || '#1e40af'} 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0;">
                  <h2 style="margin: 0;">${tipoEmoji[tipo] || '🔐'} Nuova Segnalazione KeePass</h2>
                  <p style="margin: 5px 0 0 0; opacity: 0.9;">Tipo: <strong>${tipo.charAt(0).toUpperCase() + tipo.slice(1)}</strong></p>
                </div>
                
                <div style="background: #f9fafb; padding: 20px; border-left: 4px solid ${tipoColor[tipo] || '#3b82f6'};">
                  <h3 style="margin-top: 0; color: #1f2937;">${titolo}</h3>
                  <p style="color: #4b5563; white-space: pre-wrap;">${descrizione}</p>
                </div>
            `;

            // Aggiungi dettagli credenziale se presenti
            if (credenziale_titolo || credenziale_username || credenziale_url || credenziale_path) {
              emailBody += `
                <div style="background: white; padding: 20px; border-left: 4px solid #8b5cf6;">
                  <h4 style="margin-top: 0; color: #1f2937;">📋 Credenziale Associata</h4>
              `;
              if (credenziale_path) emailBody += `<p style="margin: 5px 0;"><strong>📁 Percorso:</strong> ${credenziale_path}</p>`;
              if (credenziale_titolo) emailBody += `<p style="margin: 5px 0;"><strong>🏷️ Titolo:</strong> ${credenziale_titolo}</p>`;
              if (credenziale_username) emailBody += `<p style="margin: 5px 0;"><strong>👤 Username:</strong> ${credenziale_username}</p>`;
              if (credenziale_url) emailBody += `<p style="margin: 5px 0;"><strong>🔗 URL:</strong> <a href="${credenziale_url}" target="_blank">${credenziale_url}</a></p>`;
              emailBody += `</div>`;
            }

            // Aggiungi info cliente
            emailBody += `
              <div style="background: #eff6ff; padding: 20px; margin-top: 1px;">
                <h4 style="margin-top: 0; color: #1f2937;">👤 Segnalato da</h4>
                <p style="margin: 5px 0;"><strong>Cliente:</strong> ${cliente.nome} ${cliente.cognome}</p>
                <p style="margin: 5px 0;"><strong>Email:</strong> ${cliente.email}</p>
                ${cliente.azienda ? `<p style="margin: 5px 0;"><strong>Azienda:</strong> ${cliente.azienda}</p>` : ''}
              </div>
            `;

            // Aggiungi info allegati
            if (allegatiNames.length > 0) {
              emailBody += `
                <div style="background: #fef3c7; padding: 20px; margin-top: 1px;">
                  <h4 style="margin-top: 0; color: #1f2937;">📎 Allegati (${allegatiNames.length})</h4>
                  <ul style="margin: 5px 0; padding-left: 20px;">
                    ${allegatiNames.map(name => `<li>${name}</li>`).join('')}
                  </ul>
                </div>
              `;
            }

            emailBody += `
              <div style="background: #f3f4f6; padding: 15px; text-align: center; border-radius: 0 0 10px 10px;">
                <p style="margin: 0; color: #6b7280; font-size: 12px;">
                  Questa email è stata generata automaticamente dal Sistema di Gestione Ticket
                </p>
              </div>
            </div>
            `;

            // Invia email a tutti i tecnici (ASINCRONO - non blocca la risposta HTTP)
            for (const tecnico of tecniciResult.rows) {
              // NON uso await - l'email viene inviata in background
              transporter.sendMail({
                from: emailUser,
                to: tecnico.email,
                subject: `${tipoEmoji[tipo] || '🔐'} Nuova Segnalazione KeePass: ${titolo}`,
                html: emailBody
              })
              .then(() => {
              })
              .catch(emailErr => {
                console.error(`❌ Errore invio email a ${tecnico.email}:`, emailErr.message);
              });
            }
          }
        }
      } catch (emailErr) {
        console.error('⚠️ Errore invio email tecnici (segnalazione comunque salvata):', emailErr.message);
        // Non bloccare la risposta se l'invio email fallisce
      }

      res.json({
        success: true,
        message: 'Segnalazione inviata con successo! Il team tecnico la prenderà in carico al più presto.',
        reportId: reportId
      });
    } catch (err) {
      console.error('❌ Errore creazione segnalazione KeePass:', err);
      res.status(500).json({ error: 'Errore interno del server', details: err.message });
    }
  });

  // GET /api/keepass/office/:aziendaName - Recupera dati Office da Keepass
  router.get('/office/:aziendaName', authenticateToken, async (req, res) => {
    try {
      const userRole = req.user?.ruolo;
      const adminCompanies = req.user?.admin_companies || [];

      // Verifica permessi: solo tecnici o amministratori aziendali
      if (userRole !== 'tecnico' && userRole !== 'admin') {
        if (userRole === 'cliente' && (!adminCompanies || adminCompanies.length === 0)) {
          return res.status(403).json({ error: 'Accesso negato: permessi insufficienti' });
        }
      }

      let { aziendaName } = req.params;
      try {
        aziendaName = decodeURIComponent(aziendaName);
      } catch (e) {}
      aziendaName = aziendaName.split(':')[0].trim();

      const keepassPassword = process.env.KEEPASS_PASSWORD;
      if (!keepassPassword) {
        return res.status(500).json({ error: 'Password Keepass non configurata' });
      }
      if (!aziendaName) {
        return res.status(400).json({ error: 'Nome azienda richiesto' });
      }

      const officeData = await keepassDriveService.getOfficeData(keepassPassword, aziendaName);

      if (!officeData) {
        return res.status(404).json({ error: 'Office non trovato per questa azienda' });
      }

      res.json(officeData);
    } catch (err) {
      console.error('❌ Errore recupero Office:', err);
      res.status(500).json({ error: 'Errore durante il recupero dei dati Office' });
    }
  });

  // === Tabella office_card_status: scaduta (sì/no) e nota per ogni scheda Office ===
  const ensureOfficeCardStatusTable = async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS office_card_status (
        id SERIAL PRIMARY KEY,
        azienda_name VARCHAR(255) NOT NULL,
        card_title VARCHAR(500) NOT NULL,
        card_username VARCHAR(500) NOT NULL DEFAULT '',
        is_expired BOOLEAN NOT NULL DEFAULT false,
        note TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(azienda_name, card_title, card_username)
      )
    `);
  };
  ensureOfficeCardStatusTable().catch(err => console.warn('⚠️ Errore creazione tabella office_card_status:', err.message));

  // GET /api/keepass/office-card-status/:aziendaName — stato scaduta+nota per tutte le card di un'azienda
  router.get('/office-card-status/:aziendaName', authenticateToken, async (req, res) => {
    try {
      let { aziendaName } = req.params;
      try { aziendaName = decodeURIComponent(aziendaName); } catch (e) {}
      aziendaName = aziendaName.split(':')[0].trim();
      await ensureOfficeCardStatusTable();
      const result = await pool.query(
        'SELECT card_title, card_username, is_expired, note FROM office_card_status WHERE azienda_name = $1',
        [aziendaName]
      );
      res.json(result.rows);
    } catch (err) {
      console.error('❌ Errore recupero office-card-status:', err);
      res.status(500).json({ error: 'Errore interno' });
    }
  });

  // PUT /api/keepass/office-card-status — aggiorna scaduta+nota per una card
  router.put('/office-card-status', authenticateToken, async (req, res) => {
    try {
      const userRole = req.user?.ruolo;
      if (userRole !== 'tecnico' && userRole !== 'admin') {
        return res.status(403).json({ error: 'Solo tecnici/admin possono modificare' });
      }
      const { azienda_name, card_title, card_username, is_expired, note } = req.body;
      if (!azienda_name || !card_title) {
        return res.status(400).json({ error: 'azienda_name e card_title obbligatori' });
      }
      await ensureOfficeCardStatusTable();
      await pool.query(
        `INSERT INTO office_card_status (azienda_name, card_title, card_username, is_expired, note, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (azienda_name, card_title, card_username)
         DO UPDATE SET is_expired = $4, note = $5, updated_at = NOW()`,
        [azienda_name, card_title, card_username || '', is_expired === true, note || '']
      );
      res.json({ success: true });
    } catch (err) {
      console.error('❌ Errore aggiornamento office-card-status:', err);
      res.status(500).json({ error: 'Errore interno' });
    }
  });

  // Migrazione tabella email_expiry_info (scadenza editabile come Anti-Virus)
  const ensureEmailExpiryTable = async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_expiry_info (
        id SERIAL PRIMARY KEY,
        azienda_name VARCHAR(255) NOT NULL,
        title VARCHAR(500) NOT NULL,
        username VARCHAR(500) NOT NULL,
        url TEXT NOT NULL DEFAULT '',
        divider VARCHAR(255) NOT NULL DEFAULT '',
        expiration_date DATE,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(azienda_name, title, username, url, divider)
      )
    `);
  };

  // GET /api/keepass/email-upcoming-expiries?days=30 - Email in scadenza entro N giorni (solo tecnico/admin, per Avvisi Importanti)
  router.get('/email-upcoming-expiries', authenticateToken, async (req, res) => {
    try {
      const userRole = req.user?.ruolo;
      if (userRole !== 'tecnico' && userRole !== 'admin') {
        return res.status(403).json({ error: 'Accesso negato' });
      }
      const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 30));
      const keepassPassword = process.env.KEEPASS_PASSWORD;
      if (!keepassPassword) {
        return res.status(500).json({ error: 'Password Keepass non configurata' });
      }
      const now = new Date();
      const limit = new Date(now);
      limit.setDate(limit.getDate() + days);
      const aziendeResult = await pool.query(
        `SELECT TRIM(u.azienda) AS azienda FROM users u WHERE u.ruolo = 'cliente' AND u.azienda IS NOT NULL AND TRIM(u.azienda) != '' GROUP BY TRIM(u.azienda) ORDER BY azienda`
      );
      const aziendeNames = (aziendeResult.rows || []).map(r => (r.azienda || '').split(':')[0].trim()).filter(Boolean);
      const results = await keepassDriveService.getEmailUpcomingExpiriesAll(keepassPassword, aziendeNames, now, limit);
      res.json(results);
    } catch (err) {
      console.error('❌ Errore email-upcoming-expiries:', err);
      res.status(500).json({ error: 'Errore interno' });
    }
  });

  // GET /api/keepass/email/:aziendaName - Recupera struttura Email da Keepass (cartella Email, righe divisorie @)
  router.get('/email/:aziendaName', authenticateToken, async (req, res) => {
    try {
      const userRole = req.user?.ruolo;
      const adminCompanies = req.user?.admin_companies || [];
      if (userRole !== 'tecnico' && userRole !== 'admin') {
        if (userRole === 'cliente' && (!adminCompanies || adminCompanies.length === 0)) {
          return res.status(403).json({ error: 'Accesso negato' });
        }
      }

      let { aziendaName } = req.params;
      try { aziendaName = decodeURIComponent(aziendaName); } catch (e) {}
      aziendaName = aziendaName.split(':')[0].trim();

      const keepassPassword = process.env.KEEPASS_PASSWORD;
      if (!keepassPassword) {
        return res.status(500).json({ error: 'Password Keepass non configurata' });
      }
      if (!aziendaName) {
        return res.status(400).json({ error: 'Nome azienda richiesto' });
      }

      const structure = await keepassDriveService.getEmailStructureByAzienda(keepassPassword, aziendaName);
      // Scadenza ora letta da KeePass (entry.times.expiryTime); non più da email_expiry_info
      res.json({ items: structure });
    } catch (err) {
      console.error('❌ Errore recupero Email:', err);
      res.status(500).json({ error: 'Errore durante il recupero dei dati Email' });
    }
  });

  // PUT /api/keepass/email-expiry - Salva scadenza per entry Email (come Anti-Virus)
  router.put('/email-expiry', authenticateToken, requireRole(['tecnico', 'admin']), async (req, res) => {
    try {
      const { aziendaName, title, username, url, divider, expiration_date } = req.body;
      if (!aziendaName || !title || username === undefined) {
        return res.status(400).json({ error: 'aziendaName, title e username richiesti' });
      }

      await ensureEmailExpiryTable();
      const urlVal = url != null ? String(url) : '';
      const divVal = divider != null ? String(divider) : '';
      await pool.query(`
        INSERT INTO email_expiry_info (azienda_name, title, username, url, divider, expiration_date, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (azienda_name, title, username, url, divider) 
        DO UPDATE SET expiration_date = EXCLUDED.expiration_date, updated_at = NOW()
      `, [aziendaName, title || '', username || '', urlVal, divVal, expiration_date || null]);

      res.json({ success: true });
    } catch (err) {
      console.error('❌ Errore salvataggio scadenza Email:', err);
      res.status(500).json({ error: 'Errore salvataggio scadenza' });
    }
  });

  return router;
};

