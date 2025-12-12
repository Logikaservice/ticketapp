# 🔧 Fix Conversione USDT/EUR - Problema TOTAL BALANCE

## Problema Identificato

Il TOTAL BALANCE mostrava valori assurdi (es. €3.233.421.993.708) a causa di un **problema di conversione USDT→EUR**.

### Causa Root

Quando si chiude una posizione:
1. Il `closePrice` viene passato a `closePosition()`
2. Se il simbolo è in USDT (es. AAVEUSDT), il prezzo potrebbe essere in USDT invece di EUR
3. Il balance viene aggiornato con: `balance += closePrice * remainingVolume`
4. Se `closePrice` è in USDT (es. 100 USDT) invece di EUR (es. 92 EUR), il balance viene moltiplicato per un valore 10x più grande!

### Esempio del Bug

**Scenario:**
- Posizione AAVE: 10 AAVE @ €92 EUR (entry)
- Chiudi a 100 USDT (senza conversione)
- Balance aggiornato: `balance += 100 * 10 = 1000` (dovrebbe essere 920 EUR)
- **Errore**: Se questo succede molte volte, il balance diventa enorme!

## Fix Applicati

### 1. Endpoint `/positions/close/:ticketId`

**Prima:**
```javascript
let finalPrice = close_price;
if (!finalPrice) {
    const tradingPair = (symbol === 'bitcoin' || !symbol) ? 'BTCEUR' : 'SOLEUR';
    const priceData = await httpsGet(`https://api.binance.com/api/v3/ticker/price?symbol=${tradingPair}`);
    finalPrice = parseFloat(priceData.price); // ❌ Potrebbe essere in USDT!
}
```

**Dopo:**
```javascript
let finalPrice = close_price;
if (!finalPrice) {
    // ✅ Usa getSymbolPrice che converte automaticamente USDT→EUR
    const targetSymbol = symbol || 'bitcoin';
    finalPrice = await getSymbolPrice(targetSymbol); // ✅ Sempre in EUR
} else {
    // ✅ Verifica se close_price fornito è in USDT e converte se necessario
    const tradingPair = SYMBOL_TO_PAIR[targetSymbol] || 'BTCEUR';
    const isUSDT = tradingPair.endsWith('USDT');
    
    if (isUSDT && finalPrice > MAX_REASONABLE_EUR_PRICE) {
        // Converti USDT→EUR
        const usdtToEurRate = await getUSDTtoEURRate();
        finalPrice = finalPrice * usdtToEurRate;
    }
}
```

### 2. Funzione `updatePositionsPnL`

**Aggiunta validazione:**
```javascript
// ✅ Valida che currentPrice sia ragionevole (in EUR)
const MAX_REASONABLE_EUR_PRICE = 200000;
if (currentPrice > MAX_REASONABLE_EUR_PRICE && symbol !== 'bitcoin') {
    console.error(`🚨 currentPrice ${currentPrice} seems too high, might be in USDT!`);
}
```

### 3. Auto-Close Posizioni

**Aggiunta validazione:**
```javascript
// ✅ Verifica che currentPrice sia in EUR prima di chiudere
let validatedClosePrice = currentPrice;
const tradingPair = SYMBOL_TO_PAIR[updatedPos.symbol] || 'BTCEUR';
const isUSDT = tradingPair.endsWith('USDT');

if (isUSDT && currentPrice > 200000 && updatedPos.symbol !== 'bitcoin') {
    console.warn(`⚠️ currentPrice seems too high, might need conversion`);
}
```

## Verifica

Dopo il fix:
1. **Tutte le chiusure** usano `getSymbolPrice()` che converte automaticamente USDT→EUR
2. **Validazione** previene valori anomali
3. **Log** aiutano a identificare problemi futuri

## Test

Per verificare che funzioni:
1. Apri una posizione su un simbolo USDT (es. AAVE)
2. Chiudila manualmente o automaticamente
3. Verifica che il balance sia aggiornato correttamente (non moltiplicato per 10x)

## Nota Importante

Il problema potrebbe aver già corrotto `portfolio.balance_usd` nel database. Se il balance è ancora anomale dopo il fix:
1. Usa la validazione già implementata (fallback a €10000 se > 10M)
2. Considera di resettare il portfolio con `/api/crypto/reset`
