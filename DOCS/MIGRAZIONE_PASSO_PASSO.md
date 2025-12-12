# 🚀 Migrazione Crypto SQLite → PostgreSQL - Passo per Passo

## ⚠️ IMPORTANTE: Non toccheremo mai i database degli altri progetti!

---

## 📋 CHECKLIST PRE-MIGRAZIONE

- [ ] Backup database SQLite creato
- [ ] Database PostgreSQL principale funzionante
- [ ] Database crypto_db creato (separato)
- [ ] Tabelle crypto create nel database separato
- [ ] Dati migrati e verificati
- [ ] Test funzionalità completato
- [ ] Modulo sostituito
- [ ] Database SQLite rimosso (solo dopo conferma finale)

---

## STEP 1: Backup Database SQLite

**Cosa facciamo**: Creiamo un backup del database SQLite attuale prima di qualsiasi modifica.

**Comandi da eseguire**:
```bash
cd C:\TicketApp\backend
copy crypto.db crypto.db.backup-$(Get-Date -Format "yyyyMMdd-HHmmss")
```

**Cosa verificare**:
- [ ] File `crypto.db.backup-YYYYMMDD-HHMMSS` creato nella cartella `backend`
- [ ] Dimensione file > 0

**Screenshot richiesto**: Mostra il file backup creato

---

## STEP 2: Verifica Database PostgreSQL Principale

**Cosa facciamo**: Verifichiamo che il database PostgreSQL principale funzioni e che NON lo tocchiamo.

**Comandi da eseguire**:
```bash
# Verifica connessione (NON modifica nulla)
psql $env:DATABASE_URL -c "SELECT current_database(), version();"
```

**Cosa verificare**:
- [ ] Connessione riuscita
- [ ] Vedi il nome del database principale (es: `ticketapp`)
- [ ] NON vedi tabelle crypto (portfolio, trades, ecc.)

**Screenshot richiesto**: Mostra l'output del comando

---

## STEP 3: Creazione Database Separato crypto_db

**Cosa facciamo**: Creiamo un database PostgreSQL SEPARATO solo per crypto, senza toccare il database principale.

**Comandi da eseguire**:
```bash
# Crea database separato (NON tocca il database principale)
psql $env:DATABASE_URL -c "CREATE DATABASE crypto_db;"
```

**Cosa verificare**:
- [ ] Messaggio "CREATE DATABASE" senza errori
- [ ] Database principale ancora intatto

**Verifica database creato**:
```bash
# Lista database (solo visualizzazione)
psql $env:DATABASE_URL -c "\l" | findstr crypto
```

**Screenshot richiesto**: Mostra che crypto_db è stato creato

---

## STEP 4: Creazione Tabelle nel Database Separato

**Cosa facciamo**: Creiamo le tabelle crypto SOLO nel database crypto_db.

**IMPORTANTE**: Usiamo `DATABASE_URL_CRYPTO` o modifichiamo temporaneamente la connessione.

**Opzione A: Usa variabile d'ambiente (se configurata)**
```bash
# Se hai DATABASE_URL_CRYPTO in .env, usa quello
psql $env:DATABASE_URL_CRYPTO -f backend\scripts\migrate-crypto-to-postgresql.sql
```

**Opzione B: Specifica database manualmente**
```bash
# Estrai credenziali da DATABASE_URL e usa crypto_db
# Esempio: se DATABASE_URL = postgresql://user:pass@host:5432/ticketapp
# Usa: postgresql://user:pass@host:5432/crypto_db
psql "postgresql://USER:PASS@HOST:5432/crypto_db" -f backend\scripts\migrate-crypto-to-postgresql.sql
```

**Cosa verificare**:
- [ ] Nessun errore durante creazione tabelle
- [ ] Tabelle create solo in crypto_db

