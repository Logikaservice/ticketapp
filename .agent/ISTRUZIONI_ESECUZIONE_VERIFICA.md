# 📋 ISTRUZIONI: Esecuzione Script Verifica Klines

## ✅ Script Corretto

Lo script `verifica-klines-ricreate.js` è stato corretto e dovrebbe funzionare correttamente.

## 🚀 Come Eseguire sul VPS

```bash
# 1. Connettiti al VPS
ssh root@159.69.121.162

# 2. Vai nella directory del progetto
cd /var/www/ticketapp/backend

# 3. Esegui lo script
node scripts/verifica-klines-ricreate.js
```

## 📊 Cosa Verifica lo Script

1. **Simboli non validi in bot_settings**
   - Verifica se ci sono simboli in `bot_settings` che non sono in `SYMBOL_TO_PAIR`
   - Questi simboli potrebbero causare la ricreazione di klines

2. **Klines per simboli non validi**
   - Verifica se ci sono klines nel database per simboli non validi
   - Mostra il numero di klines e l'ultimo aggiornamento

3. **Klines create nelle ultime 24 ore**
   - Verifica se ci sono klines create recentemente per simboli non validi
   - Questo indica se il problema è attivo

## 🔧 Se lo Script Non Funziona

### Errore: "Cannot find module 'pg'"
- **Causa**: Modulo `pg` non installato
- **Soluzione**: `npm install` nella directory `backend`

### Errore: "Impossibile trovare SYMBOL_TO_PAIR"
- **Causa**: Problema nell'estrazione della mappa
- **Soluzione**: Verifica che `cryptoRoutes.js` sia presente e valido

### Errore: "DATABASE_URL non configurato"
- **Causa**: Variabile d'ambiente mancante
- **Soluzione**: Verifica che `.env` contenga `DATABASE_URL` o `DATABASE_URL_CRYPTO`

### Errore di connessione al database
- **Causa**: Database non raggiungibile o credenziali errate
- **Soluzione**: Verifica connessione e credenziali PostgreSQL

## 📝 Output Atteso

Lo script dovrebbe mostrare:

```
✅ SYMBOL_TO_PAIR caricato: 130 simboli
🔍 Verifica klines ricreate per simboli non validi...

📋 1. Verifica bot_settings...
✅ Nessun simbolo non valido in bot_settings

📊 2. Verifica klines esistenti...
✅ Nessuna kline per simboli non validi

📈 3. Statistiche:
   - Simboli validi nella mappa: 130
   - Simboli in bot_settings: XX
   - Simboli con klines: XX
   - Simboli non validi con klines: 0

✅ Verifica completata
```

## 🚨 Se Trova Problemi

Se lo script trova simboli non validi:

1. **Pulisci bot_settings**:
   ```bash
   node scripts/pulisci-bot-settings-non-validi.js --confirm
   ```

2. **Pulisci klines** (se necessario):
   ```bash
   node scripts/pulisci-simboli-non-validi.js --confirm
   ```

## 📞 Supporto

Se lo script continua a non funzionare, verifica:
- Log dello script (errori completi)
- Versione Node.js (`node --version`)
- Presenza di `node_modules` nella directory `backend`
