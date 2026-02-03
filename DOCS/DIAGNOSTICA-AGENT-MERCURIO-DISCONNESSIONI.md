# Diagnostica: Agent Mercurio si disconnette frequentemente

Questa guida aiuta a capire **perché l'agent sul PC Mercurio si disconnette improvvisamente** e cosa controllare.

---

## Come funziona la “connessione” dell’agent

- L’agent **non mantiene una connessione persistente**: invia **heartbeat ogni 5 minuti** (`POST /api/network-monitoring/agent/heartbeat`).
- Se il backend **non riceve heartbeat per più di 8 minuti**, l’agent viene considerato **offline** e viene creato un evento “Agent offline”.
- Quindi “disconnessione” = **heartbeat che non arrivano** (rete, servizio fermo, timeout, errore lato agent o server).

---

## 1. Verifiche rapide dalla dashboard (Ticket App)

1. **Monitoraggio rete** → sezione **Agenti**.
2. Trova l’agent **Mercurio** e clicca sull’icona **Diagnostica** (o “Mostra diagnostica agent”).
3. Controlla:
   - **Ultimo heartbeat**: se è “X minuti fa” con X > 8, il server non riceve heartbeat.
   - **Analisi**: il messaggio indica se il problema è “nessun heartbeat” o altro.
   - **Eventi offline non risolti**: quante volte è stato rilevato offline di recente.

4. Nella stessa pagina, apri **Eventi** e filtra per **Agent = Mercurio** e tipo **Agent offline**: vedi **quando** e con che frequenza viene segnato offline.

---

## 2. Sul PC Mercurio – Log dell’agent

I log dicono se l’heartbeat **parte** e se **fallisce** (e perché).

- **Percorso log**:  
  `C:\ProgramData\NetworkMonitorAgent\NetworkMonitorService.log`  
  (oppure nella cartella di installazione dell’agent se diversa)

Cerca in particolare:

- **`Errore heartbeat`** / **`Heartbeat fallito`** → la richiesta non va a buon fine (rete, timeout, 401/403/500).
- **`Invio heartbeat...`** seguito da **`Heartbeat completato`** → heartbeat inviato con successo; se il server lo segna comunque offline, il problema può essere lato server/rete verso il server.
- **`Errore Invoke-RestMethod`** / **`Unable to connect`** / **timeout** → problema di connettività (rete, firewall, DNS, URL).
- **`401`** / **`403`** → API key non valida o agent disabilitato/eliminato nel backend.

Se le disconnessioni sono **a orari fissi** (es. ogni notte o ogni ora), confronta con:
- sospensione/risparmio energetico del PC,
- task di manutenzione Windows,
- antivirus/firewall che bloccano periodicamente.

---

## 3. Configurazione sul PC Mercurio

- **File**: `C:\ProgramData\NetworkMonitorAgent\config.json` (o cartella installazione).

Verifica:

- **`server_url`**: deve essere solo la base, **senza** `/api` (es. `https://ticket.logikaservice.it`).
- **`api_key`**: deve essere **identica** a quella dell’agent Mercurio in dashboard (Agent → Dettaglio/Modifica). Se è stata rigenerata, aggiorna qui e riavvia il servizio.

---

## 4. Servizio Windows

Se il servizio si ferma o va in errore, non partono più heartbeat.

```powershell
Get-Service -Name "NetworkMonitorService" -ErrorAction SilentlyContinue
```

- **Running** → ok.
- **Stopped** / assente → riavvia il servizio o reinstallare con `Installa-Servizio.ps1` / `Installa-Servizio.bat`.

Controlla anche **Eventi di Windows** → Registro applicazioni / Sistema per errori relativi al servizio o a PowerShell.

---

## 5. Test manuale heartbeat da Mercurio

Da PowerShell sul PC Mercurio (sostituisci con i valori reali di Mercurio):

```powershell
$apiKey = "API_KEY_AGENT_MERCURIO"   # da dashboard → Agent Mercurio
$base = "https://ticket.logikaservice.it"
$url = "$base/api/network-monitoring/agent/heartbeat"
$headers = @{ "Content-Type" = "application/json"; "X-API-Key" = $apiKey }
$body = @{ version = "2.6.12"; timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss") } | ConvertTo-Json
Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body $body -TimeoutSec 15
```

- Risposta JSON (es. con `uninstall`, `pending_unifi_test`, ecc.) → **rete e API key ok** da quel PC; se l’agent si disconnette lo stesso, il problema può essere intermittente (Wi‑Fi, VPN, proxy, firewall).
- **401** → API key errata o agent disabilitato/eliminato.
- **Timeout / Unable to connect** → problema di rete/firewall/DNS verso `ticket.logikaservice.it`.

Ripeti il test **quando Mercurio è “disconnesso”** e **quando è “connesso”** per vedere se il comportamento cambia.

---

## 6. Lato server (VPS / backend)

- **Log backend**: cerca richieste a `/api/network-monitoring/agent/heartbeat` con **401/403** o errori 5xx per capire se i heartbeat di Mercurio vengono rifiutati o falliscono.
- **Database** (es. pgAdmin):

```sql
SELECT id, agent_name, status, last_heartbeat, enabled, deleted_at
FROM network_agents
WHERE agent_name ILIKE '%mercurio%'
ORDER BY last_heartbeat DESC NULLS LAST;
```

- `last_heartbeat` aggiornato negli ultimi 8 minuti → server **sta ricevendo** heartbeat; se la dashboard mostra offline, può essere cache/WebSocket.
- `last_heartbeat` vecchio → server **non riceve** heartbeat (problema rete/agent/servizio).
- `enabled = false` → heartbeat rifiutati (403).

---

## 7. Cause tipiche di disconnessioni frequenti

| Causa | Dove verificare |
|-------|------------------|
| **Wi‑Fi instabile / sleep** | Log agent: timeout/errori a orari ricorrenti; sospensione PC / impostazioni risparmio energetico |
| **Firewall / antivirus** | Blocco intermittente su `ticket.logikaservice.it`; test manuale heartbeat quando “disconnesso” |
| **VPN** | VPN che si disconnette o cambia route; test con e senza VPN |
| **API key errata / rigenerata** | Dashboard → Agent Mercurio; `config.json` su Mercurio; log 401 |
| **Servizio che si ferma** | `Get-Service NetworkMonitorService`; Eventi di Windows |
| **URL errato** | `config.json` → `server_url` senza `/api`; stesso URL nel test manuale |
| **Server sovraccarico / timeout** | Log backend; aumentare timeout heartbeat lato agent (attualmente 30 s) |

---

## 8. Riepilogo azioni consigliate per Mercurio

1. **Dashboard** → Diagnostica agent Mercurio + Eventi “Agent offline” per Mercurio.
2. **Sul PC Mercurio**: controllare `NetworkMonitorService.log` per “Errore heartbeat” / timeout / 401.
3. **Sul PC Mercurio**: verificare `config.json` (server_url, api_key) e che il servizio sia in esecuzione.
4. **Sul PC Mercurio**: eseguire il test manuale heartbeat (sopra) quando l’agent risulta disconnesso e quando è online.
5. **Server**: controllare `last_heartbeat` e log backend per l’agent Mercurio.

Se dopo questi passi hai **esempi concreti** (messaggio di errore dal log, orario delle disconnessioni, risultato del test manuale), si può restringere la causa (rete Mercurio, firewall, server, servizio) e intervenire in modo mirato.
