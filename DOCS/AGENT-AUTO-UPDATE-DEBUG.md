# Perché l'agent 2.3.0 non si aggiorna a 2.4.0 in automatico

## Flusso auto-update

1. **Quando parte il controllo**
   - All'**avvio** del servizio
   - Ogni **heartbeat** (circa ogni 5 minuti), insieme all’invio dello stato

2. **Cosa fa `Check-AgentUpdate`**
   - Chiama: `GET {server_url}/api/network-monitoring/agent-version` (senza API Key)
   - Legge `version` dalla risposta (`serverVersion`)
   - Usa come versione locale: `config.version` se esiste, altrimenti `$SCRIPT_VERSION` (`CurrentVersion`)
   - Se `serverVersion -ne CurrentVersion` → scarica `NetworkMonitorService.ps1`, aggiorna `config.json`, esce; NSSM (AppExit Restart) riavvia il processo che carica lo script aggiornato. Downtime ~60 s.

3. **Dove può andare storto**

   | Causa | Cosa controllare |
   |-------|------------------|
   | **VPS non aggiornata** | `/api/network-monitoring/agent-version` deve restituire `{"version":"2.4.0",...}`. Verifica: `curl -s "https://ticket.logikaservice.it/api/network-monitoring/agent-version"` e `pm2 restart backend` dopo `git pull`. |
   | **Errore di rete o HTTPS** | Nei log: `[WARN] Errore controllo aggiornamenti: ...` e `[WARN] URL tentato: ...`. Possibili: timeout, TLS, certificato, firewall. |
   | **`server_url` errato** | In `config.json`, `server_url` deve essere la base, es. `https://ticket.logikaservice.it`, **senza** `/api`. Se è `.../api` viene usato comunque `serverBase` per evitare `.../api/api/...`. |
   | **`config.version` già 2.4.0** | Se in `config.json` c’è `"version":"2.4.0"` ma lo script è ancora 2.3.0, il confronto non scatta. Verifica il contenuto di `config.json`. |
   | **`nssm.exe` assente** | Se in `C:\ProgramData\NetworkMonitorAgent` non c’è `nssm.exe`, il servizio non viene reinstallato. Nei log: `[WARN] nssm.exe non trovato...`. |

## Agent 2.3.0 che vanno offline dopo aver rilevato l’aggiornamento (2.4.0)

**Causa (fix in 2.4.0):**  
`Check-AgentUpdate` chiamava `Stop-Service -Name "NetworkMonitorService"` da **dentro** il processo del servizio. Il SCM (Service Control Manager) terminava il processo prima che lo script eseguisse `sc delete`, `nssm install` e `Start-Service`. Il servizio restava **STOPPED**, l’agent offline. I file su disco (e `config.json`) erano già stati aggiornati a 2.4.0.

**Fix (da 2.4.0):**  
Dopo aver sostituito i file e aggiornato `config.json`, lo script fa solo `exit 0`. NSSM, con `AppExit Default Restart` e `AppRestartDelay 60000`, riavvia il comando dopo ~60 secondi; il nuovo processo carica il `NetworkMonitorService.ps1` già aggiornato su disco. Nessuna chiamata a `Stop-Service`/`sc`/`nssm` da dentro il servizio.

**Se un agent è già rimasto offline (servizio STOPPED) dopo un tentativo di update:**
- Su disco e in `config.json` è già 2.4.0.
- **Aprire PowerShell o CMD come amministratore:** menu Start → cercare "PowerShell" o "Prompt dei comandi" → tasto destro → **"Esegui come amministratore"** (in barra del titolo deve comparire "Amministratore").
- Avviare il servizio:
  - **PowerShell:** `Start-Service -Name "NetworkMonitorService"`
  - **CMD:** `net start NetworkMonitorService`
- Oppure **riavviare il PC**.

### Se Start-Service o net start falliscono

| Errore | Cosa fare |
|--------|-----------|
| **Accesso negato** / **Errore di sistema 5** | La finestra non è eseguita come amministratore. Chiudere, aprire PowerShell o CMD con "Esegui come amministratore" e riprovare. |
| **Impossibile avviare il servizio NetworkMonitorService** | 1) Finestra **Amministratore**. 2) Vedi sotto: **Avvio in primo piano** e **Reinstallare il servizio**. |

### Far funzionare l'agent senza riavvio (log vuoti)

Se **non puoi riavviare il PC** e in `NetworkMonitorService.log` / `_stderr.log` / `_stdout.log` **non vedi nulla**:

