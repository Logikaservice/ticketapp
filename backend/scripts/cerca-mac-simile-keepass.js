// Script per cercare MAC simili in KeePass (per trovare variazioni)
// Esegui: node backend/scripts/cerca-mac-simile-keepass.js <mac_address>

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const keepassDriveService = require('../utils/keepassDriveService');
const { Kdbx, Credentials, ProtectedValue } = require('kdbxweb');
const { google } = require('googleapis');

async function cercaMacSimile() {
  const macAddress = process.argv[2] || '90:09:D0:39:DC:35';

  if (!process.env.KEEPASS_PASSWORD) {
    console.error('❌ KEEPASS_PASSWORD non configurata nel file .env');
    process.exit(1);
  }

  console.log('🔍 RICERCA MAC SIMILI IN KEEPASS');
  console.log('='.repeat(60));
  console.log('');
  console.log(`MAC da cercare: ${macAddress}`);
  console.log('');

  try {
    // Carica il file KDBX direttamente
    console.log('📥 Caricamento file KeePass...');
    const fileBuffer = await keepassDriveService.downloadKeepassFile(process.env.KEEPASS_PASSWORD);
    
    const credentials = new Credentials(ProtectedValue.fromString(process.env.KEEPASS_PASSWORD));
    const db = await Kdbx.load(fileBuffer.buffer, credentials);
    
    console.log(`✅ File KDBX caricato: ${db.name || 'Senza nome'}`);
    console.log('');

    // Crea pattern di ricerca flessibili
    const macNormalized = macAddress.replace(/[:-]/g, '').toUpperCase();
    const macPrefix = macNormalized.slice(0, 6); // Primi 6 caratteri
    
    console.log(`MAC normalizzato: ${macNormalized}`);
    console.log(`Prefisso MAC (primi 6 caratteri): ${macPrefix}`);
    console.log('');
    console.log('🔍 Cercando MAC che iniziano con questo prefisso...');
    console.log('');

    const risultati = [];
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

          // Cerca MAC in tutti i campi
          const fieldsToCheck = ['UserName', 'Password', 'URL', 'Notes', 'Title'];
          const campiCercati = [];

          for (const fieldName of fieldsToCheck) {
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
                      // Controlla se corrisponde o è simile
                      if (macFound === macNormalized) {
                        risultati.push({
                          tipo: 'ESATTO',
                          mac: match,
                          macNormalizzato: macFound,
                          titolo: titleStr,
                          campo: fieldName,
                          percorso: currentPath,
                          valoreCampo: valueStr.substring(0, 200) // Primi 200 caratteri
                        });
                      } else if (macFound.startsWith(macPrefix)) {
                        risultati.push({
                          tipo: 'SIMILE (stesso prefisso)',
                          mac: match,
                          macNormalizzato: macFound,
                          titolo: titleStr,
                          campo: fieldName,
                          percorso: currentPath,
                          valoreCampo: valueStr.substring(0, 200)
                        });
                      }
                    }
                  }
                }
              }
              
              // Cerca anche il MAC come stringa letterale
              if (valueStr.toUpperCase().includes(macAddress.toUpperCase()) || 
                  valueStr.toUpperCase().includes(macNormalized)) {
                campiCercati.push({
                  campo: fieldName,
                  valore: valueStr.substring(0, 300)
                });
              }
            }
          }

          // Se trovato come stringa letterale ma non come MAC
          if (campiCercati.length > 0 && risultati.filter(r => r.macNormalizzato === macNormalized).length === 0) {
            risultati.push({
              tipo: 'STRINGA LETTERALE (non riconosciuto come MAC)',
              mac: macAddress,
              macNormalizzato: macNormalized,
              titolo: titleStr,
              campiTrovati: campiCercati,
              percorso: currentPath
            });
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
    console.log('');

    if (risultati.length === 0) {
      console.log('❌ MAC NON TROVATO');
      console.log('');
      console.log('Il MAC non è presente nel file KeePass in nessuna forma riconosciuta.');
      console.log('');
      console.log('Suggerimenti:');
      console.log('  1. Verifica che il MAC sia presente nel file KeePass locale');
      console.log('  2. Verifica che il file su Google Drive sia sincronizzato');
      console.log('  3. Controlla in quale campo è presente il MAC');
      console.log('  4. Verifica il formato del MAC (dovrebbe essere tipo 90:09:D0:39:DC:35 o 90-09-D0-39-DC-35)');
    } else {
      console.log(`✅ TROVATI ${risultati.length} RISULTATI:`);
      console.log('');

      risultati.forEach((r, index) => {
        console.log(`\n📄 Risultato ${index + 1}: ${r.tipo}`);
        console.log(`   MAC trovato: ${r.mac}`);
        console.log(`   MAC normalizzato: ${r.macNormalizzato}`);
        console.log(`   Titolo: "${r.titolo}"`);
        console.log(`   Campo: ${r.campo || 'Vedi campiTrovati'}`);
        console.log(`   Percorso: ${r.percorso}`);
        if (r.valoreCampo) {
          console.log(`   Valore campo: ${r.valoreCampo}`);
        }
        if (r.campiTrovati) {
          console.log(`   Campi trovati:`);
          r.campiTrovati.forEach(c => {
            console.log(`     - ${c.campo}: ${c.valore}`);
          });
        }
      });
    }

    console.log('');
    console.log('='.repeat(60));

    process.exit(risultati.length > 0 ? 0 : 1);
  } catch (error) {
    console.error('');
    console.error('❌ ERRORE:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

cercaMacSimile();
