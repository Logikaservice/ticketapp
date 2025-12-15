# 🔍 ISTRUZIONI: Debug Klines Ricreate

## 🚨 Problema

Le klines per simboli non validi continuano a essere ricreate anche dopo:
- ✅ Filtro aggiunto nel bot cycle
- ✅ Backend riavviato
- ✅ Pulizia eseguita

## 🔍 Debug Step-by-Step

### Step 1: Verifica che il Filtro Sia Attivo

```bash
# Sul VPS
cd /var/www/ticketapp/backend
grep -A 3 "FIX CRITICO.*Verifica che il simbolo sia valido" routes/cryptoRoutes.js | head -10
```

**Dovresti vedere**:
```javascript
if (!isValidSymbol(symbol)) {
    console.warn(`🚫 [BOT-CYCLE] Simbolo non valido BLOCCATO: ${symbol}...`);
    return;
}
```

### Step 2: Monitora Log in Tempo Reale

```bash
# Monitora log del bot in tempo reale
pm2 logs ticketapp-backend --lines 0 | grep -i "BLOCCATO\|non valido\|algo\|litecoin\|shiba\|sui\|trx\|vet\|xlm"
```

**Cosa cercare**:
- Se vedi `🚫 [BOT-CYCLE] Simbolo non valido BLOCCATO: algo` → Il filtro funziona
- Se NON vedi questi log ma le klines vengono create → Il problema è altrove

### Step 3: Verifica Quando Vengono Create

```bash
# Verifica timestamp ultime klines
psql -U postgres -d crypto_db -c "SELECT symbol, COUNT(*), MAX(close_time) as ultima_kline FROM klines WHERE symbol IN ('algo', 'litecoin', 'shiba', 'sui', 'trx', 'vet', 'xlm') GROUP BY symbol ORDER BY ultima_kline DESC;"
```

**Se le klines vengono create DOPO il riavvio**, significa che qualcosa le sta ancora creando.

### Step 4: Verifica Altri Punti

Se il filtro funziona ma le klines vengono ancora create, potrebbe essere:

1. **WebSocket** - Ma dovrebbe essere protetto
2. **Altri servizi** - DataIntegrityService, KlinesAggregatorService
3. **Script esterni** - update_stale_klines.js

**Verifica**:
```bash
# Cerca tutti i punti che inseriscono klines
grep -r "INSERT INTO klines" /var/www/ticketapp/backend --include="*.js" | grep -v node_modules
```

## 🎯 Possibile Causa

Se `getSymbolPrice()` trova il trading pair in `SYMBOL_MAP_FALLBACK` (es. `trx` → `TRXUSDT`), restituisce un prezzo valido. Poi il bot cycle potrebbe creare klines anche se il simbolo originale non è in `SYMBOL_TO_PAIR`.

**Il filtro dovrebbe bloccare questo**, ma potrebbe non funzionare se:
- Il simbolo viene normalizzato prima del controllo
- Il simbolo viene passato in un formato diverso

## ✅ Soluzione

Con il log sempre visibile aggiunto, ora vedrai nei log se il filtro blocca questi simboli. Se vedi i log "BLOCCATO" ma le klines vengono ancora create, significa che c'è un altro punto che le crea.
