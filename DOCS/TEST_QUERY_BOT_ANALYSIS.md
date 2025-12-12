# 🔍 Test Query Bot-Analysis sulla VPS

## ✅ Risultati Attuali
- ✅ Database PostgreSQL connesso correttamente
- ✅ `dbAll` funziona
- ✅ Tabelle inizializzate
- ❌ HTTP 500 persiste

## 🔍 Test da Eseguire sulla VPS

### 1. Log COMPLETI (non filtrati) quando viene chiamata la route
```bash
pm2 logs ticketapp-backend --lines 200 | tail -50
```
Poi ricarica la pagina bot-analysis nel browser e guarda cosa appare nei log.

### 2. Test query specifica klines (quella usata in bot-analysis)
```bash
cd /var/www/ticketapp/backend
node -e "
const db = require('./crypto_db');
const symbol = 'bitcoin';
console.log('🔍 Test query klines per', symbol);
db.dbAll('SELECT open_time, open_price, high_price, low_price, close_price FROM klines WHERE symbol = \$1 AND interval = '\''15m'\'' ORDER BY open_time DESC LIMIT 100', [symbol])
  .then(r => {
    console.log('✅ Query OK:', r.length, 'righe trovate');
    if (r.length > 0) {
      console.log('Prima riga:', r[0]);
    }
  })
  .catch(e => {
    console.error('❌ Errore query:', e.message);
    console.error('Stack:', e.stack);
  });
"
```

### 3. Test query price_history (fallback)
```bash
cd /var/www/ticketapp/backend
node -e "
const db = require('./crypto_db');
const symbol = 'bitcoin';
console.log('🔍 Test query price_history per', symbol);
db.dbAll('SELECT price, timestamp FROM price_history WHERE symbol = \$1 ORDER BY timestamp DESC LIMIT 100', [symbol])
  .then(r => {
    console.log('✅ Query OK:', r.length, 'righe trovate');
  })
  .catch(e => {
    console.error('❌ Errore query:', e.message);
  });
"
```

### 4. Test getSymbolPrice (funzione che potrebbe fallire)
```bash
cd /var/www/ticketapp/backend
node -e "
const cryptoRoutes = require('./routes/cryptoRoutes');
// Questo test è più complesso, ma possiamo verificare se il modulo si carica
console.log('✅ Modulo cryptoRoutes caricato');
"
```

### 5. Verifica se ci sono dati nelle tabelle
```bash
psql -U postgres -h localhost -d crypto_db -c "SELECT COUNT(*) FROM klines WHERE symbol = 'bitcoin' AND interval = '15m';"
psql -U postgres -h localhost -d crypto_db -c "SELECT COUNT(*) FROM price_history WHERE symbol = 'bitcoin';"
```

### 6. Log in tempo reale durante la richiesta
```bash
# In un terminale, esegui:
pm2 logs ticketapp-backend --lines 0

# Poi in un altro terminale o nel browser, ricarica la pagina bot-analysis
# Guarda cosa appare nei log
```

## 📤 Cosa Inviare

Dopo aver eseguito i test, invia:
1. **Output del test 2** (query klines)
2. **Output del test 3** (query price_history)
3. **Output del test 5** (conteggio righe)
4. **Log completi** quando ricarichi la pagina (test 1 o 6)

Questo ci permetterà di capire se:
- Le query funzionano
- Ci sono dati nelle tabelle
- Quale errore specifico viene generato

