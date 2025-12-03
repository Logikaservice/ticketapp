# 🧪 COMANDI PER TESTARE SUL VPS (Linux/Bash)

## ⚠️ IMPORTANTE

I comandi PowerShell funzionano solo su **Windows**. Sul VPS Linux devi usare **Bash** o **curl**.

---

## 🚀 OPZIONE 1: Script Bash Completo

Sul VPS, dopo aver fatto SSH:

```bash
cd /var/www/ticketapp
bash backend/scripts/test-ordini-binance.sh
```

---

## 🚀 OPZIONE 2: Comandi curl Manuali

### Test 1: Verifica Modalità
```bash
curl -s "https://ticket.logikaservice.it/api/crypto/binance/mode" | python3 -m json.tool
```

### Test 2: Verifica Prezzo
```bash
curl -s "https://ticket.logikaservice.it/api/crypto/binance/price/SOLEUR" | python3 -m json.tool
```

### Test 3: Verifica Simboli Disponibili
```bash
curl -s "https://ticket.logikaservice.it/api/crypto/binance/symbols" | python3 -m json.tool
```

### Test 4: Test Ordine con SOLUSDT
```bash
curl -X POST "https://ticket.logikaservice.it/api/crypto/binance/order/market" \
  -H "Content-Type: application/json" \
  -d '{"symbol":"SOLUSDT","side":"BUY","quantity":"0.1"}' \
  | python3 -m json.tool
```

### Test 5: Test Ordine con SOLEUR
```bash
curl -X POST "https://ticket.logikaservice.it/api/crypto/binance/order/market" \
  -H "Content-Type: application/json" \
  -d '{"symbol":"SOLEUR","side":"BUY","quantity":"0.01"}' \
  | python3 -m json.tool
```

---

## 💻 OPZIONE 3: Dal PC Windows (PowerShell)

Se preferisci testare dal tuo PC Windows (non sul VPS):

### Test Ordine con SOLUSDT
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

### Usa lo Script Completo
```powershell
.\backend\scripts\test-ordini-binance.ps1
```

---

## 📊 VERIFICA LOG BACKEND

Se vedi errori, controlla i log:

```bash
pm2 logs ticketapp-backend --lines 50
```

Cerca:
- `📤 Binance POST Request`
- `📤 PlaceMarketOrder`
- `❌ Binance API Error`

---

## ✅ RIEPILOGO

- **Sul VPS Linux**: Usa Bash/curl (`test-ordini-binance.sh`)
- **Sul PC Windows**: Usa PowerShell (`test-ordini-binance.ps1`)
- **Entrambi**: Testano lo stesso endpoint, ma con sintassi diversa

