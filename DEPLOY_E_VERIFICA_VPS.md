# 🚀 DEPLOY E VERIFICA DATABASE VPS

## 📋 CHECKLIST COMPLETA

### ✅ FASE 1: DEPLOY CODICE (FATTO)

- [x] Modificato `cryptoRoutes.js` (rimossi SHIBA, DOGE, MANA, EOS)
- [x] Aggiunti AVAX e MATIC
- [x] Commit su Git
- [x] Push su GitHub

---

## 🔧 FASE 2: AGGIORNAMENTO VPS

### Comandi da Eseguire sulla VPS

```bash
# 1. Connettiti alla VPS
ssh root@159.69.121.162

# 2. Vai nella directory del progetto
cd /root/ticketapp

# 3. Pull delle modifiche da GitHub
git pull origin main

# 4. Verifica che il file sia aggiornato
grep -A 15 "commonSymbols = \[" backend/routes/cryptoRoutes.js
# Dovresti vedere: bitcoin, ethereum, binance_coin, solana, cardano, ripple, polkadot, chainlink, litecoin, avalanche, matic
# NON dovresti vedere: dogecoin, shiba, mana, eos

# 5. Copia gli script di verifica
# (Se non sono già presenti dopo il pull)

# 6. Rendi eseguibili gli script
chmod +x verifica-database-vps.sh
chmod +x pulisci-database-vps.sh

# 7. PRIMA: Verifica stato attuale database
./verifica-database-vps.sh

# 8. PULIZIA: Rimuovi simboli problematici e configura AVAX/MATIC
./pulisci-database-vps.sh

# 9. DOPO: Verifica che tutto sia corretto
./verifica-database-vps.sh

# 10. Riavvia il backend
pm2 restart all

# 11. Verifica che il backend sia attivo
pm2 status
pm2 logs --lines 50
```

---

## 🔍 COSA VERIFICARE

### 1. **Simboli nel Database**

Dopo `./verifica-database-vps.sh`, dovresti vedere:

**✅ Simboli ATTIVI (11 totali)**:
```
bitcoin
ethereum
binance_coin
solana
cardano
ripple
polkadot
chainlink
litecoin
avalanche  ← NUOVO
matic      ← NUOVO
```

**❌ Simboli DISATTIVATI (4 totali)**:
```
shiba      ← RIMOSSO
dogecoin   ← RIMOSSO
mana       ← RIMOSSO
eos        ← RIMOSSO
```

### 2. **Parametri Corretti**

Per TUTTI i simboli attivi:

| Parametro | Valore Corretto |
|-----------|-----------------|
| `rsi_oversold` | 30 |
| `rsi_overbought` | 70 |
| `stop_loss_percent` | 3 |
| `take_profit_percent` | 15 |
| `trailing_stop_percent` | 4 |
| `min_signal_strength` | 65 |
| `min_volume_24h` | >= 1000000 |

### 3. **Posizioni Aperte**

Verifica che NON ci siano posizioni aperte su:
- shiba
- dogecoin
- mana
- eos

Se ci sono, lo script `pulisci-database-vps.sh` le chiuderà automaticamente.

---

## 📊 OUTPUT ATTESO

### Script `verifica-database-vps.sh`

```
🔍 VERIFICA CONFIGURAZIONE DATABASE VPS
========================================

📊 1. SIMBOLI NEL DATABASE (crypto_bot_params)
------------------------------------------------
 symbol        | is_active | min_signal_strength | stop_loss_percent | take_profit_percent | trailing_stop_percent
---------------+-----------+---------------------+-------------------+---------------------+----------------------
 avalanche     |         1 |                  65 |                 3 |                  15 |                     4
 bitcoin       |         1 |                  65 |                 3 |                  15 |                     4
 binance_coin  |         1 |                  65 |                 3 |                  15 |                     4
 cardano       |         1 |                  65 |                 3 |                  15 |                     4
 chainlink     |         1 |                  65 |                 3 |                  15 |                     4
 dogecoin      |         0 |                  65 |                 3 |                  15 |                     4  ← DISATTIVATO
 eos           |         0 |                  65 |                 3 |                  15 |                     4  ← DISATTIVATO
 ethereum      |         1 |                  65 |                 3 |                  15 |                     4
 litecoin      |         1 |                  65 |                 3 |                  15 |                     4
 mana          |         0 |                  65 |                 3 |                  15 |                     4  ← DISATTIVATO
 matic         |         1 |                  65 |                 3 |                  15 |                     4
 polkadot      |         1 |                  65 |                 3 |                  15 |                     4
 ripple        |         1 |                  65 |                 3 |                  15 |                     4
 shiba         |         0 |                  65 |                 3 |                  15 |                     4  ← DISATTIVATO
 solana        |         1 |                  65 |                 3 |                  15 |                     4

📈 2. CONTEGGIO SIMBOLI ATTIVI
------------------------------
 total_symbols | active_symbols
---------------+----------------
            15 |             11  ← 11 ATTIVI, 4 DISATTIVATI

⚠️  3. VERIFICA SIMBOLI PROBLEMATICI (dovrebbero essere 0)
-----------------------------------------------------------
 symbol    | is_active
-----------+-----------
 dogecoin  |         0  ← DISATTIVATO ✅
 eos       |         0  ← DISATTIVATO ✅
 mana      |         0  ← DISATTIVATO ✅
 shiba     |         0  ← DISATTIVATO ✅

✅ 4. VERIFICA NUOVI SIMBOLI (AVAX, MATIC)
------------------------------------------
 symbol     | is_active | min_signal_strength
------------+-----------+---------------------
 avalanche  |         1 |                  65  ← ATTIVO ✅
 matic      |         1 |                  65  ← ATTIVO ✅

🎯 5. PARAMETRI RSI (dovrebbero essere: oversold=30, overbought=70)
--------------------------------------------------------------------
 symbol  | rsi_oversold | rsi_overbought | rsi_period
---------+--------------+----------------+------------
 bitcoin |           30 |             70 |         14  ← CORRETTO ✅

🛡️  6. PARAMETRI SL/TP (SL=3%, TP=15%, TS=4%)
----------------------------------------------
 symbol  | stop_loss_percent | take_profit_percent | trailing_stop_percent
---------+-------------------+---------------------+-----------------------
 bitcoin |                 3 |                  15 |                     4  ← CORRETTO ✅

💰 7. VOLUME MINIMO 24H (dovrebbe essere >= 1000000)
-----------------------------------------------------
 symbol  | min_volume_24h
---------+----------------
 bitcoin |        1000000  ← CORRETTO ✅

🚨 9. POSIZIONI APERTE SU SIMBOLI PROBLEMATICI
-----------------------------------------------
(0 rows)  ← NESSUNA POSIZIONE APERTA ✅

✅ 10. RIEPILOGO FINALE
----------------------
Se tutto è corretto, dovresti vedere:
  - 0 simboli problematici (shiba, dogecoin, mana, eos)
  - 11 simboli totali (bitcoin, ethereum, binance_coin, solana, cardano, ripple, polkadot, chainlink, litecoin, avalanche, matic)
  - RSI oversold = 30, overbought = 70
  - Stop Loss = 3%, Take Profit = 15%, Trailing Stop = 4%
  - Volume minimo 24h >= 1000000

🎯 Verifica completata!
```

