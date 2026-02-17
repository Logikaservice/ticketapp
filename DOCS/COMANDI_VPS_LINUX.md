# 🐧 Comandi da Eseguire sul Server Linux (VPS)

## ⚠️ IMPORTANTE

Gli script PowerShell (`.ps1`) vanno eseguiti **da Windows**, non dal server Linux!

Sul server Linux devi usare comandi **bash** direttamente.

---

## 🔍 Verifica Stato Backend (Sul Server Linux)

### 1. Verifica Stato PM2

```bash
pm2 status
```

**Output atteso:**
```
┌─────┬─────────────────────┬─────────┬─────────┬──────────┬─────────┐
│ id  │ name                │ mode    │ ↺       │ status   │ cpu     │
├─────┼─────────────────────┼─────────┼─────────┼──────────┼─────────┤
│ 0   │ ticketapp-backend   │ fork    │ 0       │ online   │ 0%      │
└─────┴─────────────────────┴─────────┴─────────┴──────────┴─────────┘
```

Se vedi `errored` o `stopped` → Il backend è crashato ❌

### 2. Vedi Log Backend

```bash
pm2 logs ticketapp-backend --lines 50
```

Cerca errori come:
- `Cannot find module`
- `Database connection error`
- `Port 3001 already in use`
- `EADDRINUSE`

### 3. Verifica Porta 3001

```bash
netstat -tlnp | grep 3001
# oppure
ss -tlnp | grep 3001
```

**Output atteso:**
```
tcp    0    0 0.0.0.0:3001    0.0.0.0:*    LISTEN    12345/node
```

Se non vedi nulla → Il backend non è in ascolto ❌

### 4. Test Health Check Locale

```bash
curl http://localhost:3001/api/health
```

**Output atteso:**
```json
{"status":"OK","timestamp":"2026-02-17T09:59:32.000Z","database":"connected"}
```

Se vedi `Connection refused` → Backend non risponde ❌

---

## 🔄 Riavvia Backend (Sul Server Linux)

### Se il processo PM2 esiste ma è in errore:

```bash
pm2 restart ticketapp-backend
```

### Se il processo PM2 non esiste:

```bash
cd /var/www/ticketapp/backend
pm2 start index.js --name ticketapp-backend
pm2 save
```

### Riavvia tutti i processi PM2:

```bash
pm2 restart all
```

### Verifica dopo riavvio:

```bash
pm2 status
curl http://localhost:3001/api/health
```

---

## 🛠️ Diagnostica Completa (Sul Server Linux)

### Script Bash Completo

Crea uno script bash sul server:

```bash
#!/bin/bash
# diagnostica-backend.sh

echo "=== Diagnostica Backend ==="
echo ""

echo "1. Stato PM2:"
pm2 status
echo ""

echo "2. Porta 3001:"
netstat -tlnp | grep 3001 || echo "Porta 3001 NON in ascolto!"
echo ""

echo "3. Test Health Check:"
curl -s http://localhost:3001/api/health || echo "Backend NON risponde!"
echo ""

echo "4. Ultimi log backend:"
pm2 logs ticketapp-backend --lines 20 --nostream
```

Esegui:
```bash
chmod +x diagnostica-backend.sh
./diagnostica-backend.sh
```

---

## 🔧 Risoluzione Problemi Comuni

### Problema: Backend crashato

```bash
# 1. Vedi log per capire l'errore
pm2 logs ticketapp-backend --lines 50

# 2. Riavvia
pm2 restart ticketapp-backend

# 3. Se continua a crashare, avvia manualmente per vedere l'errore
cd /var/www/ticketapp/backend
node index.js
```

### Problema: Porta 3001 occupata

```bash
# Trova processo sulla porta 3001
lsof -i :3001
# oppure
fuser -k 3001/tcp

# Poi riavvia backend
pm2 restart ticketapp-backend
```

### Problema: Database non raggiungibile

```bash
# Verifica connessione database
cd /var/www/ticketapp/backend
node -e "const { Pool } = require('pg'); require('dotenv').config(); const pool = new Pool({ connectionString: process.env.DATABASE_URL }); pool.query('SELECT NOW()').then(r => { console.log('OK:', r.rows[0]); pool.end(); }).catch(e => { console.error('ERRORE:', e.message); process.exit(1); });"
```

### Problema: File .env mancante

```bash
cd /var/www/ticketapp/backend
ls -la .env

# Se non esiste, crealo
# (usa le credenziali corrette)
```

---

## 📋 Comandi Rapidi Riepilogo

```bash
# Stato backend
pm2 status

# Log backend
pm2 logs ticketapp-backend --lines 50

# Riavvia backend
pm2 restart ticketapp-backend

# Verifica porta
netstat -tlnp | grep 3001

# Test health
curl http://localhost:3001/api/health

# Riavvia tutto PM2
pm2 restart all

# Salva configurazione PM2
pm2 save
```

---

## 🔗 Collegamento con Windows

**Da Windows** puoi eseguire questi comandi sul server Linux usando SSH:

```powershell
# Da Windows PowerShell
ssh root@159.69.121.162 "pm2 status"
ssh root@159.69.121.162 "pm2 logs ticketapp-backend --lines 50"
ssh root@159.69.121.162 "pm2 restart ticketapp-backend"
```

Oppure usa gli script PowerShell che ho creato (da Windows):
- `.\scripts\VpsHelper.ps1` → Esegue comandi SSH automaticamente
- `.\scripts\Diagnose-502Error.ps1` → Verifica stato via HTTP
