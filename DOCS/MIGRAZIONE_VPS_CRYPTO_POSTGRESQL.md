# 🚀 Migrazione Crypto VPS: SQLite → PostgreSQL

## ⚠️ IMPORTANTE: Non toccheremo mai gli altri progetti!

---

## 📋 CHECKLIST PRE-MIGRAZIONE VPS

- [ ] Backup database SQLite VPS creato
- [ ] Database PostgreSQL principale VPS funzionante
- [ ] Database crypto_db creato sulla VPS (separato)
- [ ] Tabelle crypto create nel database separato
- [ ] Dati migrati e verificati
- [ ] Modulo sostituito
- [ ] Backend VPS riavviato e funzionante
- [ ] Dashboard crypto testato

---

## STEP 1: Backup Database SQLite VPS

**Cosa facciamo**: Creiamo un backup del database SQLite sulla VPS prima di qualsiasi modifica.

**Comandi da eseguire sulla VPS**:
```bash
cd /var/www/ticketapp/backend
cp crypto.db crypto.db.backup-$(date +%Y%m%d-%H%M%S)
ls -lh crypto.db.backup-*
```

**Cosa verificare**:
- [ ] File backup creato con timestamp
- [ ] Dimensione file > 0

**Screenshot richiesto**: Mostra il file backup creato

---

## STEP 2: Verifica Database PostgreSQL Principale VPS

**Cosa facciamo**: Verifichiamo che il database PostgreSQL principale funzioni e che NON lo tocchiamo.

**Comandi da eseguire**:
```bash
# Verifica connessione (NON modifica nulla)
psql $DATABASE_URL -c "SELECT current_database(), version();"

# Verifica che NON ci siano tabelle crypto
psql $DATABASE_URL -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('portfolio', 'trades', 'bot_settings') ORDER BY table_name;"
```

**Cosa verificare**:
- [ ] Connessione riuscita
- [ ] Vedi il nome del database principale (es: `ticketapp`)
- [ ] NON vedi tabelle crypto (portfolio, trades, ecc.)

**Screenshot richiesto**: Mostra l'output del comando

---

## STEP 3: Creazione Database Separato crypto_db sulla VPS

**Cosa facciamo**: Creiamo un database PostgreSQL SEPARATO solo per crypto sulla VPS, senza toccare il database principale.

**Comandi da eseguire**:
```bash
# Crea database separato (NON tocca il database principale)
psql $DATABASE_URL -c "CREATE DATABASE crypto_db;"

# Verifica database creato
psql $DATABASE_URL -c "\l" | grep crypto
```

**Cosa verificare**:
- [ ] Messaggio "CREATE DATABASE" senza errori
- [ ] Database principale ancora intatto

**Verifica database creato**:
```bash
# Lista database (solo visualizzazione)
psql $DATABASE_URL -c "\l" | grep crypto
```

**Screenshot richiesto**: Mostra che crypto_db è stato creato

---

## STEP 4: Creazione Tabelle nel Database Separato VPS

**Cosa facciamo**: Creiamo le tabelle crypto SOLO nel database crypto_db sulla VPS.

**Comandi da eseguire**:
```bash
cd /var/www/ticketapp/backend

# Usa DATABASE_URL_CRYPTO se configurato, altrimenti crea URL
# Estrai credenziali da DATABASE_URL
DB_URL=$(echo $DATABASE_URL | sed 's|/[^/]*$|/crypto_db|')
echo "Database URL crypto: $DB_URL"

# Crea tabelle
psql $DB_URL -f scripts/migrate-crypto-to-postgresql.sql
```

**Oppure se hai DATABASE_URL_CRYPTO configurato**:
```bash
psql $DATABASE_URL_CRYPTO -f scripts/migrate-crypto-to-postgresql.sql
```

**Cosa verificare**:
- [ ] Nessun errore durante creazione tabelle
- [ ] Tabelle create solo in crypto_db

