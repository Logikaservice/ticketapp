# 📊 CALCOLO P&L (Profit & Loss) - Documentazione Completa

## 🎯 Overview

Il tuo progetto calcola il **P&L (Profit & Loss)** in tempo reale per ogni posizione aperta e chiusa, utilizzando formule diverse per posizioni LONG (buy) e SHORT (sell).

---

## 💰 Formule di Calcolo P&L

### **1. POSIZIONI LONG (Buy)**

```javascript
// Formula P&L in USDT
pnl = (currentPrice - entryPrice) * remainingVolume

// Formula P&L in percentuale
pnlPct = ((currentPrice - entryPrice) / entryPrice) * 100
```

**Esempio Pratico:**
- Entry Price: $50,000 USDT
- Current Price: $51,000 USDT
- Volume: 0.1 BTC
- **P&L**: ($51,000 - $50,000) × 0.1 = **+$100 USDT**
- **P&L %**: (($51,000 - $50,000) / $50,000) × 100 = **+2%**

---

### **2. POSIZIONI SHORT (Sell)**

```javascript
// Formula P&L in USDT
pnl = (entryPrice - currentPrice) * remainingVolume

// Formula P&L in percentuale
pnlPct = ((entryPrice - currentPrice) / entryPrice) * 100
```

**Esempio Pratico:**
- Entry Price: $50,000 USDT
- Current Price: $49,000 USDT
- Volume: 0.1 BTC
- **P&L**: ($50,000 - $49,000) × 0.1 = **+$100 USDT**
- **P&L %**: (($50,000 - $49,000) / $50,000) × 100 = **+2%**

---

## 📋 Campi Calcolati e Visualizzati

### **Tabella `open_positions` (Database)**

| Campo | Tipo | Descrizione | Calcolo |
|-------|------|-------------|---------|
| `entry_price` | DECIMAL | Prezzo di entrata | Prezzo al momento dell'apertura |
| `current_price` | DECIMAL | Prezzo corrente | Aggiornato ogni ciclo (5 secondi) |
| `volume` | DECIMAL | Volume totale | Quantità di crypto acquistata/venduta |
| `volume_closed` | DECIMAL | Volume già chiuso | Per chiusure parziali (TP1) |
| `profit_loss` | DECIMAL | P&L in USDT | `(currentPrice - entryPrice) * remainingVolume` |
| `profit_loss_pct` | DECIMAL | P&L in percentuale | `((currentPrice - entryPrice) / entryPrice) * 100` |
| `stop_loss` | DECIMAL | Stop Loss | Prezzo di stop loss |
| `take_profit` | DECIMAL | Take Profit | Prezzo di take profit |
| `take_profit_1` | DECIMAL | Take Profit 1 (parziale) | Primo livello TP (chiude 50%) |
| `take_profit_2` | DECIMAL | Take Profit 2 | Secondo livello TP |
| `highest_price` | DECIMAL | Prezzo massimo raggiunto | Per trailing stop loss |
| `trailing_stop_enabled` | BOOLEAN | Trailing stop attivo | Se abilitato |
| `trailing_stop_distance_pct` | DECIMAL | Distanza trailing stop | Percentuale di distanza |

---

## 🔄 Aggiornamento P&L in Tempo Reale

### **Frequenza di Aggiornamento**
- **Ogni 5 secondi** (configurato in `BOT_CONFIG.CHECK_INTERVAL_MS`)
- Ciclo principale: `cryptoRoutes.js` linea ~4200

### **Processo di Aggiornamento**

