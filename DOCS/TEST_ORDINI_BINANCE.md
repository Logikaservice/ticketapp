# 🧪 TEST AVANZATI: Ordini Binance Testnet

Guida completa per testare gli ordini su Binance Testnet.

---

## ⚠️ IMPORTANTE

- Tutti gli ordini su Binance Testnet usano **denaro virtuale**
- Puoi testare senza rischi
- I saldi sono virtuali (€10,000 USDT di test)

---

## 📋 TEST 1: Verifica Storico Ordini

Prima di fare ordini, verifica se ci sono ordini precedenti.

### Da Browser:
```
https://ticket.logikaservice.it/api/crypto/binance/orders/history?limit=10
```

### Risultato atteso:
```json
{
  "success": true,
  "mode": "testnet",
  "orders": [],
  "count": 0
}
```

O una lista di ordini se ne hai già fatti.

---

## 📋 TEST 2: Ordine a Mercato (Market Order)

Un ordine a mercato viene eseguito **immediatamente** al prezzo corrente.

### ⚠️ ATTENZIONE
Per questo test, devi usare un metodo che permette di inviare POST requests (browser non basta).

### Opzione A: PowerShell (Windows)

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

### Opzione B: Browser con estensione (es. REST Client)

Installa un'estensione come "REST Client" o "Postman" e usa:

**URL:** `https://ticket.logikaservice.it/api/crypto/binance/order/market`  
**Method:** `POST`  
**Headers:** `Content-Type: application/json`  
**Body:**
```json
{
  "symbol": "SOLEUR",
  "side": "BUY",
  "quantity": "0.01"
}
```

### Opzione C: cURL (da terminale)

```bash
curl -X POST https://ticket.logikaservice.it/api/crypto/binance/order/market \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "SOLEUR",
    "side": "BUY",
    "quantity": "0.01"
  }'
```

### Risultato atteso (SUCCESSO):
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
    "status": "FILLED",
    "fills": [...]
  }
}
```

### Parametri ordine:
- `symbol`: "SOLEUR" (SOL/EUR)
- `side`: "BUY" (compra) o "SELL" (vendi)
- `quantity`: quantità da comprare/vendere (es. "0.01" = 0.01 SOL)

---

## 📋 TEST 3: Ordine Limite (Limit Order)

Un ordine limite viene eseguito solo quando il prezzo raggiunge quello che specifichi.

### PowerShell:
```powershell
$body = @{
    symbol = "SOLEUR"
    side = "BUY"
    quantity = "0.01"
    price = "115.00"
} | ConvertTo-Json

Invoke-WebRequest -Uri "https://ticket.logikaservice.it/api/crypto/binance/order/limit" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body | Select-Object -ExpandProperty Content
```

### Body JSON:
```json
{
  "symbol": "SOLEUR",
  "side": "BUY",
  "quantity": "0.01",
  "price": "115.00"
}
```

### Risultato atteso:
```json
{
  "success": true,
  "mode": "testnet",
  "order": {
    "orderId": 12345679,
    "symbol": "SOLEUR",
    "side": "BUY",
    "type": "LIMIT",
    "quantity": 0.01,
    "price": 115.00,
    "status": "NEW"
  }
}
```

**Nota:** L'ordine rimarrà in "NEW" finché il prezzo non raggiunge €115.00.

---

## 📋 TEST 4: Ordine Stop-Loss

Un ordine stop-loss viene eseguito quando il prezzo scende (o sale) al livello specificato.

### PowerShell:
```powershell
$body = @{
    symbol = "SOLEUR"
    side = "SELL"
    quantity = "0.01"
    stopPrice = "110.00"
} | ConvertTo-Json

Invoke-WebRequest -Uri "https://ticket.logikaservice.it/api/crypto/binance/order/stop" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body | Select-Object -ExpandProperty Content
```

### Body JSON:
```json
{
  "symbol": "SOLEUR",
  "side": "SELL",
  "quantity": "0.01",
  "stopPrice": "110.00"
}
```

---

## 📋 TEST 5: Cancella Ordine

Se hai un ordine aperto (limit o stop), puoi cancellarlo.

### URL:
```
DELETE https://ticket.logikaservice.it/api/crypto/binance/order/SOLEUR/12345679
```

### PowerShell:
```powershell
Invoke-WebRequest -Uri "https://ticket.logikaservice.it/api/crypto/binance/order/SOLEUR/12345679" `
    -Method DELETE | Select-Object -ExpandProperty Content
```

