// Servizio per leggere file KeePass da Google Drive e cercare MAC address
const { google } = require('googleapis');
const { Kdbx, Credentials, ProtectedValue } = require('kdbxweb');

class KeepassDriveService {
  constructor() {
    this.macToTitleMap = null;
    this.lastCacheUpdate = null;
    this.lastFileModifiedTime = null; // Data di modifica dell'ultimo file caricato
    this.cacheTimeout = 5 * 60 * 1000; // 5 minuti di cache
    this.isLoading = false;
    this.loadPromise = null;
    /** Buffer KDBX scaricato: riuso tra route Office / Email / MAC (evita download paralleli e 502 da timeout). */
    this.kdbxFileCache = null; // { buffer, modifiedTime, fetchedAt }
    this.kdbxFileFetchPromise = null;
    /** Coda globale sul parse KDBX: più load paralleli sul DB grande possono esaurire la RAM e far cadere il processo (502 su tutta l'API). */
    this._kdbxOpenChain = Promise.resolve();
    /** Cache scadenze Office per evitare scansioni ripetute. */
    this._officeExpiriesCache = null; // { limitMs, fetchedAt, items }
    /** Cache struttura Email per azienda (evita ricalcolo ad ogni refresh). */
    this._emailStructureCache = new Map(); // key = aziendaNameLower, value = { fetchedAt, items }
    /** Cache scadenze Email (Hub): evita scansioni ripetute. */
    this._emailExpiriesCache = null; // { limitMs, companiesKey, fetchedAt, items }
  }

  invalidateDerivedCaches() {
    this.macToTitleMap = null;
    this.lastCacheUpdate = null;
    this._officeExpiriesCache = null;
    this._emailStructureCache = new Map();
    this._emailExpiriesCache = null;
  }

  normalizeCompanyName(name) {
    return (name || '').toString().trim().toLowerCase();
  }

  getAllowedCompanyAncestors(normalizedCompanyName) {
    const parentByCompany = {
      'conad mercurio': ['paradiso group'],
      'conad la torre': ['paradiso group'],
      'conad albatros': ['paradiso group']
    };
    return parentByCompany[normalizedCompanyName] || [];
  }