```javascript
// 1. Recupera prezzo corrente da Binance
const currentPrice = await getSymbolPrice(symbol);

// 2. Calcola remaining volume (dopo chiusure parziali)
const remainingVolume = pos.volume - (pos.volume_closed || 0);

// 3. Calcola P&L basato sul tipo di posizione
if (pos.type === 'buy') {
    pnl = (currentPrice - entryPrice) * remainingVolume;
    pnlPct = ((currentPrice - entryPrice) / entryPrice) * 100;
} else {
    pnl = (entryPrice - currentPrice) * remainingVolume;
    pnlPct = ((entryPrice - currentPrice) / entryPrice) * 100;
}

// 4. Aggiorna database
await dbRun(
    "UPDATE open_positions SET current_price = $1, profit_loss = $2, profit_loss_pct = $3 WHERE ticket_id = $4",
    [currentPrice, pnl, pnlPct, pos.ticket_id]
);
```

---

## 📊 Metriche Visualizzate nel Frontend

### **1. Dashboard - Posizioni Aperte**

Ogni posizione aperta mostra:
- ✅ **Symbol**: Simbolo crypto (es. BTC, ETH)
- ✅ **Type**: LONG (buy) o SHORT (sell)
- ✅ **Entry Price**: Prezzo di entrata in USDT
- ✅ **Current Price**: Prezzo corrente in USDT
- ✅ **Volume**: Quantità di crypto
- ✅ **P&L (USDT)**: Profitto/perdita in dollari
- ✅ **P&L (%)**: Profitto/perdita in percentuale
- ✅ **Stop Loss**: Livello di stop loss
- ✅ **Take Profit**: Livello di take profit
- ✅ **Bot Sentiment**: Sentimento attuale del bot (BULLISH/BEARISH/NEUTRAL)

### **2. Performance Analytics**

```javascript
// Statistiche calcolate per periodi: Giorno, Settimana, Mese, Anno
{
    total_trades: 50,           // Numero totale trade
    winning_trades: 30,         // Trade in profitto
    losing_trades: 20,          // Trade in perdita
    win_rate: 60.0,            // % di trade vincenti
    total_profit: 500.0,       // Profitto totale (USDT)
    total_loss: 300.0,         // Perdita totale (USDT)
    net_profit: 200.0,         // Profitto netto (USDT)
    roi_percent: 20.0,         // ROI percentuale
    avg_profit_per_trade: 4.0  // Profitto medio per trade
}
```

### **3. Portfolio Balance**

```javascript
// Balance totale calcolato
{
    balance_usd: 10800.0,      // Balance in USDT
    total_equity: 10800.0,     // Equity totale (balance + valore posizioni aperte)
    holdings: {                // Holdings crypto
        "bitcoin_usdt": 0.5,
        "ethereum_usdt": 2.0
    }
}
```

---

## 🎯 Validazioni e Protezioni

### **1. Validazione Prezzi**

```javascript
// Limiti ragionevoli per evitare errori
const MAX_REASONABLE_PRICE = 100000;  // $100k max
const MIN_REASONABLE_PRICE = 0.000001; // $0.000001 min
const MAX_REASONABLE_PNL = 1000000;    // $1M max P&L

// Verifica prezzi anomali
if (currentPrice > MAX_REASONABLE_PRICE || currentPrice < MIN_REASONABLE_PRICE) {
    console.error(`🚨 Prezzo sospetto: $${currentPrice}`);
    return; // Skip aggiornamento
}
```

### **2. Validazione P&L**

```javascript
// Verifica P&L anomali
if (Math.abs(pnl) > MAX_REASONABLE_PNL) {
    console.warn(`⚠️ P&L anomale: $${pnl}`);
    // Ricalcola con prezzo corretto
}
```

### **3. Protezione Race Conditions**

```javascript
// Lock per evitare aggiornamenti concorrenti
const lockKey = `update_pnl_${pos.ticket_id}`;
if (updatePnLLock.has(lockKey)) {
    return; // Skip se già in aggiornamento
}
updatePnLLock.add(lockKey);

// ... aggiornamento ...

updatePnLLock.delete(lockKey);
```

---

## 🔧 Funzioni Chiave

### **1. Aggiornamento P&L Automatico**
- **File**: `backend/routes/cryptoRoutes.js`
- **Linea**: ~4200-4400
- **Frequenza**: Ogni 5 secondi
- **Trigger**: Ciclo principale bot

