# 🔒 SOLUZIONE: Bloccare Creazione Simboli Non Validi

## 🎯 Problema

Simboli non presenti nella mappa `SYMBOL_TO_PAIR` vengono creati automaticamente nel database e ricreati anche dopo la cancellazione.

## 🔍 Chi Crea i Simboli

Ho identificato **4 punti principali** dove vengono inseriti simboli:

1. **`BinanceWebSocket.js`** (linea ~168-206)
   - Processa ticker da Binance
   - Aggiorna `price_history` e `symbol_volumes_24h`
   - ✅ **GIÀ FILTRATO**: Usa `pairToSymbol` (solo simboli nella mappa)

2. **`DataIntegrityService.js`** (linea ~557, ~617)
   - Rigenera klines e price_history
   - ⚠️ **DA VERIFICARE**: Potrebbe inserire simboli non validi

3. **`cryptoRoutes.js`** (multiple linee)
   - Endpoint `/klines` (linea ~309)
   - Endpoint `/price` (linea ~2464)
   - Bot cycle (linea ~1534, ~3604)
   - ⚠️ **DA VERIFICARE**: Potrebbe inserire simboli non validi

4. **`KlinesAggregatorService.js`** (linea ~207)
   - Aggrega klines da multiple timeframe
   - ⚠️ **DA VERIFICARE**: Potrebbe inserire simboli non validi

## ✅ Soluzione

### Step 1: Creare Helper per Validazione Simboli

Aggiungere in `cryptoRoutes.js` (dopo SYMBOL_TO_PAIR):

```javascript
// ✅ HELPER: Verifica se un simbolo è valido (presente nella mappa)
const isValidSymbol = (symbol) => {
    if (!symbol) return false;
    const normalized = symbol.toLowerCase().trim();
    return SYMBOL_TO_PAIR.hasOwnProperty(normalized);
};

// ✅ HELPER: Ottieni lista simboli validi
const getValidSymbols = () => {
    return Object.keys(SYMBOL_TO_PAIR);
};

// ✅ HELPER: Filtra array di simboli mantenendo solo quelli validi
const filterValidSymbols = (symbols) => {
    return symbols.filter(s => isValidSymbol(s));
};
```

### Step 2: Aggiungere Filtri in Tutti i Punti di Inserimento

#### A. `cryptoRoutes.js` - Endpoint `/price`

```javascript
// Linea ~2464
router.get('/price/:symbol', async (req, res) => {
    const { symbol } = req.params;
    
    // ✅ FIX: Verifica che il simbolo sia valido PRIMA di inserire
    if (!isValidSymbol(symbol)) {
        return res.status(400).json({ 
            error: `Simbolo non valido: ${symbol}. Simboli validi: ${getValidSymbols().slice(0, 10).join(', ')}...` 
        });
    }
    
    // ... resto del codice
});
```

#### B. `cryptoRoutes.js` - Endpoint `/klines`

```javascript
// Linea ~309
// ✅ FIX: Verifica simbolo PRIMA di inserire klines
if (!isValidSymbol(symbol)) {
    console.warn(`⚠️ [KLINES] Simbolo non valido ignorato: ${symbol}`);
    return res.status(400).json({ error: 'Simbolo non valido' });
}
```

#### C. `cryptoRoutes.js` - Bot Cycle (updatePriceHistory)

```javascript
// Linea ~1534, ~3604
// ✅ FIX: Verifica simbolo PRIMA di inserire in price_history
if (!isValidSymbol(symbol)) {
    console.warn(`⚠️ [PRICE-HISTORY] Simbolo non valido ignorato: ${symbol}`);
    return; // Non inserire
}

await dbRun("INSERT INTO price_history (symbol, price) VALUES ($1, $2)", [symbol, price]);
```

#### D. `DataIntegrityService.js`

```javascript
// Linea ~100 (verifyAndRegenerate)
async verifyAndRegenerate(symbol) {
    // ✅ FIX: Verifica simbolo PRIMA di processare
    if (!isValidSymbol(symbol)) {
        log.warn(`Simbolo non valido ignorato: ${symbol}`);
        return { valid: false, reason: 'Symbol not in SYMBOL_TO_PAIR' };
    }
    
    // ... resto del codice
}
```

#### E. `KlinesAggregatorService.js`

