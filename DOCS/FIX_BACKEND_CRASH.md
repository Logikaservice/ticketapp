# 🔧 Fix Backend in Stato "errored" - 3091 Restart

## Problema Critico

Il backend è in stato `errored` con **3091 restart** - significa che continua a crashare all'avvio.

## Diagnostica Immediata

### Sul Server, esegui questi comandi:

```bash
# 1. Vedi gli ultimi errori nei log
pm2 logs ticketapp-backend --lines 50 --nostream

# 2. Vedi solo gli errori
pm2 logs ticketapp-backend --lines 100 --nostream | grep -i error

# 3. Verifica se c'è un file di log
tail -100 /var/www/ticketapp/backend/logs/*.log 2>/dev/null || echo "Nessun file log trovato"

# 4. Prova ad avviare manualmente per vedere l'errore
cd /var/www/ticketapp/backend
node index.js
```

**IMPORTANTE:** L'ultimo comando (`node index.js`) ti mostrerà l'errore esatto che causa il crash.

---

## Cause Comuni e Soluzioni

### 1. Errore nel Codice (Syntax Error)

**Sintomi:** Errore tipo "SyntaxError" o "ReferenceError" nei log

**Soluzione:**
```bash
cd /var/www/ticketapp/backend

# Verifica sintassi
node -c index.js

# Se ci sono errori, aggiorna il codice
git pull origin main

# Reinstalla dipendenze
npm install --production

# Riavvia
pm2 restart ticketapp-backend
```

### 2. Dipendenze Mancanti o Corrotte

**Sintomi:** Errore tipo "Cannot find module" o "MODULE_NOT_FOUND"

**Soluzione:**
```bash
cd /var/www/ticketapp/backend

# Rimuovi node_modules e reinstalla
rm -rf node_modules package-lock.json
npm install --production

# Riavvia
pm2 restart ticketapp-backend
```

### 3. Variabili d'Ambiente Mancanti

**Sintomi:** Errore tipo "DATABASE_URL is not defined" o variabile d'ambiente mancante

**Soluzione:**
```bash
cd /var/www/ticketapp/backend

# Verifica file .env
cat .env

# Se manca, crealo o copialo
# Verifica che ci siano tutte le variabili necessarie:
# - DATABASE_URL
# - JWT_SECRET
# - PORT (default 3001)
# - NODE_ENV=production
```

### 4. Porta 3001 Già in Uso

**Sintomi:** Errore "EADDRINUSE: address already in use :::3001"

**Soluzione:**
```bash
# Trova processo che usa porta 3001
lsof -i :3001

# Kill processo se necessario
kill -9 <PID>

# Riavvia backend
pm2 restart ticketapp-backend
```

### 5. Database Non Raggiungibile

**Sintomi:** Errore di connessione al database

**Soluzione:**
```bash
# Verifica che PostgreSQL sia in esecuzione
sudo systemctl status postgresql

# Se non è in esecuzione, avvialo
sudo systemctl start postgresql

# Verifica connessione
cd /var/www/ticketapp/backend
node -e "require('pg').Pool({connectionString: process.env.DATABASE_URL}).query('SELECT 1', (err) => console.log(err ? 'ERR: ' + err.message : 'OK'))"
```

---

## Fix Completo (Procedura Completa)

```bash
cd /var/www/ticketapp

# 1. Ferma PM2 per evitare restart infiniti
pm2 stop ticketapp-backend
pm2 delete ticketapp-backend

# 2. Aggiorna codice
git pull origin main

# 3. Backend - pulizia e reinstallazione
cd backend
rm -rf node_modules package-lock.json
npm install --production

# 4. Verifica file .env
if [ ! -f .env ]; then
  echo "⚠️ File .env mancante! Creane uno con le variabili necessarie"
  # Crea .env minimo
  cat > .env << EOF
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://postgres:TicketApp2025!Secure@localhost:5432/ticketapp
JWT_SECRET=$(openssl rand -base64 32)
EOF
fi

# 5. Test avvio manuale (vedi errore)
echo "🔍 Test avvio manuale..."
timeout 5 node index.js || echo "❌ Errore durante avvio - controlla output sopra"

# 6. Se il test manuale funziona, riavvia con PM2
pm2 start backend/index.js --name ticketapp-backend
pm2 save

# 7. Verifica
pm2 status
pm2 logs ticketapp-backend --lines 20
```

---

## Comandi di Diagnostica Rapida

```bash
# Tutto in uno
cd /var/www/ticketapp/backend && \
echo "=== LOG PM2 ===" && \
pm2 logs ticketapp-backend --lines 30 --nostream && \
echo -e "\n=== TEST MANUALE ===" && \
timeout 3 node index.js 2>&1 | head -20
```

---

## Se Nulla Funziona

1. **Vedi l'errore esatto:**
   ```bash
   cd /var/www/ticketapp/backend
   node index.js
   ```
   Questo ti mostrerà l'errore che causa il crash.

2. **Condividi l'errore** e possiamo fixarlo insieme.

3. **Rollback temporaneo** (se necessario):
   ```bash
   cd /var/www/ticketapp
   git log --oneline -10  # Vedi ultimi commit
   git checkout <commit-prima-del-fix>  # Torna a commit funzionante
   pm2 restart ticketapp-backend
   ```

---

## Prossimi Passi

1. **Esegui:** `pm2 logs ticketapp-backend --lines 50 --nostream`
2. **Esegui:** `cd /var/www/ticketapp/backend && node index.js`
3. **Copia l'errore** che vedi e condividilo
4. **Fisso il problema** basandomi sull'errore specifico
