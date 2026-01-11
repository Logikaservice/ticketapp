# Debug Agent Network Monitoring - Offline / Dati Non Popolati

## Problema
L'agent risulta "offline" nella dashboard e i dati non vengono popolati, anche se l'agent ha rilevato dispositivi durante il test.

## Verifica Log Backend (VPS)

### 1. Connettiti alla VPS via SSH
```bash
ssh user@ticket.logikaservice.it
```

### 2. Vai nella directory del progetto
```bash
cd /var/www/ticketapp
```

### 3. Controlla i log PM2 del backend
```bash
# Ultimi 100 log
pm2 logs backend --lines 100

# Cerca errori specifici
pm2 logs backend --nostream | grep -i "scan-results\|network-monitoring\|Errore\|ERROR"
```

### 4. Cosa cercare nei log
Quando l'agent prova a inviare dati, dovresti vedere:
- `✅ Scan results ricevuti: X dispositivi, Y cambiamenti` (se successo)
- `❌ Errore ricezione scan results:` (se errore)

## Possibili Cause

### 1. Tabelle non create
Se vedi errori tipo `relation "network_devices" does not exist`, le tabelle non sono state create.

**Soluzione:**
```bash
cd /var/www/ticketapp
# Verifica che le tabelle esistano
psql -U your_db_user -d your_db_name -c "\dt network_*"

# Se non esistono, esegui lo script SQL manualmente
psql -U your_db_user -d your_db_name -f backend/scripts/init-network-monitoring.sql
```

### 2. Errore database
Se vedi errori PostgreSQL (es. `23505` = duplicate key, `23503` = foreign key violation).

**Verifica:**
- Che l'agent esista nella tabella `network_agents`
- Che l'`azienda_id` nell'agent corrisponda a un `users.id` esistente

```sql
-- Verifica agent esistente
SELECT id, agent_name, azienda_id, api_key, enabled FROM network_agents;

-- Verifica azienda_id valido
SELECT id, azienda FROM users WHERE id = (SELECT azienda_id FROM network_agents LIMIT 1);
```

### 3. Agent disabilitato
Se l'agent è disabilitato, i dati vengono rifiutati.

**Verifica:**
```sql
SELECT id, agent_name, enabled, deleted_at FROM network_agents WHERE api_key = 'YOUR_API_KEY';
```

### 4. Errore durante INSERT/UPDATE
Se vedi errori durante l'inserimento/aggiornamento dei dispositivi.

**Verifica struttura tabella:**
```sql
\d network_devices
\d network_changes
```

## Test Manuale Endpoint

Puoi testare manualmente l'endpoint per vedere l'errore esatto:

```bash
# Sulla VPS
curl -X POST https://ticket.logikaservice.it/api/network-monitoring/agent/scan-results \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "devices": [
      {
        "ip_address": "192.168.100.1",
        "mac_address": "00:11:22:33:44:55",
        "hostname": "test",
        "vendor": "test",
        "device_type": "unknown",
        "status": "online"
      }
    ],
    "changes": []
  }'
```

## Ripristino Backend

Dopo aver verificato i log:
```bash
cd /var/www/ticketapp
pm2 restart backend
```

## Verifica Agent (Lato Client)

Sul PC Windows dove è installato l'agent:
```powershell
# Verifica che il Scheduled Task sia attivo
Get-ScheduledTask -TaskName "NetworkMonitorAgent"

# Esegui test manuale
cd "D:\NetworkMonitor-Agent-Casa-Mia"
.\NetworkMonitor.ps1 -TestMode
```
