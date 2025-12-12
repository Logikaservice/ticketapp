# 🧪 TEST BINANCE TESTNET SULLA VPS

Guida completa per testare la configurazione Binance Testnet sul server VPS.

---

## 📋 PREREQUISITI

- Backend configurato sulla VPS
- File `.env` aggiornato con le Binance keys
- Backend riavviato dopo la configurazione

---

## 🔧 PASSO 1: Verificare Configurazione sulla VPS

### 1.1 Connettiti alla VPS

```bash
ssh root@tua-vps-ip
# oppure
ssh utente@tua-vps-ip
```

### 1.2 Verifica che le Binance Keys siano nel file .env

```bash
cd /var/www/ticketapp/backend
cat .env | grep BINANCE
```

**Dovresti vedere:**
```
BINANCE_MODE=testnet
BINANCE_API_KEY=PzOk2ocCeofy4S3BMeSwoh6SuTHGIhKk9xJPFQ6Z1WD96UScAfksQ9jyImziCYug
BINANCE_API_SECRET=cLAoKBP5EdvhOMqKh2vdic4MAxIUuC3KVFhLov9c4zCxHxxXC0JxBEtEhlkEWTmF
```

### 1.3 Se le keys NON sono nel file .env sulla VPS

**Opzione A: Aggiungi manualmente**

```bash
cd /var/www/ticketapp/backend
nano .env
```

Aggiungi alla fine del file:
```env

# =========================================
# BINANCE TESTNET CONFIGURATION
# =========================================
BINANCE_MODE=testnet
BINANCE_API_KEY=PzOk2ocCeofy4S3BMeSwoh6SuTHGIhKk9xJPFQ6Z1WD96UScAfksQ9jyImziCYug
BINANCE_API_SECRET=cLAoKBP5EdvhOMqKh2vdic4MAxIUuC3KVFhLov9c4zCxHxxXC0JxBEtEhlkEWTmF
```

Salva: `Ctrl + O`, poi `Enter`, poi `Ctrl + X`

**Opzione B: Usa echo (più veloce)**

```bash
cd /var/www/ticketapp/backend
cat >> .env << 'EOF'

# =========================================
# BINANCE TESTNET CONFIGURATION
# =========================================
BINANCE_MODE=testnet
BINANCE_API_KEY=PzOk2ocCeofy4S3BMeSwoh6SuTHGIhKk9xJPFQ6Z1WD96UScAfksQ9jyImziCYug
BINANCE_API_SECRET=cLAoKBP5EdvhOMqKh2vdic4MAxIUuC3KVFhLov9c4zCxHxxXC0JxBEtEhlkEWTmF
EOF
```

---

## 🔄 PASSO 2: Riavviare il Backend sulla VPS

### 2.1 Se usi PM2

```bash
pm2 restart ticketapp-backend
pm2 logs ticketapp-backend --lines 20
```

### 2.2 Se usi systemd

```bash
sudo systemctl restart ticketapp-backend
sudo systemctl status ticketapp-backend
```

### 2.3 Verifica che il backend sia attivo

```bash
curl http://localhost:3001/api
```

Dovresti vedere: `{"message":"API del sistema di ticketing funzionante."}`

---

## 🧪 PASSO 3: Test degli Endpoint Binance

### 3.1 Test da Terminale SSH sulla VPS

**Test 1: Verifica Modalità**
```bash
curl http://localhost:3001/api/crypto/binance/mode
```

**Risposta attesa:**
```json
{
  "mode": "testnet",
  "available": true,
  "message": "Modalità attiva: TESTNET"
}
```

**Test 2: Verifica Saldo**
```bash
curl http://localhost:3001/api/crypto/binance/balance
```

**Test 3: Verifica Prezzo SOL/EUR**
```bash
curl http://localhost:3001/api/crypto/binance/price/SOLEUR
```

### 3.2 Test da Browser (URL pubblica)

Il tuo backend è esposto su: **`https://ticket.logikaservice.it`**

**Test 1: Verifica Modalità**
```
https://ticket.logikaservice.it/api/crypto/binance/mode
```

**Test 2: Verifica Saldo**
```
https://ticket.logikaservice.it/api/crypto/binance/balance
```

**Test 3: Verifica Prezzo**
```
https://ticket.logikaservice.it/api/crypto/binance/price/SOLEUR
```

### 3.3 Test da PowerShell (Windows locale)

Test dalla tua macchina Windows verso la VPS:

