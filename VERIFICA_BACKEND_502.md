# 🔧 Verifica e Fix Errori 502 - TicketApp

## ⚠️ Problema Attuale
- **Errori 502 Bad Gateway** su tutti gli endpoint API
- **WebSocket connection failed**
- Il backend sulla VPS probabilmente non risponde

## ✅ Verifica Locale (Completata)
- ✅ Sintassi `backend/index.js` corretta
- ✅ Nessun riferimento a cryptoRoutes rimasto
- ✅ Rimosso duplicato route `/api/public-email`

## 🔍 Comandi da Eseguire SULLA VPS (159.69.121.162)

### 1. Connettiti alla VPS
```bash
ssh user@159.69.121.162
# oppure
ssh user@ticket.logikaservice.it
```

### 2. Verifica Stato Backend
```bash
# Verifica processi PM2
pm2 list

# Cerca processo "ticketapp-backend" o "backend"
# Se non è "online", c'è il problema!
```

### 3. Se il Backend NON è Online
```bash
# Vai nella directory backend
cd /var/www/ticketapp/backend

# Vedi log errori
pm2 logs ticketapp-backend --lines 100 --nostream

# Riavvia il backend
pm2 restart ticketapp-backend
# oppure
pm2 restart all

# Se non esiste, avvialo
pm2 start index.js --name ticketapp-backend --cwd /var/www/ticketapp/backend
pm2 save
```

### 4. Verifica Porta 3001
```bash
# Verifica che la porta 3001 sia in uso
netstat -tuln | grep 3001
# oppure
ss -tlnp | grep 3001

# Se non vedi :3001, il backend non è in ascolto
```

### 5. Test Backend Localmente
```bash
# Test se il backend risponde
curl http://localhost:3001/api/health

# Risultato atteso: JSON response o 404
# Se "Connection refused" → Backend non è attivo
```

### 6. Se il Backend Non Parte, Vedi Errore Diretto
```bash
cd /var/www/ticketapp/backend
node index.js
```

**Questo mostrerà l'errore esatto!** Premi `Ctrl+C` dopo aver visto l'errore.

### 7. Verifica Nginx
```bash
# Stato nginx
sudo systemctl status nginx

# Log errori nginx
sudo tail -50 /var/log/nginx/error.log

# Verifica configurazione
sudo nginx -t
```

## 🚨 Problemi Comuni

### Problema 1: Backend Crashato per Errore
**Sintomi:** `pm2 list` mostra backend come "errored" o "stopped"

**Soluzione:**
```bash
cd /var/www/ticketapp/backend
pm2 logs ticketapp-backend --lines 100
# Cerca l'errore nei log e risolvilo
pm2 restart ticketapp-backend
```

### Problema 2: Database Non Connesso
**Sintomi:** Log mostrano errori di connessione database

**Soluzione:**
```bash
# Verifica variabile DATABASE_URL
cd /var/www/ticketapp/backend
cat .env | grep DATABASE_URL

# Test connessione
node -e "require('dotenv').config(); const {Pool}=require('pg'); const p=new Pool({connectionString:process.env.DATABASE_URL}); p.query('SELECT 1').then(()=>console.log('OK')).catch(e=>console.error('ERR:',e.message));"
```

### Problema 3: Porta 3001 Occupata
**Sintomi:** Errore "Port 3001 already in use"

**Soluzione:**
```bash
# Trova processo che usa porta 3001
sudo lsof -i :3001
# oppure
sudo fuser -k 3001/tcp

# Riavvia backend
pm2 restart ticketapp-backend
```

## 📋 Checklist Rapida

- [ ] Backend è "online" in `pm2 list`?
- [ ] Porta 3001 è in ascolto (`netstat | grep 3001`)?
- [ ] Backend risponde a `curl localhost:3001/api/health`?
- [ ] Nginx è attivo (`systemctl status nginx`)?
- [ ] Nginx può raggiungere backend (log nginx OK)?

## 🔄 Soluzione Rapida Completa

Se vuoi riavviare tutto:
```bash
cd /var/www/ticketapp/backend
pm2 restart ticketapp-backend
sudo systemctl restart nginx
pm2 logs ticketapp-backend --lines 50
```

## 📞 Dopo la Verifica

Dopo aver eseguito i comandi, invia:
1. Output di `pm2 list`
2. Output di `pm2 logs ticketapp-backend --lines 50`
3. Output di `curl http://localhost:3001/api/health`
4. Output di `sudo tail -20 /var/log/nginx/error.log`

Questo mi permetterà di identificare il problema esatto!