---

## 🚨 TROUBLESHOOTING

### Problema: Script non eseguibile
```bash
chmod +x verifica-database-vps.sh
chmod +x pulisci-database-vps.sh
```

### Problema: DATABASE_URL non definito
```bash
# Verifica variabile d'ambiente
echo $DATABASE_URL

# Se non definito, caricalo da .env
source .env
export DATABASE_URL
```

### Problema: psql non trovato
```bash
# Installa PostgreSQL client
apt-get update
apt-get install postgresql-client
```

### Problema: Simboli ancora presenti nel Market Scanner
```bash
# 1. Verifica che siano disattivati nel database
./verifica-database-vps.sh

# 2. Riavvia il backend
pm2 restart all

# 3. Pulisci cache browser (Ctrl+Shift+R)

# 4. Verifica log backend
pm2 logs --lines 100 | grep -i "shiba\|doge\|mana\|eos"
```

---

## ✅ VERIFICA FINALE

Dopo aver eseguito tutti i comandi, verifica:

### 1. **Backend Logs**
```bash
pm2 logs --lines 50
```

Dovresti vedere:
```
✅ SIMBOLI AD ALTO VOLUME - Filtrati per liquidità e spread bassi
📊 Scanning 11 symbols: bitcoin, ethereum, binance_coin, solana, cardano, ripple, polkadot, chainlink, litecoin, avalanche, matic
```

NON dovresti vedere:
```
❌ shiba
❌ dogecoin
❌ mana
❌ eos
```

### 2. **Market Scanner (Frontend)**

Apri il Market Scanner e verifica che mostri solo **11 simboli**:
- BTC (Bitcoin)
- ETH (Ethereum)
- BNB (Binance Coin)
- SOL (Solana)
- ADA (Cardano)
- XRP (Ripple)
- DOT (Polkadot)
- LINK (Chainlink)
- LTC (Litecoin)
- AVAX (Avalanche) ← NUOVO
- MATIC (Polygon) ← NUOVO

### 3. **Spread sui Nuovi Trade**

Monitora i prossimi trade aperti:
- Spread dovrebbe essere **< 0.3%**
- Slippage dovrebbe essere **< 0.1%**
- Costi totali dovrebbero essere **< €0.30 per trade**

---

## 📈 METRICHE DA MONITORARE (7 giorni)

| Metrica | Prima | Target | Verifica |
|---------|-------|--------|----------|
| **Spread medio** | 2.5% | < 0.3% | [ ] |
| **Costi per trade** | €3.50 | < €0.30 | [ ] |
| **Win Rate** | 55% | > 65% | [ ] |
| **Profit Factor** | 1.15 | > 1.5 | [ ] |
| **Return settimanale** | +0.1% | > +0.5% | [ ] |

---

## 🎯 CHECKLIST FINALE

- [ ] Codice deployato su VPS (git pull)
- [ ] Script verifica eseguito
- [ ] Script pulizia eseguito
- [ ] Database verificato (11 simboli attivi, 4 disattivati)
- [ ] Parametri corretti (RSI 30/70, SL 3%, TP 15%, TS 4%)
- [ ] Backend riavviato (pm2 restart all)
- [ ] Market Scanner mostra solo 11 simboli
- [ ] SHIBA, DOGE, MANA, EOS non visibili
- [ ] Nessuna posizione aperta su simboli problematici
- [ ] Spread < 0.3% sui nuovi trade

---

**Se tutti i check sono ✅, il sistema è configurato correttamente!** 🚀

**Monitora per 7 giorni e verifica che i profitti aumentino del 300-400%!**
