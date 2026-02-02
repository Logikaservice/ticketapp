# Diagnostica "Carica AP associati" (Ubiquiti/Cloud Key)

## Flusso completo

1. **Frontend** (MappaturaPage.jsx) → click "Carica AP associati"
   - Chiama `POST /api/network-monitoring/router-wifi-devices/request`
   - Passa: `device_id`, `agent_id`, `router_ip`

2. **Backend** (networkMonitoring.js, riga ~6382)
   - Recupera credenziali (da `unifi_config` o KeePass)
   - Crea task con `controller_url` (es. `https://192.168.1.156:8443`)
   - Salva in `pendingRouterWifiTasks.set(agentId, { task_id, router_ip, controller_url, username, password, router_model, device_id })`
   - Risponde al frontend con `{ task_id, deferred: true }`

3. **Frontend** → polling ogni 3s su `/router-wifi-result/:task_id`

4. **Agent** (NetworkMonitorService.ps1 o NetworkMonitor.ps1)
   - Al prossimo heartbeat (ogni 2-5 min) riceve `pending_router_wifi_task`
   - Chiama `Invoke-RouterWifiFetchAndReport` con `-ControllerUrl`
   - Se UniFi: usa `$base = controller_url` (o fallback `https://${RouterIp}:8443`)
   - Login su `/api/auth/login` o `/api/login`
   - GET su `/proxy/network/api/s/default/stat/device` o `/api/s/default/stat/device`
   - Invia risultato a `POST /agent/router-wifi-result`

5. **Backend** → salva risultato in `routerWifiResults.set(task_id, { success, devices, error, created_count })`

6. **Frontend** → riceve `status: 'ok'`, mostra dispositivi

---

## Punti di fallimento possibili

### A) Il task non viene creato
- **Sintomo:** Frontend mostra errore subito (es. "Credenziali non trovate")
- **Causa:** Backend non trova credenziali (né unifi_config né KeePass)
- **Verifica:** Log backend → cerca `📡 Router WiFi request` e `✅ Credenziali da...` o `❌ KeePass: credenziali NON trovate`

### B) Il task viene creato ma l'agent non lo riceve
- **Sintomo:** Frontend resta in "Analisi in corso..." per 12 min, poi timeout
- **Causa:** Agent non fa heartbeat, o `agent_id` sbagliato
- **Verifica:** 
  - Backend log → `📡 Router WiFi: task XXXX creato per agent_id=Y`
  - Agent log → cerca `Heartbeat inviato` e `pending_router_wifi_task`
  - Se l'agent non fa heartbeat: servizio non attivo o API key errata

### C) L'agent riceve il task ma fallisce la connessione UniFi
- **Sintomo:** Frontend mostra errore dopo 2-5 min (es. "Credenziali errate" o "Login fallito")
- **Causa:** 
  - `controller_url` non passato → agent usa porta 443 invece di 8443
  - Credenziali errate
  - Controller non raggiungibile dalla rete dell'agent
- **Verifica:** Agent log → cerca:
  - `Controller WiFi (Unifi): inizio connessione a https://192.168.1.156:8443` (deve avere :8443!)
  - `Controller WiFi: tentativo login su .../api/auth/login...`
  - `Controller WiFi: login OK` o `login fallito su ... - status=401`
  - `Controller WiFi (Unifi): ERRORE - ...`

### D) L'agent si connette ma non trova dispositivi
- **Sintomo:** Frontend mostra "0 dispositivi trovati"
- **Causa:** Risposta API UniFi senza campo `data` o vuota
- **Verifica:** Agent log → `Controller WiFi: trovati 0 dispositivi nella risposta`

### E) L'agent trova dispositivi ma non invia il risultato
- **Sintomo:** Frontend timeout dopo 12 min
- **Causa:** `POST /agent/router-wifi-result` fallisce (rete, API key, timeout)
- **Verifica:** Agent log → `Invio risultato Controller WiFi fallito: ...`

