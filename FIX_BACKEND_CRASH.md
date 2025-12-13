# 🔧 Fix Backend Crash Loop

## Problema

Il backend è in **crash loop**: si riavvia continuamente (118+ volte).
- PM2 mostra: `uptime: 0s`, `↺: 118`
- Backend non risponde su `localhost:3001`

## Diagnostica

Esegui lo script di diagnostica:

```bash
cd /var/www/ticketapp
chmod +x debug-backend-crash.sh
./debug-backend-crash.sh
```

Questo script mostrerà:
1. **Log PM2 recenti** (errori che causano il crash)
2. **Status PM2 dettagliato**
3. **Verifica file .env** (DATABASE_URL, PORT, ecc.)
4. **Verifica dipendenze** (node_modules, package.json)
5. **Verifica sintassi JavaScript**
6. **Test connessione database**

## Cause Comuni

### 1. DATABASE_URL Errato o Database Non Raggiungibile

**Sintomo**: Errori tipo "connection refused", "ECONNREFUSED", "timeout"

**Fix**:
```bash
cd /var/www/ticketapp/backend

# Verifica DATABASE_URL
cat .env | grep DATABASE_URL

# Dovrebbe essere qualcosa come:
# DATABASE_URL=postgresql://postgres:password@localhost:5432/ticketapp

# Test connessione database
sudo systemctl status postgresql
sudo -u postgres psql -c "SELECT current_database();"
```

**Correzione**:
- Se PostgreSQL non è in esecuzione: `sudo systemctl start postgresql`
- Se DATABASE_URL è errato: correggi in `.env`
- Se password è errata: aggiorna password in `.env`

### 2. Dipendenze Mancanti

**Sintomo**: Errori tipo "Cannot find module", "MODULE_NOT_FOUND"

**Fix**:
```bash
cd /var/www/ticketapp/backend
rm -rf node_modules package-lock.json
npm install
```

### 3. Errore Sintassi JavaScript

**Sintomo**: Errori tipo "SyntaxError", "Unexpected token"

**Fix**:
```bash
cd /var/www/ticketapp/backend
node -c index.js
```

Se ci sono errori, correggili nel codice.

### 4. Porta 3001 Già in Uso

**Sintomo**: Errori tipo "EADDRINUSE", "port already in use"

**Fix**:
```bash
# Verifica processo che usa porta 3001
lsof -i :3001

# Se è un processo zombie, killalo
kill -9 <PID>

# Oppure cambia PORT in .env
echo "PORT=3002" >> backend/.env
```

### 5. Variabile d'Ambiente Mancante

**Sintomo**: Errori tipo "undefined", "process.env.XXX is required"

**Fix**:
```bash
cd /var/www/ticketapp/backend

# Verifica variabili obbligatorie
cat .env | grep -E "DATABASE_URL|JWT_SECRET|EMAIL_USER"

# Aggiungi quelle mancanti
```

### 6. Permessi File Errati

**Sintomo**: Errori tipo "EACCES", "permission denied"

**Fix**:
```bash
cd /var/www/ticketapp/backend
chmod 644 index.js package.json
chmod 600 .env
```

## Riavvio Manuale con Log Dettagliati

Dopo aver corretto il problema:

```bash
cd /var/www/ticketapp

# Ferma backend
pm2 stop ticketapp-backend

# Avvia con log visibili
pm2 start backend/index.js --name ticketapp-backend --update-env

# Monitora log in tempo reale
pm2 logs ticketapp-backend --lines 100
```

**Premi `Ctrl+C` per uscire dai log quando hai visto abbastanza.**

## Verifica Funzionamento

```bash
# Test endpoint health
curl http://localhost:3001/api/health

# Verifica status PM2
pm2 status

# Verifica uptime (dovrebbe aumentare, non essere 0s)
pm2 describe ticketapp-backend
```

## Se Niente Funziona

1. **Ripristina da backup** se disponibile
2. **Reinstalla dipendenze**:
   ```bash
   cd /var/www/ticketapp/backend
   rm -rf node_modules package-lock.json
   npm install --production
   ```
3. **Verifica Node.js version**:
   ```bash
   node --version  # Dovrebbe essere >= 16
   npm --version
   ```
4. **Riavvia server VPS** (ultima risorsa):
   ```bash
   sudo reboot
   ```

## Prevenzione

Per evitare crash loop futuri:

1. **Log centralizzati**: Configura log rotation in PM2
2. **Health checks**: Implementa `/api/health` endpoint
3. **Graceful shutdown**: Gestisci SIGTERM nel backend
4. **Error handling**: Cattura tutti gli errori asincroni
5. **Database connection pooling**: Gestisci reconnessioni

