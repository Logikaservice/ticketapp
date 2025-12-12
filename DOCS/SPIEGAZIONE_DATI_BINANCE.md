# 📊 Come Funziona il Sistema: Dati da Binance

## ✅ IL BOT USA BINANCE DIRETTAMENTE

Il bot **NON** usa il grafico per prendere decisioni. Usa **Binance API direttamente**:

```javascript
// Il bot chiama Binance direttamente
const data = await httpsGet(`https://api.binance.com/api/v3/ticker/price?symbol=BTCEUR`);
const currentPrice = parseFloat(data.price); // Prezzo in EUR da Binance
```

## 🔄 Aggiornamento Prezzi

### Backend (Bot)
- **Frequenza**: Ogni 10 secondi (`CHECK_INTERVAL_MS = 10000`)
- **Fonte**: `https://api.binance.com/api/v3/ticker/price?symbol=BTCEUR`
- **Uso**: Il bot usa questo prezzo per:
  - Calcolare segnali (RSI, MACD, Bollinger, etc.)
  - Decidere quando aprire/chiudere posizioni
  - Aggiornare P&L delle posizioni aperte

### Frontend (Grafico)
- **Frequenza**: Ogni 3 secondi
- **Fonte**: `/api/crypto/price/bitcoin?currency=eur` → che chiama Binance
- **Uso**: Mostra il prezzo sul grafico e aggiorna la linea blu

## 📈 Dati Storici (Grafico)

Il grafico usa dati OHLC (candele complete) da Binance:

```javascript
// Backend carica candele da Binance
const binanceUrl = 'https://api.binance.com/api/v3/klines?symbol=BTCEUR&interval=15m&limit=500';
// Salva nella tabella 'klines' del database
// Frontend legge da /api/crypto/history
```

## ⚠️ Perché Potrebbe Esserci una Piccola Differenza?

1. **Timing**: Il bot aggiorna ogni 10 secondi, il grafico ogni 3 secondi
2. **Sincronizzazione**: Potrebbero esserci piccoli ritardi (1-3 secondi)
3. **Fonte dati**: Entrambi usano Binance, ma potrebbero chiamare in momenti leggermente diversi

**La differenza è NORMALE e MINIMA** (pochi centesimi). Il bot usa sempre i dati più recenti da Binance per prendere decisioni.

## ✅ Conclusione

**Il bot USA SEMPRE Binance per le decisioni di trading**, non il grafico. Il grafico è solo per visualizzazione.