**Verifica tabelle create**:
```bash
# Connetti a crypto_db e lista tabelle
psql "postgresql://USER:PASS@HOST:5432/crypto_db" -c "\dt"
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

## STEP 5: Configurazione Variabile d'Ambiente

**Cosa facciamo**: Configuriamo `DATABASE_URL_CRYPTO` in `.env` per usare il database separato.

**File da modificare**: `backend/.env`

**Aggiungi questa riga**:
```bash
DATABASE_URL_CRYPTO=postgresql://USER:PASS@HOST:5432/crypto_db
```

**Sostituisci**:
- `USER` = tuo utente PostgreSQL
- `PASS` = tua password PostgreSQL
- `HOST` = tuo host PostgreSQL (es: localhost o IP)
- `5432` = porta PostgreSQL (solitamente 5432)

**Screenshot richiesto**: Mostra la riga aggiunta in `.env`

---

## STEP 6: Migrazione Dati da SQLite a PostgreSQL

**Cosa facciamo**: Migriamo tutti i dati da `crypto.db` (SQLite) a `crypto_db` (PostgreSQL).

**Comandi da eseguire**:
```bash
cd C:\TicketApp\backend
node scripts\migrate-crypto-data-sqlite-to-postgresql.js
```

**Cosa verificare**:
- [ ] Script eseguito senza errori
- [ ] Riepilogo mostra dati migrati
- [ ] Conta record migrati per ogni tabella

**Screenshot richiesto**: Mostra il riepilogo della migrazione

---

## STEP 7: Verifica Dati Migrati

**Cosa facciamo**: Verifichiamo che i dati siano stati migrati correttamente.

**Comandi da eseguire**:
```bash
# Connetti a crypto_db e verifica record
psql $env:DATABASE_URL_CRYPTO -c "SELECT COUNT(*) as portfolio_count FROM portfolio;"
psql $env:DATABASE_URL_CRYPTO -c "SELECT COUNT(*) as trades_count FROM trades;"
psql $env:DATABASE_URL_CRYPTO -c "SELECT COUNT(*) as positions_count FROM open_positions;"
psql $env:DATABASE_URL_CRYPTO -c "SELECT COUNT(*) as klines_count FROM klines;"
```

**Confronta con SQLite** (opzionale, per verifica):
```bash
# Se hai sqlite3 installato
sqlite3 backend\crypto.db "SELECT COUNT(*) FROM portfolio;"
sqlite3 backend\crypto.db "SELECT COUNT(*) FROM trades;"
```

**Cosa verificare**:
- [ ] I conteggi corrispondono (o sono simili)
- [ ] Nessun errore nelle query

**Screenshot richiesto**: Mostra i conteggi delle tabelle

---

## STEP 8: Test Nuovo Modulo PostgreSQL

**Cosa facciamo**: Testiamo il nuovo modulo PostgreSQL SENZA sostituire quello vecchio.

**Comandi da eseguire**:
```bash
cd C:\TicketApp\backend
node -e "const db = require('./crypto_db_postgresql'); console.log('✅ Modulo PostgreSQL caricato'); db.dbGet('SELECT COUNT(*) as count FROM portfolio').then(r => console.log('Portfolio records:', r)).catch(e => console.error('Errore:', e.message));"
```

**Cosa verificare**:
- [ ] Modulo caricato senza errori
- [ ] Query eseguita correttamente
- [ ] Record letti correttamente

**Screenshot richiesto**: Mostra l'output del test

---

## STEP 9: Backup e Sostituzione Modulo

**Cosa facciamo**: Sostituiamo il vecchio modulo SQLite con quello PostgreSQL.

**IMPORTANTE**: Prima facciamo backup del vecchio modulo.

**Comandi da eseguire**:
```bash
cd C:\TicketApp\backend

# Backup vecchio modulo
copy crypto_db.js crypto_db.js.sqlite.backup

# Sostituisci con nuovo modulo PostgreSQL
copy crypto_db_postgresql.js crypto_db.js
```

**Cosa verificare**:
- [ ] `crypto_db.js.sqlite.backup` creato
- [ ] `crypto_db.js` ora è il modulo PostgreSQL

**Screenshot richiesto**: Mostra i file nella cartella backend

---

## STEP 10: Test Backend con Nuovo Modulo

**Cosa facciamo**: Riavviamo il backend e testiamo che tutto funzioni.

**Comandi da eseguire**:
```bash
# Se usi PM2
pm2 restart backend

# Oppure manualmente (in un terminale separato)
cd C:\TicketApp\backend
node index.js
```

**Cosa verificare nei log**:
- [ ] "✅ Connected to the crypto PostgreSQL database"
- [ ] "✅ Tabelle crypto PostgreSQL inizializzate correttamente"
- [ ] Nessun errore di connessione database

**Test funzionalità**:
1. Apri dashboard crypto nel browser
2. Verifica che i dati siano visibili
3. Testa una operazione (es: visualizza posizioni)

**Screenshot richiesto**: 
- Log backend che mostra connessione PostgreSQL
- Dashboard crypto funzionante

---

## STEP 11: Verifica Database Principale Intatto

**Cosa facciamo**: Verifichiamo che il database principale NON sia stato toccato.

**Comandi da eseguire**:
```bash
# Connetti al database principale (NON crypto_db)
psql $env:DATABASE_URL -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
```

**Cosa verificare**:
- [ ] Vedi tabelle: users, tickets, alerts, access_logs, ecc.
- [ ] NON vedi tabelle crypto: portfolio, trades, bot_settings, ecc.
- [ ] Database principale completamente intatto

**Screenshot richiesto**: Mostra le tabelle del database principale (senza tabelle crypto)

---

## STEP 12: Rimozione Database SQLite (OPZIONALE - Solo dopo conferma)

**⚠️ ATTENZIONE**: Questo step elimina definitivamente il database SQLite. Esegui SOLO dopo aver verificato che tutto funzioni correttamente.

**Cosa facciamo**: Rimuoviamo il database SQLite vecchio (ora non più necessario).

**Comandi da eseguire**:
```bash
cd C:\TicketApp\backend

# Rinomina invece di eliminare (più sicuro)
ren crypto.db crypto.db.old

# Oppure elimina definitivamente (solo se sei sicuro)
# del crypto.db
```

**Cosa verificare**:
- [ ] File rimosso/rinominato
- [ ] Backup ancora presente

**Screenshot richiesto**: Mostra che crypto.db è stato rimosso/rinominato

---

## ✅ CHECKLIST FINALE

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

### Ripristino a SQLite
```bash
cd C:\TicketApp\backend
copy crypto_db.js.sqlite.backup crypto_db.js
# Ripristina crypto.db dal backup se necessario
```

### Verifica Errori
- Controlla log backend: `pm2 logs backend`
- Verifica connessione: `psql $env:DATABASE_URL_CRYPTO -c "SELECT 1;"`
- Verifica tabelle: `psql $env:DATABASE_URL_CRYPTO -c "\dt"`

---

## 📞 Pronto per Iniziare?

Quando sei pronto, inizia con **STEP 1** e inviami lo screenshot di conferma. Procederemo passo-passo con la tua approvazione ad ogni step.

