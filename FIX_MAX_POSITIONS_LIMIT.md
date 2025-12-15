# Fix: Limite 2 Posizioni Totali 🔧

## Problema Identificato

Il bot apriva **solo 2 posizioni totali** anche se configurato per aprire fino a 10 posizioni, anche con simboli diversi.

### Causa Root

I parametri di default nel database PostgreSQL (`crypto_db_postgresql.js`) **non includevano** i parametri di Risk Management:
- ❌ `max_positions` (limite totale posizioni)
- ❌ `max_positions_per_group` (limite per gruppo di correlazione)
- ❌ `max_positions_per_symbol` (limite per singolo simbolo)

Quando il bot leggeva i parametri dal database, trovava `undefined` per questi valori e usava fallback incorretti.

### Comportamento Osservato

```javascript
// Il bot leggeva:
params.max_positions  // undefined → fallback sconosciuto → bloccava a 2
```

## Soluzione Implementata

### 1. Aggiornato `crypto_db_postgresql.js`

Aggiunto i parametri mancanti ai valori di default del database:

```javascript
"max_positions": 10,              // Limite totale posizioni
"max_positions_per_group": 6,      // Max per gruppo correlazione
"max_positions_per_symbol": 2      // Max per singolo simbolo
```

### 2. Aggiornato `DEFAULT_PARAMS` in `cryptoRoutes.js`

Completato l'oggetto `DEFAULT_PARAMS` con:

```javascript
max_positions: 10,
max_positions_per_group: 6,
max_positions_per_symbol: 2
```

### 3. Creato Script di Fix per Database Esistente

Script: `backend/scripts/fix-max-positions-limit.js`

Aggiunge automaticamente i parametri mancanti a tutti i record esistenti in `bot_settings`.

## Come Applicare la Fix

### Sulla VPS:

1. **Pull delle modifiche:**
   ```bash
   cd /workspace
   git pull origin main
   ```

2. **Esegui lo script di fix del database:**
   ```bash
   cd backend
   node scripts/fix-max-positions-limit.js
   ```

3. **Riavvia il bot:**
   ```bash
   pm2 restart all
   ```

4. **Verifica nelle impostazioni:**
   - Vai su Bot Settings
   - Controlla che "Max Posizioni" sia impostato a 10 (o il valore desiderato)
   - Se necessario, salva di nuovo le impostazioni

## Verifica Funzionamento

Dopo il fix, il bot dovrebbe:
- ✅ Rispettare il limite configurato (es. 10 posizioni totali)
- ✅ Aprire posizioni su simboli diversi fino al limite
- ✅ Rispettare i sotto-limiti:
  - Max 6 posizioni per gruppo di correlazione (es. BTC+ETH+BNB)
  - Max 2 posizioni per simbolo singolo (es. max 2 su BTC: 1 LONG + 1 SHORT)

## Log di Verifica

Nei log del bot dovresti vedere:

```
🔍 [BOT] BTCUSDT - Hybrid Strategy Check: 2 open positions
   Limits: Max Total=10, Per Group=6, Per Symbol=2
✅ [HYBRID-STRATEGY] LONG APPROVED: OK
```

## File Modificati

1. `/workspace/backend/crypto_db_postgresql.js` - Aggiunto parametri ai default
2. `/workspace/backend/routes/cryptoRoutes.js` - Completato DEFAULT_PARAMS, salvataggio parametri e lettura
3. `/workspace/backend/scripts/fix-max-positions-limit.js` - Script di fix (NUOVO)
4. `/workspace/FIX_MAX_POSITIONS_LIMIT.md` - Documentazione (NUOVO)

### Dettaglio Modifiche cryptoRoutes.js:

- ✅ Aggiunto `max_positions_per_group` e `max_positions_per_symbol` a `DEFAULT_PARAMS`
- ✅ Aggiunto salvataggio di questi parametri nell'endpoint `/bot/parameters` (PUT)
- ✅ Aggiornata funzione `canOpenPositionHybridStrategy` per leggere parametri da options
- ✅ Aggiornate chiamate a `canOpenPositionHybridStrategy` per passare tutti e 3 i parametri:
  - `maxTotalPositions` (limite totale)
  - `maxPerGroup` (limite per gruppo correlazione)
  - `maxPerSymbol` (limite per simbolo singolo)

## Note Importanti

- **Non rimuovere i file SQLite:** Potrebbero servire per test locali
- **Il database PostgreSQL è l'unico usato in produzione** sulla VPS
- **I limiti sono configurabili** tramite l'interfaccia Bot Settings
- **Dopo un reset** i valori di default saranno ora corretti

## Risolto

✅ Il bot ora rispetta correttamente i limiti configurati e può aprire fino a 10 posizioni totali (o il valore impostato dall'utente).