**Verifica tabelle create**:
```bash
# Connetti a crypto_db e lista tabelle
psql $DB_URL -c "\dt"
```

**Dovresti vedere**:
- portfolio
- trades
- bot_settings
- price_history
- klines
- open_positions
- backtest_results
- performance_stats

**Screenshot richiesto**: Mostra le tabelle create in crypto_db

---

## STEP 5: Configurazione Variabile d'Ambiente VPS

**Cosa facciamo**: Configuriamo `DATABASE_URL_CRYPTO` in `.env` sulla VPS per usare il database separato.

**File da modificare**: `/var/www/ticketapp/backend/.env`

**Aggiungi questa riga**:
```bash
DATABASE_URL_CRYPTO=postgresql://USER:PASS@HOST:5432/crypto_db
```

**Sostituisci**:
- `USER` = tuo utente PostgreSQL VPS
- `PASS` = tua password PostgreSQL VPS
- `HOST` = tuo host PostgreSQL VPS (es: localhost o IP)
- `5432` = porta PostgreSQL (solitamente 5432)

**Comando rapido**:
```bash
# Estrai credenziali da DATABASE_URL e crea DATABASE_URL_CRYPTO
cd /var/www/ticketapp/backend
CRYPTO_DB_URL=$(echo $DATABASE_URL | sed 's|/[^/]*$|/crypto_db|')
echo "DATABASE_URL_CRYPTO=$CRYPTO_DB_URL" >> .env

# Verifica
grep DATABASE_URL_CRYPTO .env
```

**Screenshot richiesto**: Mostra la riga aggiunta in `.env`

---

## STEP 6: Migrazione Dati da SQLite a PostgreSQL VPS

**Cosa facciamo**: Migriamo tutti i dati da `crypto.db` (SQLite) a `crypto_db` (PostgreSQL) sulla VPS.

**Comandi da eseguire**:
```bash
cd /var/www/ticketapp/backend
node scripts/migrate-crypto-data-sqlite-to-postgresql.js
```

**Cosa verificare**:
- [ ] Script eseguito senza errori
- [ ] Riepilogo mostra dati migrati
- [ ] Conta record migrati per ogni tabella

**Screenshot richiesto**: Mostra il riepilogo della migrazione

---

## STEP 7: Verifica Dati Migrati VPS

**Cosa facciamo**: Verifichiamo che i dati siano stati migrati correttamente sulla VPS.

**Comandi da eseguire**:
```bash
# Connetti a crypto_db e verifica record
DB_URL=$(echo $DATABASE_URL | sed 's|/[^/]*$|/crypto_db|')
psql $DB_URL -c "SELECT COUNT(*) as portfolio_count FROM portfolio;"
psql $DB_URL -c "SELECT COUNT(*) as trades_count FROM trades;"
psql $DB_URL -c "SELECT COUNT(*) as positions_count FROM open_positions;"
psql $DB_URL -c "SELECT COUNT(*) as klines_count FROM klines;"
```

**Confronta con SQLite** (opzionale, per verifica):
```bash
# Se hai sqlite3 installato
sqlite3 /var/www/ticketapp/backend/crypto.db "SELECT COUNT(*) FROM portfolio;"
sqlite3 /var/www/ticketapp/backend/crypto.db "SELECT COUNT(*) FROM trades;"
```

**Cosa verificare**:
- [ ] I conteggi corrispondono (o sono simili)
- [ ] Nessun errore nelle query

**Screenshot richiesto**: Mostra i conteggi delle tabelle

---

## STEP 8: Backup e Sostituzione Modulo VPS

**Cosa facciamo**: Sostituiamo il vecchio modulo SQLite con quello PostgreSQL sulla VPS.

**IMPORTANTE**: Prima facciamo backup del vecchio modulo.

**Comandi da eseguire**:
```bash
cd /var/www/ticketapp/backend

# Backup vecchio modulo
cp crypto_db.js crypto_db.js.sqlite.backup

# Sostituisci con nuovo modulo PostgreSQL
cp crypto_db_postgresql.js crypto_db.js

# Verifica
ls -la crypto_db.js*
```

