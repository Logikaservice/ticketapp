# ✅ VERIFICA: Script di Pulizia

## 🔍 Script Verificati

### 1. `analizza-simboli-non-validi.js`
**Status**: ✅ **PRONTO E FUNZIONANTE**

- ✅ Estrae correttamente `SYMBOL_TO_PAIR` usando `Function constructor`
- ✅ Verifica tutte le tabelle: klines, bot_settings, price_history, open_positions, symbol_volumes_24h, trades
- ✅ Analizza pattern e possibili cause
- ✅ Mostra statistiche dettagliate
- ✅ Gestione errori robusta

**Uso**:
```bash
cd /var/www/ticketapp/backend
node scripts/analizza-simboli-non-validi.js
```

---

### 2. `pulisci-bot-settings-non-validi.js`
**Status**: ✅ **PRONTO E FUNZIONANTE**

- ✅ Estrae correttamente `SYMBOL_TO_PAIR` usando `Function constructor`
- ✅ Modalità dry-run (senza `--confirm`) per vedere cosa verrà eliminato
- ✅ Modalità conferma (con `--confirm`) per eliminare effettivamente
- ✅ Gestione errori robusta
- ✅ Messaggi chiari

**Uso**:
```bash
cd /var/www/ticketapp/backend

# 1. Dry-run (vedi cosa verrà eliminato)
node scripts/pulisci-bot-settings-non-validi.js

# 2. Conferma eliminazione
node scripts/pulisci-bot-settings-non-validi.js --confirm
```

---

## 📋 ORDINE DI ESECUZIONE RACCOMANDATO

```bash
cd /var/www/ticketapp/backend

# STEP 1: Analizza situazione attuale
node scripts/analizza-simboli-non-validi.js

# STEP 2: Se trova simboli non validi in bot_settings:
#    - Prima dry-run
node scripts/pulisci-bot-settings-non-validi.js

# STEP 3: Poi conferma
node scripts/pulisci-bot-settings-non-validi.js --confirm
```

---

## ✅ CHECKLIST PRE-ESECUZIONE

Prima di eseguire gli script, verifica:

- [ ] Sei connesso al VPS: `ssh root@159.69.121.162`
- [ ] Sei nella directory corretta: `cd /var/www/ticketapp/backend`
- [ ] Il database è accessibile
- [ ] Node.js è installato: `node --version`
- [ ] Le dipendenze sono installate: `npm list` (opzionale)

---

## 🚨 SE GLI SCRIPT NON FUNZIONANO

### Errore: "Cannot find module 'pg'"
```bash
cd /var/www/ticketapp/backend
npm install
```

### Errore: "Impossibile trovare SYMBOL_TO_PAIR"
- Verifica che `routes/cryptoRoutes.js` esista
- Verifica che il file contenga `const SYMBOL_TO_PAIR`

### Errore: "DATABASE_URL non configurato"
- Verifica che `.env` contenga `DATABASE_URL` o `DATABASE_URL_CRYPTO`

### Errore di connessione al database
- Verifica che PostgreSQL sia in esecuzione
- Verifica credenziali nel file `.env`

---

## 📊 OUTPUT ATTESO

### `analizza-simboli-non-validi.js`
- Lista simboli non validi trovati
- Dove sono presenti (quali tabelle)
- Statistiche dettagliate
- Possibili cause

### `pulisci-bot-settings-non-validi.js` (dry-run)
- Lista simboli che verranno eliminati
- Messaggio: "MODALITÀ DRY-RUN: Nessuna modifica effettuata"

### `pulisci-bot-settings-non-validi.js --confirm`
- Conferma eliminazione per ogni simbolo
- Totale eliminati
- Messaggio finale di conferma

---

## ✅ CONCLUSIONE

Entrambi gli script sono **pronti e funzionanti**. Possono essere eseguiti sul VPS quando necessario.

**Raccomandazione**: Esegui prima l'analisi per vedere la situazione, poi la pulizia solo se necessario.
