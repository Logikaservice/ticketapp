// Script per elencare TUTTI i MAC address trovati nel file KeePass
// Esegui: node backend/scripts/lista-tutti-mac-keepass.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const keepassDriveService = require('../utils/keepassDriveService');
const { Kdbx, Credentials, ProtectedValue } = require('kdbxweb');

async function listaTuttiMac() {
  if (!process.env.KEEPASS_PASSWORD) {
    console.error('❌ KEEPASS_PASSWORD non configurata nel file .env');
    process.exit(1);
  }

  console.log('📋 LISTA TUTTI I MAC IN KEEPASS');
  console.log('='.repeat(60));
  console.log('');

  try {
    // Carica il file KDBX direttamente
    console.log('📥 Caricamento file KeePass...');
    const fileBuffer = await keepassDriveService.downloadKeepassFile(process.env.KEEPASS_PASSWORD);
    
    const credentials = new Credentials(ProtectedValue.fromString(process.env.KEEPASS_PASSWORD));
    const db = await Kdbx.load(fileBuffer.buffer, credentials);
    
    console.log(`✅ File KDBX caricato: ${db.name || 'Senza nome'}`);
    console.log('');

    const tuttiMac = [];
    let totaleEntry = 0;

    // Funzione ricorsiva per processare gruppi ed entry
    const processGroup = (group, groupPath = '') => {
      const currentPath = groupPath ? `${groupPath} > ${group.name || 'Root'}` : (group.name || 'Root');
      
      // Processa le entry del gruppo
      if (group.entries && group.entries.length > 0) {
        for (const entry of group.entries) {
          totaleEntry++;
          
          const titleField = entry.fields && entry.fields['Title'];
          const titleStr = titleField ? (titleField instanceof ProtectedValue ? titleField.getText() : String(titleField)) : '';

          // Ottieni TUTTI i nomi dei campi disponibili (inclusi campi personalizzati)
          const allFieldNames = entry.fields ? Object.keys(entry.fields) : [];
          
          // Cerca MAC in TUTTI i campi
          for (const fieldName of allFieldNames) {
            const fieldValue = entry.fields && entry.fields[fieldName];
            if (fieldValue) {
              const valueStr = fieldValue instanceof ProtectedValue 
                ? fieldValue.getText() 
                : String(fieldValue);
              
              // Cerca pattern MAC (qualsiasi formato)
              const macPatterns = [
                /([0-9A-F]{2}[:-]){5}[0-9A-F]{2}/gi,  // Con separatori
                /[0-9A-F]{12}/gi,  // Senza separatori
                /\b[0-9A-F]{2}[:\-\s][0-9A-F]{2}[:\-\s][0-9A-F]{2}[:\-\s][0-9A-F]{2}[:\-\s][0-9A-F]{2}[:\-\s][0-9A-F]{2}\b/gi  // Con spazi
              ];

              for (const pattern of macPatterns) {
                const matches = valueStr.match(pattern);
                if (matches) {
                  for (const match of matches) {
                    const macFound = match.replace(/[:\-\s]/g, '').toUpperCase();
                    if (macFound.length === 12) {
                      // Evita duplicati
                      const giaTrovato = tuttiMac.find(m => m.macNormalizzato === macFound);
                      if (!giaTrovato) {
                        tuttiMac.push({
                          mac: match,
                          macNormalizzato: macFound,
                          titolo: titleStr,
                          campo: fieldName,
                          percorso: currentPath,
                          valoreCampo: valueStr.substring(0, 100) // Primi 100 caratteri
                        });
                      }
                    }
                  }
                }
              }
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

    console.log(`📊 Entry totali analizzate: ${totaleEntry}`);
    console.log(`📋 MAC totali trovati: ${tuttiMac.length}`);
    console.log('');

    // Ordina per MAC normalizzato
    tuttiMac.sort((a, b) => a.macNormalizzato.localeCompare(b.macNormalizzato));

    // Cerca il MAC specifico
    const macCercato = '9009D039DC35'; // 90:09:D0:39:DC:35 normalizzato
    const trovato = tuttiMac.find(m => m.macNormalizzato === macCercato);

    if (trovato) {
      console.log('✅ MAC 90:09:D0:39:DC:35 TROVATO!');
      console.log('='.repeat(60));
      console.log(`   MAC: ${trovato.mac}`);
      console.log(`   MAC Normalizzato: ${trovato.macNormalizzato}`);
      console.log(`   Titolo: "${trovato.titolo}"`);
      console.log(`   Campo: ${trovato.campo}`);
      console.log(`   Percorso: ${trovato.percorso}`);
      console.log(`   Valore campo: ${trovato.valoreCampo}`);
      console.log('');
    } else {
      console.log('❌ MAC 90:09:D0:39:DC:35 NON TROVATO');
      console.log('');
      
      // Mostra MAC simili (stesso prefisso)
      const macSimili = tuttiMac.filter(m => m.macNormalizzato.startsWith('9009D0'));
      if (macSimili.length > 0) {
        console.log(`🔍 MAC con prefisso 90:09:D0 (${macSimili.length} trovati):`);
        for (const mac of macSimili) {
          console.log(`   ${mac.mac} (normalizzato: ${mac.macNormalizzato}) -> "${mac.titolo}" (campo: ${mac.campo})`);
        }
        console.log('');
      }
    }

    console.log('='.repeat(60));
    console.log(`📋 PRIMI 20 MAC TROVATI:`);
    console.log('');
    for (let i = 0; i < Math.min(20, tuttiMac.length); i++) {
      const m = tuttiMac[i];
      console.log(`${i + 1}. ${m.mac} (${m.macNormalizzato}) -> "${m.titolo}" (${m.campo})`);
    }
    
    if (tuttiMac.length > 20) {
      console.log('');
      console.log(`... e altri ${tuttiMac.length - 20} MAC`);
    }

    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ ERRORE:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

listaTuttiMac();