```javascript
// Linea ~207
// ✅ FIX: Verifica simbolo PRIMA di inserire klines
if (!isValidSymbol(symbol)) {
    console.warn(`⚠️ [KLINES-AGG] Simbolo non valido ignorato: ${symbol}`);
    return; // Non inserire
}
```

### Step 3: Creare Constraint nel Database

```sql
-- ✅ Creare tabella di simboli validi (whitelist)
CREATE TABLE IF NOT EXISTS valid_symbols (
    symbol TEXT PRIMARY KEY,
    trading_pair TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ✅ Popolare con simboli dalla mappa SYMBOL_TO_PAIR
-- (Eseguire script per inserire tutti i simboli validi)

-- ✅ Creare funzione per verificare validità
CREATE OR REPLACE FUNCTION is_valid_symbol(symbol_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM valid_symbols WHERE symbol = symbol_name);
END;
$$ LANGUAGE plpgsql;

-- ✅ Creare trigger per bloccare inserimenti non validi (OPZIONALE - può essere troppo restrittivo)
-- Meglio filtrare nel codice
```

### Step 4: Script per Pulire Database

```javascript
// backend/scripts/pulisci-simboli-non-validi.js
const { dbAll, dbRun } = require('../crypto_db');
const SYMBOL_TO_PAIR = require('../routes/cryptoRoutes').SYMBOL_TO_PAIR;

const validSymbols = new Set(Object.keys(SYMBOL_TO_PAIR));

async function pulisciSimboliNonValidi() {
    // 1. Trova tutti i simboli nel database
    const allSymbols = await dbAll(`
        SELECT DISTINCT symbol FROM (
            SELECT symbol FROM klines
            UNION
            SELECT symbol FROM price_history
            UNION
            SELECT symbol FROM open_positions
            UNION
            SELECT symbol FROM bot_settings WHERE symbol != 'global'
            UNION
            SELECT symbol FROM symbol_volumes_24h
        ) AS all_symbols
        WHERE symbol IS NOT NULL
    `);

    const invalidSymbols = allSymbols
        .map(r => r.symbol.toLowerCase().trim())
        .filter(s => !validSymbols.has(s));

    console.log(`❌ Simboli non validi trovati: ${invalidSymbols.length}`);
    
    // 2. Elimina da tutte le tabelle
    for (const symbol of invalidSymbols) {
        console.log(`🗑️  Eliminando ${symbol}...`);
        
        await dbRun('DELETE FROM klines WHERE symbol = $1', [symbol]);
        await dbRun('DELETE FROM price_history WHERE symbol = $1', [symbol]);
        await dbRun('DELETE FROM open_positions WHERE symbol = $1', [symbol]);
        await dbRun('DELETE FROM bot_settings WHERE symbol = $1', [symbol]);
        await dbRun('DELETE FROM symbol_volumes_24h WHERE symbol = $1', [symbol]);
        await dbRun('DELETE FROM trades WHERE symbol = $1', [symbol]);
    }
    
    console.log('✅ Pulizia completata');
}
```

## 🚀 Implementazione

### Priorità ALTA

1. ✅ Aggiungere helper `isValidSymbol()` in `cryptoRoutes.js`
2. ✅ Aggiungere filtri in tutti i punti di inserimento
3. ✅ Creare script di pulizia database
4. ✅ Testare che i simboli non validi non vengano più creati

### Priorità MEDIA

5. Creare constraint nel database (opzionale)
6. Aggiungere logging per tracciare tentativi di inserimento non validi
7. Creare dashboard per monitorare simboli nel database

## 📋 Checklist

- [ ] Aggiungere helper `isValidSymbol()` 
- [ ] Filtrare endpoint `/price`
- [ ] Filtrare endpoint `/klines`
- [ ] Filtrare bot cycle (price_history)
- [ ] Filtrare DataIntegrityService
- [ ] Filtrare KlinesAggregatorService
- [ ] Creare script pulizia database
- [ ] Testare che simboli non validi non vengano creati
- [ ] Verificare che simboli validi funzionino correttamente

## 🎯 Risultato Atteso

Dopo l'implementazione:
- ✅ Solo simboli presenti in `SYMBOL_TO_PAIR` verranno inseriti nel database
- ✅ Simboli non validi verranno ignorati con warning
- ✅ Database pulito da simboli non validi
- ✅ Nessun simbolo non valido verrà più creato automaticamente
