# Network Monitor Agent - Servizio Windows con Tray Icon

## 🎯 Nuovo Sistema di Esecuzione

L'agent ora può funzionare come **servizio Windows permanente** con **icona nella system tray**, simile all'agent Synology Drive.

### Vantaggi rispetto al Scheduled Task:

✅ **Sempre attivo**: Il servizio rimane in esecuzione anche dopo il riavvio  
✅ **Tray icon**: Icona visibile nella system tray (vicino all'orologio)  
✅ **Monitoraggio continuo**: Loop continuo invece di esecuzioni periodiche separate  
✅ **Maggiore affidabilità**: Restart automatico in caso di crash  
✅ **Controllo facile**: Menu contestuale dalla tray icon  
✅ **Log migliorati**: File di log dedicati per stdout/stderr  

---

## 📦 Installazione

### Opzione 1: Installazione Automatica (Consigliata)

1. **Prepara i file:**
   - Copia tutti i file nella directory dell'agent (es: `C:\ProgramData\NetworkMonitorAgent\`)
   - Assicurati di avere `config.json` configurato

2. **Installa il servizio:**
   ```powershell
   # Esegui PowerShell come Amministratore
   .\Installa-Servizio.ps1
   ```

   Lo script:
   - Scarica automaticamente NSSM (Non-Sucking Service Manager)
   - Rimuove il vecchio Scheduled Task (opzionale)
   - Installa il servizio Windows
   - Avvia automaticamente il servizio

3. **Avvia la tray icon (opzionale):**
   ```
   .\NetworkMonitorService.ps1 -ConfigPath "config.json"
   ```
   
   Questo avvia l'applicazione con icona nella system tray per monitorare lo stato del servizio.

### Opzione 2: Solo Tray Icon (Senza Servizio)

Per testare o usare solo con tray icon (senza servizio):

```powershell
.\NetworkMonitorService.ps1 -ConfigPath "config.json"
```

Questo avvia l'applicazione in foreground con icona nella system tray.

---

## 🔧 Gestione Servizio

### Comandi PowerShell:

```powershell
# Avvia servizio
Start-Service -Name "NetworkMonitorService"

# Ferma servizio
Stop-Service -Name "NetworkMonitorService"

# Verifica stato
Get-Service -Name "NetworkMonitorService"

# Riavvia servizio
Restart-Service -Name "NetworkMonitorService"
```

### Rimozione Servizio:

```powershell
# Esegui PowerShell come Amministratore
.\Rimuovi-Servizio.ps1
```

---

## 📊 Tray Icon

L'icona nella system tray fornisce:

### Menu Contestuale (Click destro):
- **Stato**: Mostra stato corrente (In esecuzione, Errore, ecc.)
- **Apri cartella log**: Apre Esplora File nella directory dei log
- **Visualizza log**: Apre il file di log in Notepad
- **Esci**: Chiude l'applicazione tray icon (non il servizio)

### Doppio Click:
Mostra finestra con informazioni dettagliate:
- Stato servizio
- Ultima scansione eseguita
- Numero dispositivi trovati

### Tooltip (Hover):
Mostra:
- Stato corrente
- Tempo dall'ultima scansione
- Numero dispositivi trovati

### Stati Icona:
- 🟢 **Icona blu/verde**: Servizio in esecuzione normale
- 🟡 **Icona gialla**: Scansione in corso
- 🔴 **Icona rossa**: Errore rilevato

---

## 📁 File e Directory

Dopo l'installazione:

```
C:\ProgramData\NetworkMonitorAgent\
├── NetworkMonitor.ps1              # Script originale (chiamato dal servizio)
├── NetworkMonitorService.ps1       # Script servizio principale
├── Installa-Servizio.ps1           # Installer servizio
├── Rimuovi-Servizio.ps1            # Disinstaller servizio
├── config.json                     # Configurazione
├── nssm.exe                        # NSSM (scaricato automaticamente)
├── NetworkMonitorService.log       # Log principale servizio
├── NetworkMonitorService_stdout.log # Log stdout (NSSM)
├── NetworkMonitorService_stderr.log # Log stderr (NSSM)
└── .agent_status.json              # File stato (ultima scansione, ecc.)
```

---

## 🔄 Migrazione da Scheduled Task

Se hai già installato l'agent con Scheduled Task:

1. **Installa il servizio:**
   ```powershell
   .\Installa-Servizio.ps1 -RemoveOldTask
   ```
   
   Questo rimuove automaticamente il vecchio Scheduled Task.

2. **Verifica migrazione:**
   - Il servizio dovrebbe essere avviato automaticamente
   - Controlla nella dashboard che i dati arrivino correttamente
   - Il vecchio Scheduled Task viene rimosso automaticamente

---

## 🐛 Troubleshooting

### Servizio non si avvia:

1. **Verifica log:**
   ```
   Controlla: NetworkMonitorService.log
   Oppure: NetworkMonitorService_stdout.log
   ```

2. **Verifica config.json:**
   ```powershell
   Get-Content config.json | ConvertFrom-Json
   ```
   
   Assicurati che `server_url`, `api_key` e `network_ranges` siano configurati.

3. **Test manuale:**
   ```powershell
   .\NetworkMonitorService.ps1 -ConfigPath "config.json"
   ```
   
   Questo avvia l'applicazione in foreground per vedere eventuali errori.

### Tray icon non appare:

- Il servizio funziona in background anche senza tray icon
- Per mostrare la tray icon, esegui manualmente: `.\NetworkMonitorService.ps1`
- La tray icon è solo per monitoraggio, il servizio continua a funzionare anche se non c'è

### Reinstallazione:

Se hai problemi, puoi reinstallare:

1. **Rimuovi servizio:**
   ```powershell
   .\Rimuovi-Servizio.ps1
   ```

2. **Reinstalla:**
   ```powershell
   .\Installa-Servizio.ps1
   ```

---

## ⚙️ Configurazione Avanzata

### Cambio Intervallo Scansione:

L'intervallo viene gestito automaticamente dal server. Se cambi `scan_interval_minutes` nella dashboard:

1. Il servizio rileva il cambio al prossimo heartbeat
2. Aggiorna automaticamente l'intervallo
3. Non serve riavviare il servizio

### Log Rotation:

I log vengono ruotati automaticamente:
- **Dimensione massima**: 10 MB
- **Rotazione giornaliera**: Ogni 24 ore
- **Numero backup**: 1 (il file precedente viene mantenuto)

---

## 📝 Note Tecniche

- **NSSM**: Usiamo NSSM (Non-Sucking Service Manager) per wrappare lo script PowerShell come servizio Windows. NSSM è open source e molto affidabile.

- **Servizio vs Tray Icon**: 
  - Il servizio gira sempre in background (anche senza utente loggato)
  - La tray icon è un'applicazione separata che monitora lo stato (richiede utente loggato)

- **Compatibilità**: Il servizio funziona su Windows 7+ (con PowerShell 5.1+) e Windows 10/11.

---

## 🔐 Requisiti

- **Windows**: 7 o superiore
- **PowerShell**: 5.1 o superiore
- **Privilegi**: Amministratore per installazione
- **Connessione Internet**: Per download NSSM durante installazione (opzionale, puoi scaricarlo manualmente)

---

## 🆘 Supporto

Per problemi o domande:
1. Controlla i log: `NetworkMonitorService.log`
2. Esegui diagnostica: `.\Diagnostica-Agent.ps1`
3. Test manuale: `.\NetworkMonitorService.ps1`
