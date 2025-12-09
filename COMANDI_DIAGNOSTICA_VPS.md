# 🔍 Comandi Diagnostica VPS - HTTP 500 /bot-analysis

## 📋 Esegui questi comandi sulla VPS:

### 1. Verifica log del backend (ultimi errori)
```bash
pm2 logs ticketapp-backend --lines 100 | grep -i "bot-analysis\|error\|500" | tail -30
```

### 2. Log completi dell'ultima richiesta bot-analysis
```bash
pm2 logs ticketapp-backend --lines 200 | grep -A 20 "BOT-ANALYSIS"
```

### 3. Test connessione database PostgreSQL
```bash
cd /var/www/ticketapp/backend
node -e "
const db = require('./crypto_db');
console.log('dbAll:', typeof db.dbAll);
console.log('dbGet:', typeof db.dbGet);
console.log('dbRun:', typeof db.dbRun);
db.dbAll('SELECT 1 as test', [])
  .then(r => console.log('✅ dbAll funziona:', r))
  .catch(e => console.error('❌ dbAll errore:', e.message, e.stack));
"
```

### 4. Test query specifica bot-analysis
```bash
cd /var/www/ticketapp/backend
node -e "
const db = require('./crypto_db');
const symbol = 'bitcoin';
db.dbAll('SELECT open_time, open_price, high_price, low_price, close_price FROM klines WHERE symbol = \$1 AND interval = '\''15m'\'' ORDER BY open_time DESC LIMIT 100', [symbol])
  .then(r => console.log('✅ Query klines OK:', r.length, 'righe'))
  .catch(e => console.error('❌ Query klines errore:', e.message));
"
```

### 5. Verifica se il database crypto_db esiste
```bash
psql -U postgres -h localhost -c "\l" | grep crypto_db
```

### 6. Verifica tabelle nel database crypto_db
```bash
psql -U postgres -h localhost -d crypto_db -c "\dt"
```

### 7. Test endpoint direttamente (se hai un token)
```bash
# Sostituisci YOUR_TOKEN con un token valido
curl -v -H "Authorization: Bearer YOUR_TOKEN" \
  "https://ticket.logikaservice.it/api/crypto/bot-analysis?symbol=bitcoin" 2>&1 | head -50
```

## 📤 Invia i risultati

Copia e incolla l'output di questi comandi, specialmente:
- **Comando 1 e 2**: Log degli errori
- **Comando 3 e 4**: Test database
- **Comando 5 e 6**: Verifica database

Questo ci permetterà di identificare l'errore esatto.

