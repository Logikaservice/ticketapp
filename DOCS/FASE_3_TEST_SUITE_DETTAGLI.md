# 🧪 FASE 3: TEST SUITE - Dettagli Completi

## 🎯 OBIETTIVO

Creare una **suite di test completa** per garantire che:
- Tutti gli indicatori funzionino correttamente
- La logica dei segnali sia corretta
- Il sistema funzioni su dati storici reali
- Non ci siano bug o comportamenti inattesi

---

## 📋 1. UNIT TESTS - Test di ogni Indicatore

### 1.1 Test RSI
```javascript
test('RSI calculation with known data', () => {
  // Dati di test con RSI noto
  const prices = [100, 102, 101, 103, 105, 104, 106, ...];
  const expectedRSI = 65.5; // Valore calcolato manualmente
  
  const rsi = calculateRSI(prices, 14);
  expect(rsi).toBeCloseTo(expectedRSI, 1);
});

test('RSI returns null with insufficient data', () => {
  const prices = [100, 102]; // Meno di 15 valori
  const rsi = calculateRSI(prices, 14);
  expect(rsi).toBeNull();
});

test('RSI handles edge cases (all gains, all losses)', () => {
  // Test con solo guadagni (RSI = 100)
  // Test con solo perdite (RSI = 0)
});
```

### 1.2 Test MACD
```javascript
test('MACD calculation with known values', () => {
  const prices = [/* dati di test */];
  const macd = calculateMACD(prices);
  
  expect(macd.macdLine).toBeCloseTo(expectedMACD, 2);
  expect(macd.signalLine).toBeCloseTo(expectedSignal, 2);
  expect(macd.histogram).toBeCloseTo(expectedHistogram, 2);
});

test('MACD bullish/bearish detection', () => {
  // Test quando MACD > Signal (bullish)
  // Test quando MACD < Signal (bearish)
});
```

### 1.3 Test Bollinger Bands
```javascript
test('Bollinger Bands calculation', () => {
  const prices = [/* dati di test */];
  const bands = calculateBollingerBands(prices, 20, 2);
  
  expect(bands.upper).toBeGreaterThan(bands.middle);
  expect(bands.middle).toBeGreaterThan(bands.lower);
  expect(bands.upper - bands.lower).toBeCloseTo(4 * stdDev, 2);
});

test('Price at upper/lower band detection', () => {
  // Test quando prezzo tocca upper band
  // Test quando prezzo tocca lower band
});
```

### 1.4 Test EMA
```javascript
test('EMA vs SMA comparison', () => {
  const prices = [/* dati */];
  const ema = calculateEMA(prices, 10);
  const sma = calculateSMA(prices, 10);
  
  // EMA dovrebbe essere più reattiva
  expect(ema).toBeDefined();
  expect(ema).not.toBe(sma);
});
```

### 1.5 Test Divergenze RSI
```javascript
test('Bullish Divergence detection', () => {
  // Prezzo: minimi decrescenti
  // RSI: minimi crescenti
  const divergence = detectRSIDivergence(prices, rsiValues);
  expect(divergence.type).toBe('bullish');
  expect(divergence.strength).toBeGreaterThan(60);
});

test('Bearish Divergence detection', () => {
  // Prezzo: massimi crescenti
  // RSI: massimi decrescenti
  const divergence = detectRSIDivergence(prices, rsiValues);
  expect(divergence.type).toBe('bearish');
});
```

---

## 🔗 2. INTEGRATION TESTS - Test Logica Segnali

### 2.1 Test: SHORT bloccato se prezzo sale
```javascript
test('SHORT signal blocked when price is rising', () => {
  const priceHistory = [
    { price: 80000, timestamp: '2024-01-01' },
    { price: 80100, timestamp: '2024-01-02' }, // Prezzo sale
    { price: 80200, timestamp: '2024-01-03' }  // Prezzo sale ancora
  ];
  
  const signal = generateSignal(priceHistory);
  
  // Anche con RSI alto, SHORT NON deve essere generato
  expect(signal.direction).not.toBe('SHORT');
  expect(signal.reasons).toContain(expect.stringContaining('Price still rising'));
});
```

### 2.2 Test: LONG bloccato se trend bearish
```javascript
test('LONG signal blocked when trend is bearish', () => {
  // Dati con trend bearish forte
  const signal = generateSignal(bearishPriceHistory);
  
  expect(signal.direction).not.toBe('LONG');
});
```

### 2.3 Test: Sistema Multi-Conferma
```javascript
test('Signal requires minimum confirmations', () => {
  // Segnale con solo 2 conferme (non sufficiente)
  const weakSignal = generateSignal(weakData);
  expect(weakSignal.direction).toBe('NEUTRAL');
  expect(weakSignal.confirmations).toBeLessThan(3);
  
  // Segnale con 3+ conferme (valido)
  const strongSignal = generateSignal(strongData);
  expect(strongSignal.confirmations).toBeGreaterThanOrEqual(3);
});
```

