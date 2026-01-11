# Debug Agent: Tabelle OK ma Dati Non Arrivano

## Situazione
✅ Le tabelle esistono (network_agents, network_devices, network_changes, network_notification_config)  
❌ L'agent riceve "Internal server error"  
❌ Nessun log nel backend  

## Possibili Cause

### 1. Le Richieste Non Arrivano al Backend
Verifica se le richieste arrivano effettivamente al server.

### 2. Problema di Autenticazione API Key
L'API key potrebbe non corrispondere o l'agent potrebbe non essere nel database.

### 3. Endpoint Non Registrato
L'endpoint `/api/network-monitoring/agent/scan-results` potrebbe non essere registrato correttamente.

## Verifica Step-by-Step

### Step 1: Verifica Agent nel Database

```bash
cd /var/www/ticketapp/backend
node -e "
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
pool.query('SELECT id, agent_name, api_key, enabled, deleted_at FROM network_agents').then(r => {
  console.log('Agent nel database:');
  r.rows.forEach(a => {
    console.log('  ID:', a.id);
    console.log('  Nome:', a.agent_name);
    console.log('  API Key (primi 20 char):', a.api_key?.substring(0, 20) + '...');
    console.log('  Abilitato:', a.enabled);
    console.log('  Eliminato:', a.deleted_at ? 'SÌ' : 'NO');
    console.log('  ---');
  });
  if (r.rows.length === 0) console.log('  ❌ Nessun agent trovato!');
  process.exit(0);
}).catch(e => { console.error('Errore:', e.message); process.exit(1); });
"
```

Verifica che:
- L'agent esista
- L'API key corrisponda a quella che usa l'agent (`dbb753efa5af96ff66f652d04358ea379c35c22155038339280892730b49f0ef`)
- `enabled = true`
- `deleted_at IS NULL`

### Step 2: Verifica Log Nginx (Se le Richieste Arrivano)

```bash
# Sulla VPS
# Monitora in tempo reale
tail -f /var/log/nginx/access.log | grep -i "network-monitoring\|scan-results"

# Oppure verifica ultime richieste
tail -n 1000 /var/log/nginx/access.log | grep -i "network-monitoring\|scan-results" | tail -20
```

Se vedi richieste → arrivano al server  
Se non vedi nulla → le richieste non arrivano (problema network/firewall/nginx)

### Step 3: Test Manuale Endpoint (Vede Errore Esatto)

```bash
# Sulla VPS
cd /var/www/ticketapp/backend

# Test endpoint scan-results con API key dell'agent
curl -v -X POST http://localhost:3001/api/network-monitoring/agent/scan-results \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dbb753efa5af96ff66f652d04358ea379c35c22155038339280892730b49f0ef" \
  -d '{
    "devices": [
      {
        "ip_address": "192.168.100.1",
        "mac_address": "00:11:22:33:44:55",
        "hostname": "test-device",
        "vendor": "test-vendor",
        "device_type": "unknown",
        "status": "online"
      }
    ],
    "changes": []
  }' 2>&1
```

Questo mostrerà l'errore esatto.

### Step 4: Monitora Log Backend in Tempo Reale

In un terminale, monitora i log mentre l'agent prova a inviare:

```bash
# Terminale 1: Monitora log backend
tail -f /var/log/pm2/backend-out.log | grep -i "network\|scan\|agent\|ERROR\|Errore"
```

Poi, in un altro terminale (o sul PC client), esegui l'agent in modalità test:
```powershell
# Sul PC Windows
cd "D:\NetworkMonitor-Agent-Casa-Mia"
.\NetworkMonitor.ps1 -TestMode
```

### Step 5: Verifica Backend Riavvio Recente

Se hai fatto modifiche recenti, riavvia il backend:

```bash
cd /var/www/ticketapp/backend
pm2 restart backend
# oppure
pm2 restart ticketapp-backend

# Attendi 5 secondi
sleep 5

# Controlla log
pm2 logs backend --lines 50 | grep -i "network\|server.*ascolto"
```

## Soluzione Probabile

Se l'agent non è nel database o l'API key non corrisponde:

1. **Ricrea l'agent dalla dashboard web:**
   - Vai su "Monitoraggio Rete"
   - Clicca "Crea Agent"
   - Completa la procedura guidata
   - Ottieni la nuova API key
   - Aggiorna `config.json` dell'agent con la nuova API key

2. **Oppure inserisci manualmente nel database:**
   ```sql
   INSERT INTO network_agents (azienda_id, api_key, agent_name, network_ranges, scan_interval_minutes, enabled)
   VALUES (
     (SELECT id FROM users WHERE azienda = 'Logika Service' LIMIT 1),
     'dbb753efa5af96ff66f652d04358ea379c35c22155038339280892730b49f0ef',
     'Casa Mia',
     ARRAY['192.168.100.0/24'],
     15,
     true
   );
   ```

## Debug Completo in Una Volta

Esegui questo script completo:

```bash
cd /var/www/ticketapp/backend

echo "=== DEBUG NETWORK MONITORING ==="
echo ""
echo "1. Agent nel database:"
node -e "
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
pool.query('SELECT id, agent_name, api_key, enabled FROM network_agents').then(r => {
  r.rows.forEach(a => console.log('  ID:', a.id, 'Nome:', a.agent_name, 'Enabled:', a.enabled, 'API Key:', a.api_key?.substring(0, 30) + '...'));
  if (r.rows.length === 0) console.log('  ❌ Nessun agent!');
  process.exit(0);
}).catch(e => { console.error('Errore:', e.message); process.exit(1); });
"
echo ""
echo "2. Ultime richieste nginx network-monitoring:"
tail -n 500 /var/log/nginx/access.log 2>/dev/null | grep -i "network-monitoring" | tail -5 || echo "  Nessuna richiesta trovata"
echo ""
echo "3. Test endpoint locale:"
curl -s -X POST http://localhost:3001/api/network-monitoring/agent/scan-results \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dbb753efa5af96ff66f652d04358ea379c35c22155038339280892730b49f0ef" \
  -d '{"devices":[{"ip_address":"192.168.100.1","status":"online"}],"changes":[]}' 2>&1 | head -20
echo ""
```
