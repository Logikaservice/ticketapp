# 📊 Analisi Calcolo TOTAL BALANCE

## Formula Attuale (Frontend)

```javascript
const totalBalance = validatedBalance + totalLongValue - totalShortLiability;
```

Dove:
- `validatedBalance` = `portfolio.balance_usd` (validato tra -1M e +10M EUR)
- `totalLongValue` = Somma di `remainingVolume * currentPrice` per tutte le posizioni LONG aperte
- `totalShortLiability` = Somma di `remainingVolume * entryPrice` per tutte le posizioni SHORT aperte

## Problema Identificato

### Come Funziona l'Apertura/Chiusura Posizioni

**Quando si APRE una posizione LONG (buy):**
```javascript
balance -= entryPrice * volume;  // Decrementa cash
holdings[symbol] += volume;       // Aggiunge crypto
```

**Quando si CHIUDE una posizione LONG (buy):**
```javascript
balance += closePrice * remainingVolume;  // Aggiunge cash dalla vendita
holdings[symbol] -= remainingVolume;       // Rimuove crypto
```

**Quando si APRE una posizione SHORT (sell):**
```javascript
balance += entryPrice * volume;  // Aggiunge cash (prestito)
holdings[symbol] -= volume;      // Rimuove crypto (debito)
```

**Quando si CHIUDE una posizione SHORT (sell):**
```javascript
balance -= closePrice * remainingVolume;  // Restituisce cash
holdings[symbol] += remainingVolume;       // Restituisce crypto
```

## Calcolo Corretto del TOTAL BALANCE

Il TOTAL BALANCE dovrebbe rappresentare l'**Equity Totale** (valore netto del portfolio):

```
TOTAL BALANCE = Cash Residuo + Valore Attuale Posizioni Aperte
```

### Per Posizioni LONG:
- Cash residuo: `portfolio.balance_usd` (già aggiornato con chiusure)
- Valore posizioni LONG aperte: `remainingVolume * currentPrice`
- **Totale LONG**: `balance_usd + totalLongValue`

### Per Posizioni SHORT:
- Cash residuo: `portfolio.balance_usd` (già aggiornato con chiusure)
- Debito SHORT: `remainingVolume * entryPrice` (quanto dobbiamo restituire)
- **Totale SHORT**: `balance_usd - totalShortLiability`

### Formula Finale:
```
TOTAL BALANCE = portfolio.balance_usd + totalLongValue - totalShortLiability
```

## Problema Potenziale

Il calcolo attuale **dovrebbe essere corretto**, MA:

1. **`portfolio.balance_usd`** dovrebbe contenere:
   - Cash iniziale
   - + Valore ricevuto da chiusure posizioni (closePrice * volume)
   - - Valore pagato per aperture posizioni (entryPrice * volume)

2. **Se `portfolio.balance_usd` è corrotto o non aggiornato correttamente**, il TOTAL BALANCE sarà sbagliato.

3. **Il P&L realizzato** (da posizioni chiuse) dovrebbe essere già incluso in `portfolio.balance_usd` attraverso le chiusure.

## Verifica Necessaria

1. **Verificare `portfolio.balance_usd` nel database:**
   ```sql
   SELECT balance_usd, holdings FROM portfolio WHERE id = 1;
   ```

2. **Verificare se le chiusure aggiornano correttamente:**
   - Quando si chiude una posizione, `balance_usd` dovrebbe essere aggiornato
   - Il P&L realizzato è la differenza tra `closePrice` e `entryPrice`

3. **Verificare se le aperture aggiornano correttamente:**
   - Quando si apre una posizione, `balance_usd` dovrebbe essere decrementato

## Possibile Bug

Se `portfolio.balance_usd` mostra un valore anomale (es. €3.233.421.993.708), potrebbe essere:
- Un errore di calcolo durante apertura/chiusura
- Un overflow numerico
- Un valore corrotto nel database

## Soluzione

1. **Validare `portfolio.balance_usd`** (già fatto con validazione -1M a +10M)
2. **Verificare che le aperture/chiusure aggiornino correttamente** il balance
3. **Aggiungere log** per tracciare ogni modifica a `balance_usd`
4. **Calcolare TOTAL BALANCE in modo alternativo** per verificare:
   ```
   TOTAL BALANCE = Initial Balance + Realized P&L + Unrealized P&L
   ```
   Dove:
   - Initial Balance = €262.5 (default) o valore iniziale
   - Realized P&L = Somma di `profit_loss` da posizioni chiuse
   - Unrealized P&L = Somma di `profit_loss` da posizioni aperte
