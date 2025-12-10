# 🔒 REGOLE COMPATIBILITÀ BINANCE REALE

## 📋 REGOLE PER NUOVE FUNZIONALITÀ

Quando aggiungi nuove funzionalità al sistema, verifica sempre:

### ✅ Checklist Compatibilità

1. **Funziona con Binance Spot?**
   - ✅ LONG positions → OK
   - ✅ Stop-Loss/Take-Profit → OK
   - ✅ Trailing Stop → OK (con polling)
   - ✅ Partial Close → OK
   - ❌ SHORT positions → NO (serve Futures)

2. **Richiede Futures?**
   - Se sì, segna come "Futures only" e disabilita per principianti

3. **Exchange-agnostic?**
   - Indicatori tecnici (RSI, MACD, etc.) → OK
   - Risk management → OK
   - Signal generation → OK

4. **API disponibile?**
   - Verifica documentazione Binance prima di implementare

---

## 🚫 COSA NON IMPLEMENTARE

### Funzionalità NON compatibili con Binance Spot:
- ❌ Short positions (senza Futures)
- ❌ Leverage trading (senza Futures)
- ❌ Margin trading (senza Margin account)

### Funzionalità da evitare per principianti:
- ❌ Trading con leverage alto
- ❌ Futures trading (troppo complesso)
- ❌ Margin calls e liquidation

---

## ✅ COSA IMPLEMENTARE

### Funzionalità compatibili e sicure:
- ✅ LONG positions solo
- ✅ Stop-Loss e Take-Profit
- ✅ Trailing Stop (con polling)
- ✅ Partial Close
- ✅ Multi-symbol trading
- ✅ Risk management conservativo

---

## 📝 TEMPLATE PER NUOVE FUNZIONALITÀ

Quando aggiungi una nuova funzionalità, usa questo template:

```javascript
// ✅ COMPATIBILE CON BINANCE REALE: [Descrizione]
// ✅ TODO BINANCE REALE: Quando si passa a Binance reale, aggiungere:
// [Istruzioni per integrazione futura]

// Codice attuale (DEMO)...
```

Esempio:
```javascript
// ✅ COMPATIBILE CON BINANCE REALE: Apertura posizione LONG
// ✅ TODO BINANCE REALE: Quando si passa a Binance reale, aggiungere:
// const binanceClient = getBinanceClient();
// if (binanceClient.mode !== 'demo') {
//     const order = await binanceClient.placeMarketOrder(...);
//     entryPrice = order.price; // Usa prezzo reale
// }

const openPosition = async (...) => {
    // Codice attuale...
}
```

---

## 🎯 PRIORITÀ

1. **Alta priorità**: Funzionalità compatibili con Binance Spot
2. **Media priorità**: Funzionalità che richiedono Futures (segna come "Futures only")
3. **Bassa priorità**: Funzionalità exchange-specific (evita se possibile)

---

## 📊 STATO ATTUALE

- ✅ **95% compatibile** con Binance Spot reale
- ⚠️ **SHORT disabilitato** per Binance Spot (serve Futures)
- ✅ **Tutto il resto** è pronto per Binance reale

---

## 🔄 PROCESSO DI REVISIONE

Prima di commitare nuove funzionalità:

1. Verifica compatibilità con Binance Spot
2. Se richiede Futures, segna chiaramente
3. Aggiungi commenti TODO per integrazione futura
4. Testa in DEMO prima di considerare Binance reale

---

**Regola d'oro**: Se non sei sicuro se una funzionalità è compatibile, chiedi o verifica la documentazione Binance prima di implementare.















