# 🧪 TEST ORDINE BINANCE - COMANDI RAPIDI

## 📋 COMANDI PER TESTARE L'ORDINE

### Test 1: Verifica Simboli Disponibili
```powershell
Invoke-WebRequest -Uri "https://ticket.logikaservice.it/api/crypto/binance/symbols" | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 5
```

**Oppure nel browser:**
```
https://ticket.logikaservice.it/api/crypto/binance/symbols
```

---

### Test 2: Test Ordine con SOLUSDT (Sicuramente Disponibile)

```powershell
$body = @{
    symbol = "SOLUSDT"
    side = "BUY"
    quantity = "0.1"
} | ConvertTo-Json

Invoke-WebRequest -Uri "https://ticket.logikaservice.it/api/crypto/binance/order/market" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body | Select-Object -ExpandProperty Content
```

---

### Test 3: Test Ordine con SOLEUR (Se Disponibile)

```powershell
$body = @{
    symbol = "SOLEUR"
    side = "BUY"
    quantity = "0.01"
} | ConvertTo-Json

Invoke-WebRequest -Uri "https://ticket.logikaservice.it/api/crypto/binance/order/market" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body | Select-Object -ExpandProperty Content
```

---

### Test 4: Script Completo

Oppure usa lo script completo che fa tutti i test:

```powershell
.\backend\scripts\test-ordini-binance.ps1
```

---

## ⚠️ IMPORTANTE

1. **Assicurati che il backend sia riavviato** sul VPS:
   ```bash
   pm2 restart ticketapp-backend
   ```

2. **Verifica i log** se ci sono errori:
   ```bash
   pm2 logs ticketapp-backend --lines 50
   ```

3. **Controlla i log** per vedere cosa viene inviato:
   - Cerca `📤 Binance POST Request`
   - Cerca `📤 PlaceMarketOrder`
   - Cerca `❌ Binance API Error`

---

## 🎯 RISULTATO ATTESO

Se tutto funziona, dovresti vedere:
```json
{
  "success": true,
  "mode": "testnet",
  "order": {
    "orderId": 12345,
    "symbol": "SOLUSDT",
    "side": "BUY",
    "type": "MARKET",
    "quantity": 0.1,
    "price": 119.50,
    "status": "FILLED"
  }
}
```

---

## ❌ SE VEDI ERRORE -1104

L'errore significa che stiamo ancora inviando parametri errati. Controlla i log del backend per vedere esattamente cosa viene inviato.

