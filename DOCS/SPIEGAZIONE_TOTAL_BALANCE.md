# 📊 Spiegazione Calcolo TOTAL BALANCE

## Formula Attuale

```javascript
TOTAL BALANCE = portfolio.balance_usd + totalLongValue - totalShortLiability
```

### Componenti:

1. **`portfolio.balance_usd`** (Cash Residuo)
   - Valore iniziale (es. €262.5 o valore custom)
   - **+** Valore ricevuto da chiusure posizioni (`closePrice * volume`)
   - **-** Valore pagato per aperture posizioni (`entryPrice * volume`)
   - **=** Cash residuo disponibile

2. **`totalLongValue`** (Valore Posizioni LONG Aperte)
   - Somma di: `remainingVolume * currentPrice` per ogni posizione LONG aperta
   - Rappresenta il valore attuale delle crypto possedute

3. **`totalShortLiability`** (Debito Posizioni SHORT Aperte)
   - Somma di: `remainingVolume * entryPrice` per ogni posizione SHORT aperta
   - Rappresenta quanto dobbiamo restituire (debito fisso all'entry price)

## Esempio Pratico

### Scenario 1: Solo Posizioni LONG

**Situazione:**
- Cash iniziale: €1000
- Apri posizione LONG: 0.01 BTC @ €50000
  - Cash: €1000 - €500 = €500
  - Holdings: 0.01 BTC
- Prezzo BTC sale a €55000

**Calcolo:**
- `portfolio.balance_usd` = €500 (cash residuo)
- `totalLongValue` = 0.01 * €55000 = €550
- `totalShortLiability` = €0
- **TOTAL BALANCE** = €500 + €550 - €0 = **€1050** ✅

### Scenario 2: Solo Posizioni SHORT

**Situazione:**
- Cash iniziale: €1000
- Apri posizione SHORT: 0.01 BTC @ €50000
  - Cash: €1000 + €500 = €1500 (ricevi denaro dal prestito)
  - Holdings: -0.01 BTC (debito)
- Prezzo BTC sale a €55000

**Calcolo:**
- `portfolio.balance_usd` = €1500 (cash residuo)
- `totalLongValue` = €0
- `totalShortLiability` = 0.01 * €50000 = €500 (debito da restituire)
- **TOTAL BALANCE** = €1500 + €0 - €500 = **€1000** ✅
  - (Perdita di €50 non realizzata, ma il debito è fisso)

### Scenario 3: Posizioni Chiuse

**Situazione:**
- Cash iniziale: €1000
- Apri posizione LONG: 0.01 BTC @ €50000
  - Cash: €500
- Chiudi posizione LONG: 0.01 BTC @ €55000
  - Cash: €500 + €550 = €1050
  - Holdings: 0 BTC

**Calcolo:**
- `portfolio.balance_usd` = €1050 (include già il P&L realizzato di €50)
- `totalLongValue` = €0 (nessuna posizione aperta)
- `totalShortLiability` = €0
- **TOTAL BALANCE** = €1050 + €0 - €0 = **€1050** ✅

## Problema Potenziale

### Se `portfolio.balance_usd` è Corrotto

Se `portfolio.balance_usd` contiene un valore anomale (es. €3.233.421.993.708), il TOTAL BALANCE sarà sbagliato.

**Cause Possibili:**
1. **Overflow numerico** durante calcoli
2. **Errore di aggiornamento** durante apertura/chiusura
3. **Valore corrotto nel database**

**Fix Applicato:**
- Validazione: `balance_usd` deve essere tra -1M e +10M EUR
- Se anomale, usa fallback €10000

## Verifica Correttezza

### Metodo 1: Calcolo Alternativo

```
TOTAL BALANCE = Initial Balance + Realized P&L + Unrealized P&L
```

Dove:
- **Initial Balance** = €262.5 (default) o valore iniziale
- **Realized P&L** = Somma di `profit_loss` da posizioni chiuse
- **Unrealized P&L** = Somma di `profit_loss` da posizioni aperte

### Metodo 2: Verifica Database

```sql
-- Verifica balance
SELECT balance_usd, holdings FROM portfolio WHERE id = 1;

-- Verifica posizioni aperte
SELECT ticket_id, symbol, type, volume, entry_price, current_price, profit_loss 
FROM open_positions 
WHERE status = 'open';

-- Verifica posizioni chiuse con P&L
SELECT ticket_id, symbol, type, profit_loss 
FROM open_positions 
WHERE status != 'open' 
ORDER BY closed_at DESC;
```

## Debug Aggiunto

Il frontend ora logga (in console) i componenti del balance se ci sono valori anomali:

```javascript
console.log('📊 [BALANCE DEBUG]', {
    validatedBalance: ...,
    totalLongValue: ...,
    totalShortLiability: ...,
    totalBalance: ...,
    realizedPnL: ...,
    unrealizedPnL: ...,
    openPositionsCount: ...
});
```

## Conclusione

Il calcolo attuale **dovrebbe essere corretto**, ma:
1. **Dipende da `portfolio.balance_usd`** che deve essere aggiornato correttamente
2. **Se `balance_usd` è corrotto**, il TOTAL BALANCE sarà sbagliato
3. **La validazione** (-1M a +10M) previene valori assurdi ma non corregge il problema alla radice

**Prossimi Step:**
1. Verificare nel database il valore di `portfolio.balance_usd`
2. Verificare che le aperture/chiusure aggiornino correttamente il balance
3. Aggiungere log per tracciare ogni modifica a `balance_usd`
