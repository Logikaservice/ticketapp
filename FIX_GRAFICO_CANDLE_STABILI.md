# 🔧 FIX GRAFICO: Candele Instabili - Usare Klines OHLC Reali da Binance

## ❌ PROBLEMA ATTUALE

1. **Backend** scarica klines OHLC da Binance
2. **Ma salva solo Close price** nel database
3. **Frontend** ricrea candele approssimative da punti singoli
4. **Risultato**: Candele instabili, diverse da TradingView, cambiano dopo F5

## ✅ SOLUZIONE

1. **Salvare klines OHLC complete** (Open, High, Low, Close, Volume)
2. **Restituire candele OHLC reali** al frontend
3. **Usare candele direttamente** senza grouping dinamico
4. **Intervallo fisso** (es. 5 minuti o 15 minuti come TradingView)

---

## 🛠️ IMPLEMENTAZIONE

### Step 1: Nuova Tabella per Klines
```sql
CREATE TABLE IF NOT EXISTS klines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    interval TEXT NOT NULL, -- '1m', '5m', '15m', '1h', etc.
    open_time INTEGER NOT NULL, -- Unix timestamp
    open REAL NOT NULL,
    high REAL NOT NULL,
    low REAL NOT NULL,
    close REAL NOT NULL,
    volume REAL NOT NULL,
    close_time INTEGER NOT NULL,
    UNIQUE(symbol, interval, open_time)
);
```

### Step 2: Salvare Klines Complete
- Quando scarichiamo da Binance, salviamo OHLC completo
- Non solo close price

### Step 3: Endpoint Restituisce Candele OHLC
- `/api/crypto/history` restituisce array di candele OHLC
- Non punti singoli

### Step 4: Frontend Usa Candele Direttamente
- Nessun grouping dinamico
- Candele sono stabili e identiche a TradingView

---

**STATO**: 🔄 IMPLEMENTAZIONE IN CORSO

