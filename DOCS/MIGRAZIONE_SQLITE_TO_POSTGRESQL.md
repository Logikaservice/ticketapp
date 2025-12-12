# Migrazione Crypto da SQLite a PostgreSQL

Questa guida descrive il processo completo per migrare il sistema crypto da SQLite a PostgreSQL, per coerenza con gli altri moduli del progetto.

## 📋 Prerequisiti

1. PostgreSQL installato e configurato
2. Database PostgreSQL esistente (o creare uno nuovo)
3. Variabile d'ambiente `DATABASE_URL` configurata in `.env`
4. Backup del database SQLite esistente (`crypto.db`)

## 🔄 Processo di Migrazione

### Fase 1: Preparazione

1. **Backup del database SQLite**
   ```bash
   cp backend/crypto.db backend/crypto.db.backup
   ```

2. **Verifica connessione PostgreSQL**
   ```bash
   psql $DATABASE_URL -c "SELECT version();"
   ```

### Fase 2: Creazione Schema PostgreSQL

**✅ RACCOMANDATO: Database Separato per Isolamento Completo**

1. **Crea database separato per crypto** (come Vivaldi e PackVision)
   ```bash
   # Crea database separato
   createdb crypto_db
   
   # Oppure via psql:
   psql $DATABASE_URL -c "CREATE DATABASE crypto_db;"
   ```

2. **Configura variabile d'ambiente** (opzionale ma consigliato)
   ```bash
   # Aggiungi in .env:
   DATABASE_URL_CRYPTO=postgresql://user:password@host:5432/crypto_db
   ```
   
   **Nota**: Se non configuri `DATABASE_URL_CRYPTO`, il sistema creerà automaticamente un database separato basato su `DATABASE_URL` (sostituendo il nome database con `crypto_db`).

3. **Esegui lo script SQL per creare le tabelle**
   ```bash
   # Se hai configurato DATABASE_URL_CRYPTO:
   psql $DATABASE_URL_CRYPTO -f backend/scripts/migrate-crypto-to-postgresql.sql
   
   # Oppure se vuoi specificare manualmente:
   psql postgresql://user:password@host:5432/crypto_db -f backend/scripts/migrate-crypto-to-postgresql.sql
   ```

**⚠️ Alternativa: Stesso Database (Non Consigliato)**
   Se preferisci usare lo stesso database degli altri progetti (non isolato):
   ```bash
   psql $DATABASE_URL -f backend/scripts/migrate-crypto-to-postgresql.sql
   ```
   Le tabelle crypto hanno nomi unici e non entrano in conflitto con le altre.

### Fase 3: Migrazione Dati

1. **Esegui lo script di migrazione dati**
   ```bash
   cd backend
   node scripts/migrate-crypto-data-sqlite-to-postgresql.js
   ```

   Lo script:
   - Legge tutti i dati da `crypto.db` (SQLite)
   - Migra i dati nel database PostgreSQL
   - Verifica l'integrità dei dati
   - Mostra un riepilogo della migrazione

### Fase 4: Sostituzione Modulo Database

1. **Backup del vecchio modulo**
   ```bash
   mv backend/crypto_db.js backend/crypto_db.js.sqlite.backup
   ```

2. **Rinomina il nuovo modulo**
   ```bash
   mv backend/crypto_db_postgresql.js backend/crypto_db.js
   ```

3. **Verifica che il nuovo modulo funzioni**
   ```bash
   node -e "const db = require('./backend/crypto_db'); console.log('✅ Modulo caricato correttamente');"
   ```

### Fase 5: Test e Verifica

1. **Riavvia il backend**
   ```bash
   # Se usi PM2
   pm2 restart backend
   
   # Oppure manualmente
   cd backend && node index.js
   ```

2. **Verifica funzionalità**
   - Apri il dashboard crypto
   - Verifica che i dati siano presenti
   - Testa operazioni di trading
   - Verifica statistiche e grafici

3. **Controlla i log**
   ```bash
   # Dovresti vedere:
   # ✅ Connected to the crypto PostgreSQL database
   # ✅ Tabelle crypto PostgreSQL inizializzate correttamente
   ```

