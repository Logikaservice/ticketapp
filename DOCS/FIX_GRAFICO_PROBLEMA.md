# 🔧 FIX GRAFICO - Problemi Identificati

## ❌ PROBLEMI

1. **Candele diverse da TradingView**: Stiamo ricreando candele da punti invece di usare OHLC reali
2. **Candele cambiano dopo F5**: Il grouping viene ricalcolato ogni volta

## ✅ SOLUZIONE

1. **Salvare klines OHLC complete** da Binance
2. **Restituire candele OHLC** direttamente al frontend
3. **Nessun grouping dinamico** - usa candele come vengono da Binance
4. **Intervallo fisso** (es. 5m o 15m come TradingView)

---

Procedo con l'implementazione!

