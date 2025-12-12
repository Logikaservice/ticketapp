# Fix Configurazione Nginx per Timeout PackVision

## 🔍 Problema Identificato

L'API funziona su `localhost:3001` ma restituisce `504 Gateway Time-out` quando accessibile tramite `https://packvision.logikaservice.it`.

**Causa:** Timeout Nginx troppo corti (60s) per richieste che includono connessione database e invio email.

## ✅ Soluzione

Aggiorna la configurazione Nginx sul server con timeout aumentati a 300 secondi (5 minuti).

## 📋 Istruzioni per il Fix

### 1. Aggiorna Configurazione Nginx

**Sul server, esegui:**

```bash
# Modifica il file di configurazione
sudo nano /etc/nginx/sites-available/packvision.logikaservice.it
```

### 2. Cerca la sezione `location /api/` e aggiorna i timeout:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Timeout aumentati per richieste che possono richiedere tempo (database, email)
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;
    proxy_read_timeout 300s;
    
    # Buffering disabilitato per risposte immediate
    proxy_buffering off;
}
```

### 3. Verifica e Ricarica Nginx

```bash
# Testa la configurazione
sudo nginx -t

# Se OK, ricarica Nginx
sudo systemctl reload nginx
```

## 🔄 Alternative: Comando Rapido

Se preferisci, puoi copiare direttamente il file aggiornato dal repository:

```bash
# Dal repository locale (dopo git pull)
cd /path/to/ticketapp
scp deploy/nginx/packvision.logikaservice.it.conf root@ticketapp-server:/etc/nginx/sites-available/packvision.logikaservice.it

# Sul server
sudo nginx -t
sudo systemctl reload nginx
```

## 🧪 Test Dopo il Fix

```bash
# Test diretto dal server
curl -v -X POST https://packvision.logikaservice.it/api/packvision/monitor/request \
  -H "Content-Type: application/json" \
  -d '{"monitor_id": 1}' \
  --max-time 120

# Dovrebbe restituire JSON, non timeout
```

## ⚠️ Note Importanti

1. **Timeout aumentati**: Da 60s a 300s (5 minuti) per permettere operazioni database ed email
2. **Buffering disabilitato**: Per risposte immediate senza attese
3. **Sia HTTP che HTTPS**: Assicurati di aggiornare entrambe le configurazioni se hai sia porta 80 che 443

## 📝 Verifica Configurazione Attiva

```bash
# Controlla quale configurazione è attiva
sudo nginx -T | grep -A 30 "server_name packvision.logikaservice.it"

# Verifica timeout impostati
sudo nginx -T | grep -A 10 "location /api/" | grep timeout
```

## 🐛 Se il Problema Persiste

1. **Verifica log Nginx:**
```bash
sudo tail -f /var/log/nginx/error.log
```

2. **Verifica che il backend risponda:**
```bash
curl -v http://localhost:3001/api/packvision/test
```

3. **Verifica connessione backend da Nginx:**
```bash
# Test dal server stesso
curl -v http://127.0.0.1:3001/api/packvision/monitor/request \
  -H "Content-Type: application/json" \
  -d '{"monitor_id": 1}'
```

## ✅ Dopo il Fix

Dovresti vedere:
- ✅ Risposta JSON invece di 504 timeout
- ✅ Nessun errore nei log Nginx
- ✅ Funzionamento corretto dell'autorizzazione monitor