  isPathAllowedForCompany(pathSegments, aziendaName) {
    if (!aziendaName) return true;

    const normalizedTarget = this.normalizeCompanyName(aziendaName);
    const gestioneIndex = pathSegments.findIndex(seg => this.normalizeCompanyName(seg) === 'gestione');
    // Se non abbiamo ancora incontrato "gestione" nel percorso, non possiamo ancora filtrare:
    // permettiamo la discesa nei sottogruppi e applicheremo il filtro quando "gestione" apparirà.
    if (gestioneIndex === -1) return true;

    const afterGestione = pathSegments.slice(gestioneIndex + 1).map(seg => this.normalizeCompanyName(seg)).filter(Boolean);
    if (afterGestione.length === 0) return true;

    const allowedAncestors = this.getAllowedCompanyAncestors(normalizedTarget);
    const firstSegment = afterGestione[0];
    if (firstSegment === normalizedTarget) return true;
    if (allowedAncestors.includes(firstSegment)) return true;
    return false;
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

        // Verifica che il file esista e ottieni la data di modifica
        try {
          const fileInfo = await drive.files.get({
            fileId: fileId,
            fields: 'id, name, modifiedTime'
          });
          fileName = fileInfo.data.name || 'keepass.kdbx';
          modifiedTime = fileInfo.data.modifiedTime;
        } catch (err) {
          throw new Error(`File con ID ${fileId} non trovato su Google Drive: ${err.message}`);
        }
      } else {
        // Altrimenti cerca per nome (compatibilità con configurazione precedente)
        const fileNameToSearch = process.env.KEEPASS_FILE_NAME || 'keepass.kdbx';

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
   * Una sola copia del file KDBX in memoria entro cacheTimeout;
   * le richieste concorrenti condividono lo stesso download (promise).
   * Riduce burst su Google Drive e tempi lunghi aggregati sul proxy (502).
   */
  async getKeepassFileData(password) {
    const now = Date.now();

    if (this.kdbxFileFetchPromise) {
      return this.kdbxFileFetchPromise;
    }

    if (
      this.kdbxFileCache &&
      this.kdbxFileCache.buffer &&
      (now - this.kdbxFileCache.fetchedAt) < this.cacheTimeout
    ) {
      return {
        buffer: this.kdbxFileCache.buffer,
        modifiedTime: this.kdbxFileCache.modifiedTime
      };
    }

    this.kdbxFileFetchPromise = (async () => {
      try {
        // metadata-first: se abbiamo già un buffer in cache ma è scaduto, controlla prima modifiedTime
        // e scarica il KDBX solo se è cambiato.
        if (this.kdbxFileCache && this.kdbxFileCache.buffer) {
          const currentModifiedTime = await this.checkFileModified(password);
          if (currentModifiedTime) {
            const cachedModified = this.kdbxFileCache.modifiedTime || this.lastFileModifiedTime || null;
            if (cachedModified && currentModifiedTime === cachedModified) {
              // il file non è cambiato: rinnova solo la scadenza cache
              this.kdbxFileCache.fetchedAt = Date.now();
              this.lastFileModifiedTime = currentModifiedTime;
              return { buffer: this.kdbxFileCache.buffer, modifiedTime: currentModifiedTime };
            }
            if (cachedModified && currentModifiedTime !== cachedModified) {
              // file cambiato: invalida cache derivate prima del nuovo download
              this.invalidateDerivedCaches();
              this.kdbxFileCache = null;
              this.lastFileModifiedTime = null;
            }
          }
        }

        const fd = await this.downloadKeepassFile(password);
        this.kdbxFileCache = {
          buffer: fd.buffer,
          modifiedTime: fd.modifiedTime,
          fetchedAt: Date.now()
        };
        if (fd.modifiedTime) {
          this.lastFileModifiedTime = fd.modifiedTime;
        }
        return { buffer: fd.buffer, modifiedTime: fd.modifiedTime };
      } finally {
        this.kdbxFileFetchPromise = null;
      }
    })();

    return this.kdbxFileFetchPromise;
  }

  /**
   * Esegue worker(db, fileData) dopo un solo parse KDBX per volta (tutti i worker sono in fila).
   * fileData è l'oggetto restituito da getKeepassFileData (buffer + modifiedTime da Drive).
   */
  async withLoadedKdbx(password, worker) {
    const task = async () => {
      const fileData = await this.getKeepassFileData(password);
      const credentials = new Credentials(ProtectedValue.fromString(password));
      const db = await Kdbx.load(fileData.buffer.buffer, credentials);
      return worker(db, fileData);
    };
    const p = this._kdbxOpenChain.then(task, task);
    this._kdbxOpenChain = p.then(
      () => undefined,
      () => undefined
    );
    return p;
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
   * Gestisce anche campi con più MAC address separati da virgole, spazi, newline, ecc.
   * Ritorna il primo MAC trovato (per compatibilità con codice esistente)
   */
  extractMacFromField(value) {
    const allMacs = this.extractAllMacsFromField(value);
    return allMacs.length > 0 ? allMacs[0] : null;
  }

  /**
   * Estrae TUTTI i MAC address da un campo del KeePass
   * Gestisce campi con più MAC address separati da virgole, spazi, newline, ecc.
   */
  extractAllMacsFromField(value) {
    if (!value) return [];
    const str = String(value).toUpperCase();
    const macs = [];

    // Pattern per MAC address: XX-XX-XX-XX-XX-XX o XX:XX:XX:XX:XX:XX o XXXXXXXXXXXX (senza spazi)
    const macPattern = /([0-9A-F]{2}[:-]){5}[0-9A-F]{2}|[0-9A-F]{12}/g;
    const matches = str.match(macPattern);

    if (matches && matches.length > 0) {
      for (const match of matches) {
        let mac = match.replace(/[:-]/g, '');
        if (mac.length === 12) {
          mac = mac.replace(/(..)(..)(..)(..)(..)(..)/, '$1-$2-$3-$4-$5-$6');
          macs.push(mac.toUpperCase());
        }
      }
    }

    return macs;
  }

  /**
   * Carica il file KDBX e crea la mappa MAC -> Titolo
   */
  async loadMacToTitleMap(password) {
    try {
      return await this.withLoadedKdbx(password, async (db, fileData) => {
      const modifiedTime = fileData.modifiedTime;

      // Crea la mappa MAC -> {title, path}
      const macMap = new Map();
      let entryCount = 0; // Contatore per debug

      // Funzione ricorsiva per processare gruppi ed entry
      const processGroup = (group, groupPath = '') => {
        const currentPath = groupPath ? `${groupPath} > ${group.name || 'Root'}` : (group.name || 'Root');

        // Processa le entry del gruppo
        if (group.entries && group.entries.length > 0) {
          for (const entry of group.entries) {
            entryCount++; // Incrementa il contatore per debug

            // kdbxweb usa entry.fields come oggetto, non come Map
            // Accediamo direttamente alle proprietà
            const titleField = entry.fields && entry.fields['Title'];
            let titleStr = titleField ? (titleField instanceof ProtectedValue ? titleField.getText() : String(titleField)) : '';
            if (!titleStr || !titleStr.trim()) {
              const getCustomTitle = (name) => {
                if (!entry.customFields) return null;
                return typeof entry.customFields.get === 'function' ? entry.customFields.get(name) : entry.customFields[name];
              };
              const alt = getCustomTitle('Titolo') || getCustomTitle('Hostname') || getCustomTitle('Nome') || (entry.fields && (entry.fields['Titolo'] || entry.fields['Hostname'] || entry.fields['Nome']));
              if (alt) titleStr = alt instanceof ProtectedValue ? alt.getText() : String(alt);
            }

            // Estrai il campo "Modello" da KeePass (campi standard + "Campi stringa" / custom)
            // kdbxweb può esporre entry.fields e entry.customFields come Map: usare entries(), non Object.entries
            const allEntries = (container) => {
              if (!container) return [];
              if (typeof container.entries === 'function') return [...container.entries()];
              return Object.entries(container);
            };
            const modelloKeyMatch = (key) => {
              const k = String(key || '').trim().toLowerCase();
              return k === 'modello' || k === 'model' || k.includes('modello');
            };
            const readModelloFromContainer = (container) => {
              for (const [key, value] of allEntries(container)) {
                if (modelloKeyMatch(key) && value !== undefined && value !== null && String(value).trim() !== '') {
                  return value;
                }
              }
              return null;
            };

            let modelloStr = '';
            let modelloField = readModelloFromContainer(entry.fields || null);
            if (!modelloField && entry.customFields) {
              modelloField = readModelloFromContainer(entry.customFields);
            }
            if (modelloField) {
              modelloStr = modelloField instanceof ProtectedValue ? modelloField.getText() : String(modelloField);
            }


            // Cerca MAC in TUTTI i campi (inclusi campi personalizzati)
            // entry.fields e entry.customFields possono essere Map: usare keys/entries, non Object.keys
            const allFieldNames = entry.fields
              ? (typeof entry.fields.keys === 'function' ? [...entry.fields.keys()] : Object.keys(entry.fields))
              : [];
            let customFieldNames = [];
            if (entry.customFields) {
              customFieldNames = typeof entry.customFields.keys === 'function'
                ? [...entry.customFields.keys()]
                : Object.keys(entry.customFields);
            }

            const standardFields = ['UserName', 'Password', 'URL', 'Notes', 'Title'];
            const fieldsToCheck = [...new Set([...standardFields, ...allFieldNames, ...customFieldNames])]; // Unisci senza duplicati

            // DEBUG: Log COMPLETO per le prime 50 entry
            if (entryCount <= 50) {
              console.log(`\n🔍 DEBUG Entry #${entryCount}: "${titleStr}" (Path: "${currentPath}")`);
              console.log(`   - allFieldNames (entry.fields): ${allFieldNames.join(', ')}`);
              console.log(`   - customFieldNames (entry.customFields): ${customFieldNames.join(', ')}`);
              console.log(`   - fieldsToCheck (totale): ${fieldsToCheck.join(', ')}`);

              // Mostra i VALORI di tutti i campi personalizzati
              if (customFieldNames.length > 0) {
                console.log(`   - Valori campi personalizzati:`);
                customFieldNames.forEach(fieldName => {
                  let fieldValue = null;
                  if (entry.customFields) {
                    fieldValue = typeof entry.customFields.get === 'function'
                      ? entry.customFields.get(fieldName)
                      : entry.customFields[fieldName];
                  }
                  const valueStr = fieldValue instanceof ProtectedValue
                    ? '[PROTECTED]'
                    : String(fieldValue || '(vuoto)');
                  console.log(`      * "${fieldName}": "${valueStr.substring(0, 50)}${valueStr.length > 50 ? '...' : ''}"`);
                });
              }
            }

            // DEBUG SPECIFICO: Log per entry di Theorica
            if (currentPath && currentPath.toLowerCase().includes('theorica')) {
              console.log(`\n🎯 THEORICA Entry: "${titleStr}" (Path: "${currentPath}")`);
              console.log(`   - customFields type: ${typeof entry.customFields}`);
              console.log(`   - customFields is Map: ${entry.customFields instanceof Map}`);
              console.log(`   - customFieldNames: [${customFieldNames.join(', ')}]`);

              if (entry.customFields) {
                console.log(`   - Tentativo lettura diretta customFields:`);
                // Prova diversi metodi di accesso
                if (typeof entry.customFields.forEach === 'function') {
                  entry.customFields.forEach((value, key) => {
                    const val = value instanceof ProtectedValue ? '[PROTECTED]' : String(value || '');
                    console.log(`      * forEach: "${key}" = "${val.substring(0, 50)}"`);
                  });
                }
                if (typeof entry.customFields.entries === 'function') {
                  for (const [key, value] of entry.customFields.entries()) {
                    const val = value instanceof ProtectedValue ? '[PROTECTED]' : String(value || '');
                    console.log(`      * entries: "${key}" = "${val.substring(0, 50)}"`);
                  }
                }
              }
            }

            let foundMac = null;
            let foundMacField = null;

            // Cerca TUTTI i MAC in TUTTI i campi (un campo può contenere più MAC)
            const foundMacs = [];

            const getField = (container, name) => {
              if (!container) return null;
              if (typeof container.get === 'function') return container.get(name);
              return container[name];
            };
            for (const fieldName of fieldsToCheck) {
              let fieldValue = getField(entry.fields, fieldName) || getField(entry.customFields, fieldName);

              if (fieldValue) {
                const valueStr = fieldValue instanceof ProtectedValue
                  ? fieldValue.getText()
                  : String(fieldValue);

                // Estrai TUTTI i MAC da questo campo (non solo il primo)
                const allMacsInField = this.extractAllMacsFromField(valueStr);
                for (const mac of allMacsInField) {
                  foundMacs.push({ mac, field: fieldName });
                }

                // DEBUG: Log per entry specifiche
                if (titleStr && (titleStr.includes('Contabilita') || titleStr.includes('acdomain'))) {
                  if (allMacsInField.length > 0) {
                    console.log(`   ✅ Campo "${fieldName}": trovati ${allMacsInField.length} MAC: ${allMacsInField.join(', ')}`);
                  }
                }
              }
            }

            // DEBUG: Log finale per entry specifiche
            if (titleStr && (titleStr.includes('Contabilita') || titleStr.includes('acdomain'))) {
              console.log(`   📊 Totale MAC trovati: ${foundMacs.length}`);
              if (foundMacs.length > 0) {
                foundMacs.forEach(({ mac, field }) => {
                  console.log(`      - MAC ${mac} trovato in campo "${field}"`);
                });
              }
            }


            // Aggiungi TUTTI i MAC trovati alla mappa
            // IMPORTANTE: Estrai l'username per ogni entry che contiene almeno un MAC
            for (const { mac, field } of foundMacs) {
              // mac è già normalizzato da extractAllMacsFromField (formato XX-XX-XX-XX-XX-XX)
              // Normalizziamo per la ricerca (rimuoviamo separatori)
              const normalizedMac = this.normalizeMacForSearch(mac);
              if (normalizedMac) {
                // Estrai il campo UserName (Nome Utente); fallback su campi personalizzati "Utente" / "User"
                // QUESTO VIENE FATTO PER OGNI MAC TROVATO, garantendo che l'username sia sempre associato correttamente
                const usernameField = entry.fields && entry.fields['UserName'];
                let usernameStr = usernameField ? (usernameField instanceof ProtectedValue ? usernameField.getText() : String(usernameField)) : '';
                if (!usernameStr || !usernameStr.trim()) {
                  const getCustom = (name) => {
                    if (!entry.customFields) return null;
                    return typeof entry.customFields.get === 'function' ? entry.customFields.get(name) : entry.customFields[name];
                  };
                  const altField = (entry.fields && (entry.fields['Utente'] || entry.fields['User'])) || getCustom('Utente') || getCustom('User');
                  if (altField) {
                    usernameStr = altField instanceof ProtectedValue ? altField.getText() : String(altField);
                  }
                }

                // Estrai Icon ID (supporta sia primitive che object)
                let iconId = entry.icon;
                if (entry.icon && typeof entry.icon === 'object' && entry.icon.id !== undefined) {
                  iconId = entry.icon.id;
                }
                // Stesso MAC può apparire in più entry (es. Theorica e Cestino): teniamo TUTTE le entry per MAC.
                // In fase di lettura (route dispositivi) si sceglie l'entry il cui path contiene il nome azienda (es. "Theorica").
                const entryData = { title: titleStr || '', path: currentPath || '', username: usernameStr || '', iconId: iconId, model: (modelloStr || '').trim() };
                if (!macMap.has(normalizedMac)) macMap.set(normalizedMac, []);
                macMap.get(normalizedMac).push(entryData);
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

      // Salva la data di modifica del file
      this.lastFileModifiedTime = modifiedTime;

      return macMap;
      });
    } catch (error) {
      console.error('❌ Errore caricamento mappa MAC->Titolo:', error.message);
      throw error;
    }
  }

  /**
   * Carica tutte le entry Keepass filtrate per percorso azienda
   * @param {string} password - Password del file Keepass
   * @param {string} aziendaName - Nome azienda per filtrare (es. "Theorica")
   * @returns {Array} Array di entry Keepass con tutti i campi
   */
  async getAllEntriesByAzienda(password, aziendaName = null) {
    try {
      return await this.withLoadedKdbx(password, async (db) => {
      const entries = [];
      const foundAziendeAfterGestione = new Set(); // Raccogli nomi aziende trovate dopo "gestione" per debug

      // Funzione ricorsiva per processare gruppi ed entry
      const processGroup = (group, groupPath = '') => {
        const groupName = group.name || 'Root';
        const currentPath = groupPath ? `${groupPath} > ${groupName}` : groupName;


        // Se è specificata un'azienda, verifica se il percorso appartiene all'azienda
        // IMPORTANTE: Verifica solo il primo segmento dopo "gestione"
        // Deve essere un match IDENTICO esatto (case-insensitive) - nessuna variazione accettata
        let shouldInclude = true;
        if (aziendaName) {
          // Dividi il percorso in segmenti (separati da ">")
          const pathSegments = currentPath.split('>').map(seg => seg.trim()).filter(seg => seg);

          // Cerca "gestione" nel percorso (case-insensitive)
          const gestioneIndex = pathSegments.findIndex(seg => seg.toLowerCase() === 'gestione');

          if (gestioneIndex === -1) {
            // Se non c'è "gestione", escludi tutto
            shouldInclude = false;
          } else {
            // Prendi il segmento immediatamente dopo "gestione"
            const aziendaSegmentIndex = gestioneIndex + 1;

            if (aziendaSegmentIndex >= pathSegments.length) {
              // Se non c'è ancora un segmento dopo "gestione" (es. percorso = "gestione"),
              // continua a processare i sottogruppi (non escludere ancora)
              // Il controllo verrà fatto quando processeremo i sottogruppi (es. "gestione > Theorica")
              shouldInclude = true; // Continua a processare i sottogruppi
            } else {
              const aziendaSegmentInPath = pathSegments[aziendaSegmentIndex];

              // IMPORTANTE: Raccogli SOLO il segmento direttamente dopo "gestione"
              // Non raccogliere segmenti più profondi (es. "Theorica_old" in "gestione > dismessi > Theorica_old")
              foundAziendeAfterGestione.add(aziendaSegmentInPath.trim());

              // Confronto ESATTO case-insensitive
              // "Theorica" deve matchare SOLO "Theorica", "theorica", "THEORICA"
              // NON deve matchare "Theorica_old", "Theorica_new", ecc.
              // NON deve matchare "Theorica_old" anche se è in "gestione > dismessi > Theorica_old" (il segmento dopo "gestione" è "dismessi", non "Theorica_old")
              const aziendaNameNormalized = aziendaName.trim().toLowerCase();
              const segmentNormalized = aziendaSegmentInPath.trim().toLowerCase();

              // Match IDENTICO esatto: solo case-insensitive, nessuna variazione accettata
              shouldInclude = (aziendaNameNormalized === segmentNormalized);
            }
          }

          if (!shouldInclude) {
            // Salta questo gruppo e i suoi figli se non appartiene all'azienda
            return;
          }
        }

        // Processa le entry del gruppo
        if (group.entries && group.entries.length > 0) {
          for (const entry of group.entries) {
            // Estrai tutti i campi dell'entry
            const titleField = entry.fields && entry.fields['Title'];
            const title = titleField ? (titleField instanceof ProtectedValue ? titleField.getText() : String(titleField)) : '';

            const usernameField = entry.fields && entry.fields['UserName'];
            const username = usernameField ? (usernameField instanceof ProtectedValue ? usernameField.getText() : String(usernameField)) : '';

            const passwordField = entry.fields && entry.fields['Password'];
            const password = passwordField ? (passwordField instanceof ProtectedValue ? passwordField.getText() : String(passwordField)) : '';

            const urlField = entry.fields && entry.fields['URL'];
            const url = urlField ? (urlField instanceof ProtectedValue ? urlField.getText() : String(urlField)) : '';

            const notesField = entry.fields && entry.fields['Notes'];
            const notes = notesField ? (notesField instanceof ProtectedValue ? notesField.getText() : String(notesField)) : '';

            // Salta entry senza password
            if (!password || password.trim() === '') {
              continue;
            }

            entries.push({
              title: title || 'Senza titolo',
              username: username || '',
              password: password, // Password in chiaro (sarà criptata prima di essere inviata)
              url: url || '',
              notes: notes || '',
              groupPath: currentPath,
              icon_id: entry.icon ? entry.icon.id : 0
            });
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

      return entries;
      });
    } catch (error) {
      console.error('❌ Errore caricamento entry Keepass:', error.message);
      throw error;
    }
  }

  /**
   * Recupera la struttura Email da Keepass per un'azienda.
   * Cerca gestione > Azienda > Email (o EMail), poi per ogni sottocartella tipo @nomequalcosa
   * aggiunge una riga divisoria (azzurra) e le entry sotto con Titolo, Username, URL.
   * @param {string} password - Password del file Keepass
   * @param {string} aziendaName - Nome azienda (es. "Conad Mercurio")
   * @returns {Array} Array di { type: 'divider', name } o { type: 'entry', title, username, url }
   */
  async getEmailStructureByAzienda(password, aziendaName) {
    try {
      const key = (aziendaName || '').toString().trim().toLowerCase();
      if (key) {
        const hit = this._emailStructureCache.get(key);
        if (hit && Array.isArray(hit.items) && (Date.now() - (hit.fetchedAt || 0)) < this.cacheTimeout) {
          return hit.items;
        }
      }

      return await this.withLoadedKdbx(password, async (db) => {
      const result = [];

      // Recupera i gruppi figli compatibile con tutte le versioni di kdbxweb
      const getChildGroups = (g) => {
        if (!g) return [];
        const arr = g.groups || g.children || g.subGroups;
        if (!arr) return [];
        if (Array.isArray(arr)) return arr;
        // kdbxweb alcune versioni usa Map o iterabile
        if (typeof arr[Symbol.iterator] === 'function') return [...arr];
        return [];
      };

      const findEmailGroup = (group, path = '') => {
        const name = group.name || 'Root';
        const currentPath = path ? `${path} > ${name}` : name;
        const segments = currentPath.split('>').map(s => s.trim()).filter(Boolean);

        if (aziendaName) {
          const gestioneIdx = segments.findIndex(s => s.toLowerCase() === 'gestione');
          if (gestioneIdx === -1) return null;
          const aziendaIdx = gestioneIdx + 1;
          if (aziendaIdx >= segments.length) {
            // ancora sotto gestione, continua a cercare
          } else {
            const segAzienda = segments[aziendaIdx].trim().toLowerCase();
            const aziendaNorm = aziendaName.trim().toLowerCase();
            if (segAzienda !== aziendaNorm) return null;
          }
        }

        if (name.toLowerCase() === 'email' || name.toLowerCase() === 'e-mail') {
          return group;
        }
        for (const sub of getChildGroups(group)) {
          const found = findEmailGroup(sub, currentPath);
          if (found) return found;
        }
        return null;
      };

      let emailGroup = null;
      for (const root of db.groups || []) {
        emailGroup = findEmailGroup(root);
        if (emailGroup) break;
      }

      if (!emailGroup) {
        return result;
      }

      const extractEntry = (entry, divider = '') => {
        const titleF = entry.fields && entry.fields['Title'];
        const userF = entry.fields && entry.fields['UserName'];
        const urlF = entry.fields && entry.fields['URL'];
        const title = titleF ? (titleF instanceof ProtectedValue ? titleF.getText() : String(titleF)) : '';
        const username = userF ? (userF instanceof ProtectedValue ? userF.getText() : String(userF)) : '';
        const url = urlF ? (urlF instanceof ProtectedValue ? urlF.getText() : String(urlF)) : '';
        let expires = null;
        const useExpiry = entry.times && (entry.times.expires === true || entry.times.Expires === true);
        if (useExpiry) {
          const raw = entry.times.expiryTime ?? entry.times.ExpiryTime;
          if (raw != null) {
            let d;
            if (raw instanceof Date) {
              d = raw;
            } else if (typeof raw === 'object' && typeof raw.getTime === 'function') {
              d = raw;
            } else if (typeof raw === 'object' && raw.value != null) {
              d = new Date(raw.value);
            } else {
              d = new Date(raw);
            }
            const maxDate = new Date();
            maxDate.setFullYear(maxDate.getFullYear() + 100);
            if (!isNaN(d.getTime()) && d.getTime() > 0 && d <= maxDate) {
              expires = d.toISOString();
            }
          }
        }
        return {
          type: 'entry',
          title,
          username,
          url,
          divider: divider || '',
          expires
        };
      };

      const visitGroup = (group, depth) => {
        const groupName = (group.name || '').trim();
        result.push({ type: 'divider', name: groupName, level: depth });
        if (group.entries) {
          for (const entry of group.entries) {
            result.push({ ...extractEntry(entry, groupName), level: depth });
          }
        }
        for (const child of getChildGroups(group)) {
          visitGroup(child, depth + 1);
        }
      };

      // 1. Entry dirette del gruppo Email (senza sottocartelle)
      if (emailGroup.entries) {
        for (const entry of emailGroup.entries) {
          result.push({ ...extractEntry(entry, ''), level: 0 });
        }
      }

      // 2. Ogni sottocartella di Email, ricorsivamente come in KeePass
      for (const sub of getChildGroups(emailGroup)) {
        visitGroup(sub, 0);
      }

      if (key) this._emailStructureCache.set(key, { fetchedAt: Date.now(), items: result });
      return result;
      });
    } catch (error) {
      console.error('❌ Errore getEmailStructureByAzienda:', error.message);
      throw error;
    }
  }

  /**
   * Recupera la password di una singola entry Email da KeePass.
   * Usato per visualizzazione su richiesta (solo admin).
   * @param {string} password - Password del file Keepass
   * @param {string} aziendaName - Nome azienda
   * @param {object} params - { title, username, url, divider } per identificare l'entry
   * @returns {string|null} Password in chiaro o null se non trovata
   */
  async getEmailEntryPassword(password, aziendaName, params = {}) {
    try {
      const { title = '', username = '', url = '', divider = '' } = params;
      return await this.withLoadedKdbx(password, async (db) => {

      const findEmailGroup = (group, path = '') => {
        const name = group.name || 'Root';
        const currentPath = path ? `${path} > ${name}` : name;
        const segments = currentPath.split('>').map(s => s.trim()).filter(Boolean);
        if (aziendaName) {
          const gestioneIdx = segments.findIndex(s => s.toLowerCase() === 'gestione');
          if (gestioneIdx === -1) return null;
          const aziendaIdx = gestioneIdx + 1;
          if (aziendaIdx < segments.length) {
            const segAzienda = segments[aziendaIdx].trim().toLowerCase();
            const aziendaNorm = aziendaName.trim().toLowerCase();
            if (segAzienda !== aziendaNorm) return null;
          }
        }
        if (name.toLowerCase() === 'email' || name.toLowerCase() === 'e-mail') return group;
        if (group.groups) {
          for (const sub of group.groups) {
            const found = findEmailGroup(sub, currentPath);
            if (found) return found;
          }
        }
        return null;
      };

      let emailGroup = null;
      for (const root of db.groups || []) {
        emailGroup = findEmailGroup(root);
        if (emailGroup) break;
      }
      if (!emailGroup) return null;

      const normalize = (s) => (s || '').trim();
      const titleN = normalize(title);
      const usernameN = normalize(username);
      const urlN = normalize(url);
      const dividerN = normalize(divider);

      const findEntry = (group, currentDivider) => {
        if (group.entries) {
          for (const entry of group.entries) {
            const titleF = entry.fields && entry.fields['Title'];
            const userF = entry.fields && entry.fields['UserName'];
            const urlF = entry.fields && entry.fields['URL'];
            const t = normalize(titleF ? (titleF instanceof ProtectedValue ? titleF.getText() : String(titleF)) : '');
            const u = normalize(userF ? (userF instanceof ProtectedValue ? userF.getText() : String(userF)) : '');
            const r = normalize(urlF ? (urlF instanceof ProtectedValue ? urlF.getText() : String(urlF)) : '');
            const d = normalize(currentDivider);
            if (t === titleN && u === usernameN && r === urlN && d === dividerN) {
              const passF = entry.fields && entry.fields['Password'];
              if (!passF) return null;
              return passF instanceof ProtectedValue ? passF.getText() : String(passF || '');
            }
          }
        }
        const children = Array.isArray(group.groups) ? group.groups : [];
        for (const sub of children) {
          const subName = (sub.name || '').trim();
          const found = findEntry(sub, subName);
          if (found !== undefined && found !== null) return found;
        }
        return undefined;
      };

      let pw = findEntry(emailGroup, '');
      if (pw !== undefined && pw !== null) return pw;
      return null;
      });
    } catch (error) {
      console.error('❌ Errore getEmailEntryPassword:', error.message);
      throw error;
    }
  }

  /**
   * Email in scadenza per tutte le aziende: carica KeePass UNA sola volta e restituisce le entry con scadenza nel range [now, limit].
   * Evita N download (uno per azienda) che causano timeout 504.
   * @param {string} password - Password KeePass
   * @param {string[]} aziendeNames - Lista nomi aziende (stesso ordine/lista della pagina Email)
   * @param {Date} now - Data ora
   * @param {Date} limit - Data limite (es. now + 30 giorni)
   * @returns {Array<{aziendaName, title, username, url, divider, expires, daysLeft}>}
   */
  async getEmailUpcomingExpiriesAll(password, aziendeNames, now, limit) {
    const aziendeSet = new Set((aziendeNames || []).map(a => (a || '').trim().toLowerCase()).filter(Boolean));
    if (aziendeSet.size === 0) return [];

    const limitMs = limit instanceof Date ? limit.getTime() : new Date(limit).getTime();
    const companiesKey = [...aziendeSet].sort().join('|');
    const cacheOk =
      this._emailExpiriesCache &&
      Number.isFinite(this._emailExpiriesCache.limitMs) &&
      this._emailExpiriesCache.limitMs === limitMs &&
      this._emailExpiriesCache.companiesKey === companiesKey &&
      (Date.now() - (this._emailExpiriesCache.fetchedAt || 0)) < this.cacheTimeout &&
      Array.isArray(this._emailExpiriesCache.items);

    const computeAll = async () =>
      this.withLoadedKdbx(password, async (db) => {
      const results = [];
    const dayMs = 24 * 60 * 60 * 1000;
    const daysLeftFrom = (expDate) => {
      const diff = (expDate.getTime() - now.getTime()) / dayMs;
      // Per scadenze passate vogliamo -1, -2, ... (ceil(-0.1)=0 sarebbe sbagliato)
      return diff >= 0 ? Math.ceil(diff) : Math.floor(diff);
    };

    const getChildGroups = (g) => {
      if (!g) return [];
      const arr = g.groups || g.children || g.subGroups;
      if (!arr) return [];
      if (Array.isArray(arr)) return arr;
      if (typeof arr[Symbol.iterator] === 'function') return [...arr];
      return [];
    };

    const extractEntry = (entry, divider = '') => {
      const titleF = entry.fields && entry.fields['Title'];
      const userF = entry.fields && entry.fields['UserName'];
      const urlF = entry.fields && entry.fields['URL'];
      const title = titleF ? (titleF instanceof ProtectedValue ? titleF.getText() : String(titleF)) : '';
      const username = userF ? (userF instanceof ProtectedValue ? userF.getText() : String(userF)) : '';
      const url = urlF ? (urlF instanceof ProtectedValue ? urlF.getText() : String(urlF)) : '';
      let expires = null;
      const useExpiry = entry.times && (entry.times.expires === true || entry.times.Expires === true);
      if (useExpiry) {
        const raw = entry.times.expiryTime ?? entry.times.ExpiryTime;
        if (raw != null) {
          let d;
          if (raw instanceof Date) d = raw;
          else if (typeof raw === 'object' && typeof raw.getTime === 'function') d = raw;
          else if (typeof raw === 'object' && raw.value != null) d = new Date(raw.value);
          else d = new Date(raw);
          const maxDate = new Date();
          maxDate.setFullYear(maxDate.getFullYear() + 100);
          if (!isNaN(d.getTime()) && d.getTime() > 0 && d <= maxDate) expires = d.toISOString();
        }
      }
      return { type: 'entry', title, username, url, divider: divider || '', expires };
    };

    const findEmailGroupUnder = (group) => {
      if (!group) return null;
      if (group.name && (group.name.toLowerCase() === 'email' || group.name.toLowerCase() === 'e-mail')) return group;
      for (const sub of getChildGroups(group)) {
        const found = findEmailGroupUnder(sub);
        if (found) return found;
      }
      return null;
    };

    const collectExpiriesFromGroup = (emailGroup, aziendaName) => {
      const out = [];
      const walk = (group, divider = '') => {
        if (!group) return;
        const groupName = (group.name || '').toString().trim();
        const nextDivider = divider || groupName || '';
        if (group.entries) {
          for (const entry of group.entries) {
            const item = extractEntry(entry, divider);
            if (item.expires) out.push({ ...item, aziendaName });
          }
        }
        for (const sub of getChildGroups(group)) {
          walk(sub, sub?.name ? String(sub.name) : nextDivider);
        }
      };
      // divider vuoto per le entry direttamente sotto Email
      walk(emailGroup, '');
      return out;
    };

    const findGestioneGroup = (group) => {
      if (!group) return null;
      const name = (group.name || '').toString().trim().toLowerCase();
      if (name === 'gestione') return group;
      for (const sub of getChildGroups(group)) {
        const found = findGestioneGroup(sub);
        if (found) return found;
      }
      return null;
    };

    let allEntries = [];
    let gestione = null;
    for (const root of db.groups || []) {
      gestione = findGestioneGroup(root);
      if (gestione) break;
    }

    if (gestione) {
      // I figli diretti di Gestione sono le aziende: scansioniamo solo quello, non tutto il DB.
      for (const companyGroup of getChildGroups(gestione)) {
        const aziendaName = (companyGroup?.name || '').toString().trim();
        if (!aziendaName) continue;
        const key = aziendaName.toLowerCase();
        if (!aziendeSet.has(key)) continue;
        const emailGroup = findEmailGroupUnder(companyGroup);
        if (!emailGroup) continue;
        allEntries = allEntries.concat(collectExpiriesFromGroup(emailGroup, aziendaName));
      }
    } else {
      // Fallback lento se non troviamo Gestione.
      const visitSlow = (group, pathSegments = []) => {
        const name = (group.name || '').toString();
        const segments = [...pathSegments, name].map((s) => String(s || '').trim()).filter(Boolean);
        const gestioneIdx = segments.findIndex((s) => s.toLowerCase() === 'gestione');
        if (gestioneIdx >= 0 && segments.length === gestioneIdx + 2) {
          const aziendaName = segments[gestioneIdx + 1].trim();
          const key = aziendaName.toLowerCase();
          if (aziendeSet.has(key)) {
            const emailGroup = findEmailGroupUnder(group);
            if (emailGroup) return collectExpiriesFromGroup(emailGroup, aziendaName);
          }
          return [];
        }
        let collected = [];
        for (const sub of getChildGroups(group)) {
          collected = collected.concat(visitSlow(sub, segments));
        }
        return collected;
      };
      for (const root of db.groups || []) {
        allEntries = allEntries.concat(visitSlow(root, []));
      }
    }

    for (const item of allEntries) {
      if (!item.expires) continue;
      const exp = new Date(item.expires);
      if (isNaN(exp.getTime())) continue;
      if (exp > limit) continue;
      const daysLeft = daysLeftFrom(exp);
      results.push({
        aziendaName: item.aziendaName,
        title: item.title || '',
        username: item.username || '',
        url: item.url || '',
        divider: item.divider || '',
        expires: item.expires,
        daysLeft
      });
    }
    return results;
    });

    if (cacheOk) return this._emailExpiriesCache.items;
    const items = await computeAll();
    this._emailExpiriesCache = { limitMs, companiesKey, fetchedAt: Date.now(), items };
    return items;
  }

  /**
   * Cerca la voce "Office" come radice e poi "Login" con i campi personalizzati
   * @param {string} password - Password del file Keepass
   * @param {string} aziendaName - Nome azienda per filtrare (es. "Theorica")
   * @returns {Object|null} Oggetto con titolo Office, campi personalizzati 1-5 e scadenza, o null se non trovato
   */
  async getOfficeData(password, aziendaName) {
    try {
      return await this.withLoadedKdbx(password, async (db) => {
      let officeTitle = null;
      const officeFiles = []; // Array per contenere TUTTE le entry trovate nel gruppo Office

      // Funzione ricorsiva per cercare Office e tutte le entry nel gruppo
      const searchOfficeAndLogin = (group, groupPath = '', isInOfficeGroup = false) => {
        const groupName = group.name || 'Root';
        const currentPath = groupPath ? `${groupPath} > ${groupName}` : groupName;

        // Verifica se il percorso appartiene all'azienda
        let shouldInclude = true;
        if (aziendaName) {
          const pathSegments = currentPath.split('>').map(seg => seg.trim()).filter(seg => seg);
          shouldInclude = this.isPathAllowedForCompany(pathSegments, aziendaName);
          if (!shouldInclude) return;
        }

        // Cerca "Office" come gruppo (case-insensitive)
        const isOfficeGroup = groupName.toLowerCase() === 'office';
        const currentIsInOfficeGroup = isInOfficeGroup || isOfficeGroup;

        // Se abbiamo trovato il gruppo Office, salviamo il titolo (se non ne abbiamo già uno)
        if (isOfficeGroup && (!officeTitle || officeTitle !== 'Office')) {
          officeTitle = groupName || 'Office';
        }

        // Controlla le entry del gruppo corrente
        if (group.entries && group.entries.length > 0) {
          // Se siamo nel percorso corretto (shouldInclude=true), cerchiamo le entry rilevanti

          for (const entry of group.entries) {
            const titleField = entry.fields && entry.fields['Title'];
            const title = titleField ? (titleField instanceof ProtectedValue ? titleField.getText() : String(titleField)) : '';
            const titleLower = title.trim().toLowerCase();

            // Se siamo nel gruppo Office, aggiungi TUTTE le entry trovate
            if (currentIsInOfficeGroup) {
              const fileData = extractEntryData(entry, title || 'Senza titolo');
              officeFiles.push(fileData);
            }
          }
        }

        // Processa i sottogruppi
        if (group.groups && group.groups.length > 0) {
          for (const subGroup of group.groups) {
            searchOfficeAndLogin(subGroup, currentPath, currentIsInOfficeGroup);
          }
        }
      };

      // Helper per estrarre i dati dall'entry
      const extractEntryData = (entry, entryTitle) => {
        const getContainerEntries = (container) => {
          if (!container) return [];
          if (typeof container.entries === 'function') return [...container.entries()];
          return Object.entries(container);
        };

        // Estrai username (campo standard KeePass)
        let username = '';
        if (entry.fields && entry.fields['UserName']) {
          const usernameField = entry.fields['UserName'];
          username = usernameField instanceof ProtectedValue
            ? usernameField.getText()
            : String(usernameField || '');
        }

        // Indica se l'entry ha una password valorizzata
        let hasPassword = false;
        if (entry.fields && entry.fields['Password'] !== undefined && entry.fields['Password'] !== null) {
          const passwordField = entry.fields['Password'];
          const passwordValue = passwordField instanceof ProtectedValue
            ? passwordField.getText()
            : String(passwordField || '');
          hasPassword = String(passwordValue || '').trim() !== '';
        }

        // Estrai i campi personalizzati
        const customFields = {};
        if (entry.customFields) {
          for (const [fieldName, fieldValue] of getContainerEntries(entry.customFields)) {
            const value = fieldValue instanceof ProtectedValue
              ? fieldValue.getText()
              : String(fieldValue || '');
            customFields[fieldName] = value;
          }
        }

        // Estrai anche i campi standard per verificare se ci sono campi personalizzati lì
        if (entry.fields) {
          for (const [fieldName, fieldValue] of getContainerEntries(entry.fields)) {
            // Salta i campi standard principali
            if (['Title', 'UserName', 'Password', 'URL', 'Notes'].includes(fieldName)) {
              continue;
            }
            const value = fieldValue instanceof ProtectedValue
              ? fieldValue.getText()
              : String(fieldValue || '');
            if (!customFields[fieldName]) {
              customFields[fieldName] = value;
            }
          }
        }

        // Estrai la scadenza: entry.times.expiryTime è la data, entry.times.expires è il bool checkbox
        let expires = null;
        if (entry.times && entry.times.expiryTime && entry.times.expires) {
          const expiresDate = entry.times.expiryTime;
          const d = expiresDate instanceof Date ? expiresDate : new Date(expiresDate);
          const maxDate = new Date();
          maxDate.setFullYear(maxDate.getFullYear() + 100);
          if (!isNaN(d.getTime()) && d <= maxDate) {
            expires = d;
          }
        }

        return {
          title: entryTitle,
          username,
          hasPassword,
          customFields: customFields,
          expires: expires
        };
      };

      // Processa tutti i gruppi root
      if (db.groups && db.groups.length > 0) {
        for (const group of db.groups) {
          searchOfficeAndLogin(group);
        }
      }

      if (!officeTitle || officeFiles.length === 0) {
        return null;
      }

      // Processa ogni file trovato per estrarre i campi personalizzati numerici
      const processedFiles = officeFiles.map((file) => {
        const customFieldsSource = file.customFields || {};
        const numericFieldMap = new Map();

        const parseFieldNumber = (rawKey) => {
          const key = String(rawKey || '').trim();
          const match = key.match(/^(?:custom|campo(?:\s+personalizzato)?|custom\s+field)?\s*(\d+)$/i);
          if (!match) return null;
          const parsed = parseInt(match[1], 10);
          return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
        };

        for (const [rawKey, rawValue] of Object.entries(customFieldsSource)) {
          const fieldNumber = parseFieldNumber(rawKey);
          if (!fieldNumber) continue;
          const value = rawValue == null ? '' : String(rawValue).trim();
          if (!numericFieldMap.has(fieldNumber) || value) {
            numericFieldMap.set(fieldNumber, value);
          }
        }

        const getLicenseValue = () => {
          for (const [rawKey, rawValue] of Object.entries(customFieldsSource)) {
            const key = String(rawKey || '').trim().toLowerCase();
            if (key === 'licenza' || key === 'license') {
              return rawValue == null ? '' : String(rawValue).trim();
            }
          }
          return '';
        };

        const license = getLicenseValue();

        const dynamicCustomFields = {};
        if (numericFieldMap.size > 0) {
          const maxFieldNumber = Math.max(...numericFieldMap.keys());
          for (let i = 1; i <= maxFieldNumber; i += 1) {
            dynamicCustomFields[`custom${i}`] = numericFieldMap.get(i) || '';
          }
        }

        return {
          title: file.title,
          username: file.username || '',
          hasPassword: !!file.hasPassword,
          license,
          customFields: dynamicCustomFields,
          expires: file.expires ? file.expires.toISOString() : null
        };
      });

      return {
        title: officeTitle,
        files: processedFiles
      };
      });
    } catch (error) {
      console.error('❌ Errore ricerca Office in Keepass:', error.message);
      throw error;
    }
  }

  /**
   * Office in scadenza per tutte le aziende: carica KeePass UNA sola volta e restituisce le entry con scadenza entro `limit`.
   * Include anche le entry già scadute (daysLeft < 0) perché sono comunque "scadenze" rilevanti per l'Hub.
   * @param {string} password - Password KeePass
   * @param {Date} now - Data ora
   * @param {Date} limit - Data limite (es. now + 30 giorni)
   * @param {string[] | null} allowedCompanies - se valorizzato, filtra per aziende (case-insensitive)
   * @returns {Array<{aziendaName: string, title: string, username: string, expires: string, daysLeft: number}>}
   */
  async getOfficeUpcomingExpiriesAll(password, now, limit, allowedCompanies = null) {
    const allowedSet =
      Array.isArray(allowedCompanies) && allowedCompanies.length > 0
        ? new Set(allowedCompanies.map((a) => (a || '').trim().toLowerCase()).filter(Boolean))
        : null;

    const limitMs = limit instanceof Date ? limit.getTime() : new Date(limit).getTime();
    const cacheOk =
      this._officeExpiriesCache &&
      Number.isFinite(this._officeExpiriesCache.limitMs) &&
      this._officeExpiriesCache.limitMs === limitMs &&
      (Date.now() - (this._officeExpiriesCache.fetchedAt || 0)) < this.cacheTimeout &&
      Array.isArray(this._officeExpiriesCache.items);

    const computeAll = async () =>
      this.withLoadedKdbx(password, async (db) => {
      const results = [];

      const getChildGroups = (g) => {
        if (!g) return [];
        const arr = g.groups || g.children || g.subGroups;
        if (!arr) return [];
        if (Array.isArray(arr)) return arr;
        if (typeof arr[Symbol.iterator] === 'function') return [...arr];
        return [];
      };

      const extractExpiryIso = (entry) => {
        let expires = null;
        const useExpiry = entry.times && (entry.times.expires === true || entry.times.Expires === true);
        if (!useExpiry) return null;
        const raw = entry.times.expiryTime ?? entry.times.ExpiryTime;
        if (raw == null) return null;
        let d;
        if (raw instanceof Date) d = raw;
        else if (typeof raw === 'object' && typeof raw.getTime === 'function') d = raw;
        else if (typeof raw === 'object' && raw.value != null) d = new Date(raw.value);
        else d = new Date(raw);
        const maxDate = new Date();
        maxDate.setFullYear(maxDate.getFullYear() + 100);
        if (isNaN(d.getTime()) || d.getTime() <= 0 || d > maxDate) return null;
        expires = d.toISOString();
        return expires;
      };

      const extractOfficeEntries = (officeGroup, aziendaName) => {
        const out = [];
        const walk = (group) => {
          if (!group) return;
          if (group.entries) {
            for (const entry of group.entries) {
              const expires = extractExpiryIso(entry);
              if (!expires) continue;
              const titleF = entry.fields && entry.fields['Title'];
              const userF = entry.fields && entry.fields['UserName'];
              const title = titleF ? (titleF instanceof ProtectedValue ? titleF.getText() : String(titleF)) : '';
              const username = userF ? (userF instanceof ProtectedValue ? userF.getText() : String(userF)) : '';
              out.push({
                aziendaName,
                title: title || '',
                username: username || '',
                expires
              });
            }
          }
          for (const sub of getChildGroups(group)) walk(sub);
        };
        walk(officeGroup);
        return out;
      };

      const findOfficeGroupUnder = (group) => {
        if (!group) return null;
        const name = (group.name || '').toString().trim().toLowerCase();
        if (name === 'office') return group;
        for (const sub of getChildGroups(group)) {
          const found = findOfficeGroupUnder(sub);
          if (found) return found;
        }
        return null;
      };

      const findGestioneGroup = (group) => {
        if (!group) return null;
        const name = (group.name || '').toString().trim().toLowerCase();
        if (name === 'gestione') return group;
        for (const sub of getChildGroups(group)) {
          const found = findGestioneGroup(sub);
          if (found) return found;
        }
        return null;
      };

      let gestione = null;
      for (const root of db.groups || []) {
        gestione = findGestioneGroup(root);
        if (gestione) break;
      }

      let allEntries = [];
      if (gestione) {
        // I figli diretti di Gestione sono le aziende: scansioniamo solo quello, non tutto il DB.
        for (const companyGroup of getChildGroups(gestione)) {
          const aziendaName = (companyGroup?.name || '').toString().trim();
          if (!aziendaName) continue;
          const key = aziendaName.toLowerCase();
          if (allowedSet && !allowedSet.has(key)) continue;
          const officeGroup = findOfficeGroupUnder(companyGroup);
          if (!officeGroup) continue;
          allEntries = allEntries.concat(extractOfficeEntries(officeGroup, aziendaName));
        }
      } else {
        // Fallback: se non troviamo Gestione, torniamo a scansionare tutto (più lento).
        const visitSlow = (group, pathSegments = []) => {
          const name = (group.name || '').toString();
          const segments = [...pathSegments, name].map((s) => String(s || '').trim()).filter(Boolean);
          const gestioneIdx = segments.findIndex((s) => s.toLowerCase() === 'gestione');
          if (gestioneIdx >= 0 && segments.length === gestioneIdx + 2) {
            const aziendaName = segments[gestioneIdx + 1].trim();
            const aziendaKey = aziendaName.toLowerCase();
            if (allowedSet && !allowedSet.has(aziendaKey)) return [];
            const officeGroup = findOfficeGroupUnder(group);
            if (!officeGroup) return [];
            return extractOfficeEntries(officeGroup, aziendaName);
          }
          let collected = [];
          for (const sub of getChildGroups(group)) {
            collected = collected.concat(visitSlow(sub, segments));
          }
          return collected;
        };
        for (const root of db.groups || []) {
          allEntries = allEntries.concat(visitSlow(root, []));
        }
      }

      for (const item of allEntries) {
        const exp = new Date(item.expires);
        if (isNaN(exp.getTime())) continue;
        if (exp > limit) continue;
        const daysLeft = Math.ceil((exp - now) / (24 * 60 * 60 * 1000));
        results.push({
          aziendaName: item.aziendaName,
          title: item.title || '',
          username: item.username || '',
          expires: item.expires,
          daysLeft
        });
      }

      results.sort((a, b) => {
        const ta = new Date(a.expires).getTime();
        const tb = new Date(b.expires).getTime();
        return ta - tb;
      });

      return results;
    });

    const allResults = cacheOk
      ? this._officeExpiriesCache.items
      : await (async () => {
          const rows = await computeAll();
          this._officeExpiriesCache = { limitMs, fetchedAt: Date.now(), items: rows };
          return rows;
        })();

    // Filter per allowedCompanies se necessario (cache è globale).
    if (allowedSet) {
      return allResults.filter((r) => allowedSet.has(String(r.aziendaName || '').trim().toLowerCase()));
    }
    return allResults;
  }

  /**
   * Recupera la password di una singola entry Office da KeePass.
   * @param {string} password - Password del file Keepass
   * @param {string} aziendaName - Nome azienda
   * @param {object} params - { title, username } per identificare l'entry
   * @returns {string|null} Password in chiaro o null se non trovata
   */
  async getOfficeEntryPassword(password, aziendaName, params = {}) {
    try {
      const { title = '', username = '' } = params;
      return await this.withLoadedKdbx(password, async (db) => {

      const normalize = (s) => (s || '').trim();
      const titleN = normalize(title);
      const usernameN = normalize(username);

      const findEntry = (group, groupPath = '', isInOfficeGroup = false) => {
        const groupName = group.name || 'Root';
        const currentPath = groupPath ? `${groupPath} > ${groupName}` : groupName;

        let shouldInclude = true;
        if (aziendaName) {
          const pathSegments = currentPath.split('>').map(seg => seg.trim()).filter(Boolean);
          if (!this.isPathAllowedForCompany(pathSegments, aziendaName)) return null;
        }

        const isOfficeGroup = groupName.toLowerCase() === 'office';
        const currentIsInOffice = isInOfficeGroup || isOfficeGroup;

        if (group.entries && currentIsInOffice) {
          for (const entry of group.entries) {
            const tF = entry.fields && entry.fields['Title'];
            const uF = entry.fields && entry.fields['UserName'];
            const t = normalize(tF ? (tF instanceof ProtectedValue ? tF.getText() : String(tF)) : '');
            const u = normalize(uF ? (uF instanceof ProtectedValue ? uF.getText() : String(uF)) : '');
            if (t === titleN && u === usernameN) {
              const passF = entry.fields && entry.fields['Password'];
              if (!passF) return null;
              return passF instanceof ProtectedValue ? passF.getText() : String(passF || '');
            }
          }
        }

        if (group.groups) {
          for (const sub of group.groups) {
            const found = findEntry(sub, currentPath, currentIsInOffice);
            if (found !== undefined && found !== null) return found;
          }
        }
        return null;
      };

      for (const root of db.groups || []) {
        const pw = findEntry(root);
        if (pw !== undefined && pw !== null) return pw;
      }
      return null;
      });
    } catch (error) {
      console.error('❌ Errore getOfficeEntryPassword:', error.message);
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

    // Se la cache è valida, restituiscila SUBITO senza interrogare Google Drive
    if (this.macToTitleMap && this.lastCacheUpdate && (now - this.lastCacheUpdate) < this.cacheTimeout) {
      return this.macToTitleMap;
    }

    // Controlla se il file è stato modificato su Google Drive
    const currentModifiedTime = await this.checkFileModified(password);
    if (currentModifiedTime) {
      if (!this.lastFileModifiedTime) {
        // Prima volta che viene caricato - salva la data di modifica
      } else if (currentModifiedTime !== this.lastFileModifiedTime) {
        // File modificato - forza il ricaricamento
        this.macToTitleMap = null;
        this.lastCacheUpdate = null;
        this.lastFileModifiedTime = null;
        fileModified = true;
        this.kdbxFileCache = null;
      }
    }

    // Se c'è già un caricamento in corso, aspetta che finisca
    if (this.isLoading && this.loadPromise) {
      return await this.loadPromise;
    }

    // Avvia il caricamento
    this.isLoading = true;
    this.loadPromise = this.loadMacToTitleMap(password)
      .then(map => {
        // loadMacToTitleMap ha già salvato this.lastFileModifiedTime
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
        return null;
      }

      // Normalizza il MAC per la ricerca
      const normalizedMac = this.normalizeMacForSearch(macAddress);
      if (!normalizedMac) {
        return null;
      }

      // Ottieni la mappa (con cache)
      const macMap = await this.getMacToTitleMap(password);

      // Cerca il MAC nella mappa (ora è un array di entry; senza contesto azienda restituiamo l'ultima)
      const result = macMap.get(normalizedMac);
      if (Array.isArray(result) && result.length > 0) {
        return result[result.length - 1];
      }
      if (result && typeof result === 'object' && result.path !== undefined) {
        return result; // backward compat: cache con singola entry
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
   * Cerca un MAC nel file KeePass e restituisce username e password dell'entry (per controller/router).
   * Non usa cache: carica il file, trova l'entry, restituisce solo quella credenziale.
   */
  async getCredentialsByMac(macAddress, password) {
    try {
      if (!macAddress || !password) return null;
      const normalizedMac = this.normalizeMacForSearch(macAddress);
      if (!normalizedMac) return null;

      return await this.withLoadedKdbx(password, async (db) => {
      let result = null;
      const processGroup = (group) => {
        if (group.entries && group.entries.length > 0) {
          for (const entry of group.entries) {
            const allFieldNames = entry.fields ? Object.keys(entry.fields) : [];
            const customFieldNames = entry.customFields ? Object.keys(entry.customFields) : [];
            const standardFields = ['UserName', 'Password', 'URL', 'Notes', 'Title'];
            const fieldsToCheck = [...new Set([...standardFields, ...allFieldNames, ...customFieldNames])];
            for (const fieldName of fieldsToCheck) {
              let fieldValue = (entry.fields && entry.fields[fieldName]) || (entry.customFields && entry.customFields[fieldName]);
              if (fieldValue) {
                const valueStr = fieldValue instanceof ProtectedValue ? fieldValue.getText() : String(fieldValue);
                const macs = this.extractAllMacsFromField(valueStr);
                for (const m of macs) {
                  if (this.normalizeMacForSearch(m) === normalizedMac) {
                    const usernameField = entry.fields && entry.fields['UserName'];
                    const passwordField = entry.fields && entry.fields['Password'];
                    const usernameStr = usernameField ? (usernameField instanceof ProtectedValue ? usernameField.getText() : String(usernameField)) : '';
                    const passwordStr = passwordField ? (passwordField instanceof ProtectedValue ? passwordField.getText() : String(passwordField)) : '';
                    result = { username: usernameStr || '', password: passwordStr || '' };
                    return;
                  }
                }
              }
            }
          }
        }
        if (group.groups && group.groups.length > 0) {
          for (const sub of group.groups) {
            processGroup(sub);
            if (result) return;
          }
        }
      };
      if (db.groups && db.groups.length > 0) {
        for (const group of db.groups) {
          processGroup(group);
          if (result) break;
        }
      }
      return result;
      });
    } catch (error) {
      console.error('❌ getCredentialsByMac KeePass:', error.message);
      return null;
    }
  }

  /**
   * Dato un array di entry KeePass per lo stesso MAC, restituisce quella il cui path corrisponde all'azienda.
   * Es. aziendaName "Theorica" -> preferisce entry con path "gestione > Theorica > Router > ...".
   * Se nessuna corrisponde, restituisce l'ultima (comportamento "ultima vince").
   * @param {Array} entries - Array di { title, path, username, iconId }
   * @param {string} aziendaName - Nome azienda (es. "Theorica")
   * @returns {Object|null} Una singola entry o null
   */
  pickEntryForAzienda(entries, aziendaName) {
    if (!entries || !Array.isArray(entries) || entries.length === 0) return null;
    const an = (aziendaName || '').trim().toLowerCase();
    if (!an) return entries[entries.length - 1];
    // Preferisci l'entry il cui path contiene il nome azienda (es. "gestione > Theorica > ...")
    let best = null;
    let bestPathLen = 0;
    for (const e of entries) {
      const path = (e.path || '').trim().toLowerCase();
      if (path.includes(an)) {
        // Se più entry matchano, prendi quella con path più lungo (più specifica)
        if (path.length > bestPathLen) {
          bestPathLen = path.length;
          best = e;
        }
      }
    }
    return best || entries[entries.length - 1];
  }

  /**
   * Invalida la cache (forza il ricaricamento al prossimo accesso)
   */
  invalidateCache() {
    this.macToTitleMap = null;
    this.lastCacheUpdate = null;
    this.lastFileModifiedTime = null; // Reset anche la data di modifica per forzare il controllo
    this.kdbxFileCache = null;
    this.kdbxFileFetchPromise = null;
  }
}

// Esporta un'istanza singleton
module.exports = new KeepassDriveService();
