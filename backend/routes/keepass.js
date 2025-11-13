// backend/routes/keepass.js

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const xml2js = require('xml2js');
const crypto = require('crypto');
const { requireRole } = require('../middleware/authMiddleware');

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
            // Debug: mostra tutti i campi String disponibili per la prima entry
            if (i === 0 && entry.String) {
              const stringArray = Array.isArray(entry.String) ? entry.String : [entry.String];
              console.log(`    🔍 Campi String disponibili nella prima entry:`, stringArray.map(s => {
                let key = '';
                if (s.Key) {
                  const keyValue = Array.isArray(s.Key) ? s.Key[0] : s.Key;
                  key = typeof keyValue === 'string' ? keyValue : (keyValue?._ || keyValue?.$?.Key || String(keyValue || ''));
                } else if (s.$ && s.$.Key) {
                  key = s.$.Key;
                }
                return key;
              }).filter(Boolean));
            }
            
            // Prova prima con 'Title', poi con 'Name' se Title è vuoto
            let title = getStringValue(entry.String, 'Title');
            if (!title || title.trim() === '') {
              title = getStringValue(entry.String, 'Name');
            }
            
            const username = getStringValue(entry.String, 'UserName');
            let password = getStringValue(entry.String, 'Password');
            const url = getStringValue(entry.String, 'URL');
            const notes = getStringValue(entry.String, 'Notes');
            
            // Debug: verifica tipo password dopo getStringValue
            if (typeof password !== 'string') {
              console.warn(`    ⚠️ getStringValue ha restituito un ${typeof password} invece di stringa:`, password);
              // Se è ancora un oggetto, prova a estrarre il valore manualmente
              if (password && typeof password === 'object') {
                password = password._ !== undefined ? String(password._ || '') : '';
                console.warn(`    🔧 Password convertita manualmente, nuova lunghezza: ${password.length}`);
              } else {
                password = String(password || '');
              }
            }
            
            console.log(`    📄 Entry ${i + 1}/${entries.length}: "${title || 'Senza titolo'}"`);
            
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
              if (passwordString === '' && password.$) {
                console.log(`    ℹ️ Password vuota (solo attributi ProtectInMemory nel XML)`);
              }
            } else {
              passwordString = password ? String(password) : '';
            }
            
            console.log(`    🔐 Password estratta, tipo originale: ${typeof password}, lunghezza: ${passwordString.length}`);
            
            // Se la password è vuota, salta questa entry
            if (!passwordString || passwordString.trim() === '') {
              console.log(`    ⏭️ Password vuota, salto questa entry: "${title || 'Senza titolo'}"`);
              continue; // Salta questa entry e passa alla successiva
            }
            
            if (typeof password !== 'string' && password) {
              console.warn(`    ⚠️ Password non era una stringa, valore originale:`, password);
            }
            
            // Cifra la password (ora sappiamo che non è vuota)
            const encryptedPassword = encryptPassword(passwordString);
            
            if (!encryptedPassword) {
              console.error(`    ❌ ERRORE: Password non cifrata per entry "${title || 'Senza titolo'}"`);
              throw new Error(`Errore nella cifratura della password per entry: ${title || 'Senza titolo'}`);
            }
            
            console.log(`    ✅ Password cifrata con successo, lunghezza cifrata: ${encryptedPassword.length}`);
            
            // Assicurati che password_encrypted non sia null (campo NOT NULL)
            const finalEncryptedPassword = encryptedPassword;
            
            await client.query(
              `INSERT INTO keepass_entries (group_id, title, username, password_encrypted, url, notes, uuid, icon_id) 
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [groupId, title || 'Senza titolo', username || '', finalEncryptedPassword, url || '', notes || '', entryUuid, iconId]
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
          trim: true,
          explicitCharkey: true,  // Usa _ per il testo quando ci sono attributi
          explicitRoot: false
        });
        result = await parser.parseStringPromise(xmlContent);
        console.log('✅ XML parsato con successo');
        console.log('📋 Struttura root:', Object.keys(result));
        console.log('📋 Contenuto root (primi 200 caratteri):', JSON.stringify(result).substring(0, 200));
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
        // Prova a cercare in qualsiasi chiave del risultato
        const keys = Object.keys(result);
        console.log('🔍 Chiavi trovate nel risultato:', keys);
        for (const key of keys) {
          if (key.toLowerCase().includes('keepass') || result[key]?.Root) {
            keePassFile = result[key];
            console.log('✅ Trovato KeePassFile in chiave:', key);
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

      console.log('📤 Invio credenziali al frontend:');
      console.log(`   - Gruppi root: ${rootGroups.length}`);
      console.log(`   - Totale gruppi (con children): ${allGroups.length}`);
      
      if (rootGroups.length > 0) {
        const totalEntries = allGroups.reduce((sum, g) => sum + (g.entries?.length || 0), 0);
        console.log(`   - Totale entry: ${totalEntries}`);
        console.log(`   - Primo gruppo root: "${rootGroups[0].name}" (${rootGroups[0].entries?.length || 0} entries, ${rootGroups[0].children?.length || 0} children)`);
      }

      res.json({ groups: rootGroups });
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

      let encryptedPassword = entryCheck.rows[0].password_encrypted;
      console.log('🔐 Password cifrata trovata, tipo:', typeof encryptedPassword);
      console.log('🔐 Password cifrata, lunghezza:', encryptedPassword?.length || 0);
      
      // Se la password è un oggetto (JSON salvato come stringa), prova a parsarla
      if (typeof encryptedPassword === 'object' && encryptedPassword !== null) {
        console.warn('⚠️ Password cifrata è un oggetto, provo a convertire...');
        encryptedPassword = JSON.stringify(encryptedPassword);
      }
      
      // Se è una stringa che inizia con '{', potrebbe essere JSON salvato come stringa
      if (typeof encryptedPassword === 'string' && encryptedPassword.trim().startsWith('{')) {
        console.warn('⚠️ Password cifrata sembra essere JSON, provo a parsare...');
        try {
          const parsed = JSON.parse(encryptedPassword);
          // Se è un oggetto con campo _, estrai il valore
          if (parsed._ !== undefined) {
            encryptedPassword = String(parsed._ || '');
            console.log('✅ Estratto valore da oggetto JSON, nuova lunghezza:', encryptedPassword.length);
          } else {
            console.warn('⚠️ Oggetto JSON senza campo _, uso stringa vuota');
            encryptedPassword = '';
          }
        } catch (parseErr) {
          console.error('❌ Errore parsing JSON password:', parseErr);
          encryptedPassword = '';
        }
      }
      
      console.log('🔐 Password cifrata (primi 100 caratteri):', encryptedPassword?.substring(0, 100) || 'vuota');

      if (!encryptedPassword || encryptedPassword.trim() === '') {
        console.warn('⚠️ Password cifrata vuota per entry:', entryId);
        console.warn('⚠️ Questo significa che la password era vuota durante l\'import o non è stata cifrata correttamente');
        console.warn('⚠️ Soluzione: reimporta il file XML KeePass per cifrare correttamente tutte le password');
        return res.json({ 
          password: '',
          warning: 'Password vuota o non cifrata. Reimporta il file XML per correggere.'
        });
      }

      // Verifica che sia nel formato corretto (iv:encrypted)
      if (!encryptedPassword.includes(':')) {
        console.error('❌ Password cifrata non è nel formato corretto (iv:encrypted)');
        console.error('❌ Formato attuale:', encryptedPassword.substring(0, 100));
        return res.json({ 
          password: '',
          warning: 'Password in formato non supportato. Reimporta il file XML per correggere.'
        });
      }

      console.log('🔓 Tentativo decifratura...');
      const decryptedPassword = decryptPassword(encryptedPassword);
      console.log('🔓 Risultato decifratura:', decryptedPassword !== null ? `lunghezza ${decryptedPassword.length}` : 'null');

      // Restituisci stringa vuota invece di null se la decifratura restituisce null
      if (decryptedPassword === null) {
        console.error('❌ Errore nella decifratura - encryptedPassword (primi 100 caratteri):', encryptedPassword?.substring(0, 100));
        console.error('❌ Formato password cifrata:', encryptedPassword?.includes(':') ? 'formato corretto (iv:encrypted)' : 'formato errato');
        return res.json({ 
          password: '',
          warning: 'Errore nella decifratura. La password potrebbe essere in un formato non supportato. Reimporta il file XML.'
        });
      }

      console.log('✅ Password decifrata con successo, lunghezza:', decryptedPassword.length);
      res.json({ password: decryptedPassword });
    } catch (err) {
      console.error('❌ Errore decifratura password:', err);
      console.error('Stack:', err.stack);
      res.status(500).json({ error: 'Errore nella decifratura della password', details: err.message });
    }
  });

  // POST /api/keepass/migrate - Migra e corregge tutte le credenziali esistenti (solo tecnici)
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
    
    console.log(`✅ Migrazione autorizzata per: ${req.user.email} (${req.user.ruolo})`);
    
    const client = await pool.connect();
    try {
      console.log('🔄 Inizio migrazione credenziali KeePass...');
      
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
      
      console.log(`📊 Trovate ${allEntries.rows.length} entry da verificare`);
      
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
            console.log(`ℹ️ Entry ${entry.id} ("${entry.title || 'Senza titolo'}") ha password vuota - verrà mantenuta ma non mostrata`);
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
            console.log(`✅ Entry ${entry.id} ("${entry.title || 'Senza titolo'}") aggiornata:`, Object.keys(updates).join(', '));
          }
        } catch (err) {
          errors++;
          errorsList.push({ entryId: entry.id, error: err.message });
          console.error(`❌ Errore processamento entry ${entry.id}:`, err.message);
        }
      }
      
      // Aggiorna anche i nomi dei gruppi
      console.log('🔄 Verifica nomi gruppi...');
      const allGroups = await client.query('SELECT id, name FROM keepass_groups ORDER BY id');
      
      let groupsUpdated = 0;
      for (const group of allGroups.rows) {
        const nameString = extractString(group.name);
        if (nameString !== group.name) {
          await client.query('UPDATE keepass_groups SET name = $1 WHERE id = $2', [nameString, group.id]);
          groupsUpdated++;
          console.log(`✅ Gruppo ${group.id} aggiornato: name`);
        }
      }
      
      console.log('✅ Migrazione completata!');
      console.log(`📊 Riepilogo:`);
      console.log(`   - Entry aggiornate: ${updated}`);
      console.log(`   - Gruppi aggiornati: ${groupsUpdated}`);
      console.log(`   - Errori: ${errors}`);
      console.log(`   - Nota: Entry con password vuote sono state mantenute nel database`);
      
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

  return router;
};

