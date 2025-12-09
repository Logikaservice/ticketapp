# Riepilogo Migrazione SQLite → PostgreSQL

## ✅ Lavoro Completato

Ho preparato tutto il necessario per migrare il sistema crypto da SQLite a PostgreSQL. Ecco cosa è stato creato:

### 📁 File Creati

1. **`backend/scripts/migrate-crypto-to-postgresql.sql`**
   - Schema PostgreSQL completo con tutte le tabelle
   - Conversioni automatiche dei tipi dati (INTEGER → SERIAL, REAL → DOUBLE PRECISION, ecc.)
   - Indici per performance
   - Valori di default e constraints

2. **`backend/scripts/migrate-crypto-data-sqlite-to-postgresql.js`**
   - Script Node.js per migrare tutti i dati da SQLite a PostgreSQL
   - Gestione automatica dei conflitti (ON CONFLICT)
   - Verifica integrità dati
   - Riepilogo dettagliato della migrazione

3. **`backend/crypto_db_postgresql.js`**
   - Nuovo modulo database che usa PostgreSQL invece di SQLite
   - Helper functions (dbAll, dbGet, dbRun) compatibili con il codice esistente
   - Conversione automatica query SQLite → PostgreSQL:
     - Placeholders `?` → `$1, $2, $3...`
     - `INSERT OR IGNORE` → `INSERT ... ON CONFLICT DO NOTHING`
   - Inizializzazione automatica tabelle

4. **`MIGRAZIONE_SQLITE_TO_POSTGRESQL.md`**
   - Guida completa passo-passo per la migrazione
   - Troubleshooting e verifiche
   - Checklist finale

5. **`backend/routes/cryptoRoutes.js`** (aggiornato)
   - Supporto retrocompatibile: funziona sia con SQLite che PostgreSQL
   - Rileva automaticamente quale modulo database è disponibile
   - Nessuna interruzione durante la migrazione

## 🔄 Prossimi Passi

### 1. Test Locale (Consigliato)

```bash
# 1. Backup database SQLite
cp backend/crypto.db backend/crypto.db.backup

# 2. Crea schema PostgreSQL
psql $DATABASE_URL -f backend/scripts/migrate-crypto-to-postgresql.sql

# 3. Migra dati
cd backend
node scripts/migrate-crypto-data-sqlite-to-postgresql.js

# 4. Testa nuovo modulo (senza sostituire ancora)
node -e "const db = require('./crypto_db_postgresql'); console.log('✅ PostgreSQL module OK');"
```

### 2. Migrazione Completa

```bash
# 1. Backup vecchio modulo
mv backend/crypto_db.js backend/crypto_db.js.sqlite.backup

# 2. Attiva nuovo modulo PostgreSQL
mv backend/crypto_db_postgresql.js backend/crypto_db.js

# 3. Riavvia backend
pm2 restart backend
# oppure
cd backend && node index.js
```

### 3. Verifica

- ✅ Dashboard crypto mostra dati corretti
- ✅ Trading operations funzionano
- ✅ Statistiche e grafici aggiornati
- ✅ Log senza errori database

## 📊 Tabelle Migrate

- `portfolio` - Balance e holdings
- `trades` - Storico trade
- `bot_settings` - Configurazioni bot
- `price_history` - Storico prezzi
- `klines` - Candele OHLC
- `open_positions` - Posizioni aperte
- `backtest_results` - Risultati backtest
- `performance_stats` - Statistiche performance

## 🔧 Conversioni Automatiche

Il nuovo modulo gestisce automaticamente:

1. **Placeholders**: `?` → `$1, $2, $3...`
2. **INSERT OR IGNORE**: Convertito in `ON CONFLICT DO NOTHING/UPDATE`
3. **Tipi Dati**: Tutti convertiti correttamente
4. **Timestamps**: `DATETIME` → `TIMESTAMPTZ`

## ⚠️ Note Importanti

1. **Database Separato (Opzionale)**
   - Puoi usare lo stesso database PostgreSQL degli altri moduli
   - Oppure creare un database separato: `DATABASE_URL_CRYPTO` in `.env`

2. **Retrocompatibilità**
   - `cryptoRoutes.js` supporta entrambi i sistemi
   - Puoi tornare a SQLite se necessario (ripristina backup)

3. **Altri File che Usano crypto_db**
   - `SmartExit.js`
   - `RiskManager.js`
   - Vari script in `backend/scripts/`
   - Funzioneranno automaticamente con il nuovo modulo (stessa API)

## 🎯 Vantaggi PostgreSQL

- ✅ Coerenza con altri moduli (tickets, vivaldi, packvision)
- ✅ Migliori performance su dataset grandi
- ✅ Transazioni ACID complete
- ✅ Backup e replica più semplici
- ✅ Supporto JSONB nativo (se necessario in futuro)

## 🆘 Se Qualcosa Va Storto

1. **Ripristina SQLite**:
   ```bash
   mv backend/crypto_db.js backend/crypto_db_postgresql.js
   mv backend/crypto_db.js.sqlite.backup backend/crypto_db.js
   pm2 restart backend
   ```

2. **Verifica Log**:
   ```bash
   pm2 logs backend
   # Cerca errori PostgreSQL
   ```

3. **Test Connessione**:
   ```bash
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM portfolio;"
   ```

## ✅ Stato Attuale

- [x] Schema PostgreSQL creato
- [x] Script migrazione dati pronto
- [x] Nuovo modulo PostgreSQL implementato
- [x] cryptoRoutes.js aggiornato (retrocompatibile)
- [ ] Migrazione dati eseguita (da fare)
- [ ] Test funzionalità completo (da fare)
- [ ] Deploy in produzione (da fare)

Tutto è pronto per la migrazione! 🚀

