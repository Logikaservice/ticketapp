# 🔍 Diagnostica Dettagliata VPS - 403 Forbidden

## ✅ Stato Attuale (dallo screenshot)

- ✅ Backend in esecuzione: `ticketapp-backend` (PM2 online)
- ✅ Nginx attivo e funzionante
- ❌ Sito mostra 403 Forbidden

## 🔍 Comandi da Eseguire sulla VPS

### 1. Vedi Log Backend (IMPORTANTE)

```bash
# Vedi ultimi log del backend
pm2 logs backend --lines 50 --nostream

# Oppure in tempo reale (premi Ctrl+C per uscire)
pm2 logs backend
```

**Cosa cercare:**
- Errori di database
- Errori di autenticazione
- Errori di route
- Errori 403/500

### 2. Verifica Configurazione Nginx

```bash
# Vedi configurazione nginx per ticketapp
sudo cat /etc/nginx/sites-available/ticketapp
# oppure
sudo cat /etc/nginx/sites-enabled/ticketapp

# Verifica che la configurazione sia corretta
sudo nginx -t
```

**Cosa verificare:**
- Proxy pass alla porta corretta (3001)
- Permessi corretti
- SSL configurato correttamente

### 3. Verifica Log Nginx

```bash
# Log errori nginx
sudo tail -50 /var/log/nginx/error.log

# Log accessi
sudo tail -50 /var/log/nginx/access.log
```

### 4. Test Connessione Backend

```bash
# Test se il backend risponde localmente
curl http://localhost:3001/api/health
# oppure
curl http://127.0.0.1:3001/

# Se funziona, il problema è in nginx
# Se non funziona, il problema è nel backend
```

### 5. Verifica Permessi File

```bash
# Verifica permessi directory
ls -la /var/www/ticketapp/

# Verifica permessi backend
ls -la /var/www/ticketapp/backend/

# Verifica permessi frontend
ls -la /var/www/ticketapp/frontend/
```

## 🚨 Problemi Comuni

### Problema 1: Nginx Blocca Richieste

**Sintomi:**
- 403 Forbidden
- Backend funziona (curl localhost:3001 OK)

**Soluzione:**
```bash
# Verifica configurazione nginx
sudo nano /etc/nginx/sites-available/ticketapp

# Cerca queste righe e verifica:
# - root /var/www/ticketapp/frontend;
# - proxy_pass http://localhost:3001;
# - index index.html;

# Dopo modifiche:
sudo nginx -t
sudo systemctl reload nginx
```

### Problema 2: Backend Restituisce 403

**Sintomi:**
- `curl localhost:3001` restituisce 403
- Log backend mostrano errori

**Soluzione:**
```bash
# Vedi log backend
pm2 logs backend --lines 100

# Riavvia backend
pm2 restart backend

# Verifica file .env
cat /var/www/ticketapp/backend/.env | grep -v "SECRET\|PASSWORD"
```

### Problema 3: Permessi File

**Sintomi:**
- Nginx non può leggere file

**Soluzione:**
```bash
# Correzioni permessi
sudo chown -R www-data:www-data /var/www/ticketapp/
sudo chmod -R 755 /var/www/ticketapp/
sudo chmod -R 644 /var/www/ticketapp/frontend/*
```

## 📋 Checklist Rapida

Esegui questi comandi in ordine e invia output:

```bash
# 1. Log backend
pm2 logs backend --lines 50 --nostream

# 2. Test backend locale
curl -v http://localhost:3001/

# 3. Configurazione nginx
sudo cat /etc/nginx/sites-available/ticketapp

# 4. Log nginx errori
sudo tail -30 /var/log/nginx/error.log

# 5. Verifica porta 3001
sudo netstat -tlnp | grep 3001
```

