# 🔧 Fix Errori 502 Crypto Dashboard

## Problema
Tutti gli endpoint `/api/crypto/*` restituiscono **502 Bad Gateway**, causando:
- "Errore nel caricamento delle statistiche"
- "Simbolo non valido" nel grafico
- Nessun dato visibile nel dashboard

## Cause Possibili

1. **Backend crashato** - Il processo Node.js non è in esecuzione
2. **Database crypto.db mancante** - Il database SQLite non esiste o è corrotto
3. **Errore all'avvio** - Il backend crasha quando carica le route crypto
4. **Problema connessione database** - SQLite non può essere aperto

## Soluzione Rapida

### Step 1: Verifica Stato Backend

Esegui questo comando sul server VPS:

```bash
ssh root@159.69.121.162
pm2 status
```

Se vedi `ticketapp-backend` con status `errored` o `stopped`, il backend è crashato.

### Step 2: Verifica Log Backend

```bash
pm2 logs ticketapp-backend --lines 100
```

Cerca errori come:
- `Error opening crypto database`
- `Cannot find module`
- `EACCES` (permessi)
- `ENOENT` (file non trovato)

### Step 3: Verifica Database Crypto

```bash
cd /var/www/ticketapp/backend
ls -la crypto.db
```

Se il file non esiste o ha permessi sbagliati:
```bash
# Crea il database se non esiste (verrà creato automaticamente)
touch crypto.db
chmod 644 crypto.db
```

### Step 4: Riavvia Backend

```bash
pm2 restart ticketapp-backend
```

Se non funziona:
```bash
pm2 delete ticketapp-backend
cd /var/www/ticketapp/backend
pm2 start index.js --name ticketapp-backend
pm2 save
```

### Step 5: Verifica Funzionamento

```bash
# Test endpoint locale
curl http://localhost:3001/api/crypto/dashboard

# Se risponde con JSON, il backend funziona
# Se risponde con errore, controlla i log
```

## Soluzione Completa (Se il Problema Persiste)

### 1. Reinstalla Dipendenze Backend

```bash
cd /var/www/ticketapp/backend
npm install --production
```

### 2. Verifica Variabili d'Ambiente

```bash
cd /var/www/ticketapp/backend
cat .env | grep -E "DATABASE|CRYPTO|BINANCE"
```

### 3. Test Database Crypto Manualmente

```bash
cd /var/www/ticketapp/backend
node -e "const db = require('./crypto_db'); db.get('SELECT 1', (err) => { if(err) console.error(err); else console.log('OK'); process.exit(0); });"
```

### 4. Riavvia Tutto

```bash
pm2 restart all
sudo systemctl restart nginx
```

## Prevenzione Futura

Aggiungi gestione errori migliore nel backend per evitare crash:

1. **Wrap database initialization** in try-catch
2. **Verifica esistenza database** prima di usarlo
3. **Log dettagliati** per debug

## Verifica Finale

Dopo il fix, verifica:

1. ✅ Backend risponde: `curl http://localhost:3001/api/crypto/dashboard`
2. ✅ Dashboard carica dati senza errori 502
3. ✅ Grafico mostra simboli validi
4. ✅ Statistiche vengono caricate

## Se Nulla Funziona

Esegui diagnostica completa:

```bash
cd /var/www/ticketapp
node verifica-crypto-backend.js
```

Questo script verificherà:
- Esistenza database
- Connessione database
- Tabelle presenti
- Dati nel database
