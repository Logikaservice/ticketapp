# 🔧 FIX ERRORE -1104 BINANCE

## 📊 PROBLEMA

Errore Binance **-1104**: "Not all sent parameters were read; read '6' parameter(s) but was sent '7'"

Questo significa che stiamo inviando **7 parametri** ma Binance ne legge solo **6**.

---

## 🔍 ANALISI

### Parametri che stiamo inviando:
Per un ordine MARKET, dovremmo inviare:
1. `symbol` - Simbolo (es. SOLEUR, SOLUSDT)
2. `side` - BUY o SELL
3. `type` - MARKET
4. `quantity` - Quantità
5. `timestamp` - Timestamp (aggiunto automaticamente)
6. `signature` - Firma (aggiunto automaticamente)

**Totale: 6 parametri nella query string**

### Problema identificato:
Potremmo avere:
- Un parametro extra nella query string
- O parametri sia nella query string che nel body (anche se body dovrebbe essere vuoto)

---

## ✅ CORREZIONI APPLICATE

1. **Rimosso endpoint `/symbols` duplicato**
2. **Corretta struttura richieste POST autenticate:**
   - Parametri solo nella query string
   - Body vuoto per POST autenticate

---

## 🧪 VERIFICA

Dopo il deploy, testa di nuovo l'ordine:

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

## 📝 NOTE

- Per ordini MARKET, Binance **NON** accetta `timeInForce`
- Per ordini LIMIT, Binance **RICHIEDE** `timeInForce`
- I parametri devono essere **solo nella query string** per POST autenticate
- Il **body deve essere vuoto** per POST autenticate

---

## 🚀 PROSSIMI PASSI

1. Deploy sul VPS
2. Riavviare backend
3. Testare ordine con SOLUSDT (che sicuramente esiste)
4. Se funziona, verificare disponibilità SOLEUR

