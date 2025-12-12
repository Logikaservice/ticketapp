# 🔧 Guida Fix Errore 500 - Bot Analysis

## Problemi Trovati e Risolti

### ✅ Fix 1: INSERT OR REPLACE (PostgreSQL)
- **File**: `backend/crypto_db_postgresql.js`
- **Problema**: `INSERT OR REPLACE` non supportato in PostgreSQL
- **Soluzione**: Aggiunto supporto per `INSERT ... ON CONFLICT DO UPDATE`

### ✅ Fix 2: setPerformanceStats mancante (Frontend)
- **File**: `frontend/src/components/CryptoDashboard/CryptoDashboard.jsx`
- **Problema**: `ReferenceError: setPerformanceStats is not defined`
- **Soluzione**: Aggiunto `useState` per `performanceStats`

### ✅ Fix 3: db.serialize() e db.run() diretti (Backend)
- **File**: `backend/routes/cryptoRoutes.js` (linea ~1024)
- **Problema**: Uso diretto di `db.serialize()` e `db.run()` che fallisce con PostgreSQL
- **Soluzione**: Convertito a `await dbRun()`

### ✅ Fix 4: db.get() diretto (Backend)
- **File**: `backend/routes/cryptoRoutes.js` (linea ~1658)
- **Problema**: Uso diretto di `db.get()` con require che fallisce con PostgreSQL
- **Soluzione**: Convertito a `await dbGet()`

## 📋 Comandi da Eseguire sulla VPS

```bash
# 1. Vai nella directory del progetto
cd /var/www/ticketapp

# 2. Pull di TUTTI i fix
git pull origin main

# 3. VERIFICA CRITICA: Controlla che crypto_db.js sia PostgreSQL
cd backend
head -5 crypto_db.js

# ✅ DEVE mostrare:
# const { Pool } = require('pg');
# 
# ❌ NON deve mostrare:
# const sqlite3 = require('sqlite3');

# 4. Se crypto_db.js è ancora SQLite, sostituiscilo:
# (Fai backup prima!)
cp crypto_db.js crypto_db.js.backup-sqlite
cp crypto_db_postgresql.js crypto_db.js

# 5. Verifica che DATABASE_URL_CRYPTO sia configurato
grep DATABASE_URL_CRYPTO .env
# Se non c'è, aggiungilo al .env:
# DATABASE_URL_CRYPTO=postgresql://user:password@localhost:5432/crypto_db

# 6. Rebuild frontend (per fix setPerformanceStats)
cd ../frontend
npm run build

# 7. Verifica che index.html sia stato creato
ls -la build/index.html

# 8. Correggi permessi se necessario
sudo chown -R www-data:www-data /var/www/ticketapp/frontend/build/
sudo chmod -R 755 /var/www/ticketapp/frontend/build/

# 9. Riavvia backend
cd ../backend
pm2 restart ticketapp-backend

# 10. Verifica log per errori
pm2 logs ticketapp-backend --lines 100 | grep -i error

# 11. Verifica che il backend usi PostgreSQL
pm2 logs ticketapp-backend --lines 50 | grep -i "postgresql\|sqlite"
# ✅ DEVE mostrare: "Using PostgreSQL crypto database"
# ❌ NON deve mostrare: "Using SQLite crypto database"
```

## 🔍 Verifica Finale

Dopo aver eseguito tutti i comandi:

1. **Apri il browser** e vai su `ticket.logikaservice.it/?domain=crypto&page=bot-analysis&symbol=bitcoin`
2. **Apri la console** (F12) e verifica:
   - ✅ NON deve esserci errore 500
   - ✅ La pagina deve caricare i dati
   - ✅ NON deve esserci "ReferenceError: setPerformanceStats is not defined"

3. **Verifica Market Scanner**:
   - ✅ I dati devono essere visibili
   - ⚠️ "Dati non disponibili" è normale se il bot non ha ancora analizzato i simboli

## 🚨 Se l'Errore 500 Persiste

Se dopo tutti i fix l'errore 500 persiste:

1. **Controlla i log del backend**:
   ```bash
   pm2 logs ticketapp-backend --lines 200 | grep -A 10 "BOT-ANALYSIS\|Error\|500"
   ```

2. **Verifica che il database crypto_db esista**:
   ```bash
   psql -U postgres -l | grep crypto_db
   ```

3. **Verifica la connessione al database**:
   ```bash
   cd /var/www/ticketapp/backend
   node -e "require('dotenv').config(); const { Pool } = require('pg'); const pool = new Pool({ connectionString: process.env.DATABASE_URL_CRYPTO || process.env.DATABASE_URL.replace(/\/[^\/]+$/, '/crypto_db') }); pool.query('SELECT 1').then(() => console.log('✅ DB OK')).catch(e => console.error('❌ DB Error:', e.message));"
   ```

4. **Invia i log completi** per ulteriore analisi.

