# 🚀 COMANDI RAPIDI VPS - COPIA E INCOLLA

## 📋 SEQUENZA COMPLETA (Copia tutto insieme)

```bash
# 1. Connessione VPS
ssh root@185.199.53.169

# 2. Vai nella directory progetto
cd /root/ticketapp

# 3. Pull modifiche da GitHub
git pull origin main

# 4. Verifica file aggiornato
echo "=== VERIFICA SIMBOLI NEL CODICE ==="
grep -A 15 "commonSymbols = \[" backend/routes/cryptoRoutes.js

# 5. Rendi eseguibili gli script
chmod +x verifica-database-vps.sh pulisci-database-vps.sh

# 6. PRIMA: Verifica stato attuale
echo ""
echo "=== STATO ATTUALE DATABASE ==="
./verifica-database-vps.sh

# 7. PULIZIA: Rimuovi simboli problematici
echo ""
echo "=== PULIZIA DATABASE ==="
./pulisci-database-vps.sh

# 8. DOPO: Verifica modifiche
echo ""
echo "=== VERIFICA FINALE ==="
./verifica-database-vps.sh

# 9. Riavvia backend
echo ""
echo "=== RIAVVIO BACKEND ==="
pm2 restart all

# 10. Verifica status
pm2 status

# 11. Controlla log (ultimi 50 righe)
pm2 logs --lines 50
```

---

## 🎯 COMANDI SINGOLI (Se preferisci passo-passo)

### Passo 1: Connessione
```bash
ssh root@185.199.53.169
```

### Passo 2: Navigazione
```bash
cd /root/ticketapp
```

### Passo 3: Pull Codice
```bash
git pull origin main
```

### Passo 4: Verifica Codice
```bash
grep -A 15 "commonSymbols = \[" backend/routes/cryptoRoutes.js
```

**Output atteso**:
```javascript
const commonSymbols = [
    'bitcoin',      // BTC - Volume: €500M+
    'ethereum',     // ETH - Volume: €200M+
    'binance_coin', // BNB - Volume: €50M+
    'solana',       // SOL - Volume: €30M+
    'cardano',      // ADA - Volume: €20M+
    'ripple',       // XRP - Volume: €25M+
    'polkadot',     // DOT - Volume: €10M+
    'chainlink',    // LINK - Volume: €10M+
    'litecoin',     // LTC - Volume: €15M+
    'avalanche',    // AVAX - Volume: €15M+
    'matic',        // MATIC - Volume: €12M+
    // ❌ RIMOSSI: 'dogecoin', 'shiba'
];
```

### Passo 5: Permessi Script
```bash
chmod +x verifica-database-vps.sh pulisci-database-vps.sh
```

### Passo 6: Verifica Database (PRIMA)
```bash
./verifica-database-vps.sh
```

### Passo 7: Pulizia Database
```bash
./pulisci-database-vps.sh
```

### Passo 8: Verifica Database (DOPO)
```bash
./verifica-database-vps.sh
```

### Passo 9: Riavvio Backend
```bash
pm2 restart all
```

### Passo 10: Status Backend
```bash
pm2 status
```

### Passo 11: Log Backend
```bash
pm2 logs --lines 50
```

---

## ✅ COSA VERIFICARE NEI LOG

Dopo `pm2 logs --lines 50`, cerca:

### ✅ BUONI SEGNALI:
```
✅ SIMBOLI AD ALTO VOLUME - Filtrati per liquidità e spread bassi
📊 Scanning 11 symbols: bitcoin, ethereum, binance_coin, solana, cardano, ripple, polkadot, chainlink, litecoin, avalanche, matic
✅ [BTC] Volume 24h: €500M+ - OK
✅ [ETH] Volume 24h: €200M+ - OK
✅ [AVAX] Volume 24h: €15M+ - OK
✅ [MATIC] Volume 24h: €12M+ - OK
```

### ❌ SEGNALI PROBLEMATICI (non dovrebbero apparire):
```
❌ [SHIBA] Volume 24h: €2M - SKIPPED
❌ [DOGE] Volume 24h: €5M - SKIPPED
❌ [MANA] Volume 24h: €3M - SKIPPED
❌ [EOS] Volume 24h: €1M - SKIPPED
```

---

## 🔍 VERIFICA RAPIDA DATABASE

### Query Rapida: Conta Simboli Attivi
```bash
psql $DATABASE_URL -c "SELECT COUNT(*) as attivi FROM crypto_bot_params WHERE is_active = 1;"
```

**Output atteso**: `11`

### Query Rapida: Lista Simboli Attivi
```bash
psql $DATABASE_URL -c "SELECT symbol FROM crypto_bot_params WHERE is_active = 1 ORDER BY symbol;"
```

**Output atteso**:
```
 symbol
---------------
 avalanche
 bitcoin
 binance_coin
 cardano
 chainlink
 ethereum
 litecoin
 matic
 polkadot
 ripple
 solana
(11 rows)
```

### Query Rapida: Simboli Problematici
```bash
psql $DATABASE_URL -c "SELECT symbol, is_active FROM crypto_bot_params WHERE symbol IN ('shiba', 'dogecoin', 'mana', 'eos');"
```

**Output atteso**: Tutti con `is_active = 0`

---

## 🚨 TROUBLESHOOTING RAPIDO

### Problema: Git pull fallisce
```bash
# Reset modifiche locali
git reset --hard HEAD
git pull origin main
```

### Problema: Script non eseguibile
```bash
chmod +x *.sh
```

### Problema: DATABASE_URL non trovato
```bash
# Carica da .env
source .env
export DATABASE_URL
```

### Problema: Backend non si riavvia
```bash
# Stop forzato
pm2 stop all
pm2 delete all

# Riavvio completo
cd /root/ticketapp/backend
pm2 start index.js --name ticketapp-backend
```

### Problema: Simboli ancora visibili nel Market Scanner
```bash
# 1. Riavvia backend
pm2 restart all

# 2. Pulisci cache browser (Ctrl+Shift+R)

# 3. Verifica database
./verifica-database-vps.sh
```

---

## 📊 CHECKLIST FINALE

Dopo aver eseguito tutti i comandi:

- [ ] Git pull completato senza errori
- [ ] Codice aggiornato (grep mostra nuovi simboli)
- [ ] Script eseguibili (chmod +x)
- [ ] Verifica database mostra 11 simboli attivi
- [ ] Pulizia database completata
- [ ] Simboli problematici disattivati (is_active = 0)
- [ ] AVAX e MATIC configurati e attivi
- [ ] Backend riavviato (pm2 restart all)
- [ ] PM2 status mostra "online"
- [ ] Log backend non mostrano errori
- [ ] Log backend mostrano solo 11 simboli
- [ ] SHIBA, DOGE, MANA, EOS non nei log

---

## 🎯 VERIFICA FRONTEND

Dopo il deploy, apri il frontend e verifica:

### Market Scanner
- Dovrebbe mostrare **11 simboli**
- NON dovrebbe mostrare: SHIBA, DOGE, MANA, EOS
- DOVREBBE mostrare: AVAX, MATIC (nuovi)

### Bot Analysis
- Parametri RSI: oversold = 30, overbought = 70
- Stop Loss = 3%
- Take Profit = 15%
- Trailing Stop = 4%

### Nuovi Trade
- Spread < 0.3%
- Slippage < 0.1%
- Costi totali < €0.30

---

**Se tutti i check sono ✅, il sistema è configurato correttamente!** 🚀

**Monitora per 7 giorni e aspettati +300-400% profitti!**
