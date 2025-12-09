# 🚨 BUG CRITICO: Mismatch Valuta ADA/EUR

## 📊 Problema Identificato

### Sintomi
- **Entry Price mostrato**: $0.4573
- **Current Price mostrato**: $0.3864  
- **Simbolo**: ADA/EUR
- **P&L**: -7.41% (ma dovrebbe essere molto diverso)

### 🔍 Causa Root

Il sistema sta **mescolando EUR e USDT** per le coppie EUR:

1. **Posizione aperta con prezzo USDT**: Quando il bot apre una posizione su `cardano` (ADAEUR), salva il prezzo in **USDT** (~$0.45)
2. **Grafico mostra EUR**: Il grafico TradingView/Binance mostra **ADAEUR** in EUR (~€0.90-1.00)
3. **Calcolo P&L errato**: Il sistema confronta entry_price USDT con current_price USDT, ma il grafico è in EUR

### 📈 Prezzi Reali (esempio)
- **ADA/USDT**: ~$0.45
- **ADA/EUR**: ~€0.42 (circa $0.45 / 1.08)
- **Conversione**: 1 EUR ≈ 1.08 USDT

### 🐛 Dove Avviene l'Errore

#### 1. Apertura Posizione (`openPosition`)
```javascript
// File: cryptoRoutes.js, linea ~2845
const openPosition = async (symbol, type, volume, entryPrice, ...) => {
    // symbol = 'cardano'
    // tradingPair = SYMBOL_TO_PAIR['cardano'] = 'ADAEUR'
    const tradingPair = SYMBOL_TO_PAIR[symbol] || 'BTCUSDT';
    const isEURPair = tradingPair.endsWith('EUR');
    
    // ❌ PROBLEMA: entryPrice viene da getSymbolPrice() che restituisce USDT
    // Ma per coppie EUR dovrebbe essere in EUR!
    
    // Il codice tenta di convertire EUR→USDT (linea 2851-2885)
    // MA il prezzo è GIÀ in USDT, quindi la conversione è sbagliata!
}
```

#### 2. Fetch Prezzo (`getSymbolPrice`)
```javascript
// Il sistema probabilmente fetcha il prezzo da CoinGecko in USD
// e lo salva come se fosse il prezzo della coppia Binance
// Ma ADAEUR su Binance ha un prezzo diverso da ADA/USD!
```

#### 3. Update P&L (`updatePositionsPnL`)
```javascript
// File: cryptoRoutes.js, linea ~3184
const updatePositionsPnL = async (currentPrice, symbol) => {
    // currentPrice è in USDT (da getSymbolPrice)
    // entry_price è in USDT (salvato all'apertura)
    // MA il grafico mostra EUR!
    
    // Il codice tenta di rilevare e convertire (linea 3196-3220)
    // Ma la logica è difettosa
}
```

## 🎯 Soluzione

### Opzione 1: Usa Solo Coppie USDT (Raccomandato)
**Vantaggi**:
- ✅ Nessuna conversione necessaria
- ✅ Massima liquidità
- ✅ Coerenza con TradingView

**Implementazione**:
1. Cambia `SYMBOL_TO_PAIR['cardano']` da `'ADAEUR'` a `'ADAUSDT'`
2. Usa `cardano_usdt` invece di `cardano` nel Market Scanner
3. Rimuovi tutte le coppie EUR dal sistema

### Opzione 2: Fix Conversione EUR/USDT
**Vantaggi**:
- ✅ Supporta entrambe le coppie
- ✅ Flessibilità

**Implementazione**:
1. **getSymbolPrice**: Deve restituire il prezzo nella valuta corretta (EUR per ADAEUR, USDT per ADAUSDT)
2. **openPosition**: Non deve convertire se il prezzo è già nella valuta corretta
3. **updatePositionsPnL**: Deve usare la stessa valuta di entry_price

### Opzione 3: Salva Valuta nel Database
**Vantaggi**:
- ✅ Massima precisione
- ✅ Supporta qualsiasi coppia

**Implementazione**:
1. Aggiungi colonna `price_currency` a `open_positions` (EUR/USDT/USD)
2. Salva la valuta all'apertura
3. Usa la valuta corretta per calcoli P&L e display

## 🔧 Fix Immediato

### Step 1: Identifica Posizioni Affette
```sql
SELECT ticket_id, symbol, entry_price, current_price, profit_loss
FROM open_positions 
WHERE status = 'open' 
AND (symbol LIKE '%cardano%' OR symbol LIKE '%_eur')
ORDER BY opened_at DESC;
```

### Step 2: Correggi Entry Price
Per ogni posizione EUR, converti entry_price da USDT a EUR:
```javascript
// Se entry_price è in USDT ma dovrebbe essere in EUR
const EUR_TO_USDT_RATE = 1.08;
const correctedEntryPrice = entryPriceUSDT / EUR_TO_USDT_RATE;
```

### Step 3: Usa Solo USDT per Nuove Posizioni
Cambia il mapping per usare solo coppie USDT:
```javascript
// cryptoRoutes.js, linea ~1030
'cardano': 'ADAUSDT',  // Era 'ADAEUR'
```

## 📋 Checklist Verifica

- [ ] Verifica che `getSymbolPrice('cardano')` restituisca prezzo ADAUSDT
- [ ] Verifica che `openPosition` salvi prezzo in USDT
- [ ] Verifica che `updatePositionsPnL` usi USDT per calcoli
- [ ] Verifica che il grafico mostri ADAUSDT (non ADAEUR)
- [ ] Correggi posizioni esistenti con entry_price errato

## 🎯 Raccomandazione Finale

**USA SOLO COPPIE USDT** per evitare confusione e garantire coerenza:
- ✅ Cambia tutti i mapping da EUR a USDT
- ✅ Rimuovi logica di conversione EUR/USDT
- ✅ Usa un'unica valuta (USDT) per tutto il sistema
- ✅ Correggi posizioni esistenti EUR

Questo eliminerà completamente il problema e renderà il sistema più semplice e affidabile.
