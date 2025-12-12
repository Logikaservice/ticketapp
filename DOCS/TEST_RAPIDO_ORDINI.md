# ⚡ TEST RAPIDO ORDINI BINANCE

Guida rapida per testare un ordine Binance Testnet in 30 secondi!

---

## 🚀 TEST RAPIDO: Ordine Market con PowerShell

### Apri PowerShell e incolla questo comando:

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

### Risultato atteso:

```json
{
  "success": true,
  "mode": "testnet",
  "order": {
    "orderId": 12345678,
    "symbol": "SOLEUR",
    "side": "BUY",
    "type": "MARKET",
    "quantity": 0.01,
    "price": 119.43,
    "status": "FILLED"
  }
}
```

**Cosa significa:**
- ✅ Ordine eseguito con successo!
- Hai comprato 0.01 SOL al prezzo di €119.43
- Status: FILLED = eseguito immediatamente

---

## 🔍 VERIFICA RISULTATO

Dopo l'ordine, verifica:

1. **Saldo aggiornato:**
   ```
   https://ticket.logikaservice.it/api/crypto/binance/balance
   ```
   Dovresti vedere meno EUR e più SOL.

2. **Storico ordini:**
   ```
   https://ticket.logikaservice.it/api/crypto/binance/orders/history?symbol=SOLEUR
   ```
   Dovresti vedere il tuo ordine nella lista.

---

## 📝 PARAMETRI ORDINE

### Market Order (esecuzione immediata):
```json
{
  "symbol": "SOLEUR",
  "side": "BUY",      // o "SELL"
  "quantity": "0.01"  // quantità in SOL
}
```

### Limit Order (esecuzione a prezzo specifico):
```json
{
  "symbol": "SOLEUR",
  "side": "BUY",
  "quantity": "0.01",
  "price": "115.00"   // prezzo limite
}
```

### Stop-Loss Order:
```json
{
  "symbol": "SOLEUR",
  "side": "SELL",
  "quantity": "0.01",
  "stopPrice": "110.00"  // prezzo stop
}
```

---

## 🎯 SCRIPT AUTOMATICO

Oppure usa lo script automatico che ho creato:

```powershell
cd C:\TicketApp
.\backend\scripts\test-ordini-binance.ps1
```

Questo script fa automaticamente:
- ✅ Verifica modalità
- ✅ Verifica prezzo
- ✅ Verifica saldo
- ✅ Chiede conferma e fa un ordine di test
- ✅ Verifica risultato

---

## ⚠️ IMPORTANTE

- Tutti gli ordini usano **denaro virtuale** (Testnet)
- Puoi testare senza rischi
- Il saldo viene resettato periodicamente

---

## 🆘 PROBLEMI?

Se l'ordine fallisce:

1. **"Insufficient funds"** → Verifica saldo: `/api/crypto/binance/balance`
2. **"Invalid symbol"** → Usa `SOLEUR` (tutto maiuscolo)
3. **"MIN_NOTIONAL"** → Aumenta la quantità (es. 0.1 invece di 0.01)

Buon testing! 🚀

