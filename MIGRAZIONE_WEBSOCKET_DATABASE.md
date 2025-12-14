# 🔄 Migrazione a WebSocket + Database come Fonte Primaria

## 📋 Cosa è stato fatto

Con l'IP bannato da Binance, ho implementato una soluzione completa che usa **WebSocket e Database come fonte primaria** invece delle REST API:

### ✅ Modifiche Implementate

1. **WebSocket salva prezzi nel database**
   - Ogni prezzo ricevuto dal WebSocket viene salvato in `price_history`
   - Salva solo se il prezzo cambia > 0.1% (evita spam DB)
   - Valida prezzi anomali (> $100k o < $0.000001)

2. **WebSocket salva volumi nel database**
   - Ogni volume 24h ricevuto dal WebSocket viene salvato in `symbol_volumes_24h`
   - Già implementato in precedenza

3. **`getSymbolPrice` usa PRIMA il database quando IP è bannato**
   - Prima controlla il database (più affidabile)
   - Poi controlla la cache (aggiornata in tempo reale)
   - Non chiama mai REST API se bannato

4. **`get24hVolume` usa PRIMA il database quando IP è bannato**
   - Prima controlla il database (più affidabile)
   - Poi controlla la cache (aggiornata in tempo reale)
   - Non chiama mai REST API se bannato

5. **Script per ripopolare dati storici**
   - `backend/scripts/repopulate-from-websocket.js`
   - Si connette al WebSocket per 5 minuti
   - Salva tutti i prezzi e volumi ricevuti nel database

## 🚀 Come Applicare sul VPS

### Passo 1: Aggiorna il codice

```bash
cd /var/www/ticketapp
git pull
```

### Passo 2: Riavvia il backend

```bash
cd /var/www/ticketapp
chmod +x fix-tutto-vps.sh
./fix-tutto-vps.sh
```

Questo script:
- Aggiorna il codice
- Ferma PM2
- Libera porta 3001
- Pulisce prezzi anomali
- Riavvia backend

### Passo 3: (Opzionale) Ripopola dati storici

Se vuoi ripopolare il database con dati freschi dal WebSocket:

```bash
cd /var/www/ticketapp/backend
node scripts/repopulate-from-websocket.js
```

Questo script:
- Si connette al WebSocket di Binance
- Attende 5 minuti raccogliendo dati
- Salva tutti i prezzi e volumi nel database
- Mostra statistiche finali

**Nota:** Il backend già salva automaticamente i dati dal WebSocket, quindi questo script è opzionale. Serve solo se vuoi accelerare il processo di ripopolamento.

## 📊 Cosa Aspettarsi

### ✅ Vantaggi

1. **Nessuna dipendenza da REST API quando bannato**
   - Tutto funziona con WebSocket + Database
   - Prezzi e volumi sempre disponibili

2. **Dati sempre aggiornati**
   - WebSocket aggiorna in tempo reale
   - Database come fallback persistente

3. **Nessun rate limiting**
   - WebSocket non ha limiti di chiamate
   - Database locale, zero latenza

### ⚠️ Limitazioni

1. **Dati storici limitati**
   - Il database contiene solo dati dal momento in cui il WebSocket è attivo
   - Per dati storici più vecchi, serve attendere o usare altri metodi

2. **Dipende da WebSocket**
   - Se WebSocket si disconnette, i dati si fermano
   - Ma il database mantiene gli ultimi valori salvati

## 🔍 Verifica Funzionamento

### Controlla che il WebSocket salvi nel database:

```bash
# Controlla ultimi prezzi salvati
psql -U postgres -d crypto_db -c "SELECT symbol, price, timestamp FROM price_history ORDER BY timestamp DESC LIMIT 20;"

# Controlla ultimi volumi salvati
psql -U postgres -d crypto_db -c "SELECT symbol, volume_24h, updated_at FROM symbol_volumes_24h ORDER BY updated_at DESC LIMIT 20;"
```

### Controlla i log del backend:

```bash
pm2 logs ticketapp-backend --lines 100 | grep -E "WEBSOCKET|BINANCE-BAN|PRICE|VOLUME"
```

Dovresti vedere:
- `📡 [WEBSOCKET] Prezzo aggiornato ...` (prezzi salvati)
- `📡 [WEBSOCKET] Volume 24h aggiornato ...` (volumi salvati)
- `💾 [BINANCE-BAN] Usando prezzo dal database per ...` (quando usa DB)
- `💾 [VOLUME-BAN] IP bannato - usando volume dal DB per ...` (quando usa DB)

## 🎯 Risultato Finale

Con queste modifiche:
- ✅ **Prezzi**: Sempre disponibili dal WebSocket/Database
- ✅ **Volumi**: Sempre disponibili dal WebSocket/Database
- ✅ **Nessun errore 502**: Tutto funziona anche con IP bannato
- ✅ **Dati real-time**: WebSocket aggiorna continuamente
- ✅ **Persistenza**: Database mantiene tutto anche se WebSocket si disconnette

## 🆘 Troubleshooting

### Se vedi ancora prezzi a $0 o volumi a $0:

1. **Verifica che il WebSocket sia connesso:**
   ```bash
   pm2 logs ticketapp-backend --lines 50 | grep "WEBSOCKET"
   ```
   Dovresti vedere `✅ WebSocket connesso!`

2. **Attendi qualche minuto:**
   - Il WebSocket impiega qualche minuto per popolare il database
   - I dati arrivano in tempo reale

3. **Ripopola manualmente:**
   ```bash
   cd /var/www/ticketapp/backend
   node scripts/repopulate-from-websocket.js
   ```

### Se vedi ancora errori 502:

1. **Verifica che il backend sia online:**
   ```bash
   pm2 status
   curl http://localhost:3001/api/health
   ```

2. **Riavvia il backend:**
   ```bash
   ./fix-tutto-vps.sh
   ```

## 📝 Note Tecniche

- **WebSocket Stream**: Usa `!ticker@arr` di Binance (tutti i ticker in tempo reale)
- **Database Tables**: 
  - `price_history`: Prezzi storici
  - `symbol_volumes_24h`: Volumi 24h
- **Cache**: Mantiene anche cache in-memory per accesso veloce
- **Validazione**: Filtra prezzi anomali (> $100k o < $0.000001)