## 🔍 Verifica Post-Migrazione

### Controllo Dati

```sql
-- Verifica record migrati
SELECT COUNT(*) FROM portfolio;
SELECT COUNT(*) FROM trades;
SELECT COUNT(*) FROM open_positions;
SELECT COUNT(*) FROM bot_settings;
SELECT COUNT(*) FROM klines;
SELECT COUNT(*) FROM performance_stats;
```

### Confronto SQLite vs PostgreSQL

```bash
# Conta record SQLite
sqlite3 backend/crypto.db "SELECT COUNT(*) FROM portfolio;"
sqlite3 backend/crypto.db "SELECT COUNT(*) FROM trades;"
sqlite3 backend/crypto.db "SELECT COUNT(*) FROM open_positions;"

# Confronta con PostgreSQL
psql $DATABASE_URL -c "SELECT COUNT(*) FROM portfolio;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM trades;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM open_positions;"
```

## ⚠️ Note Importanti

### Differenze SQLite vs PostgreSQL

1. **Tipi Dati**
   - `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`
   - `REAL` → `DOUBLE PRECISION`
   - `DATETIME` → `TIMESTAMPTZ`
   - `TEXT` → `TEXT` (uguale)

2. **Placeholders**
   - SQLite: `?` → PostgreSQL: `$1, $2, $3...`
   - Gestito automaticamente da `convertSqliteToPostgres()`

3. **INSERT OR IGNORE**
   - SQLite: `INSERT OR IGNORE` → PostgreSQL: `INSERT ... ON CONFLICT DO NOTHING`
   - Gestito automaticamente per ogni tabella

4. **PRAGMA**
   - SQLite: `PRAGMA table_info(table)` → PostgreSQL: `SELECT column_name FROM information_schema.columns`
   - Non più necessario dopo migrazione iniziale

### Gestione Errori

Se qualcosa va storto:

1. **Ripristina backup SQLite**
   ```bash
   cp backend/crypto.db.backup backend/crypto.db
   mv backend/crypto_db.js backend/crypto_db_postgresql.js
   mv backend/crypto_db.js.sqlite.backup backend/crypto_db.js
   ```

2. **Riavvia backend**
   ```bash
   pm2 restart backend
   ```

## 📝 File Modificati

- ✅ `backend/scripts/migrate-crypto-to-postgresql.sql` - Schema PostgreSQL
- ✅ `backend/scripts/migrate-crypto-data-sqlite-to-postgresql.js` - Script migrazione dati
- ✅ `backend/crypto_db_postgresql.js` - Nuovo modulo PostgreSQL (da rinominare in `crypto_db.js`)

## 🚀 Dopo la Migrazione

Una volta verificato che tutto funziona:

1. **Rimuovi dipendenza SQLite** (opzionale, se non usata altrove)
   ```bash
   npm uninstall sqlite3
   ```

2. **Archivia database SQLite** (mantieni backup)
   ```bash
   mkdir -p backups
   mv backend/crypto.db backups/crypto.db.$(date +%Y%m%d)
   ```

3. **Aggiorna documentazione** se necessario

## ✅ Checklist Finale

- [ ] Backup SQLite creato
- [ ] Schema PostgreSQL creato
- [ ] Dati migrati e verificati
- [ ] Modulo `crypto_db.js` sostituito
- [ ] Backend riavviato e funzionante
- [ ] Dashboard crypto testato
- [ ] Trading operations testate
- [ ] Statistiche e grafici verificati
- [ ] Log senza errori

## 🆘 Troubleshooting

### Errore: "relation does not exist"
- Verifica che lo script SQL sia stato eseguito
- Controlla che `DATABASE_URL` punti al database corretto

### Errore: "duplicate key value violates unique constraint"
- I dati sono già stati migrati
- Lo script gestisce automaticamente i conflitti

### Errore: "syntax error at or near"
- Verifica che tutte le query siano state convertite correttamente
- Controlla i log per la query specifica

### Performance lente
- Verifica che gli indici siano stati creati
- Controlla `EXPLAIN ANALYZE` per query lente

