# 🔍 DEBUG - Dati Non Visualizzati

## 📊 PROBLEMA

Il dashboard mostra:
- ❌ "Nessuna posizione aperta" (anche se ci sono posizioni)
- ❌ "No trades yet. Start the bot!" (anche se ci sono trades)
- ❌ Grafico non mostra dati storici

---

## 🔍 VERIFICA IMMEDIATA

### 1. Apri Console Browser (F12)

Cerca questi log:
```
📊 Dashboard data received: {...}
📊 LightweightChart: priceHistory length: X
📊 LightweightChart: Valid data points: X
```

### 2. Verifica Endpoint API

Apri nel browser:
```
https://ticket.logikaservice.it/api/crypto/dashboard
```

Dovresti vedere:
```json
{
  "portfolio": {...},
  "recent_trades": [...],
  "all_trades": [...],
  "open_positions": [...],
  ...
}
```

### 3. Verifica Endpoint History

Apri nel browser:
```
https://ticket.logikaservice.it/api/crypto/history
```

Dovresti vedere array di prezzi storici.

---

## 🔧 POSSIBILI CAUSE

### Causa 1: Database Vuoto
Se non hai ancora fatto trade o aperto posizioni, il database potrebbe essere vuoto.

**Soluzione**: Fai un trade di test o apri una posizione manualmente.

### Causa 2: Simbolo Errato
Il database potrebbe avere `'solana'` invece di `'bitcoin'`.

**Verifica**:
```sql
SELECT * FROM trades WHERE symbol = 'bitcoin';
SELECT * FROM open_positions WHERE symbol = 'bitcoin';
```

**Se sono vuoti, prova**:
```sql
SELECT * FROM trades WHERE symbol = 'solana';
SELECT * FROM open_positions WHERE symbol = 'solana';
```

### Causa 3: API Non Restituisce Dati

**Verifica nel browser console**:
- C'è un errore 404/500?
- I dati arrivano ma sono vuoti?

---

## 🛠️ FIX RAPIDI

### Fix 1: Verifica Dati Database

Sul VPS:
```bash
sqlite3 /var/www/ticketapp/backend/crypto.db "SELECT COUNT(*) FROM trades;"
sqlite3 /var/www/ticketapp/backend/crypto.db "SELECT COUNT(*) FROM open_positions;"
```

### Fix 2: Aggiungi Trade di Test

Puoi aprire una posizione manualmente tramite l'API:
```bash
curl -X POST "https://ticket.logikaservice.it/api/crypto/positions/open" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "bitcoin",
    "type": "buy",
    "volume": 0.001,
    "entry_price": 78000,
    "strategy": "Manual Test"
  }'
```

### Fix 3: Verifica Symbol nel Database

Se i dati usano ancora `'solana'`, aggiorna:
```sql
UPDATE trades SET symbol = 'bitcoin' WHERE symbol = 'solana';
UPDATE open_positions SET symbol = 'bitcoin' WHERE symbol = 'solana';
```

---

## 📝 PROSSIMI PASSI

1. **Controlla console browser** per vedere i log
2. **Verifica endpoint API** per vedere se restituiscono dati
3. **Controlla database** per vedere se ci sono dati
4. **Fammi sapere** cosa vedi nei log/API

