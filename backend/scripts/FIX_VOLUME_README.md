# 🔧 Correzione Volumi Sbagliati nelle Posizioni

## Problema Identificato

Alcune posizioni aperte hanno un **volume sbagliato** salvato nel database, causando **P&L incorretti**.

### Causa

Il bot calcola il volume con: `volume = tradeSize / currentPrice`

Se `currentPrice` è sbagliato al momento dell'apertura (es. prezzo di una crypto diversa, API timeout, cache vecchia), il volume salvato è errato.

### Esempio

- **Trade Size configurato**: $100.00
- **Entry Price reale**: $0.02500000 (BONK)
- **Volume CORRETTO**: 100 / 0.02500000 = **4,000 BONK**
- **Volume SALVATO**: 0.001051 BONK ❌ (calcolato con prezzo sbagliato ~$95,147!)

Risultato: P&L completamente sballato perché opera su 0.001051 BONK invece di 4,000 BONK.

---

## 🛠️ Come Correggere

### Opzione 1: Script SQL (Manuale)

1. Connettiti al database PostgreSQL:

```bash
psql -U postgres -d crypto_trading_bot
```

2. Esegui lo script SQL:

```bash
\i /workspace/backend/scripts/fix-wrong-volumes.sql
```

Lo script eseguirà:
1. **ANALISI**: Mostra tutte le posizioni con volume sbagliato (diff > 5%)
2. **CORREZIONE**: Aggiorna `volume`, `profit_loss`, `profit_loss_pct` con valori corretti
3. **VERIFICA**: Mostra le posizioni dopo la correzione

### Opzione 2: Script Node.js (Automatico, richiede pg installato)

```bash
cd /workspace/backend
npm install  # Se necessario
node scripts/fix-wrong-volumes.js
```

Con opzione verbose per vedere anche i volumi corretti:

```bash
node scripts/fix-wrong-volumes.js --verbose
```

---

## 📊 Cosa Fa lo Script

### 1. Identifica posizioni sbagliate

Confronta:
- **Volume attuale** (nel database)
- **Volume corretto** = `trade_size_usdt / entry_price`

Se la differenza è > 5%, la posizione è sbagliata.

### 2. Calcola i valori corretti

```javascript
// Volume corretto
const correctVolume = trade_size_usdt / entry_price;

// P&L corretto
if (type === 'buy') {
    correctPnL = (current_price - entry_price) * correctVolume;
} else {
    correctPnL = (entry_price - current_price) * correctVolume;
}
```

### 3. Aggiorna il database

```sql
UPDATE open_positions
SET 
    volume = trade_size_usdt / entry_price,
    profit_loss = CASE 
        WHEN type = 'buy' THEN (current_price - entry_price) * (trade_size_usdt / entry_price)
        ELSE (entry_price - current_price) * (trade_size_usdt / entry_price)
    END,
    profit_loss_pct = CASE 
        WHEN type = 'buy' THEN ((current_price - entry_price) / entry_price) * 100
        ELSE ((entry_price - current_price) / entry_price) * 100
    END
WHERE status = 'open'
    AND ABS((volume - (trade_size_usdt / entry_price)) / (trade_size_usdt / entry_price) * 100) > 5;
```

---

## 🔍 Verifica Manuale

Per verificare una singola posizione:

```sql
SELECT 
    ticket_id,
    symbol,
    type,
    entry_price,
    trade_size_usdt,
    volume as volume_attuale,
    (trade_size_usdt / entry_price) as volume_corretto,
    ((volume - (trade_size_usdt / entry_price)) / (trade_size_usdt / entry_price) * 100) as diff_pct
FROM open_positions
WHERE ticket_id = 'bonk_buy_1734142800000';  -- Sostituisci con il ticket_id
```

---

## 🚨 Prevenzione Futura

Per evitare che il problema si ripresenti, il bot dovrebbe:

1. **Validare il prezzo** prima di calcolare il volume:
   ```javascript
   const currentPrice = await getSymbolPrice(symbol);
   
   // Verifica che il prezzo sia ragionevole per il simbolo
   if (currentPrice === 0 || currentPrice > 100000) {
       console.error(`⚠️ Prezzo sospetto per ${symbol}: $${currentPrice}`);
       return;  // Non aprire la posizione
   }
   ```

2. **Salvare il prezzo usato per il calcolo**:
   ```javascript
   INSERT INTO open_positions (
       ..., volume, entry_price, price_used_for_volume_calc
   ) VALUES (
       ..., volume, entryPrice, currentPrice  // Salva anche currentPrice
   )
   ```

3. **Log dettagliato** all'apertura:
   ```javascript
   console.log(`Opening ${symbol} position:`);
   console.log(`  Current Price: $${currentPrice}`);
   console.log(`  Trade Size: $${tradeSize}`);
   console.log(`  Calculated Volume: ${volume}`);
   console.log(`  Entry Price: $${entryPrice}`);
   ```

---

## 📝 Note

- Lo script **non chiude** le posizioni, le corregge solo
- I P&L storici in `closed_positions` **non vengono modificati**
- Dopo la correzione, **ricarica il frontend** per vedere i valori aggiornati
- Se una posizione ha `trade_size_usdt = 0` o `entry_price = 0`, viene saltata

---

## ✅ Test

Dopo l'esecuzione, verifica che:

1. Tutte le posizioni aperte hanno `volume ≈ trade_size_usdt / entry_price` (diff < 5%)
2. I P&L mostrati nel frontend sono realistici
3. Il valore "Investito" corrisponde al `trade_size_usdt` configurato

```sql
-- Verifica finale
SELECT 
    symbol,
    type,
    trade_size_usdt,
    entry_price,
    volume,
    (trade_size_usdt / entry_price) as volume_atteso,
    profit_loss,
    profit_loss_pct
FROM open_positions
WHERE status = 'open'
ORDER BY opened_at DESC;
```
