# ✅ VERIFICA: Esecuzione Script sul VPS

## 🔍 Verifica Struttura Script

### Percorsi Script
- ✅ `backend/scripts/analizza-simboli-non-validi.js`
- ✅ `backend/scripts/pulisci-bot-settings-non-validi.js`

### Import Verificati
- ✅ `const crypto_db = require('../crypto_db');` - Percorso corretto (relativo a `backend/scripts/`)
- ✅ `const cryptoRoutesPath = path.join(__dirname, '../routes/cryptoRoutes.js');` - Percorso corretto

### Requisiti sul VPS
- ✅ Node.js installato
- ✅ Dipendenze installate (`npm install` nella directory `backend`)
- ✅ Modulo `pg` installato (per PostgreSQL)
- ✅ File `.env` con `DATABASE_URL` o `DATABASE_URL_CRYPTO`
- ✅ Database PostgreSQL accessibile

## 🚀 Esecuzione sul VPS

### Comandi Corretti
```bash
# Connettiti al VPS
ssh root@159.69.121.162

# Vai nella directory corretta
cd /var/www/ticketapp/backend

# Esegui analisi
node scripts/analizza-simboli-non-validi.js

# Esegui pulizia (dopo analisi)
node scripts/pulisci-bot-settings-non-validi.js --confirm
```

## ⚠️ Possibili Problemi sul VPS

### 1. Modulo `pg` non installato
**Errore**: `Cannot find module 'pg'`
**Soluzione**:
```bash
cd /var/www/ticketapp/backend
npm install
```

### 2. File `.env` mancante o DATABASE_URL non configurato
**Errore**: `DATABASE_URL o DATABASE_URL_CRYPTO non configurato!`
**Soluzione**: Verifica che `.env` esista e contenga `DATABASE_URL` o `DATABASE_URL_CRYPTO`

### 3. Database non raggiungibile
**Errore**: Errori di connessione PostgreSQL
**Soluzione**: Verifica che PostgreSQL sia in esecuzione e le credenziali siano corrette

### 4. File `cryptoRoutes.js` non trovato
**Errore**: `Impossibile trovare SYMBOL_TO_PAIR`
**Soluzione**: Verifica che `routes/cryptoRoutes.js` esista nella directory `backend`

## ✅ Checklist Pre-Esecuzione VPS

Prima di eseguire gli script sul VPS:

- [ ] Connesso al VPS: `ssh root@159.69.121.162`
- [ ] Directory corretta: `cd /var/www/ticketapp/backend`
- [ ] Verifica Node.js: `node --version`
- [ ] Verifica dipendenze: `ls node_modules/pg` (dovrebbe esistere)
- [ ] Verifica file `.env`: `cat .env | grep DATABASE_URL`
- [ ] Verifica `cryptoRoutes.js`: `ls routes/cryptoRoutes.js`

## 📊 Output Atteso sul VPS

### `analizza-simboli-non-validi.js`
Dovrebbe mostrare:
- ✅ `SYMBOL_TO_PAIR caricato: 130 simboli` (o numero simile)
- Analisi di tutte le tabelle
- Lista simboli non validi (se presenti)
- Statistiche dettagliate

### `pulisci-bot-settings-non-validi.js`
Dovrebbe mostrare:
- ✅ `SYMBOL_TO_PAIR caricato: 130 simboli` (o numero simile)
- Lista simboli non validi in `bot_settings`
- Conferma eliminazione (con `--confirm`)

## 🔧 Se Qualcosa Non Funziona

1. **Verifica log errori completi** - Gli script mostrano stack trace dettagliati
2. **Verifica connessione database** - Prova query semplice: `psql -U postgres -d crypto_db -c "SELECT 1;"`
3. **Verifica permessi** - Assicurati di avere permessi per leggere file e connettersi al database
4. **Verifica versione Node.js** - Dovrebbe essere Node.js 14+ (preferibilmente 16+)

## ✅ Conclusione

Gli script sono **pronti per l'esecuzione sul VPS**. Se riscontri problemi, verifica i requisiti sopra elencati.