### 2.4 Test: SHORT richiede più conferme
```javascript
test('SHORT requires more confirmations than LONG', () => {
  // LONG: min 3 conferme
  // SHORT: min 4 conferme
  
  const longSignal = generateSignal(longData);
  expect(longSignal.confirmations).toBeGreaterThanOrEqual(3);
  
  const shortSignal = generateSignal(shortData);
  expect(shortSignal.confirmations).toBeGreaterThanOrEqual(4);
});
```

---

## 📊 3. BACKTEST - Test su Dati Storici Reali

### 3.1 Backtest su Periodo Recente
```javascript
test('Backtest on 3 months historical data', async () => {
  const historicalData = await loadHistoricalData('2024-01-01', '2024-03-31');
  
  const results = await runBacktest(historicalData, {
    initialCapital: 250,
    tradeSize: 50,
    strategy: 'RSI_Strategy_Professional'
  });
  
  // Verifiche performance
  expect(results.winRate).toBeGreaterThan(0.55); // > 55%
  expect(results.profitFactor).toBeGreaterThan(1.5);
  expect(results.maxDrawdown).toBeLessThan(0.20); // < 20%
  expect(results.totalTrades).toBeGreaterThan(10);
});
```

### 3.2 Metriche Calcolate
- **Win Rate**: % di trade vincenti
- **Profit Factor**: Profitti totali / Perdite totali
- **Max Drawdown**: Massima perdita da picco
- **Sharpe Ratio**: Risk-adjusted return
- **Average Win/Loss**: Media vincite vs perdite
- **Total P&L**: Profitto/perdita totale

### 3.3 Backtest Multi-Periodo
```javascript
test('Backtest across different market conditions', () => {
  // Bull market
  // Bear market
  // Sideways market
  // High volatility period
  // Low volatility period
});
```

---

## 🎲 4. EDGE CASES - Casi Limite

### 4.1 Mercato Laterale (Sideways)
```javascript
test('System behavior in sideways market', () => {
  // Prezzo oscilla senza trend chiaro
  // Il sistema NON deve aprire troppi trade
  // Deve aspettare trend chiaro
});
```

### 4.2 Alta Volatilità
```javascript
test('System handles high volatility', () => {
  // Prezzo con movimenti molto grandi
  // Stop Loss devono essere appropriati
  // Non deve over-trade
});
```

### 4.3 Gap di Prezzo
```javascript
test('System handles price gaps', () => {
  // Gap tra candele (weekend, eventi)
  // Il sistema deve gestire correttamente
});
```

### 4.4 Volume Anomalo
```javascript
test('System handles abnormal volume', () => {
  // Volume molto alto o molto basso
  // Deve riconoscere e gestire
});
```

### 4.5 Dati Mancanti
```javascript
test('System handles missing data', () => {
  // Cosa succede se mancano alcuni prezzi?
  // Il sistema deve essere robusto
});
```

---

## 🛠️ STRUTTURA IMPLEMENTAZIONE

### File di Test
```
backend/tests/
  ├── unit/
  │   ├── rsi.test.js
  │   ├── macd.test.js
  │   ├── bollinger.test.js
  │   ├── ema.test.js
  │   └── divergence.test.js
  ├── integration/
  │   ├── signal-generation.test.js
  │   ├── multi-confirmation.test.js
  │   └── trend-validation.test.js
  ├── backtest/
  │   ├── historical-backtest.test.js
  │   └── performance-metrics.test.js
  └── edge-cases/
      ├── sideways-market.test.js
      ├── high-volatility.test.js
      └── data-quality.test.js
```

### Strumenti di Test
- **Jest**: Framework di test per Node.js
- **Supertest**: Per test API
- **Mock Data**: Dati di test conosciuti

---

## ✅ CRITERI DI SUCCESSO

### Unit Tests
- ✅ Coverage > 90%
- ✅ Tutti gli indicatori testati
- ✅ Edge cases coperti

### Integration Tests
- ✅ Logica segnali verificata
- ✅ Protezioni funzionanti
- ✅ Multi-conferma rigorosa

### Backtest
- ✅ Win Rate > 55%
- ✅ Profit Factor > 1.5
- ✅ Max Drawdown < 20%
- ✅ Testato su 3-6 mesi di dati

---

## 🎯 BENEFICI

1. **Confindenza**: Sappiamo che tutto funziona
2. **Prevenzione Bug**: Catch errori prima che vadano live
3. **Documentazione**: I test documentano come funziona
4. **Refactoring Sicuro**: Possiamo modificare senza paura
5. **Performance**: Verifichiamo che il sistema sia profittevole

---

**STATO**: 📋 FASE 3 DEFINITA - PRONTA PER IMPLEMENTAZIONE

