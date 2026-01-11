# Debug Agent: Nessun Log nel Backend

## Problema
L'agent invia dati ma riceve "Internal server error", ma nei log del backend non ci sono errori relativi a network monitoring.

## Possibili Cause

### 1. Le Richieste Non Arrivano al Backend
Le richieste potrebbero essere bloccate da nginx o non raggiungere il backend.

### 2. Le Tabelle Non Esistono
Se le tabelle `network_agents`, `network_devices`, `network_changes` non esistono, l'errore potrebbe avvenire durante `ensureTables()` ma non essere loggato correttamente.

### 3. Problema di Autenticazione
Se l'API key non è valida, la richiesta viene rifiutata prima di arrivare all'endpoint.

## Verifica Step-by-Step

### Step 1: Verifica se le Richieste Arrivano (Nginx Access Logs)

```bash
# Sulla VPS
# Cerca richieste all'endpoint network-monitoring
tail -f /var/log/nginx/access.log | grep -i "network-monitoring"

# Oppure verifica gli ultimi accessi
tail -n 500 /var/log/nginx/access.log | grep -i "network-monitoring\|scan-results"
```

Se vedi richieste → arrivano al server  
Se non vedi nulla → nginx potrebbe bloccare o l'agent non riesce a connettersi

### Step 2: Verifica Tabelle Database

```bash
# Sulla VPS
# Connetti al database (sostituisci con le tue credenziali)
psql -U your_db_user -d your_db_name -c "\dt network_*"
```

Se le tabelle non esistono, devi crearle:
```bash
cd /var/www/ticketapp
psql -U your_db_user -d your_db_name -f backend/scripts/init-network-monitoring.sql
```

### Step 3: Verifica Agent nel Database

```bash
# Verifica che l'agent esista
psql -U your_db_user -d your_db_name -c "SELECT id, agent_name, api_key, enabled FROM network_agents;"
```

Devi vedere l'agent "Casa Mia" con l'API key corretta.

### Step 4: Test Manuale Endpoint

```bash
# Sulla VPS, testa l'endpoint manualmente
curl -X POST http://localhost:3001/api/network-monitoring/agent/scan-results \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dbb753efa5af96ff66f652d04358ea379c35c22155038339280892730b49f0ef" \
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

Questo mostrerà l'errore esatto.

### Step 5: Verifica Log Nginx Error

```bash
# Errori nginx
tail -n 100 /var/log/nginx/error.log | grep -i "network\|backend\|upstream"
```

### Step 6: Test Connessione Agent → Server

Dal PC client, verifica che l'agent possa raggiungere il server:

```powershell
# Sul PC Windows dove è installato l'agent
# Test connessione HTTPS
Test-NetConnection -ComputerName ticket.logikaservice.it -Port 443

# Test endpoint direttamente
Invoke-WebRequest -Uri "https://ticket.logikaservice.it/api/network-monitoring/agent/heartbeat" -Method POST -Headers @{"X-API-Key"="dbb753efa5af96ff66f652d04358ea379c35c22155038339280892730b49f0ef"} -ContentType "application/json" -Body '{"version":"1.0.0"}'
```

## Soluzione Probabile: Creare le Tabelle

Il problema più probabile è che le tabelle non esistono. Crea le tabelle:

```bash
# Sulla VPS
cd /var/www/ticketapp

# Verifica che lo script SQL esista
ls -la backend/scripts/init-network-monitoring.sql

# Esegui lo script SQL
# (Sostituisci con le tue credenziali database)
psql -U your_db_user -d your_db_name -f backend/scripts/init-network-monitoring.sql
```

Oppure, se lo script non esiste, crea le tabelle manualmente usando il codice da `backend/routes/networkMonitoring.js` (funzione `initTables`).

## Verifica Rapida Completa

Esegui questo script sulla VPS:

```bash
#!/bin/bash
echo "=== Verifica Network Monitoring ==="
echo ""
echo "1. Tabelle database:"
psql -U your_db_user -d your_db_name -c "\dt network_*" 2>&1
echo ""
echo "2. Agent nel database:"
psql -U your_db_user -d your_db_name -c "SELECT id, agent_name, enabled FROM network_agents;" 2>&1
echo ""
echo "3. Ultime richieste nginx network-monitoring:"
tail -n 1000 /var/log/nginx/access.log | grep -i "network-monitoring" | tail -10
echo ""
echo "4. Backend risponde:"
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3001/api/health
```
