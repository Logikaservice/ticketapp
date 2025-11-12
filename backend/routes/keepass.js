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
  // AES-256 richiede una chiave di 32 bytes (64 caratteri hex)
  const ENCRYPTION_KEY = process.env.KEEPASS_ENCRYPTION_KEY || 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2';
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
      console.log(`🔐 Password cifrata (lunghezza originale: ${passwordToEncrypt.length}, cifrata: ${result.length})`);
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
      console.log('⚠️ decryptPassword: encryptedPassword è null o vuoto');
      return null;
    }
    
    // Se la password è una stringa vuota cifrata, potrebbe essere solo ':'
    if (encryptedPassword === '' || encryptedPassword.trim() === '') {
      console.log('⚠️ decryptPassword: encryptedPassword è stringa vuota');
      return '';
    }
    
    try {
      const parts = encryptedPassword.split(':');
      console.log('🔓 decryptPassword: parts.length =', parts.length);
      
      if (parts.length !== 2) {
        console.error('❌ decryptPassword: formato errato, parts.length =', parts.length);
        console.error('❌ encryptedPassword (primi 100 caratteri):', encryptedPassword.substring(0, 100));
        return null;
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      const key = getEncryptionKey();
      
      console.log('🔓 decryptPassword: IV length =', iv.length, 'encrypted length =', encrypted.length);
      
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      console.log('✅ decryptPassword: decifratura riuscita, lunghezza =', decrypted.length);
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
      
      if (s.Key) {
        stringKey = Array.isArray(s.Key) ? s.Key[0] : s.Key;
      } else if (s.$.Key) {
        stringKey = s.$.Key;
      }
      
      if (s.Value) {
        stringValue = Array.isArray(s.Value) ? s.Value[0] : s.Value;
      } else if (s._) {
        stringValue = s._;
      }
      
      if (stringKey === key) {
        return stringValue || '';
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
      console.log(`  📁 Processando gruppo: "${groupName}"`);
      
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
      console.log(`  💾 Inserimento gruppo nel database...`);
      const groupResult = await client.query(
        `INSERT INTO keepass_groups (name, parent_id, client_id, uuid, notes) 
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [groupName, parentId, clientId, groupUuid, groupNotes]
      );
      const groupId = groupResult.rows[0].id;
      console.log(`  ✅ Gruppo inserito con ID: ${groupId}`);

      // Processa le entry del gruppo (gestisci sia array che oggetto singolo)
      if (groupNode.Entry) {
        const entries = Array.isArray(groupNode.Entry) ? groupNode.Entry : [groupNode.Entry];
        console.log(`  📝 Trovate ${entries.length} entry nel gruppo`);
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          try {
            const title = getStringValue(entry.String, 'Title');
            const username = getStringValue(entry.String, 'UserName');
            const password = getStringValue(entry.String, 'Password');
            const url = getStringValue(entry.String, 'URL');
            const notes = getStringValue(entry.String, 'Notes');
            
            console.log(`    📄 Entry ${i + 1}/${entries.length}: "${title || 'Senza titolo'}"`);
            
            // Estrai UUID entry
            let entryUuid = null;
            if (entry.UUID) {
              entryUuid = Array.isArray(entry.UUID) ? entry.UUID[0] : entry.UUID;
            }

            // Cifra la password (cifra sempre, anche se vuota)
            console.log(`    🔐 Password estratta, lunghezza: ${password?.length || 0}`);
            const encryptedPassword = encryptPassword(password);
            
            if (!encryptedPassword) {
              console.error(`    ❌ ERRORE: Password non cifrata per entry "${title || 'Senza titolo'}"`);
              throw new Error(`Errore nella cifratura della password per entry: ${title || 'Senza titolo'}`);
            }
            
            console.log(`    ✅ Password cifrata con successo, lunghezza cifrata: ${encryptedPassword.length}`);
            
            // Assicurati che password_encrypted non sia null (campo NOT NULL)
            const finalEncryptedPassword = encryptedPassword;
            
            await client.query(
              `INSERT INTO keepass_entries (group_id, title, username, password_encrypted, url, notes, uuid) 
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [groupId, title || 'Senza titolo', username || '', finalEncryptedPassword, url || '', notes || '', entryUuid]
            );
            console.log(`    ✅ Entry inserita`);
          } catch (entryErr) {
            console.error(`    ❌ Errore inserimento entry ${i + 1}:`, entryErr);
            console.error(`    Stack:`, entryErr.stack);
            // Rilancia l'errore per abortire la transazione
            // Non continuiamo se c'è un errore di database
            throw entryErr;
          }
        }
      } else {
        console.log(`  ℹ️ Nessuna entry trovata nel gruppo`);
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
    console.log('📥 Ricevuta richiesta import KeePass');
    try {
      // Verifica ruolo tecnico
      const role = (req.headers['x-user-role'] || req.body?.role || '').toString();
      console.log('👤 Ruolo utente:', role);
      if (role !== 'tecnico') {
        return res.status(403).json({ error: 'Solo i tecnici possono importare file KeePass' });
      }

      if (!req.file) {
        console.log('❌ File non ricevuto');
        return res.status(400).json({ error: 'File XML mancante' });
      }

      console.log('📄 File ricevuto:', req.file.originalname, 'Size:', req.file.size);

      const { clientId } = req.body;
      console.log('👥 Client ID:', clientId);
      if (!clientId) {
        return res.status(400).json({ error: 'ID cliente mancante' });
      }

      // Verifica che il cliente esista
      console.log('🔍 Verifica cliente nel database...');
      const clientCheck = await pool.query('SELECT id, email FROM users WHERE id = $1 AND ruolo = $2', 
        [clientId, 'cliente']);
      if (clientCheck.rows.length === 0) {
        console.log('❌ Cliente non trovato:', clientId);
        return res.status(404).json({ error: 'Cliente non trovato' });
      }
      console.log('✅ Cliente trovato:', clientCheck.rows[0].email);

      // Leggi e parsea il file XML
      console.log('📖 Lettura file XML...');
      let xmlContent;
      try {
        // Prova a leggere da file path (diskStorage) o da buffer (memoryStorage)
        if (req.file.path && fs.existsSync(req.file.path)) {
          console.log('📁 Leggo da path:', req.file.path);
          xmlContent = fs.readFileSync(req.file.path, 'utf8');
        } else if (req.file.buffer) {
          console.log('💾 Leggo da buffer');
          xmlContent = req.file.buffer.toString('utf8');
        } else {
          console.log('❌ Nessun metodo disponibile per leggere il file');
          return res.status(400).json({ error: 'Impossibile leggere il file XML' });
        }
        console.log('✅ File letto, dimensione:', xmlContent.length, 'caratteri');
      } catch (readErr) {
        console.error('❌ Errore lettura file XML:', readErr);
        return res.status(400).json({ error: 'Errore nella lettura del file XML: ' + readErr.message });
      }

      console.log('🔍 Parsing XML...');
      let result;
      try {
        const parser = new xml2js.Parser({ 
          explicitArray: true, 
          mergeAttrs: false,
          ignoreAttrs: false,
          trim: true
        });
        result = await parser.parseStringPromise(xmlContent);
        console.log('✅ XML parsato con successo');
        console.log('📋 Struttura root:', Object.keys(result));
      } catch (parseErr) {
        console.error('❌ Errore parsing XML:', parseErr);
        console.error('Stack:', parseErr.stack);
        return res.status(400).json({ error: 'Errore nel parsing del file XML: ' + parseErr.message });
      }

      if (!result.KeePassFile) {
        return res.status(400).json({ error: 'Formato XML non valido: manca tag KeePassFile' });
      }

      // Gestisci sia Root come array che come oggetto
      const rootElement = Array.isArray(result.KeePassFile.Root) 
        ? result.KeePassFile.Root[0] 
        : result.KeePassFile.Root;
      
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

      console.log('💾 Connessione al database...');
      
      // Verifica che le tabelle esistano
      try {
        const tableCheck = await pool.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name IN ('keepass_groups', 'keepass_entries')
        `);
        console.log('📊 Tabelle trovate:', tableCheck.rows.map(r => r.table_name));
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
        console.log('✅ Transazione iniziata');

        // Elimina eventuali dati esistenti per questo cliente
        console.log('🗑️ Eliminazione dati esistenti per cliente...');
        try {
          await client.query('DELETE FROM keepass_entries WHERE group_id IN (SELECT id FROM keepass_groups WHERE client_id = $1)', [clientId]);
          await client.query('DELETE FROM keepass_groups WHERE client_id = $1', [clientId]);
          console.log('✅ Dati esistenti eliminati');
        } catch (deleteErr) {
          console.error('❌ Errore eliminazione dati esistenti:', deleteErr);
          throw deleteErr;
        }

        // Processa tutti i gruppi dalla root
        console.log('🔄 Processamento gruppi...');
        try {
          await processGroup(rootGroup, null, clientId, client);
          console.log('✅ Gruppi processati');
        } catch (processErr) {
          console.error('❌ Errore processamento gruppi:', processErr);
          throw processErr;
        }

        await client.query('COMMIT');
        transactionStarted = false;
        console.log('✅ Transazione completata');

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
            console.log('✅ Rollback eseguito');
          } catch (rollbackErr) {
            console.error('❌ Errore durante rollback:', rollbackErr);
          }
        }
        throw dbErr;
      } finally {
        client.release();
        console.log('🔌 Connessione database rilasciata');
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

      console.log('🔍 Recupero credenziali per utente:', userId, 'ruolo:', role);

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
            e.notes
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
      // Usa req.user.id dal middleware authenticateToken invece di req.headers
      const userId = req.user?.id || req.headers['x-user-id'];
      const role = req.user?.ruolo || (req.headers['x-user-role'] || '').toString();
      const { entryId } = req.body;

      if (!userId || !entryId) {
        console.error('❌ Parametri mancanti - userId:', userId, 'entryId:', entryId);
        return res.status(400).json({ error: 'Parametri mancanti' });
      }

      console.log('🔓 Decifratura password per entry:', entryId, 'utente:', userId, 'ruolo:', role);

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

      const encryptedPassword = entryCheck.rows[0].password_encrypted;
      console.log('🔐 Password cifrata trovata, lunghezza:', encryptedPassword?.length || 0);
      console.log('🔐 Password cifrata (primi 50 caratteri):', encryptedPassword?.substring(0, 50) || 'vuota');

      if (!encryptedPassword || encryptedPassword.trim() === '') {
        console.warn('⚠️ Password cifrata vuota per entry:', entryId);
        console.warn('⚠️ Questo significa che la password era vuota durante l\'import o non è stata cifrata correttamente');
        console.warn('⚠️ Soluzione: reimporta il file XML KeePass per cifrare correttamente tutte le password');
        return res.json({ 
          password: '',
          warning: 'Password vuota o non cifrata. Reimporta il file XML per correggere.'
        });
      }

      console.log('🔓 Tentativo decifratura...');
      const decryptedPassword = decryptPassword(encryptedPassword);
      console.log('🔓 Risultato decifratura:', decryptedPassword ? `lunghezza ${decryptedPassword.length}` : 'null/vuota');

      if (!decryptedPassword) {
        console.error('❌ Errore nella decifratura - encryptedPassword:', encryptedPassword?.substring(0, 50));
        console.error('❌ Formato password cifrata:', encryptedPassword?.includes(':') ? 'formato corretto (iv:encrypted)' : 'formato errato');
        return res.status(500).json({ error: 'Errore nella decifratura della password', details: 'La password potrebbe essere vuota o in un formato non supportato' });
      }

      console.log('✅ Password decifrata con successo, lunghezza:', decryptedPassword.length);
      res.json({ password: decryptedPassword });
    } catch (err) {
      console.error('❌ Errore decifratura password:', err);
      console.error('Stack:', err.stack);
      res.status(500).json({ error: 'Errore nella decifratura della password', details: err.message });
    }
  });

  return router;
};