### **2. Calcolo Performance Analytics**
- **File**: `backend/routes/cryptoRoutes.js`
- **Endpoint**: `GET /api/crypto/performance-analytics`
- **Linea**: ~740-800

### **3. Ricalcolo Balance**
- **File**: `backend/routes/cryptoRoutes.js`
- **Endpoint**: `POST /api/crypto/recalculate-balance`
- **Linea**: ~11200-11300

---

## 📈 Esempi Pratici

### **Esempio 1: LONG Position in Profitto**

```
Symbol: BTC
Type: LONG (buy)
Entry Price: $50,000 USDT
Current Price: $52,000 USDT
Volume: 0.1 BTC
Volume Closed: 0 BTC

Calcolo:
- Remaining Volume = 0.1 - 0 = 0.1 BTC
- P&L = ($52,000 - $50,000) × 0.1 = $200 USDT ✅
- P&L % = (($52,000 - $50,000) / $50,000) × 100 = +4% ✅
```

### **Esempio 2: SHORT Position in Profitto**

```
Symbol: ETH
Type: SHORT (sell)
Entry Price: $3,000 USDT
Current Price: $2,900 USDT
Volume: 1.0 ETH
Volume Closed: 0 ETH

Calcolo:
- Remaining Volume = 1.0 - 0 = 1.0 ETH
- P&L = ($3,000 - $2,900) × 1.0 = $100 USDT ✅
- P&L % = (($3,000 - $2,900) / $3,000) × 100 = +3.33% ✅
```

### **Esempio 3: LONG Position con Chiusura Parziale**

```
Symbol: SOL
Type: LONG (buy)
Entry Price: $100 USDT
Current Price: $110 USDT
Volume: 10 SOL
Volume Closed: 5 SOL (TP1 hit)

Calcolo:
- Remaining Volume = 10 - 5 = 5 SOL
- P&L = ($110 - $100) × 5 = $50 USDT ✅
- P&L % = (($110 - $100) / $100) × 100 = +10% ✅

Nota: Il P&L mostrato è solo sulla parte ancora aperta (5 SOL)
```

---

## 🚨 Troubleshooting

### **Problema: P&L non si aggiorna**
- ✅ Verifica che il bot sia attivo (`is_active = 1` in `bot_settings`)
- ✅ Controlla i log per errori di connessione Binance
- ✅ Verifica che `current_price` sia aggiornato nel database

### **Problema: P&L anomalo (troppo alto/basso)**
- ✅ Verifica `entry_price` nel database
- ✅ Controlla `volume` e `volume_closed`
- ✅ Usa endpoint `/api/crypto/fix-closed-positions-pnl` per correggere

### **Problema: Balance non corrisponde**
- ✅ Usa endpoint `/api/crypto/recalculate-balance` per ricalcolare
- ✅ Verifica posizioni chiuse con `profit_loss` corretto
- ✅ Controlla log per transazioni duplicate

---

## 📚 Riferimenti Codice

| Funzionalità | File | Linea |
|--------------|------|-------|
| Calcolo P&L LONG/SHORT | `cryptoRoutes.js` | 4205-4213 |
| Aggiornamento P&L | `cryptoRoutes.js` | 4318-4321 |
| Performance Analytics | `cryptoRoutes.js` | 740-800 |
| Ricalcolo Balance | `cryptoRoutes.js` | 11202-11300 |
| Validazione Prezzi | `cryptoRoutes.js` | 11104-11180 |
| Trailing Stop Loss | `cryptoRoutes.js` | 4237-4286 |

---

## ✅ Best Practices

1. **Monitora i log** per verificare aggiornamenti P&L
2. **Usa validazioni** per evitare P&L anomali
3. **Ricalcola periodicamente** il balance con `/recalculate-balance`
4. **Verifica prezzi** prima di aprire posizioni
5. **Testa formule** con esempi pratici prima di deployare

---

**Ultimo aggiornamento**: 2025-12-15
**Versione**: 2.0
