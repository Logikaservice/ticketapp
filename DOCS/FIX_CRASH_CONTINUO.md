# 🚨 Fix Crash Continuo Backend

## Problema Identificato

Il backend continua a crashare nonostante il fix Vivaldi sia presente:
- ✅ Fix `if (vivaldiRoutes)` presente nel codice (riga 1128)
- ❌ Backend crasha continuamente (restart count: 1681 → 1805)
- ❌ Endpoint non rispondono: `Failed to connect to localhost port 3001`

**Conclusione:** C'è un **altro errore** che causa il crash, non solo Vivaldi.

## Step 1: Trova l'Errore Esatto

Esegui questo script sul server per vedere l'errore esatto:

```bash
ssh root@159.69.121.162
cd /var/www/ticketapp
bash TROVA_ERRORE_CRASH.sh
```

Oppure esegui manualmente:

```bash
# 1. Monitora crash in tempo reale
pm2 logs ticketapp-backend --lines 0 --raw | grep -i error

# 2. Oppure avvia manualmente per vedere l'errore completo
cd /var/www/ticketapp/backend
node index.js
# Premi Ctrl+C dopo aver visto l'errore
```

## Step 2: Possibili Cause e Fix

### Causa 1: Altro Route Null (come PackVision)

**Sintomi:**
- Errore `TypeError: Router.use() requires a middleware function but got a Null`
- Ma non per Vivaldi (quello è già fixato)

**Fix:**
Verifica `packvisionRoutes` in `backend/index.js`:

```javascript
// Riga ~639
const packvisionRoutes = require('./routes/packvision')(poolPackVision, io);

// Se poolPackVision è null, packvisionRoutes potrebbe essere null
// Fix simile a Vivaldi:
if (packvisionRoutes) {
  app.use('/api/packvision', packvisionRoutes);
} else {
  app.use('/api/packvision', (req, res) => {
    res.status(503).json({ error: 'PackVision non disponibile' });
  });
}
```

### Causa 2: Errore Database Crypto

**Sintomi:**
- Errore `Error opening crypto database` o `ENOENT`
- Crash all'avvio quando carica `cryptoRoutes`

**Fix:**
```bash
cd /var/www/ticketapp/backend
# Rimuovi database corrotto (verrà ricreato)
rm -f crypto.db
pm2 restart ticketapp-backend
```

### Causa 3: Modulo Mancante

**Sintomi:**
- Errore `Cannot find module 'xxx'`
- Crash immediato all'avvio

**Fix:**
```bash
cd /var/www/ticketapp/backend
npm install --production
pm2 restart ticketapp-backend
```

### Causa 4: Errore Sintassi o Require

**Sintomi:**
- Errore `SyntaxError` o `ReferenceError`
- Crash immediato all'avvio

**Fix:**
```bash
# Verifica sintassi
cd /var/www/ticketapp/backend
node -c index.js

# Se ci sono errori, correggili
```

### Causa 5: Errore Connessione Database PostgreSQL

**Sintomi:**
- Errore `Connection refused` o `timeout`
- Crash quando tenta di connettersi al DB

**Fix:**
```bash
# Verifica variabili d'ambiente
cd /var/www/ticketapp/backend
cat .env | grep DATABASE_URL

# Verifica connessione
node -e "const { Pool } = require('pg'); const pool = new Pool({ connectionString: process.env.DATABASE_URL }); pool.query('SELECT 1').then(() => { console.log('✅ DB OK'); process.exit(0); }).catch(e => { console.log('❌ DB Error:', e.message); process.exit(1); });"
```

## Step 3: Fix Rapido (Se Vedi l'Errore)

Una volta identificato l'errore esatto:

1. **Se è un altro route null:**
   - Applica lo stesso fix di Vivaldi (controllo `if (route)`)

2. **Se è un errore database:**
   - Verifica `.env` e connessioni DB

3. **Se è un modulo mancante:**
   - `npm install --production`

4. **Se è un errore codice:**
   - Correggi l'errore e fai `git commit && git push`

## Step 4: Verifica Dopo Fix

```bash
# 1. Riavvia backend
pm2 restart ticketapp-backend

# 2. Attendi 5 secondi
sleep 5

# 3. Verifica stato (restart count non deve aumentare)
pm2 status

# 4. Test endpoint
curl http://localhost:3001/api/health
curl http://localhost:3001/api/crypto/dashboard
```

## Comandi Rapidi

```bash
# Trova errore esatto
ssh root@159.69.121.162 << 'EOF'
cd /var/www/ticketapp/backend
pm2 logs ticketapp-backend --lines 100 --nostream | grep -i "error\|exception\|crash" | tail -20
echo ""
echo "Test avvio manuale (primi 5 secondi):"
timeout 5 node index.js 2>&1 | head -30
EOF
```

## Prossimi Passi

1. ✅ Esegui `TROVA_ERRORE_CRASH.sh` per vedere l'errore esatto
2. ✅ Invia l'output dell'errore
3. ✅ Applico il fix specifico per quell'errore