```powershell
# Test modalità
Invoke-WebRequest -Uri "https://ticket.logikaservice.it/api/crypto/binance/mode" | Select-Object -ExpandProperty Content

# Test prezzo
Invoke-WebRequest -Uri "https://ticket.logikaservice.it/api/crypto/binance/price/SOLEUR" | Select-Object -ExpandProperty Content
```

### 3.3 Test da PowerShell (Windows locale)

Se vuoi testare dalla tua macchina Windows:

```powershell
# Test modalità
Invoke-WebRequest -Uri "https://ticket.logikaservice.it/api/crypto/binance/mode" | Select-Object -ExpandProperty Content

# Test prezzo
Invoke-WebRequest -Uri "https://ticket.logikaservice.it/api/crypto/binance/price/SOLEUR" | Select-Object -ExpandProperty Content
```

---

## ✅ RISULTATI ATTESI

### ✅ Test Modalità - SUCCESSO

```json
{
  "mode": "testnet",
  "available": true,
  "message": "Modalità attiva: TESTNET"
}
```

### ✅ Test Prezzo - SUCCESSO

```json
{
  "success": true,
  "mode": "testnet",
  "symbol": "SOLEUR",
  "price": 123.45
}
```

### ✅ Test Saldo - SUCCESSO

```json
{
  "success": true,
  "mode": "testnet",
  "balance": [
    {
      "asset": "EUR",
      "free": 10000.00,
      "locked": 0.00,
      "total": 10000.00
    }
  ]
}
```

---

## ❌ PROBLEMI COMUNI

### ❌ Errore: "Modalità DEMO: usando simulazione locale"

**Causa:** Le variabili d'ambiente non sono state caricate o il backend non è stato riavviato.

**Soluzione:**
1. Verifica che le keys siano nel file `.env`
2. Riavvia il backend: `pm2 restart ticketapp-backend`
3. Verifica che il backend stia leggendo il file `.env`:
   ```bash
   pm2 logs ticketapp-backend | grep -i binance
   ```

### ❌ Errore: "API Key o Secret mancanti"

**Causa:** Le API keys non sono state configurate correttamente.

**Soluzione:**
1. Verifica il file `.env`:
   ```bash
   cat /var/www/ticketapp/backend/.env | grep BINANCE
   ```
2. Assicurati che non ci siano spazi prima o dopo il simbolo `=`
3. Assicurati che le keys siano su righe separate

### ❌ Errore: "Invalid API-key"

**Causa:** Le API keys non sono corrette o sono scadute.

**Soluzione:**
1. Verifica che le keys siano quelle generate su https://testnet.binance.vision/
2. Genera nuove keys se necessario
3. Aggiorna il file `.env` e riavvia il backend

### ❌ Errore: "Request timeout" o "ECONNREFUSED"

**Causa:** Problemi di connessione internet o Binance Testnet non raggiungibile.

**Soluzione:**
1. Verifica connessione internet sulla VPS:
   ```bash
   ping testnet.binance.vision
   ```
2. Verifica che non ci siano firewall che bloccano le richieste
3. Prova di nuovo dopo qualche minuto

---

## 📝 SCRIPT DI TEST AUTOMATICO

Crea un file `test-binance.sh` sulla VPS:

```bash
#!/bin/bash

echo "🧪 TEST BINANCE TESTNET"
echo "========================"
echo ""

BASE_URL="http://localhost:3001/api/crypto/binance"

echo "1️⃣  Test Modalità..."
curl -s "$BASE_URL/mode" | jq '.'
echo ""
echo ""

echo "2️⃣  Test Prezzo SOLEUR..."
curl -s "$BASE_URL/price/SOLEUR" | jq '.'
echo ""
echo ""

echo "3️⃣  Test Saldo..."
curl -s "$BASE_URL/balance" | jq '.'
echo ""
echo ""

echo "✅ Test completati!"
```

Esegui:
```bash
chmod +x test-binance.sh
./test-binance.sh
```

---

## 🎯 PROSSIMI PASSI

Una volta che i test funzionano:

1. ✅ **Integrare con sistema Open Positions** - Usare Binance per aprire posizioni reali
2. ✅ **Sincronizzare saldo** - Aggiornare il portfolio locale con il saldo Binance
3. ✅ **Testare ordini** - Provare a fare un ordine di test su Binance Testnet

---

## 📞 SUPPORTO

Se hai problemi:
1. Controlla i log del backend: `pm2 logs ticketapp-backend`
2. Verifica che il backend stia leggendo il `.env`: `pm2 env ticketapp-backend`
3. Testa la connessione: `curl -v https://testnet.binance.vision/api/v3/ping`

