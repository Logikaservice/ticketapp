# 🔧 Soluzione Errore 502 - Backend Non Raggiungibile

## 🔍 Problema

Quando accedi ai tuoi progetti da un altro browser, vedi errori **502 Bad Gateway**. Questo significa che:
- ✅ Nginx funziona (riceve le richieste)
- ❌ Il backend Node.js NON risponde sulla porta 3001
- ❌ Nginx non riesce a inoltrare le richieste al backend

## 🚨 Cause Possibili

1. **Backend non avviato** - Il processo PM2 è fermo o crashato
2. **Backend in errore** - Il backend si avvia ma crasha subito
3. **Porta 3001 occupata** - Un altro processo usa la porta
4. **Problemi database** - Il backend non riesce a connettersi al database
5. **File .env mancante** - Configurazione non trovata

## ✅ Soluzione Rapida

### Step 1: Connettiti alla VPS

```bash
ssh root@159.69.121.162
```

### Step 2: Esegui Diagnostica

```bash
cd /var/www/ticketapp
bash diagnostica-502-backend.sh
```

Oppure verifica manualmente:

```bash
# Verifica se la porta 3001 è in ascolto
netstat -tuln | grep 3001

# Verifica processi PM2
pm2 list

# Verifica se il backend risponde
curl http://localhost:3001/api/health
```

### Step 3: Riavvia il Backend

#### Se il processo PM2 esiste:

```bash
# Vedi tutti i processi
pm2 list

# Riavvia il backend (usa il nome corretto dal comando sopra)
pm2 restart ticketapp-backend
# oppure
pm2 restart all

# Verifica i log
pm2 logs ticketapp-backend --lines 50
```

#### Se il processo PM2 NON esiste:

```bash
cd /var/www/ticketapp/backend

# Verifica che il file .env esista
ls -la .env

# Avvia il backend con PM2
pm2 start index.js --name ticketapp-backend --cwd /var/www/ticketapp/backend
pm2 save

# Verifica che sia partito
pm2 list
pm2 logs ticketapp-backend --lines 30
```

### Step 4: Se il Backend Continua a Crashare

Se il backend si avvia ma crasha subito, avvialo manualmente per vedere l'errore:

```bash
cd /var/www/ticketapp/backend
node index.js
```

Questo mostrerà l'errore esatto. Errori comuni:

#### Errore: "Cannot connect to database"
```bash
# Verifica che PostgreSQL sia attivo
systemctl status postgresql

# Verifica le variabili d'ambiente
cat .env | grep DATABASE_URL
```

#### Errore: "Port 3001 already in use"
```bash
# Trova quale processo usa la porta 3001
lsof -i :3001
# oppure
netstat -tulpn | grep 3001

# Ferma il processo
kill -9 <PID>
```

#### Errore: "Cannot find module"
```bash
# Reinstalla le dipendenze
cd /var/www/ticketapp/backend
npm install
```

### Step 5: Verifica Funzionamento

Dopo aver riavviato il backend:

```bash
# Test endpoint locale
curl http://localhost:3001/api/health
curl http://localhost:3001/api/crypto/dashboard

# Se rispondono, verifica da browser
# Apri: https://ticket.logikaservice.it/?domain=crypto
```

## 🔄 Script Automatico di Riavvio

Se preferisci, puoi usare lo script di riavvio automatico:

```bash
cd /var/www/ticketapp/backend
bash scripts/restart-backend.sh
```

Oppure usa lo script di fix PM2:

```bash
cd /var/www/ticketapp
bash FIX_PM2_CONFIG.sh
```

## 📋 Checklist Post-Riavvio

Dopo aver riavviato il backend, verifica:

- [ ] `pm2 list` mostra il processo come "online"
- [ ] `curl http://localhost:3001/api/health` risponde
- [ ] Non ci sono errori nei log: `pm2 logs ticketapp-backend --lines 20`
- [ ] Il sito web funziona senza errori 502
- [ ] Gli endpoint API rispondono correttamente

## 🆘 Se Nulla Funziona

Se dopo tutti questi passaggi il problema persiste:

1. **Verifica i log nginx:**
   ```bash
   tail -f /var/log/nginx/error.log
   ```

2. **Verifica i log PM2:**
   ```bash
   pm2 logs ticketapp-backend --lines 100
   ```

3. **Riavvia nginx:**
   ```bash
   systemctl restart nginx
   ```

4. **Riavvia tutto:**
   ```bash
   pm2 restart all
   systemctl restart nginx
   ```

## 🔐 Nota Importante

Se stai accedendo da un **altro browser** o da un **altro dispositivo**, assicurati che:
- Il firewall della VPS permetta connessioni HTTP/HTTPS
- Il dominio `ticket.logikaservice.it` punti correttamente alla VPS
- Non ci siano restrizioni IP nel backend (se presenti)

## 📞 Debug Avanzato

Per vedere esattamente cosa succede quando fai una richiesta:

```bash
# Sul server, monitora i log in tempo reale
pm2 logs ticketapp-backend --lines 0

# In un altro terminale, fai una richiesta
curl -v http://localhost:3001/api/crypto/dashboard
```

Questo ti mostrerà se la richiesta arriva al backend e quale risposta viene generata.



