# 🚀 Guida Installazione Network Monitor Service (Nuovo Sistema)

## 📋 Requisiti

- **Windows**: 7 o superiore
- **PowerShell**: 5.1 o superiore
- **Privilegi**: Amministratore per installazione
- **Connessione Internet**: Per download NSSM (opzionale, può essere scaricato manualmente)

---

## 📥 Passo 1: Scarica il Nuovo Pacchetto

1. **Accedi alla dashboard TicketApp** come tecnico/admin
2. Vai su **"Monitoraggio Rete"** (pulsante nel menu rapido)
3. Seleziona l'azienda del cliente
4. Clicca sul pulsante **"Scarica Pacchetto"** per l'agent desiderato
5. Salva il file ZIP (es: `NetworkMonitor-Agent-NomeAgent.zip`)

---

## 📦 Passo 2: Estrai e Prepara i File

1. **Estrai il ZIP** in una directory **permanente**:
   - ✅ **Consigliato**: `C:\ProgramData\NetworkMonitorAgent\`
   - ✅ **Alternativa**: `C:\Tools\NetworkMonitorAgent\`
   - ❌ **NON usare**: `C:\Users\[NomeUtente]\Downloads\` (viene spesso pulita)

2. **Verifica che i file siano presenti**:
   ```
   C:\ProgramData\NetworkMonitorAgent\
   ├── config.json
   ├── NetworkMonitor.ps1
   ├── NetworkMonitorService.ps1    ← NUOVO
   ├── Installa-Servizio.ps1         ← NUOVO
   ├── Rimuovi-Servizio.ps1          ← NUOVO
   ├── InstallerCompleto.ps1         (vecchio metodo, opzionale)
   └── README_SERVICE.md              ← NUOVO
   ```

---

## 🔧 Passo 3: Installa il Servizio Windows

### Opzione A: Installazione Automatica (Consigliata)

1. **Apri PowerShell come Amministratore**:
   - Tasto destro su "PowerShell" → "Esegui come amministratore"
   - Oppure: Cerca "PowerShell" → Tasto destro → "Esegui come amministratore"

2. **Vai alla directory dell'agent**:
   ```powershell
   cd C:\ProgramData\NetworkMonitorAgent
   ```

3. **Esegui l'installer**:
   ```powershell
   .\Installa-Servizio.ps1 -RemoveOldTask
   ```
   
   Il parametro `-RemoveOldTask` rimuove automaticamente il vecchio Scheduled Task se presente.

4. **Attendi il completamento**:
   - L'installer scaricherà automaticamente NSSM (Non-Sucking Service Manager)
   - Creerà il servizio Windows "NetworkMonitorService"
   - Avvierà automaticamente il servizio
   - Mostrerà il risultato finale

### Opzione B: Solo Tray Icon (Senza Servizio - Solo Test)

Se vuoi solo testare senza installare come servizio:

```powershell
.\NetworkMonitorService.ps1 -ConfigPath "config.json"
```

Questo avvia l'applicazione con icona nella system tray per monitorare lo stato (utile per debug).

---

## ✅ Passo 4: Verifica Installazione

### Verifica Servizio

```powershell
# Verifica stato servizio
Get-Service -Name "NetworkMonitorService"

# Dovresti vedere:
# Status: Running
# DisplayName: Network Monitor Agent Service
```

### Verifica Tray Icon (Opzionale)

1. **Avvia l'applicazione tray icon**:
   ```powershell
   cd C:\ProgramData\NetworkMonitorAgent
   .\NetworkMonitorService.ps1 -ConfigPath "config.json"
   ```

2. **Controlla la system tray** (icona vicino all'orologio):
   - Dovresti vedere un'icona blu/verde quando tutto funziona
   - Click destro per menu contestuale
   - Doppio click per informazioni dettagliate

---

## 🔄 Passo 5: Migrazione da Scheduled Task (Se Applicabile)

Se avevi già installato l'agent con il **vecchio metodo** (Scheduled Task):

### Metodo Automatico (Consigliato)

L'installer con `-RemoveOldTask` rimuove automaticamente il vecchio Scheduled Task:

```powershell
.\Installa-Servizio.ps1 -RemoveOldTask
```

### Metodo Manuale

Se preferisci farlo manualmente:

```powershell
# 1. Ferma il vecchio Scheduled Task (se è in esecuzione)
Stop-ScheduledTask -TaskName "NetworkMonitorAgent"

# 2. Rimuovi il vecchio Scheduled Task
Unregister-ScheduledTask -TaskName "NetworkMonitorAgent" -Confirm:$false

# 3. Installa il nuovo servizio
.\Installa-Servizio.ps1
```

---

## 🎛️ Gestione Servizio

### Comandi Utili

```powershell
# Avvia servizio
Start-Service -Name "NetworkMonitorService"

# Ferma servizio
Stop-Service -Name "NetworkMonitorService"

# Riavvia servizio
Restart-Service -Name "NetworkMonitorService"

# Verifica stato
Get-Service -Name "NetworkMonitorService"

# Visualizza log
notepad C:\ProgramData\NetworkMonitorAgent\NetworkMonitorService.log

# Visualizza log stdout/stderr (NSSM)
notepad C:\ProgramData\NetworkMonitorAgent\NetworkMonitorService_stdout.log
notepad C:\ProgramData\NetworkMonitorAgent\NetworkMonitorService_stderr.log
```

### Disinstallazione

```powershell
# Esegui PowerShell come Amministratore
cd C:\ProgramData\NetworkMonitorAgent
.\Rimuovi-Servizio.ps1
```

Oppure:

```powershell
# Rimuovi servizio manualmente usando NSSM
.\nssm.exe remove NetworkMonitorService confirm

