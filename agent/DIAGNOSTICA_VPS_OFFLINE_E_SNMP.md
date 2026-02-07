# Diagnostica: VPS non vede agent online / Dati non arrivano / SNMP

## Riepilogo

- **Heartbeat**: l’agent invia `POST {server_url}/api/network-monitoring/agent/heartbeat` con header `X-API-Key`. Se arriva, il backend imposta `last_heartbeat = NOW()` e `status = 'online'`.
- **Offline**: se `last_heartbeat` è più vecchio di **8–10 minuti**, l’agent viene considerato offline.
- **Scan**: dopo ogni scansione → `POST .../agent/scan-results` con i dispositivi.
- **SNMP**: dopo ogni scansione l’agent chiama `Sync-ManagedSwitchesSnmp` (GET managed-switches, snmpwalk in locale, POST switch-address-table). **Se `snmpwalk` non è installato, la sync SNMP viene saltata** (log: `snmpwalk non trovato (Net-SNMP)`), ma heartbeat e scan-results **funzionano ugualmente**.

---

## 1. Sui PC con l’agent (2.6.0)

### 1.1 `config.json`

Percorso: `C:\ProgramData\NetworkMonitorAgent\config.json` oppure nella cartella di installazione (es. `C:\NetworkMonitorAgent\`).

Verifica:

- **`server_url`**: solo la base, **senza** `/api` o path.  
  - OK: `https://tua-vps.it`  
  - KO: `https://tua-vps.it/api` o `https://tua-vps.it/api/network-monitoring`
- **`api_key`**: deve essere **identica** a quella dell’agent in dashboard (copia da “Agent” → Dettaglio / Modifica). Se l’agent è stato rigenerato, bisogna aggiornare `config.json` e riavviare il servizio.

### 1.2 Log

- `C:\ProgramData\NetworkMonitorAgent\NetworkMonitorService.log`
- `C:\ProgramData\NetworkMonitorAgent\NetworkMonitorService_bootstrap.log` (se il servizio crasha all’avvio)

Cerca:

- `Heartbeat completato` / `Errore heartbeat` / `Errore Invoke-RestMethod` / `401` / `403` / `500`
- `Invio dati` / `scan-results` / `Errore` in `Send-ScanResults`
- `snmpwalk non trovato (Net-SNMP); sync switch SNMP saltata` → SNMP non usato (opzionale)
- `Sync switch SNMP` / `macs_matched` → SNMP usato

### 1.3 Servizio

```powershell
Get-Service -Name "NetworkMonitorService" -ErrorAction SilentlyContinue
# Stato: Running
```

Se è `Stopped` o assente: reinstallare con `Installa-Servizio.ps1` / `Installa-Servizio.bat`.

### 1.4 Test manuale heartbeat (PowerShell)

```powershell
$apiKey = "LA_TUA_API_KEY"
$base = "https://tua-vps.it"   # come in config.json, senza /api
$url = "$base/api/network-monitoring/agent/heartbeat"
$headers = @{ "Content-Type" = "application/json"; "X-API-Key" = $apiKey }
$body = @{ agent_id = $null; version = "2.6.0"; timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss") } | ConvertTo-Json
Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body $body
```

- Se risponde con un JSON (es. `uninstall`, `pending_unifi_test`, ecc.) → backend e API key ok.
- Se 401 → API key non valida / agent disabilitato o eliminato.
- Se timeout / `Unable to connect` → rete, firewall, DNS, URL errato.

---

## 2. Sulla VPS / Backend

### 2.1 Route

Le route sono in `backend/routes/networkMonitoring.js` e montate come:

`/api/network-monitoring` (in `backend/index.js`).

Endpoint agent:

- `POST /api/network-monitoring/agent/heartbeat` (con `X-API-Key` o `api_key` in body/query)
- `POST /api/network-monitoring/agent/scan-results`
- `GET /api/network-monitoring/agent/managed-switches`
- `POST /api/network-monitoring/agent/switch-address-table`

### 2.2 Autenticazione (`authenticateAgent`)

- Legge: `req.headers['x-api-key']` oppure `req.body.api_key` oppure `req.query.api_key`.
- Cerca in DB: `network_agents` con `api_key = $1` e `deleted_at IS NULL`.
- Se non trovato → **401** “API Key non valida”.
- Se `enabled = false` → **403** “Agent disabilitato”.

Verifica nel DB (es. `psql` o pgAdmin):

```sql
SELECT id, agent_name, api_key, status, last_heartbeat, enabled, deleted_at
FROM network_agents
WHERE deleted_at IS NULL
ORDER BY last_heartbeat DESC NULLS LAST;
```

- `last_heartbeat` aggiornato negli ultimi 8–10 minuti → agent considerato online.
- `enabled = false` → heartbeat e scan-results vengono rifiutati (403).

### 2.3 Log backend

Cerca in stdout/PM2/log dell’app Node:

- `Errore heartbeat` / `Errore autenticazione agent`
- `401` / `403` / `500` su `/api/network-monitoring/agent/heartbeat` o `/agent/scan-results`
- `Ricevuto payload scan-results` → i dati scan stanno arrivando.

### 2.4 Rete / reverse proxy

- La VPS deve esporre la porta (es. 443) e inoltrare a Node (es. 3000 o 5000).
- Firewall: consentire 443 (e la porta dell’app se esposta).
- Se usi Nginx/Apache: verificare che `/api/network-monitoring` sia inoltrato al backend.

---

## 3. SNMP (switch gestiti)

- **Dove**: l’agent, **sul PC in locale**, esegue `snmpwalk` verso gli IP degli switch (stessa LAN).
- **Requisito**: **Net-SNMP** con `snmpwalk` in PATH, in  
  `C:\Program Files\Net-SNMP\bin\snmpwalk.exe` oppure in `C:\usr\bin\snmpwalk` (o `.exe`) se l’installazione e sotto `C:\usr`.
- **Flusso**:
  1. `GET .../agent/managed-switches` (lista switch per l’azienda)
  2. Per ogni switch: `snmpwalk -v 2c -c <community> <ip> dot1dTpFdbPort`
  3. `POST .../agent/switch-address-table` con la tabella MAC→porta

Se `snmpwalk` non c’è:

- In log: `snmpwalk non trovato (Net-SNMP); sync switch SNMP saltata`
- Heartbeat e scan-results **continuano a funzionare**. Solo la mappa “switch/porta” non viene aggiornata.

Per usare SNMP:

1. Installare **Net-SNMP** sui PC con l’agent. `snmpwalk` puo stare in PATH, in `C:\Program Files\Net-SNMP\bin\` o in `C:\usr\bin\` (se l’install e under `C:\usr`). I MIB, se servono, in `C:\usr\share\snmp\mibs` o in `C:\Program Files\Net-SNMP\share\snmp\mibs`; script e agent li cercano in questi path.
2. In dashboard: **Managed Switches** per l’azienda: aggiungere switch con IP, community, `snmp_version` (es. 2c).

---

## 4. Corruzione script (era il problema 2.6.0)

Se sui PC girava una versione di `NetworkMonitorService.ps1` **corrotta** (~124k righe, blocchi duplicati), il main loop/heartbeat potevano non funzionare.  
È stata ripristinata una versione integra (2.5.9 → 2.6.0) e corretti alcuni errori di parsing.  
**Cosa fare**: aggiornare l’agent sui PC (via auto-update quando il servizio riesce a contattare il server, oppure copiando a mano il nuovo `NetworkMonitorService.ps1` e riavviando il servizio).

---

## 5. Checklist rapida

| Controllo | Dove |
|-----------|------|
| `server_url` senza `/api`, `api_key` corretta | `config.json` su PC |
| Servizio `NetworkMonitorService` in esecuzione | PC |
| Log: “Heartbeat completato” o “Errore heartbeat” | `NetworkMonitorService.log` |
| Log: “scan-results” / “Invio dati” / errori | `NetworkMonitorService.log` |
| `last_heartbeat` recente, `enabled=1`, `deleted_at` NULL | DB `network_agents` |
| 401/403/500 su heartbeat/scan-results | Log backend / proxy |
| `/api/network-monitoring` raggiungibile dalla rete dei PC | Rete / firewall / proxy |
| `snmpwalk` in PATH, in `C:\Program Files\Net-SNMP\bin\` o in `C:\usr\bin\` (solo se usi switch) | PC |
| Managed Switches configurati in dashboard (solo se usi SNMP) | Backend / DB |

---

## 6. Riferimenti

- `agent/NetworkMonitorService.ps1`: `Send-Heartbeat`, `Send-ScanResults`, `Sync-ManagedSwitchesSnmp`
- `backend/routes/networkMonitoring.js`: `authenticateAgent`, `POST /agent/heartbeat`, `POST /agent/scan-results`, `GET /agent/managed-switches`, `POST /agent/switch-address-table`
- `agent/config.example.json`: `server_url`, `api_key`

---

## 7. Agent che si disconnette ogni giorno (servizio che termina)

Se il PC è un **server** (niente sospensione, niente riavvii automatici) e l’agent va offline in modo ricorrente, la causa probabile è che il **processo PowerShell dell’agent termina** (crash, eccezione non gestita, o uscita). NSSM riavvia il processo dopo 60 secondi (`AppRestartDelay`), ma il server considera offline chi non invia heartbeat da 8+ minuti, quindi potresti dover riavviare manualmente o aspettare il riavvio NSSM.

### 7.1 Verificare che sia il processo a terminare

1. **Log agent**  
   Apri `C:\ProgramData\NetworkMonitorAgent\NetworkMonitorService.log` (o la cartella di installazione) e cerca l’**ora dell’ultimo** “Heartbeat completato” prima della disconnessione. Se i log si interrompono bruscamente (nessun “Errore nel loop principale” subito dopo), il processo è probabilmente terminato senza uscire dal catch (es. crash .NET/PowerShell).

2. **Log stderr NSSM**  
   Controlla `NetworkMonitorService_stderr.log` nella stessa cartella: eventuali errori fatali o stack trace prima dell’offline.

3. **Event Viewer (Windows)**  
   - **Visualizzatore eventi** → Registri applicazioni di Windows → **Applicazione**  
   Cerca eventi con origine **PowerShell** o **.NET Runtime** o il nome del servizio, in corrispondenza dell’ora in cui l’agent risulta offline.  
   - **Registro di sistema** → eventi del **Service Control Manager** per “NetworkMonitorService”: arresto/avvio del servizio o del processo.

4. **Ora ricorrente**  
   Se l’offline avviene sempre alla stessa ora (es. di notte), può esserci un task pianificato, un aggiornamento o un altro processo che termina l’agent.

### 7.2 Cosa fare

- **Ripristino del servizio Windows**  
  `services.msc` → **NetworkMonitorService** → Proprietà → scheda **Ripristino**:  
  - Primo tentativo: **Riavvia il servizio**  
  - Secondo tentativo: **Riavvia il servizio**  
  - Tentativi successivi: **Riavvia il servizio**  
  - “Reinizia il servizio dopo”: **1** minuto  
  Così, se il servizio (NSSM) si arresta, Windows lo riavvia. Il riavvio del **processo** figlio è già gestito da NSSM (`AppExit Default Restart`).

- **Watchdog (consigliato)**  
  Usa lo script **Watchdog-Servizio.ps1** (vedi sotto) con una **attività pianificata** ogni 5 minuti: se il servizio è fermo, lo riavvia. Così anche in casi anomali (NSSM che non riavvia, servizio fermato per errore) l’agent torna online senza intervento manuale.

- **Ridurre il ritardo di riavvio NSSM**  
  Di default NSSM riavvia il processo dopo 60 secondi. Puoi ridurlo a 30 secondi eseguendo (come Amministratore) lo script **Riduci-Ritardo-Riavvio.ps1** dalla cartella dell’agent, oppure a mano:
  ```powershell
  & "C:\ProgramData\NetworkMonitorAgent\nssm.exe" set NetworkMonitorService AppRestartDelay 30000
  ```
  Non serve riavviare il servizio: la modifica vale al prossimo riavvio del processo. L’agent tornerà online prima dopo un eventuale crash.

- **Aggiornamento automatico**  
  Se l’agent fa auto-update e subito dopo va offline, controlla che il nuovo `NetworkMonitorService.ps1` scaricato non sia corrotto (dimensioni file, assenza errori in stderr dopo l’update). In caso di update fallito, NSSM riavvia il vecchio script; se il nuovo file è rotto, potresti avere loop di crash/restart.

### 7.3 Script Watchdog (riavvia servizio se fermo)

Lo script `agent/Watchdog-Servizio.ps1` controlla se il **servizio Windows** `NetworkMonitorService` è in esecuzione; se è **Stopped**, lo avvia e registra l’evento in `Watchdog-Servizio.log`.  
Utile se in rari casi il servizio (NSSM) va in Stopped; quando è solo il **processo** PowerShell a terminare, è NSSM che lo riavvia dopo 60 s (vedi riduzione ritardo sotto).

**Creare l’attività pianificata** (eseguire PowerShell **come Amministratore**):

```powershell
$scriptPath = "C:\ProgramData\NetworkMonitorAgent\Watchdog-Servizio.ps1"
if (-not (Test-Path $scriptPath)) { $scriptPath = "C:\NetworkMonitorAgent\Watchdog-Servizio.ps1" }
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration ([TimeSpan]::MaxValue)
Register-ScheduledTask -TaskName "NetworkMonitorAgentWatchdog" -Action $action -Trigger $trigger -RunLevel Highest -Description "Riavvia NetworkMonitorService se fermo"
```

Oppure da **Utilità di pianificazione**: programma `powershell.exe`, argomenti come sopra, trigger ogni 5 minuti, “Esegui con privilegi più alti”, “Esegui anche quando l’utente non ha effettuato l’accesso”.
