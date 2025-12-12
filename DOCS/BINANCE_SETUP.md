# Configurazione Binance Testnet per Trading

Questa guida spiega come configurare Binance Testnet per testare il trading senza usare denaro reale.

## Modalità Disponibili

Il sistema supporta 3 modalità:

1. **DEMO** (default) - Simulazione locale senza API reali
2. **TESTNET** - Binance Testnet (test con API reali ma denaro virtuale)
3. **LIVE** - Produzione reale (⚠️ DENARO REALE)

## Configurazione Binance Testnet

### Passo 1: Creare Account Binance Testnet

1. Vai su https://testnet.binance.vision/
2. Clicca su "Generate HMAC_SHA256 Key" per creare una nuova API key
3. Salva:
   - **API Key**
   - **Secret Key**

### Passo 2: Configurare Variabili d'Ambiente

Aggiungi al file `backend/.env`:

```env
# Binance Configuration
BINANCE_MODE=testnet
BINANCE_API_KEY=la_tua_api_key_testnet
BINANCE_API_SECRET=il_tuo_secret_key_testnet
```

### Passo 3: Verificare Configurazione

Il sistema caricherà automaticamente le variabili d'ambiente. Per verificare:

```bash
# Controlla lo stato
curl http://localhost:3001/api/crypto/binance/mode
```

Dovresti vedere:
```json
{
  "mode": "testnet",
  "available": true,
  "message": "Modalità attiva: TESTNET"
}
```

## Endpoint API Disponibili

### 1. Verifica Modalità
```
GET /api/crypto/binance/mode
```

### 2. Saldo Account
```
GET /api/crypto/binance/balance?symbol=EUR
GET /api/crypto/binance/balance  # Tutti i saldi
```

### 3. Prezzo Cryptovaluta
```
GET /api/crypto/binance/price/SOLEUR
```

### 4. Ordine a Mercato
```
POST /api/crypto/binance/order/market
Content-Type: application/json

{
  "symbol": "SOLEUR",
  "side": "BUY",
  "quantity": "0.1"
}
```

### 5. Ordine Limite
```
POST /api/crypto/binance/order/limit
Content-Type: application/json

{
  "symbol": "SOLEUR",
  "side": "BUY",
  "quantity": "0.1",
  "price": "120.50"
}
```

### 6. Ordine Stop-Loss
```
POST /api/crypto/binance/order/stop
Content-Type: application/json

{
  "symbol": "SOLEUR",
  "side": "SELL",
  "quantity": "0.1",
  "stopPrice": "115.00"
}
```

### 7. Storico Ordini
```
GET /api/crypto/binance/orders/history?symbol=SOLEUR&limit=50
```

### 8. Cancella Ordine
```
DELETE /api/crypto/binance/order/SOLEUR/12345678
```

## Sicurezza

⚠️ **IMPORTANTE:**

1. **Non committare mai le API keys su Git**
   - Le API keys sono già in `.gitignore`
   - Verifica che `backend/.env` non sia tracciato

2. **Usa TESTNET per sviluppo**
   - TESTNET = denaro virtuale
   - LIVE = denaro reale

3. **Limiti Rate**
   - 10 ordini/secondo
   - 1200 richieste/minuto
   - Il sistema gestisce automaticamente i rate limits

## Test

### Test Saldo
```bash
curl http://localhost:3001/api/crypto/binance/balance
```

### Test Prezzo
```bash
curl http://localhost:3001/api/crypto/binance/price/SOLEUR
```

### Test Ordine (Market)
```bash
curl -X POST http://localhost:3001/api/crypto/binance/order/market \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "SOLEUR",
    "side": "BUY",
    "quantity": "0.01"
  }'
```

## Troubleshooting

### Errore: "API Key o Secret mancanti"
- Verifica che `BINANCE_API_KEY` e `BINANCE_API_SECRET` siano nel file `.env`
- Riavvia il backend dopo aver modificato `.env`

### Errore: "Modalità DEMO: usando simulazione locale"
- Verifica che `BINANCE_MODE=testnet` nel file `.env`
- Riavvia il backend

### Errore: "Request timeout"
- Verifica la connessione internet
- Binance Testnet potrebbe essere temporaneamente non disponibile

### Errore: "Invalid API-key"
- Verifica che le API keys siano corrette
- Genera nuove keys su https://testnet.binance.vision/

## Integrazione con Sistema Open Positions

Il sistema può essere integrato per:
- Aprire posizioni reali su Binance Testnet
- Gestire stop-loss e take-profit via Binance
- Sincronizzare saldo con portfolio locale

⚠️ **Al momento il sistema usa ancora simulazione locale. L'integrazione completa sarà nel prossimo step.**

## Prossimi Passi

1. ✅ Configurazione Binance Testnet
2. ⏳ Integrazione con sistema Open Positions
3. ⏳ Sincronizzazione automatica saldo
4. ⏳ Esecuzione ordini reali dal bot

