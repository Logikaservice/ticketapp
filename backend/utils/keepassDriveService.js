// Servizio per leggere file KeePass da Google Drive e cercare MAC address
const { google } = require('googleapis');
const { Kdbx, Credentials, ProtectedValue } = require('kdbxweb');

class KeepassDriveService {
  constructor() {
    this.macToTitleMap = null;
    this.lastCacheUpdate = null;
    this.lastFileModifiedTime = null; // Data di modifica dell'ultimo file caricato
    this.cacheTimeout = 30 * 1000; // 30 secondi di cache (ridotto per aggiornamenti più frequenti)
    this.isLoading = false;
    this.loadPromise = null;
  }

  /**
   * Ottiene l'autenticazione Google Drive
   */
  async getDriveAuth() {
    if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      throw new Error('Credenziali Google Service Account non configurate');
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        type: "service_account",
        project_id: process.env.GOOGLE_PROJECT_ID || "ticketapp-b2a2a",
        private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        client_id: process.env.GOOGLE_CLIENT_ID,
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL,
        universe_domain: "googleapis.com"
      },
      scopes: [
        'https://www.googleapis.com/auth/drive.readonly'
      ]
    });

    return await auth.getClient();
  }

  /**
   * Scarica il file keepass.kdbx da Google Drive e restituisce anche la data di modifica
   */
  async downloadKeepassFile(password) {
    try {
      const authClient = await this.getDriveAuth();
      const drive = google.drive({ version: 'v3', auth: authClient });

      let fileId;
      let fileName;
      let modifiedTime;

      // Se è specificato il file ID direttamente, usalo (più efficiente)
      if (process.env.KEEPASS_FILE_ID) {
        fileId = process.env.KEEPASS_FILE_ID;
        console.log(`📥 Usando file ID specificato: ${fileId}`);
        
        // Verifica che il file esista e ottieni la data di modifica
        try {
          const fileInfo = await drive.files.get({
            fileId: fileId,
            fields: 'id, name, modifiedTime'
          });
          fileName = fileInfo.data.name || 'keepass.kdbx';
          modifiedTime = fileInfo.data.modifiedTime;
          console.log(`📄 Nome file: ${fileName}`);
          console.log(`📅 Data modifica file: ${modifiedTime}`);
        } catch (err) {
          throw new Error(`File con ID ${fileId} non trovato su Google Drive: ${err.message}`);
        }
      } else {
        // Altrimenti cerca per nome (compatibilità con configurazione precedente)
        const fileNameToSearch = process.env.KEEPASS_FILE_NAME || 'keepass.kdbx';
        console.log(`🔍 Cercando file per nome: ${fileNameToSearch}`);
        
        const searchQuery = `name='${fileNameToSearch}' and trashed=false`;
        const response = await drive.files.list({
          q: searchQuery,
          fields: 'files(id, name, modifiedTime)',
          pageSize: 1
        });

        if (!response.data.files || response.data.files.length === 0) {
          throw new Error(`File ${fileNameToSearch} non trovato su Google Drive`);
        }

        fileId = response.data.files[0].id;
        fileName = response.data.files[0].name || fileNameToSearch;
        modifiedTime = response.data.files[0].modifiedTime;
        console.log(`📥 File trovato: ${fileName} (ID: ${fileId})`);
        console.log(`📅 Data modifica file: ${modifiedTime}`);
      }

      // Scarica il file
      const fileResponse = await drive.files.get(
        { fileId: fileId, alt: 'media' },
        { responseType: 'arraybuffer' }
      );

      return {
        buffer: Buffer.from(fileResponse.data),
        modifiedTime: modifiedTime
      };
    } catch (error) {
      console.error('❌ Errore download file KeePass da Google Drive:', error.message);
      throw error;
    }
  }

  /**
   * Normalizza un MAC address per la ricerca (rimuove separatori, uppercase)
   * Gestisce sia formato "00-FD-22-A8-34-2C" che "00:03:2D:52:DC:90"
   */
  normalizeMacForSearch(mac) {
    if (!mac) return null;
    // Rimuovi tutti i separatori (sia : che -) e converti in uppercase
    return mac.replace(/[:-]/g, '').toUpperCase();
  }

  /**
   * Estrae MAC address da un campo del KeePass (può essere in Title, UserName, Notes, URL, etc.)
   */
  extractMacFromField(value) {
    if (!value) return null;
    const str = String(value).toUpperCase();
    
    // Pattern per MAC address: XX-XX-XX-XX-XX-XX o XX:XX:XX:XX:XX:XX o XXXXXXXXXXXX
    const macPattern = /([0-9A-F]{2}[:-]){5}[0-9A-F]{2}|[0-9A-F]{12}/;
    const match = str.match(macPattern);
    
    if (match) {
      let mac = match[0];
      // Normalizza: rimuovi separatori e aggiungi trattini
      mac = mac.replace(/[:-]/g, '');
      if (mac.length === 12) {
        mac = mac.replace(/(..)(..)(..)(..)(..)(..)/, '$1-$2-$3-$4-$5-$6');
      }
      return mac.toUpperCase();
    }
    
    return null;
  }

  /**
   * Carica il file KDBX e crea la mappa MAC -> Titolo
   */
  async loadMacToTitleMap(password) {
    try {
      console.log('🔄 Caricamento mappa MAC->Titolo da KeePass...');

      // Scarica il file da Google Drive (con data di modifica)
      const fileData = await this.downloadKeepassFile(password);
      const fileBuffer = fileData.buffer;
      const modifiedTime = fileData.modifiedTime;

      // Carica il file KDBX
      const credentials = new Credentials(ProtectedValue.fromString(password));
      const db = await Kdbx.load(fileBuffer.buffer, credentials);

      console.log(`✅ File KDBX caricato: ${db.name || 'Senza nome'}`);

      // Crea la mappa MAC -> {title, path}
      const macMap = new Map();

      // Funzione ricorsiva per processare gruppi ed entry
      const processGroup = (group, groupPath = '') => {
        const currentPath = groupPath ? `${groupPath} > ${group.name || 'Root'}` : (group.name || 'Root');
        
        // Processa le entry del gruppo
        if (group.entries && group.entries.length > 0) {
          for (const entry of group.entries) {
            // kdbxweb usa entry.fields come oggetto, non come Map
            // Accediamo direttamente alle proprietà
            const titleField = entry.fields && entry.fields['Title'];
            const titleStr = titleField ? (titleField instanceof ProtectedValue ? titleField.getText() : String(titleField)) : '';

            // Cerca MAC in TUTTI i campi (inclusi campi personalizzati)
            // Prima ottieni tutti i nomi dei campi disponibili
            const allFieldNames = entry.fields ? Object.keys(entry.fields) : [];
            
            // Verifica anche se ci sono customFields (alcune versioni di kdbxweb li mettono qui)
            const customFieldNames = entry.customFields ? Object.keys(entry.customFields) : [];
            
            const standardFields = ['UserName', 'Password', 'URL', 'Notes', 'Title'];
            const fieldsToCheck = [...new Set([...standardFields, ...allFieldNames, ...customFieldNames])]; // Unisci senza duplicati
            let foundMac = null;
            let foundMacField = null;

            for (const fieldName of fieldsToCheck) {
              // Prova prima in entry.fields, poi in entry.customFields
              let fieldValue = null;
              if (entry.fields && entry.fields[fieldName]) {
                fieldValue = entry.fields[fieldName];
              } else if (entry.customFields && entry.customFields[fieldName]) {
                fieldValue = entry.customFields[fieldName];
              }
              
              if (fieldValue) {
                const valueStr = fieldValue instanceof ProtectedValue 
                  ? fieldValue.getText() 
                  : String(fieldValue);
                
                const mac = this.extractMacFromField(valueStr);
                if (mac) {
                  foundMac = mac;
                  foundMacField = fieldName;
                  break; // Prendi il primo MAC trovato
                }
              }
            }

            // Se trovato un MAC, aggiungilo alla mappa
            if (foundMac && titleStr) {
              // foundMac è già normalizzato da extractMacFromField (formato XX-XX-XX-XX-XX-XX)
              // Normalizziamo per la ricerca (rimuoviamo separatori)
              const normalizedMac = this.normalizeMacForSearch(foundMac);
              if (normalizedMac) {
                // Se ci sono più entry con lo stesso MAC, mantieni la prima trovata
                if (!macMap.has(normalizedMac)) {
                  macMap.set(normalizedMac, { title: titleStr, path: currentPath });
                  console.log(`  📝 MAC ${foundMac} (normalizzato: ${normalizedMac}) -> Titolo: "${titleStr}", Campo: "${foundMacField}", Percorso: "${currentPath}"`);
                } else {
                  console.log(`  ⚠️ MAC ${foundMac} (normalizzato: ${normalizedMac}) già presente nella mappa, ignoro duplicato`);
                }
              } else {
                console.log(`  ⚠️ MAC ${foundMac} non può essere normalizzato per la ricerca`);
              }
            }
          }
        }

        // Processa i sottogruppi
        if (group.groups && group.groups.length > 0) {
          for (const subGroup of group.groups) {
            processGroup(subGroup, currentPath);
          }
        }
      };

      // Processa tutti i gruppi root
      if (db.groups && db.groups.length > 0) {
        for (const group of db.groups) {
          processGroup(group);
        }
      }

      console.log(`✅ Mappa MAC->Titolo creata: ${macMap.size} entry trovate`);
      
      // Salva la data di modifica del file
      this.lastFileModifiedTime = modifiedTime;
      
      // Debug: mostra alcuni esempi di MAC nella mappa
      if (macMap.size > 0) {
        const examples = Array.from(macMap.entries()).slice(0, 5);
        console.log(`   Esempi MAC nella mappa:`);
        examples.forEach(([mac, result]) => {
          console.log(`     - ${mac} -> Titolo: "${result.title}", Percorso: "${result.path}"`);
        });
      } else {
        console.log(`   ⚠️ ATTENZIONE: Nessun MAC trovato nel file KeePass!`);
        console.log(`   Verifica che i MAC siano presenti nei campi (inclusi campi personalizzati)`);
      }
      
      return macMap;
    } catch (error) {
      console.error('❌ Errore caricamento mappa MAC->Titolo:', error.message);
      throw error;
    }
  }

  /**
   * Verifica se il file KeePass è stato modificato su Google Drive
   */
  async checkFileModified(password) {
    try {
      const authClient = await this.getDriveAuth();
      const drive = google.drive({ version: 'v3', auth: authClient });

      let fileId;
      if (process.env.KEEPASS_FILE_ID) {
        fileId = process.env.KEEPASS_FILE_ID;
      } else {
        const fileNameToSearch = process.env.KEEPASS_FILE_NAME || 'keepass.kdbx';
        const searchQuery = `name='${fileNameToSearch}' and trashed=false`;
        const response = await drive.files.list({
          q: searchQuery,
          fields: 'files(id)',
          pageSize: 1
        });
        if (!response.data.files || response.data.files.length === 0) {
          return null;
        }
        fileId = response.data.files[0].id;
      }

      const fileInfo = await drive.files.get({
        fileId: fileId,
        fields: 'modifiedTime'
      });

      return fileInfo.data.modifiedTime || null;
    } catch (error) {
      console.warn('⚠️ Errore verifica data modifica file KeePass:', error.message);
      return null;
    }
  }

  /**
   * Ottiene la mappa MAC->Titolo (con cache e controllo data modifica)
   */
  async getMacToTitleMap(password) {
    const now = Date.now();
    let fileModified = false;

    // Controlla se il file è stato modificato su Google Drive
    const currentModifiedTime = await this.checkFileModified(password);
    if (currentModifiedTime) {
      if (!this.lastFileModifiedTime) {
        // Prima volta che viene caricato - salva la data di modifica
        console.log('📅 Prima caricamento file KeePass');
      } else if (currentModifiedTime !== this.lastFileModifiedTime) {
        // File modificato - forza il ricaricamento
        console.log('🔄 File KeePass modificato su Google Drive - invalidazione cache e ricaricamento');
        console.log(`   Data precedente: ${this.lastFileModifiedTime}`);
        console.log(`   Data attuale: ${currentModifiedTime}`);
        this.macToTitleMap = null;
        this.lastCacheUpdate = null;
        this.lastFileModifiedTime = null;
        fileModified = true;
      }
    }

    // Se la cache è valida E il file non è stato modificato, restituiscila
    if (!fileModified && this.macToTitleMap && this.lastCacheUpdate && 
        (now - this.lastCacheUpdate) < this.cacheTimeout) {
      return this.macToTitleMap;
    }

    // Se c'è già un caricamento in corso, aspetta che finisca
    if (this.isLoading && this.loadPromise) {
      return await this.loadPromise;
    }

    // Avvia il caricamento
    this.isLoading = true;
    this.loadPromise = this.loadMacToTitleMap(password)
      .then(map => {
      this.macToTitleMap = map;
      this.lastCacheUpdate = Date.now();
      this.lastFileModifiedTime = modifiedTime; // Salva la data di modifica del file caricato
      this.isLoading = false;
      this.loadPromise = null;
      return map;
      })
      .catch(err => {
        this.isLoading = false;
        this.loadPromise = null;
        throw err;
      });

    return await this.loadPromise;
  }

  /**
   * Cerca un MAC address nel file KeePass e restituisce il Titolo corrispondente
   */
  async findMacTitle(macAddress, password) {
    try {
      if (!macAddress) {
        console.log(`ℹ️ findMacTitle chiamato con MAC null o undefined`);
        return null;
      }

      // Normalizza il MAC per la ricerca
      const normalizedMac = this.normalizeMacForSearch(macAddress);
      if (!normalizedMac) {
        console.log(`⚠️ MAC ${macAddress} non può essere normalizzato`);
        return null;
      }

      console.log(`🔍 Ricerca MAC: "${macAddress}" -> Normalizzato: "${normalizedMac}"`);

      // Ottieni la mappa (con cache)
      const macMap = await this.getMacToTitleMap(password);

      console.log(`📊 Mappa KeePass caricata: ${macMap.size} MAC address trovati`);

      // Cerca il MAC nella mappa
      const result = macMap.get(normalizedMac);
      
      if (result) {
        console.log(`✅ MAC ${macAddress} (normalizzato: ${normalizedMac}) trovato in KeePass -> Titolo: "${result.title}", Percorso: "${result.path}"`);
        return result;
      } else {
        console.log(`ℹ️ MAC ${macAddress} (normalizzato: ${normalizedMac}) non trovato in KeePass`);
        // Debug: mostra i primi 5 MAC nella mappa per confronto
        if (macMap.size > 0) {
          const first5Macs = Array.from(macMap.keys()).slice(0, 5);
          console.log(`   📋 Esempi MAC nella mappa: ${first5Macs.join(', ')}`);
        }
      }

      return null;
    } catch (error) {
      console.error(`❌ Errore ricerca MAC ${macAddress} in KeePass:`, error.message);
      console.error('Stack:', error.stack);
      // In caso di errore, non bloccare il processo, restituisci null
      return null;
    }
  }

  /**
   * Invalida la cache (forza il ricaricamento al prossimo accesso)
   */
  invalidateCache() {
    this.macToTitleMap = null;
    this.lastCacheUpdate = null;
    this.lastFileModifiedTime = null; // Reset anche la data di modifica per forzare il controllo
    console.log('🔄 Cache KeePass invalidata completamente');
  }
}

// Esporta un'istanza singleton
module.exports = new KeepassDriveService();
