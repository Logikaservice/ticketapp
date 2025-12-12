# Comandi da Eseguire sul Server per Verificare Autorizzazione Monitor

## ✅ Database Verificato
Il database `packvision_db` esiste correttamente.

## 🔍 Prossimi Step di Verifica

### 1. Verifica Stato Backend

```bash
# Controlla se il backend è in esecuzione
sudo systemctl status ticketapp-backend

# Se non è attivo, avvialo
sudo systemctl start ticketapp-backend

# Controlla gli ultimi log (tutti, non filtrati)
sudo journalctl -u ticketapp-backend -n 100 --no-pager
```

### 2. Test API con Curl (Verifica Output Completo)

```bash
# Test semplice - dovrebbe restituire JSON o errore chiaro
curl -v -X POST http://localhost:3001/api/packvision/monitor/request \
  -H "Content-Type: application/json" \
  -d '{"monitor_id": 1}' \
  2>&1 | head -50
```

**Cosa aspettarsi:**
- **Se funziona**: JSON con `success: true` e `request_id`
- **Se errore database**: JSON con errore specifico
- **Se route non trovata**: 404 Not Found
- **Se timeout**: errore di connessione

### 3. Verifica Connessione Database dal Backend

```bash
# Test connessione database direttamente
sudo -u postgres psql -d packvision_db -c "SELECT version();"

# Verifica che il backend possa connettersi
# (controlla le variabili d'ambiente)
sudo systemctl show ticketapp-backend | grep -i database
```

### 4. Verifica Variabili d'Ambiente

```bash
# Controlla il file di servizio systemd
sudo cat /etc/systemd/system/ticketapp-backend.service

# O controlla il file .env
sudo cat /var/www/ticketapp/.env | grep -i database
```

### 5. Test Tabella Monitor Authorizations

```bash
# Connettiti al database e verifica la tabella
sudo -u postgres psql -d packvision_db -c "\dt monitor_authorizations"

# Se non esiste, dovrebbe essere creata automaticamente alla prima richiesta
# Ma verifichiamo se ci sono problemi
```

### 6. Controlla Log Backend in Tempo Reale

```bash
# Apri un nuovo terminale e monitora i log mentre fai la richiesta
sudo journalctl -u ticketapp-backend -f

# In un altro terminale, fai la richiesta curl
curl -X POST http://localhost:3001/api/packvision/monitor/request \
  -H "Content-Type: application/json" \
  -d '{"monitor_id": 1}'

# Guarda cosa appare nei log in tempo reale
```

### 7. Verifica Route PackVision

```bash
# Test endpoint health (se esiste)
curl http://localhost:3001/api/packvision/health

# Dovrebbe restituire qualcosa se il backend risponde
```

### 8. Controlla Porta 3001

```bash
# Verifica che il backend stia ascoltando sulla porta 3001
sudo netstat -tlnp | grep 3001
# oppure
sudo ss -tlnp | grep 3001
```

## 🐛 Possibili Problemi e Soluzioni

### Problema 1: Backend non risponde

**Sintomi:**
- `curl` non restituisce nulla
- Timeout o connessione rifiutata

**Soluzione:**
```bash
# Riavvia il backend
sudo systemctl restart ticketapp-backend

# Attendi qualche secondo e verifica
sudo systemctl status ticketapp-backend
```

### Problema 2: Database non accessibile dal backend

**Sintomi:**
- Errore "Database PackVision non disponibile"
- Errore di connessione nei log

**Soluzione:**
```bash
# Verifica DATABASE_URL
# Dovrebbe essere qualcosa come:
# DATABASE_URL=postgresql://user:password@localhost:5432/packvision_db

# Test connessione manuale
sudo -u postgres psql -d packvision_db -c "SELECT 1;"
```

### Problema 3: Route non trovata

**Sintomi:**
- 404 Not Found
- "Cannot POST /api/packvision/monitor/request"

**Soluzione:**
- Verifica che il codice sia stato deployato
- Verifica che le route siano montate correttamente in `backend/index.js`

### Problema 4: Errore 500 con HTML

**Sintomi:**
- Risposta HTML invece di JSON
- "Unexpected token '<'"

**Soluzione:**
- Controlla i log del backend per l'errore specifico
- Verifica che gli errori vengano gestiti correttamente (sempre JSON, mai HTML)

## 📋 Checklist Completa

Esegui questi comandi in ordine e annota i risultati:

- [ ] Backend è in esecuzione: `sudo systemctl status ticketapp-backend`
- [ ] Porta 3001 è in ascolto: `sudo netstat -tlnp | grep 3001`
- [ ] Database è accessibile: `sudo -u postgres psql -d packvision_db -c "SELECT 1;"`
- [ ] Health endpoint risponde: `curl http://localhost:3001/api/packvision/health`
- [ ] Monitor request endpoint risponde: `curl -v http://localhost:3001/api/packvision/monitor/request`
- [ ] Log backend mostrano richieste: `sudo journalctl -u ticketapp-backend -n 50`

## 🔄 Test Completo End-to-End

1. **Apri un terminale per i log:**
```bash
sudo journalctl -u ticketapp-backend -f
```

2. **In un altro terminale, esegui:**
```bash
curl -v -X POST http://localhost:3001/api/packvision/monitor/request \
  -H "Content-Type: application/json" \
  -d '{"monitor_id": 1}' \
  -w "\n\nHTTP Status: %{http_code}\n"
```

3. **Osserva:**
   - Output del curl (JSON o errore?)
   - Log in tempo reale (errori o successi?)

## 📞 Cosa Inviare per il Debug

Se continui ad avere problemi, invia:

1. **Output completo del curl:**
```bash
curl -v -X POST http://localhost:3001/api/packvision/monitor/request \
  -H "Content-Type: application/json" \
  -d '{"monitor_id": 1}' 2>&1
```

2. **Ultimi 100 log del backend:**
```bash
sudo journalctl -u ticketapp-backend -n 100 --no-pager > backend_logs.txt
cat backend_logs.txt
```

3. **Stato del servizio:**
```bash
sudo systemctl status ticketapp-backend --no-pager
```

4. **Configurazione database:**
```bash
sudo systemctl show ticketapp-backend | grep -i env
```