# Oppure rimuovi servizio usando sc.exe
sc.exe delete NetworkMonitorService
```

---

## 🔍 Troubleshooting

### Servizio non si avvia

1. **Verifica log**:
   ```powershell
   Get-Content C:\ProgramData\NetworkMonitorAgent\NetworkMonitorService.log -Tail 50
   ```

2. **Verifica config.json**:
   ```powershell
   Get-Content C:\ProgramData\NetworkMonitorAgent\config.json | ConvertFrom-Json
   ```
   
   Assicurati che `server_url`, `api_key` e `network_ranges` siano configurati.

3. **Test manuale**:
   ```powershell
   cd C:\ProgramData\NetworkMonitorAgent
   .\NetworkMonitorService.ps1 -ConfigPath "config.json"
   ```
   
   Questo avvia l'applicazione in foreground per vedere eventuali errori.

### Tray icon non appare

- Il servizio funziona in background anche senza tray icon
- Per mostrare la tray icon, esegui manualmente: `.\NetworkMonitorService.ps1`
- La tray icon è solo per monitoraggio, il servizio continua a funzionare anche senza

### Errore "NSSM non trovato"

L'installer scarica automaticamente NSSM, ma se fallisce:

1. **Download manuale**:
   - Vai su: https://nssm.cc/download
   - Scarica `nssm-2.24.zip`
   - Estrai `win64\nssm.exe`
   - Copia `nssm.exe` nella directory dell'agent: `C:\ProgramData\NetworkMonitorAgent\`

2. **Riesegui installer**:
   ```powershell
   .\Installa-Servizio.ps1
   ```

---

## 🎯 Differenze tra Vecchio e Nuovo Sistema

| Aspetto | Vecchio (Scheduled Task) | Nuovo (Servizio Windows) |
|---------|-------------------------|-------------------------|
| **Avvio** | Esegue script ogni X minuti | Loop continuo sempre attivo |
| **Intervallo scansione** | Gestito da Scheduled Task | Gestito internamente nel servizio |
| **Modifica intervallo** | Richiede ricreare Scheduled Task | Aggiornato automaticamente senza restart |
| **Tray icon** | ❌ Non disponibile | ✅ Disponibile |
| **Log** | Script singoli | Log continuo |
| **Gestione** | Task Scheduler | Windows Services |
| **Restart automatico** | Limitato | Gestito da NSSM |

---

## 📊 Monitoraggio

### Dashboard TicketApp

Il servizio invia heartbeat ogni 5 minuti e dati di scansione periodicamente. Controlla nella dashboard:
- **Stato agent**: Dovrebbe essere "online"
- **Ultimo heartbeat**: Dovrebbe essere recente (< 10 minuti)
- **Dispositivi**: Dovrebbero apparire nella lista

### Tray Icon (Opzionale)

- 🟢 **Icona blu/verde**: Servizio in esecuzione normale
- 🟡 **Icona gialla**: Scansione in corso
- 🔴 **Icona rossa**: Errore rilevato

### File di Stato

Il servizio crea un file `.agent_status.json` nella directory dell'agent con:
- Stato corrente
- Ultima scansione eseguita
- Numero dispositivi trovati
- Intervallo scansione corrente

---

## ⚙️ Configurazione Avanzata

### Cambio Intervallo Scansione

1. **Dalla dashboard**: Modifica `scan_interval_minutes` nell'agent
2. Il servizio rileva automaticamente il cambio al prossimo heartbeat (max 5 minuti)
3. L'intervallo viene aggiornato senza riavviare il servizio
4. Viene salvato in `config.json` per persistenza

### Log Rotation

I log vengono ruotati automaticamente da NSSM:
- **Dimensione massima**: 10 MB
- **Rotazione giornaliera**: Ogni 24 ore
- **Numero backup**: 1 (il file precedente viene mantenuto)

---

## 📞 Supporto

Per problemi:

1. **Controlla log**: `NetworkMonitorService.log`
2. **Esegui diagnostica**: `.\Diagnostica-Agent.ps1`
3. **Test manuale**: `.\NetworkMonitorService.ps1 -ConfigPath "config.json"`

---

## ✅ Checklist Installazione

- [ ] Pacchetto scaricato dalla dashboard
- [ ] File estratti in directory permanente
- [ ] PowerShell eseguito come Amministratore
- [ ] `Installa-Servizio.ps1` eseguito con successo
- [ ] Servizio installato e avviato (`Get-Service -Name "NetworkMonitorService"`)
- [ ] Vecchio Scheduled Task rimosso (se presente)
- [ ] Agent visibile nella dashboard come "online"
- [ ] (Opzionale) Tray icon avviata e visibile

---

## 🎉 Fine!

Una volta completati tutti i passaggi, il servizio è attivo e funzionante! 

Il servizio:
- ✅ Si avvia automaticamente all'avvio di Windows
- ✅ Rimane sempre attivo
- ✅ Esegue scansioni periodicamente in base all'intervallo configurato
- ✅ Aggiorna automaticamente l'intervallo se modificato dalla dashboard
- ✅ Mostra icona nella system tray (se avviata l'app)
- ✅ Non dipende più dai Scheduled Task di Windows
