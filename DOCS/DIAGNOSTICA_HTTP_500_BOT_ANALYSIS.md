# 🔍 Diagnostica HTTP 500 su /api/crypto/bot-analysis

## 📋 Problema
L'endpoint `/api/crypto/bot-analysis` restituisce HTTP 500 dopo la migrazione a PostgreSQL.

## 🔧 Passi di Diagnostica sulla VPS

### 1. Verifica che crypto_db.js sia PostgreSQL

```bash
cd /var/www/ticketapp/backend
head -20 crypto_db.js
```

**✅ DEVE mostrare:**
```javascript
const { Pool } = require('pg');
```

**❌ NON deve mostrare:**
```javascript
const sqlite3 = require('sqlite3');
```

### 2. Verifica i log del backend

```bash
pm2 logs ticketapp-backend --lines 100 | grep -i "bot-analysis\|error\|500"
```

Cerca errori specifici come:
- `db.get is not a function`
- `db.all is not a function`
- `syntax error at or near`
- `column does not exist`
- `relation does not exist`

### 3. Verifica connessione PostgreSQL

```bash
cd /var/www/ticketapp/backend
node -e "const db = require('./crypto_db'); console.log('dbAll:', typeof db.dbAll); console.log('dbGet:', typeof db.dbGet); console.log('dbRun:', typeof db.dbRun);"
```

**✅ DEVE mostrare:**
```
dbAll: function
dbGet: function
dbRun: function
```

### 4. Test diretto dell'endpoint

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://ticket.logikaservice.it/api/crypto/bot-analysis?symbol=bitcoin
```

### 5. Verifica variabili d'ambiente

```bash
cd /var/www/ticketapp/backend
grep DATABASE_URL .env
```

Deve essere configurato correttamente per PostgreSQL.

## 🔧 Fix Possibili

### Fix 1: Se crypto_db.js è ancora SQLite

```bash
cd /var/www/ticketapp/backend
# Backup
cp crypto_db.js crypto_db.js.backup-sqlite
# Sostituisci con PostgreSQL
cp crypto_db_postgresql.js crypto_db.js
# Riavvia
pm2 restart ticketapp-backend
```

### Fix 2: Se il database non esiste

```bash
# Connetti a PostgreSQL
psql -U postgres -h localhost

# Crea database crypto_db
CREATE DATABASE crypto_db;

# Esci
\q
```

### Fix 3: Se ci sono errori di sintassi SQL

Verifica che tutte le query usino la sintassi PostgreSQL corretta:
- `?` → `$1, $2, ...` (convertito automaticamente da crypto_db_postgresql.js)
- `INSERT OR REPLACE` → `INSERT ... ON CONFLICT DO UPDATE` (convertito automaticamente)

## 📋 Checklist

- [ ] `crypto_db.js` è PostgreSQL (non SQLite)
- [ ] Database `crypto_db` esiste in PostgreSQL
- [ ] Variabile `DATABASE_URL` è configurata correttamente
- [ ] Backend riavviato dopo le modifiche
- [ ] Log del backend non mostrano errori critici
- [ ] Test diretto dell'endpoint funziona

## 🚨 Se il problema persiste

1. **Cattura l'errore completo:**
   ```bash
   pm2 logs ticketapp-backend --lines 200 > /tmp/backend-logs.txt
   cat /tmp/backend-logs.txt | grep -A 10 "bot-analysis"
   ```

2. **Verifica che il modulo PostgreSQL funzioni:**
   ```bash
   cd /var/www/ticketapp/backend
   node -e "
   const db = require('./crypto_db');
   db.dbAll('SELECT 1 as test', [])
     .then(r => console.log('✅ dbAll funziona:', r))
     .catch(e => console.error('❌ dbAll errore:', e));
   "
   ```

3. **Test connessione database:**
   ```bash
   cd /var/www/ticketapp/backend
   node -e "
   const { Pool } = require('pg');
   const pool = new Pool({
     connectionString: process.env.DATABASE_URL?.replace(/\/[^\/]+$/, '/crypto_db')
   });
   pool.query('SELECT 1')
     .then(() => { console.log('✅ Connessione OK'); process.exit(0); })
     .catch(e => { console.error('❌ Errore connessione:', e.message); process.exit(1); });
   "
   ```