Sostituisci `12345679` con l'ID del tuo ordine.

---

## 📋 TEST 6: Verifica Saldo Dopo Ordine

Dopo aver fatto un ordine, verifica che il saldo sia stato aggiornato.

### URL:
```
https://ticket.logikaservice.it/api/crypto/binance/balance
```

Dovresti vedere:
- Meno EUR (se hai comprato)
- Più SOL (se hai comprato)
- O viceversa se hai venduto

---

## 🎯 SEQUENZA DI TEST CONSIGLIATA

### Test Completo:

1. **Verifica saldo iniziale**
   ```
   GET /api/crypto/binance/balance
   ```

2. **Fai un ordine di test (BUY 0.01 SOL)**
   ```
   POST /api/crypto/binance/order/market
   Body: {"symbol":"SOLEUR","side":"BUY","quantity":"0.01"}
   ```

3. **Verifica saldo dopo ordine**
   ```
   GET /api/crypto/binance/balance
   ```

4. **Controlla storico ordini**
   ```
   GET /api/crypto/binance/orders/history?symbol=SOLEUR
   ```

5. **Vendi di nuovo (opzionale)**
   ```
   POST /api/crypto/binance/order/market
   Body: {"symbol":"SOLEUR","side":"SELL","quantity":"0.01"}
   ```

---

## 🛠️ STRUMENTI CONSIGLIATI PER TEST

### 1. REST Client Extension (Browser)
- Chrome: "REST Client" o "Talend API Tester"
- Firefox: "RESTClient"

### 2. Postman
- App desktop per testare API
- Download: https://www.postman.com/downloads/

### 3. PowerShell (già disponibile su Windows)
- Scripts PowerShell inclusi nella guida

### 4. cURL (da terminale)
- Disponibile su Linux/Mac
- Su Windows: usa PowerShell o Git Bash

---

## ✅ RISULTATI ATTESI

### Ordine Market - SUCCESSO:
- `status: "FILLED"` (eseguito immediatamente)
- `quantity: 0.01` (quantità eseguita)
- `price: 119.43` (prezzo di esecuzione)
- `fills: [...]` (dettagli esecuzione)

### Ordine Limit - SUCCESSO:
- `status: "NEW"` (in attesa)
- Verrà eseguito quando il prezzo raggiunge il limite

### Ordine Stop-Loss - SUCCESSO:
- `status: "NEW"` (attivo)
- Verrà eseguito quando il prezzo raggiunge lo stop

---

## ❌ ERRORI COMUNI

### ❌ "Insufficient funds"
- Non hai abbastanza denaro virtuale
- Verifica il saldo con `/api/crypto/binance/balance`

### ❌ "Invalid symbol"
- Il simbolo non è corretto
- Per SOL/EUR usa: `SOLEUR` (tutto maiuscolo)

### ❌ "MIN_NOTIONAL"
- L'ordine è troppo piccolo
- Aumenta la quantità (es. da 0.01 a 0.1)

### ❌ "Invalid API-key"
- Le API keys non sono corrette
- Verifica nel file `.env` sulla VPS

---

## 🎉 PROSSIMI PASSI

Dopo aver testato gli ordini, possiamo:

1. ✅ **Integrare con sistema Open Positions** - Collegare ordini con posizioni
2. ✅ **Automatizzare ordini dal bot** - Bot che fa ordini automatici
3. ✅ **Sincronizzare saldo** - Aggiornare portfolio locale con Binance

---

## 📞 NOTA

Se hai problemi con i test, verifica:
1. Le API keys sono corrette sulla VPS
2. Il backend è riavviato
3. Hai abbastanza saldo virtuale
4. Il simbolo è corretto (SOLEUR)

Buon testing! 🚀