**Cosa verificare**:
- [ ] `crypto_db.js.sqlite.backup` creato
- [ ] `crypto_db.js` ora è il modulo PostgreSQL

**Screenshot richiesto**: Mostra i file nella cartella backend

---

## STEP 9: Test Backend VPS con Nuovo Modulo

**Cosa facciamo**: Riavviamo il backend VPS e testiamo che tutto funzioni.

**Comandi da eseguire**:
```bash
# Riavvia backend
pm2 restart ticketapp-backend
# oppure
pm2 restart backend

# Vedi log
pm2 logs backend --lines 50
```

**Cosa verificare nei log**:
- [ ] "✅ Connected to the crypto PostgreSQL database"
- [ ] "✅ Tabelle crypto PostgreSQL inizializzate correttamente"
- [ ] Nessun errore di connessione database

**Test funzionalità**:
1. Apri dashboard crypto nel browser: `https://ticket.logikaservice.it/crypto` (o percorso corretto)
2. Verifica che i dati siano visibili
3. Testa una operazione (es: visualizza posizioni)

**Screenshot richiesto**: 
- Log backend che mostra connessione PostgreSQL
- Dashboard crypto funzionante

---

## STEP 10: Verifica Database Principale VPS Intatto

**Cosa facciamo**: Verifichiamo che il database principale VPS NON sia stato toccato.

**Comandi da eseguire**:
```bash
# Connetti al database principale (NON crypto_db)
psql $DATABASE_URL -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
```

**Cosa verificare**:
- [ ] Vedi tabelle: users, tickets, alerts, access_logs, ecc.
- [ ] NON vedi tabelle crypto: portfolio, trades, bot_settings, ecc.
- [ ] Database principale completamente intatto

**Screenshot richiesto**: Mostra le tabelle del database principale (senza tabelle crypto)

---

## STEP 11: Rimozione Database SQLite VPS (OPZIONALE - Solo dopo conferma)

**⚠️ ATTENZIONE**: Questo step elimina definitivamente il database SQLite. Esegui SOLO dopo aver verificato che tutto funzioni correttamente.

**Cosa facciamo**: Rimuoviamo il database SQLite vecchio (ora non più necessario).

**Comandi da eseguire**:
```bash
cd /var/www/ticketapp/backend

# Rinomina invece di eliminare (più sicuro)
mv crypto.db crypto.db.old

# Oppure elimina definitivamente (solo se sei sicuro)
# rm crypto.db
```

**Cosa verificare**:
- [ ] File rimosso/rinominato
- [ ] Backup ancora presente

**Screenshot richiesto**: Mostra che crypto.db è stato rimosso/rinominato

---

## ✅ CHECKLIST FINALE VPS

- [ ] Database SQLite backup creato
- [ ] Database crypto_db creato (separato)
- [ ] Tabelle create in crypto_db
- [ ] Dati migrati correttamente
- [ ] Modulo PostgreSQL funzionante
- [ ] Backend funziona con PostgreSQL
- [ ] Database principale intatto (verificato)
- [ ] Dashboard crypto funzionante
- [ ] Database SQLite rimosso (opzionale)

---

## 🆘 In Caso di Problemi

### Ripristino a SQLite VPS
```bash
cd /var/www/ticketapp/backend
cp crypto_db.js.sqlite.backup crypto_db.js
# Ripristina crypto.db dal backup se necessario
pm2 restart backend
```

### Verifica Errori
- Controlla log backend: `pm2 logs backend`
- Verifica connessione: `psql $DATABASE_URL_CRYPTO -c "SELECT 1;"`
- Verifica tabelle: `psql $DATABASE_URL_CRYPTO -c "\dt"`

---

## 📞 Pronto per Iniziare?

Quando sei pronto, inizia con **STEP 1** e inviami lo screenshot di conferma. Procederemo passo-passo con la tua approvazione ad ogni step.