### F) Il backend riceve il risultato ma il frontend non lo vede
- **Sintomo:** Frontend timeout, ma backend log mostra `✅ Router WiFi sync: X nuovi dispositivi`
- **Causa:** `routerWifiResults.set(task_id, ...)` non viene fatto, o task_id diverso
- **Verifica:** Backend log → `📡 Router WiFi: risultato task XXXX - success=true, devices=Y`

---

## Checklist diagnostica

1. **Backend log** (VPS: `pm2 logs ticketapp-backend --lines 200`):
   ```
   📡 Router WiFi request: device_id=X, mac=..., ip=192.168.1.156, router_model=Ubiquiti...
   ✅ Credenziali da unifi_config agent: host=192.168.1.156, username=..., controller_url=https://192.168.1.156:8443
   📡 Router WiFi: task rw-... creato per agent_id=8, router https://192.168.1.156, controller_url=https://192.168.1.156:8443
   📡 Router WiFi: task rw-... inviato a agent_id=8, controller_url=https://192.168.1.156:8443
   📡 Router WiFi result ricevuto: task_id=rw-..., success=true, devices=5
   ✅ Router WiFi sync: 5 nuovi dispositivi aggiunti alla mappa
   ```

2. **Agent log** (PC agent: `C:\ProgramData\NetworkMonitorAgent\logs\service.log`):
   ```
   Controller WiFi (Unifi): inizio connessione a https://192.168.1.156:8443 (modello: Ubiquiti..., user: ...)
   Controller WiFi: tentativo login su https://192.168.1.156:8443/api/auth/login...
   Controller WiFi: login OK (status 200) su /api/auth/login
   Controller WiFi: login riuscito, recupero dispositivi...
   Controller WiFi: tentativo GET https://192.168.1.156:8443/proxy/network/api/s/default/stat/device...
   Controller WiFi: risposta ricevuta da /proxy/network/api/s/default/stat/device
   Controller WiFi: trovati 5 dispositivi nella risposta
     - Dispositivo: AA:BB:CC:DD:EE:FF, IP: 192.168.1.10, Nome: AP-Ufficio
   Unifi Controller: trovati 5 dispositivi/AP
   Risultato Controller WiFi inviato (success=true, devices=5, error=)
   ```

3. **Frontend console** (browser DevTools → Network):
   - `POST /api/network-monitoring/router-wifi-devices/request` → 200, `{ task_id: "rw-..." }`
   - `GET /api/network-monitoring/router-wifi-result/rw-...` (ogni 3s) → `{ status: "pending" }` poi `{ status: "ok", devices: [...], created_count: 5 }`

---

## Fix comuni

### Fix 1: controller_url non passato (porta 443 invece di 8443)
**Sintomo:** Agent log mostra `https://192.168.1.156/api/auth/login` (senza :8443)
**Soluzione:** Verifica che backend passi `controller_url` nel task e agent usi `-ControllerUrl $prw.controller_url`

### Fix 2: Agent non fa heartbeat
**Sintomo:** Backend log non mostra mai "task inviato a agent_id=X"
**Soluzione:** Verifica servizio agent attivo: `Get-Service NetworkMonitorAgent` (Windows) o controlla `service.log`

### Fix 3: Credenziali errate
**Sintomo:** Agent log `login fallito ... - status=401`
**Soluzione:** Verifica username/password in `unifi_config` dell'agent o in KeePass (entry con MAC del Cloud Key)

### Fix 4: Agent versione vecchia
**Sintomo:** Agent non ha parametro `-ControllerUrl` → usa sempre porta 443
**Soluzione:** Aggiorna agent a v2.6.7+ (con supporto `controller_url`)

### Fix 5: Timeout heartbeat troppo lungo
**Sintomo:** Frontend timeout dopo 12 min, ma agent non ha ancora fatto heartbeat
**Soluzione:** Riduci intervallo heartbeat agent (es. da 5 min a 2 min) o aumenta timeout frontend (da 12 a 15 min)
