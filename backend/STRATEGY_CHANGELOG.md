# 📊 Trading Strategy Changelog

## 🔄 Strategy Evolution History

---

## **[CURRENT] Strategy v1.0 - RSI + MTF Confirmation** 
**Date:** 2025-12-15 (Before Williams %R Implementation)
**Status:** ✅ STABLE - BACKUP POINT

### Strategy Description
Conservative momentum strategy based on RSI oversold/overbought with Multi-Timeframe confirmation.

### Entry Logic - LONG
```javascript
// Primary Signal (15m)
- RSI < 30 (oversold)
- Volume > average
- EMA crossover

// Multi-Timeframe Confirmation
- 1h trend: bullish (+5 or +10 bonus)
- 4h trend: bullish (+5 or +10 bonus)

// Filters
- ATR in range (0.2% - 5.0%)
- Min volume 24h: 500k USDT
- Min signal strength: 70/100
- Min confirmations: 3
```

### Entry Logic - SHORT
```javascript
// Primary Signal (15m)
- RSI > 70 (overbought)
- Volume > average
- EMA crossover

// Multi-Timeframe Confirmation
- 1h trend: bearish (+5 or +10 bonus)
- 4h trend: bearish (+5 or +10 bonus)

// Filters
- ATR in range (0.2% - 5.0%)
- Min volume 24h: 500k USDT
- Min signal strength: 70/100
- Min confirmations: 4
```

### Indicators Used
1. **RSI (14)** - Primary momentum indicator
2. **EMA (10, 20, 50)** - Trend confirmation
3. **Volume** - Liquidity check
4. **ATR** - Volatility filter
5. **MTF (1h, 4h)** - Higher timeframe confirmation

### Strengths
- ✅ Low false signals (conservative)
- ✅ Multi-timeframe confirmation reduces risk
- ✅ Good for trending markets

### Weaknesses
- ⚠️ Late entry (misses 30-50% of movement)
- ⚠️ Waits for full confirmation
- ⚠️ RSI can stay oversold/overbought for long periods

### Performance Metrics (Before Change)
- Win Rate: ~60-65%
- Avg Profit per Trade: ~2-3%
- Max Drawdown: ~5-8%
- Entry Timing: Late (after 30-50% of movement)

### Backup Files
- `backend/routes/cryptoRoutes.js` (main logic)
- `backend/utils/signalGenerator.js` (RSI calculation)

---

## **[NEXT] Strategy v2.0 - Williams %R + RSI + TSI Momentum**
**Date:** 2025-12-15 (Implementation in Progress)
**Status:** 🚧 IN DEVELOPMENT

### Strategy Description
Momentum-based strategy with early entry using Williams %R for anticipation, RSI for confirmation, and TSI for momentum acceleration detection.

### Key Changes
1. **Add Williams %R (14)** - Early oversold/overbought detection
2. **Add TSI** - Momentum acceleration detection
3. **Lower RSI threshold** - From 30 to 35 (LONG), 70 to 65 (SHORT)
4. **New entry condition** - Williams %R triggers, RSI confirms, TSI validates momentum

### Expected Improvements
- ⚡ Earlier entry (1-2 candles before current strategy)
- 📈 Capture 10-20% more of movement
- 🎯 Better entry timing

### Expected Trade-offs
- ⚠️ Slightly more false signals (5-10% increase)
- ⚠️ Requires more monitoring
- ⚠️ More complex logic

### Rollback Plan
If new strategy underperforms after 7 days:
1. Revert to Strategy v1.0 (this backup)
2. Analyze what went wrong
3. Adjust parameters or abandon v2.0

---

## 📝 Notes for Future Developers

### How to Rollback to v1.0
```bash
# 1. Restore backup files
git checkout <commit-hash-before-v2> -- backend/routes/cryptoRoutes.js
git checkout <commit-hash-before-v2> -- backend/utils/signalGenerator.js

# 2. Restart backend
pm2 restart backend

# 3. Verify strategy in UI
# Check "Analisi Bot" shows RSI-based logic
```

### Testing New Strategies
1. Always create backup point in this file
2. Document expected improvements
3. Set rollback criteria (time + performance)
4. Monitor for at least 7 days
5. Compare metrics with previous strategy

---

## 🔍 Strategy Comparison Matrix

| Metric | v1.0 (RSI) | v2.0 (Williams+RSI+TSI) |
|--------|------------|-------------------------|
| Entry Speed | Late | Early (-1-2 candles) |
| False Signals | Low (~5%) | Medium (~10-15%) |
| Movement Captured | 50-70% | 70-90% |
| Complexity | Low | Medium |
| Win Rate | 60-65% | TBD |
| Avg Profit | 2-3% | TBD |

---

## 📅 Version History

- **v1.0** (2025-12-15): Initial RSI + MTF strategy (STABLE)
- **v2.0** (2025-12-15): Williams %R + RSI + TSI momentum (IN DEVELOPMENT)

