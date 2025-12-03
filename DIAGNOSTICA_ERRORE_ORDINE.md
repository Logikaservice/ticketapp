# 🔍 DIAGNOSTICA ERRORE 500 ORDINE BINANCE

Il test ha mostrato un errore 500 durante l'esecuzione di un ordine market su Binance Testnet.

---

## 🔎 POSSIBILI CAUSE

1. **SOLEUR non esiste su Binance Testnet**
   - Binance Testnet potrebbe non avere tutte le coppie disponibili
   - Potrebbero usare solo coppie standard (BTCUSDT, ETHUSDT, SOLUSDT, ecc.)

2. **Quantità troppo piccola**
   - 0.01 SOL potrebbe essere sotto il minimo richiesto
   - Ogni simbolo ha un LOT_SIZE minimo

3. **Problema con l'autenticazione**
   - La firma potrebbe essere errata
   - I permessi API potrebbero non essere corretti

---

## 🧪 VERIFICA: Quali Simboli sono Disponibili?

### Opzione 1: Browser
Apri:
```
https://ticket.logikaservice.it/api/crypto/binance/symbols
```

Dovresti vedere:
- Lista simboli con SOL
- Lista simboli con EUR
- Simboli comuni (BTC, ETH, BNB, SOL)

### Opzione 2: PowerShell
```powershell
Invoke-WebRequest -Uri "https://ticket.logikaservice.it/api/crypto/binance/symbols" | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 5
```

---

## 🔍 VERIFICA LOG BACKEND

Per vedere l'errore esatto, controlla i log del backend:

```bash
# Sul VPS
pm2 logs ticketapp-backend --lines 50
```

Cerca messaggi con:
- `❌ Errore placeMarketOrder`
- `❌ Binance API Error`
- `Error details`

---

## 🧪 TEST ALTERNATIVO: Usa SOLUSDT

Se SOLEUR non esiste, prova con SOLUSDT (che sicuramente esiste):

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

## ✅ PROSSIMI PASSI

1. Verificare quali simboli sono disponibili con l'endpoint `/api/crypto/binance/symbols`
2. Se SOLEUR non esiste, possiamo:
   - Usare SOLUSDT per gli ordini
   - Convertire i prezzi EUR usando un tasso di cambio
   - Mantenere SOLEUR come simbolo interno nel sistema
3. Migliorare la gestione degli errori per vedere i dettagli esatti

Verifichiamo prima i simboli disponibili!

