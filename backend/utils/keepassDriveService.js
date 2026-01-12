// Servizio per leggere file KeePass da Google Drive e cercare MAC address
const { google } = require('googleapis');
const { Kdbx, Credentials, ProtectedValue } = require('kdbxweb');

class KeepassDriveService {
  constructor() {
    this.macToTitleMap = null;
    this.lastCacheUpdate = null;
    this.cacheTimeout = 5 * 60 * 1000; // 5 minuti di cache
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
   * Scarica il file keepass.kdbx da Google Drive
   */
  async downloadKeepassFile(password) {
    try {
      const authClient = await this.getDriveAuth();
      const drive = google.drive({ version: 'v3', auth: authClient });

      // Cerca il file keepass.kdbx
      const searchQuery = "name='keepass.kdbx' and trashed=false";
      const response = await drive.files.list({
        q: searchQuery,
        fields: 'files(id, name)',
        pageSize: 1
      });

      if (!response.data.files || response.data.files.length === 0) {
        throw new Error('File keepass.kdbx non trovato su Google Drive');
      }

      const fileId = response.data.files[0].id;
      console.log(`📥 Scaricando file keepass.kdbx (ID: ${fileId})...`);

      // Scarica il file
      const fileResponse = await drive.files.get(
        { fileId: fileId, alt: 'media' },
        { responseType: 'arraybuffer' }
      );

      return Buffer.from(fileResponse.data);
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

      // Scarica il file da Google Drive
      const fileBuffer = await this.downloadKeepassFile(password);

      // Carica il file KDBX
      const credentials = new Credentials(ProtectedValue.fromString(password));
      const db = await Kdbx.load(fileBuffer.buffer, credentials);

      console.log(`✅ File KDBX caricato: ${db.name || 'Senza nome'}`);

      // Crea la mappa MAC -> Titolo
      const macMap = new Map();

      // Funzione ricorsiva per processare gruppi ed entry
      const processGroup = (group) => {
        // Processa le entry del gruppo
        if (group.entries && group.entries.length > 0) {
          for (const entry of group.entries) {
            const title = entry.fields.get('Title');
            const titleStr = title ? (title instanceof ProtectedValue ? title.getText() : String(title)) : '';

            // Cerca MAC in vari campi
            const fieldsToCheck = ['UserName', 'Password', 'URL', 'Notes', 'Title'];
            let foundMac = null;

            for (const fieldName of fieldsToCheck) {
              const fieldValue = entry.fields.get(fieldName);
              if (fieldValue) {
                const valueStr = fieldValue instanceof ProtectedValue 
                  ? fieldValue.getText() 
                  : String(fieldValue);
                
                const mac = this.extractMacFromField(valueStr);
                if (mac) {
                  foundMac = mac;
                  break; // Prendi il primo MAC trovato
                }
              }
            }

            // Se trovato un MAC, aggiungilo alla mappa
            if (foundMac && titleStr) {
              const normalizedMac = this.normalizeMacForSearch(foundMac);
              if (normalizedMac) {
                // Se ci sono più entry con lo stesso MAC, mantieni la prima trovata
                if (!macMap.has(normalizedMac)) {
                  macMap.set(normalizedMac, titleStr);
                  console.log(`  📝 MAC ${foundMac} -> Titolo: "${titleStr}"`);
                }
              }
            }
          }
        }

        // Processa i sottogruppi
        if (group.groups && group.groups.length > 0) {
          for (const subGroup of group.groups) {
            processGroup(subGroup);
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
      return macMap;
    } catch (error) {
      console.error('❌ Errore caricamento mappa MAC->Titolo:', error.message);
      throw error;
    }
  }

  /**
   * Ottiene la mappa MAC->Titolo (con cache)
   */
  async getMacToTitleMap(password) {
    const now = Date.now();

    // Se la cache è valida, restituiscila
    if (this.macToTitleMap && this.lastCacheUpdate && 
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
      const title = macMap.get(normalizedMac);
      
      if (title) {
        console.log(`✅ MAC ${macAddress} (normalizzato: ${normalizedMac}) trovato in KeePass -> Titolo: "${title}"`);
      } else {
        console.log(`ℹ️ MAC ${macAddress} (normalizzato: ${normalizedMac}) non trovato in KeePass`);
        // Debug: mostra i primi 5 MAC nella mappa per confronto
        if (macMap.size > 0) {
          const first5Macs = Array.from(macMap.keys()).slice(0, 5);
          console.log(`   📋 Esempi MAC nella mappa: ${first5Macs.join(', ')}`);
        }
      }

      return title || null;
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
    console.log('🔄 Cache KeePass invalidata');
  }
}

// Esporta un'istanza singleton
module.exports = new KeepassDriveService();