1. **Log bootstrap** (scritto subito all’avvio, anche se poi va in crash):  
   `C:\ProgramData\NetworkMonitorAgent\NetworkMonitorService_bootstrap.log`  
   - Se è **vuoto**: il processo non parte (servizio rotto, path sbagliato).  
   - Se c’è una riga `BOOT: avvio...` e poi niente: lo script è crashato subito dopo; l’ultima riga può dare un indizio.

2. **Avvio in primo piano (soluzione immediata, senza servizio)**  
   L’agent gira nella finestra PowerShell: finché non la chiudi, resta online. Nessun riavvio.

   - Scarica **`Avvia-Agent-Manuale.ps1`**: repo `agent/` oppure `{server_url}/api/network-monitoring/download/agent/Avvia-Agent-Manuale.ps1` (es. `https://ticket.logikaservice.it/.../Avvia-Agent-Manuale.ps1`). Salvalo in `C:\ProgramData\NetworkMonitorAgent` (o nella cartella di `NetworkMonitorService.ps1` e `config.json`).  
   - Apri **PowerShell come Amministratore**, poi:
     ```powershell
     & "C:\ProgramData\NetworkMonitorAgent\Avvia-Agent-Manuale.ps1"
     ```
   - **Non chiudere la finestra**: l’agent è online finché resta aperta. Per fermare: Ctrl+C.  
   - Se l’installazione è in un’altra cartella, adatta il percorso; oppure `cd` in quella cartella e esegui `.\Avvia-Agent-Manuale.ps1`.

   In alternativa, senza script:
   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File "C:\ProgramData\NetworkMonitorAgent\NetworkMonitorService.ps1" -ConfigPath "C:\ProgramData\NetworkMonitorAgent\config.json"
   ```
   (sostituisci il percorso se l’agent è installato altrove)

3. **Reinstallare il servizio (per farlo ripartire come servizio, senza riavvio)**  
   - Scarica **`Reinstalla-Servizio-Quick.ps1`** (repo agent o `{server_url}/api/network-monitoring/download/agent/Reinstalla-Servizio-Quick.ps1`) e salvalo in `C:\ProgramData\NetworkMonitorAgent`.  
   - PowerShell **come Amministratore**:
     ```powershell
     & "C:\ProgramData\NetworkMonitorAgent\Reinstalla-Servizio-Quick.ps1"
     ```
   - Se l’installazione è altrove:  
     `.\Reinstalla-Servizio-Quick.ps1 -InstallDir "D:\Percorso\Agent"`  
   - Richiede `nssm.exe` nella stessa cartella. Se dopo la reinstallazione il servizio non parte, usa l’**avvio in primo piano** (punto 2).

## Cosa verificare su un agent 2.3.0 che non si aggiorna

1. **Log** in `C:\ProgramData\NetworkMonitorAgent\NetworkMonitorService.log`:
   - `[INFO] Controllo aggiornamenti agent... (versione corrente: 2.3.0)` → il controllo parte
   - `[INFO] Versione disponibile sul server: 2.4.0]` → la VPS risponde 2.4.0
   - `[INFO] Nuova versione disponibile! Avvio aggiornamento...` → parte l’aggiornamento
   - `[WARN] Errore controllo aggiornamenti: ...` e `[WARN] URL tentato: ...` → errore (rete, URL, backend)

2. **VPS**
   - `curl -s "https://ticket.logikaservice.it/api/network-monitoring/agent-version"`
   - Deve contenere `"version":"2.4.0"`. Se è ancora `2.3.0`, fare `git pull` e `pm2 restart backend`.

3. **Config sull’agent**
   - Aprire `C:\ProgramData\NetworkMonitorAgent\config.json`
   - Controllare `server_url` (solo base, senza `/api`) e `version` (in un 2.3.0 che non si aggiorna dovrebbe essere `2.3.0`).

## Modifiche fatte nell’agent (log, URL, riavvio)

- **URL:** uso di `serverBase` (rimozione di `/api` e slash finali da `server_url`) per costruire l’URL di `agent-version` e evitare `.../api/api/...`.
- **Log:** in caso di errore in `Check-AgentUpdate` vengono loggati messaggio, URL tentato e dettaglio interno.
- **Sicurezza:** se la risposta di `agent-version` non ha il campo `version`, il controllo viene saltato e si logga un avviso.
- **Riavvio post-update (2.4.0):** niente più `Stop-Service` / `sc delete` / `nssm install` da dentro il servizio (causavano agent offline). Dopo l’update dei file e di `config.json` si fa solo `exit 0`; NSSM riavvia il processo con lo script aggiornato (~60 s di downtime).

Dopo aver aggiornato l’agent con queste modifiche e aver ridistribuito (o fatto aggiornare) la 2.4.0, i log daranno informazioni molto più chiare in caso di mancato aggiornamento.
