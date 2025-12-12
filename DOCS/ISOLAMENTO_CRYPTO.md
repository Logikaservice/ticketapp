# Isolamento Dati Crypto - Guida Completa

## 🎯 Obiettivo

Garantire che i dati del progetto crypto siano **completamente isolati** dagli altri progetti (tickets, vivaldi, packvision), permettendo di:
- ✅ Eliminare il progetto crypto senza toccare altri dati
- ✅ Spostare il progetto crypto su un server separato
- ✅ Fare backup/restore indipendenti
- ✅ Gestire permessi e accessi separatamente

## 📊 Situazione Attuale

### SQLite (Attuale)
- ✅ **Completamente isolato**: `crypto.db` è un file separato
- ✅ Nessun conflitto con altri progetti
- ✅ Facile da eliminare/spostare: basta copiare/eliminare il file

### PostgreSQL (Dopo Migrazione)

**Opzione 1: Database Separato** ⭐ **RACCOMANDATO**
- ✅ Isolamento completo (come Vivaldi e PackVision)
- ✅ Database dedicato: `crypto_db`
- ✅ Eliminazione semplice: `DROP DATABASE crypto_db;`
- ✅ Backup indipendente

**Opzione 2: Stesso Database, Tabelle Separate**
- ⚠️ Tabelle con nomi unici (nessun conflitto)
- ⚠️ Eliminazione richiede `DROP TABLE` per ogni tabella crypto
- ⚠️ Backup include anche altri progetti

## 🔧 Configurazione Database Separato

### 1. Crea Database Separato

```bash
# Metodo 1: Via psql
psql $DATABASE_URL -c "CREATE DATABASE crypto_db;"

# Metodo 2: Via createdb
createdb crypto_db
```

### 2. Configura Variabile d'Ambiente

Aggiungi in `.env`:

```bash
# Database separato per crypto (raccomandato)
DATABASE_URL_CRYPTO=postgresql://user:password@host:5432/crypto_db
```

**Nota**: Se non configuri `DATABASE_URL_CRYPTO`, il sistema creerà automaticamente un database separato basato su `DATABASE_URL` (sostituendo il nome database con `crypto_db`).

### 3. Esegui Migrazione

```bash
# Crea tabelle nel database separato
psql $DATABASE_URL_CRYPTO -f backend/scripts/migrate-crypto-to-postgresql.sql

# Migra dati da SQLite
cd backend
node scripts/migrate-crypto-data-sqlite-to-postgresql.js
```

## 📋 Tabelle Crypto (8 tabelle totali)

Tutte le tabelle crypto hanno nomi unici e non entrano in conflitto:

1. `portfolio` - Balance e holdings
2. `trades` - Storico trade
3. `bot_settings` - Configurazioni bot
4. `price_history` - Storico prezzi
5. `klines` - Candele OHLC
6. `open_positions` - Posizioni aperte
7. `backtest_results` - Risultati backtest
8. `performance_stats` - Statistiche performance

## 🗑️ Come Eliminare il Progetto Crypto

### Se Database Separato (Raccomandato)

```bash
# 1. Elimina database PostgreSQL
psql $DATABASE_URL -c "DROP DATABASE crypto_db;"

# 2. Rimuovi file SQLite (se ancora presente)
rm backend/crypto.db

# 3. Rimuovi variabile d'ambiente (opzionale)
# Rimuovi DATABASE_URL_CRYPTO da .env

# 4. Rimuovi codice (opzionale)
rm -rf backend/routes/cryptoRoutes.js
rm -rf backend/crypto_db.js
rm -rf backend/services/*Crypto*.js
rm -rf frontend/src/components/CryptoDashboard
```

### Se Stesso Database

```sql
-- Elimina tutte le tabelle crypto
DROP TABLE IF EXISTS portfolio CASCADE;
DROP TABLE IF EXISTS trades CASCADE;
DROP TABLE IF EXISTS bot_settings CASCADE;
DROP TABLE IF EXISTS price_history CASCADE;
DROP TABLE IF EXISTS klines CASCADE;
DROP TABLE IF EXISTS open_positions CASCADE;
DROP TABLE IF EXISTS backtest_results CASCADE;
DROP TABLE IF EXISTS performance_stats CASCADE;
```

## 📦 Come Spostare il Progetto Crypto

### Metodo 1: Backup/Restore Database Separato

```bash
# 1. Backup database crypto
pg_dump $DATABASE_URL_CRYPTO > crypto_backup.sql

# 2. Trasferisci file
scp crypto_backup.sql nuovo-server:/path/

# 3. Crea database sul nuovo server
psql $DATABASE_URL_NUOVO -c "CREATE DATABASE crypto_db;"

# 4. Restore
psql $DATABASE_URL_CRYPTO_NUOVO < crypto_backup.sql
```

### Metodo 2: Export/Import Dati

```bash
# 1. Export dati
cd backend
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL_CRYPTO });
// Export logic...
"

# 2. Import su nuovo server
# (stesso processo inverso)
```

## 🔍 Verifica Isolamento

### Controlla Database Separato

```bash
# Lista database
psql $DATABASE_URL -c "\l" | grep crypto

# Conta tabelle crypto
psql $DATABASE_URL_CRYPTO -c "\dt"

# Verifica che non ci siano tabelle di altri progetti
psql $DATABASE_URL_CRYPTO -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"
```

### Controlla Stesso Database

```sql
-- Lista tutte le tabelle
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Verifica che le tabelle crypto siano separate
-- Dovresti vedere solo: portfolio, trades, bot_settings, price_history, 
-- klines, open_positions, backtest_results, performance_stats
-- E NON vedere: users, tickets, alerts, access_logs, ecc.
```

## 📊 Confronto con Altri Progetti

| Progetto | Database | Isolamento |
|----------|----------|------------|
| **Tickets** | `DATABASE_URL` (main) | Condiviso |
| **Vivaldi** | `DATABASE_URL_VIVALDI` | ✅ Separato |
| **PackVision** | `packvision_db` (auto) | ✅ Separato |
| **Crypto** | `DATABASE_URL_CRYPTO` (auto) | ✅ Separato |

## ✅ Vantaggi Database Separato

1. **Isolamento Completo**: Nessun rischio di conflitti
2. **Eliminazione Semplice**: `DROP DATABASE` e via
3. **Backup Indipendente**: Backup solo dati crypto
4. **Performance**: Database dedicato = performance migliori
5. **Sicurezza**: Permessi separati per database crypto
6. **Scalabilità**: Può essere spostato su server dedicato

## 🎯 Raccomandazione Finale

**Usa sempre un database separato per crypto** (`DATABASE_URL_CRYPTO`), come fanno Vivaldi e PackVision. Questo garantisce:
- ✅ Isolamento completo
- ✅ Facilità di gestione
- ✅ Nessun impatto sugli altri progetti
- ✅ Possibilità di eliminare/spostare senza problemi

