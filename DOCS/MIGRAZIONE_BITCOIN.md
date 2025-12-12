# 🔄 MIGRAZIONE DA SOLEUR/SOL A BITCOIN (BTC)

## ✅ MODIFICHE COMPLETATE

### Backend (`backend/routes/cryptoRoutes.js`)
- ✅ Sostituito `SOLEUR` → `BTCEUR` per API Binance
- ✅ Sostituito `'solana'` → `'bitcoin'` come simbolo interno
- ✅ Aggiornato CoinGecko da `solana` → `bitcoin`
- ✅ Aggiornati tutti i log e messaggi (SOL → BTC)
- ✅ Aggiornato `updatePositionsPnL` default da `'solana'` → `'bitcoin'`
- ✅ Aggiornate query database da `'solana'` → `'bitcoin'`

### Frontend (`frontend/src/components/CryptoDashboard/CryptoDashboard.jsx`)
- ✅ Sostituito `symbol=solana` → `symbol=bitcoin`
- ✅ Aggiornato `holdings['solana']` → `holdings['bitcoin']`
- ✅ Aggiornato titolo dashboard: "Solana / EUR" → "Bitcoin / EUR"
- ✅ Aggiornato endpoint prezzo: `/price/solana` → `/price/bitcoin`

### Script di Test
- ✅ `backend/scripts/test-ordini-binance.sh`: SOLEUR → BTCEUR
- ✅ `backend/scripts/test-ordini-binance.ps1`: SOLEUR → BTCEUR
- ✅ Aggiornate quantità test ordini (0.01 SOL → 0.001 BTC)

---

## 📝 NOTE IMPORTANTI

### Simboli Binance
- **BTCEUR**: Bitcoin in Euro (per prezzi e ordini in EUR)
- **BTCUSDT**: Bitcoin in USDT (alternativa per ordini)

### Database
⚠️ **Importante**: Il database SQLite (`crypto.db`) potrebbe ancora contenere dati con simbolo `'solana'`. 

Se vuoi migrare i dati esistenti:
```sql
-- Aggiorna posizioni aperte
UPDATE open_positions SET symbol = 'bitcoin' WHERE symbol = 'solana';

-- Aggiorna storico trades
UPDATE trades SET symbol = 'bitcoin' WHERE symbol = 'solana';

-- Aggiorna price_history
UPDATE price_history SET symbol = 'bitcoin' WHERE symbol = 'solana';

-- Aggiorna holdings nel portfolio
UPDATE portfolio SET holdings = REPLACE(holdings, '"solana"', '"bitcoin"');
```

---

## 🧪 TEST

Dopo il deploy, testa:

### Test 1: Verifica Prezzo
```bash
curl "https://ticket.logikaservice.it/api/crypto/binance/price/BTCEUR"
```

### Test 2: Test Ordine (BTCUSDT - sicuramente disponibile)
```bash
curl -X POST "https://ticket.logikaservice.it/api/crypto/binance/order/market" \
  -H "Content-Type: application/json" \
  -d '{"symbol":"BTCUSDT","side":"BUY","quantity":"0.001"}' \
  | python3 -m json.tool
```

---

## 🚀 PROSSIMI PASSI

1. **Deploy sul VPS**
2. **Testare prezzo BTCEUR**
3. **Verificare che il bot usi Bitcoin**
4. **Eventualmente migrare dati database** (vedi sopra)

---

## 📊 RIEPILOGO

- **Simbolo API Binance**: `BTCEUR` (prezzi) / `BTCUSDT` (ordini)
- **Simbolo interno sistema**: `'bitcoin'`
- **Abbreviazione**: `BTC`
- **Valuta**: EUR (o USDT per ordini)

Tutte le funzionalità ora usano **Bitcoin** invece di Solana!

