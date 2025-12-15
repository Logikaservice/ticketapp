# 🔍 ANALISI: Origine Simboli Non Validi

## 📊 PUNTI DOVE VENGONO INSERITI SIMBOLI NEL DATABASE

### ✅ PUNTI PROTETTI (hanno filtro `isValidSymbol()`)

1. **Endpoint `/klines`** (cryptoRoutes.js linea ~174)
   - ✅ Filtro: `if (!isValidSymbol(symbol))`
   - Blocca simboli non validi PRIMA di inserire

2. **WebSocket Volume Callback** (cryptoRoutes.js linea ~1586)
   - ✅ Filtro: `if (!isValidSymbol(symbol))`
   - Blocca simboli non validi prima di salvare in `symbol_volumes_24h`

3. **REST API Volume** (cryptoRoutes.js linea ~2160)
   - ✅ Filtro: `if (!isValidSymbol(symbol))`
   - Blocca simboli non validi prima di salvare

4. **update_stale_klines.js** (linea ~123)
   - ✅ Filtro: `isValidSymbol()` check
   - Blocca simboli non validi prima di scaricare e inserire

5. **DataIntegrityService** (linea ~552)
   - ✅ Filtro presente
   - Blocca simboli non validi

6. **KlinesAggregatorService** (linea ~205)
   - ✅ Filtro presente
   - Blocca simboli non validi

### ❌ PUNTI POTENZIALMENTE NON PROTETTI

1. **WebSocket Price Callback** (cryptoRoutes.js linea ~1547)
   - ⚠️ **POTENZIALE PROBLEMA**: Inserisce in `price_history` senza filtro `isValidSymbol()`
   - Il simbolo viene da `pairToSymbol[ticker.s]` che potrebbe non essere valido
   - **Linea**: ~1547 `INSERT INTO price_history`

2. **Bot Cycle - Klines Creation** (cryptoRoutes.js linea ~2589, ~2631)
   - ❌ **NON PROTETTO**: Crea klines senza filtro `isValidSymbol()`
   - Se un simbolo non valido è in `bot_settings`, verrà processato
   - **Linee**: ~2589 (crea candela), ~2631 (MTF candele)

3. **Bot Cycle - Price History** (cryptoRoutes.js linea ~2478)
   - ⚠️ **PROTETTO**: Ha filtro `isValidSymbol()` alla linea ~2477
   - ✅ OK

4. **Endpoint API che accettano simboli dall'esterno**
   - ⚠️ **DA VERIFICARE**: Alcuni endpoint accettano `req.query.symbol` o `req.body.symbol` senza validazione
   - Endpoint trovati:
     - `/api/trades` (linea ~1178) - accetta `symbol` da `req.body`
     - `/api/positions` (linea ~4989) - accetta `symbol` da `req.body`
     - `/api/close-position` (linea ~5058) - accetta `symbol` da `req.body`
     - `/api/bot-analysis` (linea ~7595) - accetta `symbol` da `req.query`
     - Altri endpoint...

## 🚨 PROBLEMA PRINCIPALE IDENTIFICATO

### 1. WebSocket Price History (POTENZIALE)

**File**: `cryptoRoutes.js` linea ~1547

```javascript
await dbRun(
    `INSERT INTO price_history (symbol, price, timestamp) 
     VALUES ($1, $2, CURRENT_TIMESTAMP)`,
    [symbol, price]
);
```

**Problema**: 
- Il simbolo viene da `pairToSymbol[ticker.s]` che potrebbe non essere valido
- Non c'è filtro `isValidSymbol()` prima dell'INSERT

**Soluzione**: Aggiungere filtro prima dell'INSERT

### 2. Bot Cycle Klines (CONFERMATO)

**File**: `cryptoRoutes.js` linea ~2589, ~2631

**Problema**: 
- Se un simbolo non valido è in `bot_settings` con `is_active = 1`, il bot cycle lo processerà
- Creerà klines senza verificare se il simbolo è valido

**Soluzione**: 
- Aggiungere filtro `isValidSymbol()` all'inizio di `runBotCycleForSymbol()`
- OPPURE: Pulire `bot_settings` da simboli non validi (come richiesto dall'utente)

### 3. Endpoint API (DA VERIFICARE)

Alcuni endpoint accettano simboli dall'esterno senza validazione. Potrebbero inserire dati con simboli non validi.

## 🔧 SOLUZIONI

### Soluzione 1: Aggiungere Filtro WebSocket Price History

```javascript
// Prima dell'INSERT in price_history (linea ~1547)
if (!isValidSymbol(symbol)) {
    return; // Non salvare per simboli non validi
}
```

### Soluzione 2: Pulire bot_settings

Eseguire script per eliminare simboli non validi da `bot_settings`:
```bash
node scripts/pulisci-bot-settings-non-validi.js --confirm
```

### Soluzione 3: Verificare Endpoint API

Aggiungere validazione `isValidSymbol()` a tutti gli endpoint che accettano simboli dall'esterno.

## 📋 PROSSIMI PASSI

1. ✅ Eseguire `analizza-simboli-non-validi.js` per vedere quali simboli ci sono
2. ✅ Identificare da dove provengono (quali tabelle)
3. ✅ Applicare fix appropriati
4. ✅ Verificare che non vengano più creati
