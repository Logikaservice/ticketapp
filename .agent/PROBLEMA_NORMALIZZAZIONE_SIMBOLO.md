# 🚨 PROBLEMA: Normalizzazione Simbolo

## 🔍 Analisi

Se non vedi messaggi "BLOCCATO" nei log, significa che il filtro **NON viene chiamato** per questi simboli.

**Possibile causa**: Il simbolo viene **normalizzato** prima di essere salvato nel database.

### Esempio

1. Bot cycle riceve: `trx_eur` (VALIDO)
2. Filtro controlla: `isValidSymbol('trx_eur')` → ✅ PASS
3. Ma quando viene salvato: potrebbe essere normalizzato a `trx` (NON VALIDO)

## 🔧 Verifica Necessaria

### 1. Verifica Come Viene Salvato il Simbolo

Nel codice, quando viene inserita una kline:
```javascript
await dbRun(
    `INSERT INTO klines ... VALUES ($1, ...)`,
    [symbol, ...]  // ← Il simbolo viene salvato così com'è
);
```

**Il simbolo `symbol` viene salvato direttamente** - non viene normalizzato prima dell'INSERT.

### 2. Possibile Problema

Se il simbolo viene passato al bot cycle in un formato (es. `trx_eur`) ma poi viene normalizzato da qualche parte prima di essere salvato (es. `trx`), il filtro non lo bloccherà perché controlla `trx_eur` (valido) ma viene salvato `trx` (non valido).

### 3. Verifica Necessaria

Eseguire sul VPS:
```bash
# Verifica se ci sono klines per varianti
psql -U postgres -d crypto_db -c "SELECT symbol, COUNT(*) FROM klines WHERE symbol LIKE '%trx%' OR symbol LIKE '%xlm%' OR symbol LIKE '%sui%' GROUP BY symbol;"
```

Questo mostrerà se ci sono sia `trx` che `trx_eur` (o altre varianti).

## ✅ Soluzione Possibile

Se il problema è la normalizzazione, bisogna:
1. **Assicurarsi che il simbolo salvato sia quello passato al filtro**
2. **Aggiungere normalizzazione anche nel filtro** (se necessario)
3. **Verificare che non ci sia normalizzazione tra filtro e INSERT**

## 📋 Prossimi Passi

1. Eseguire script di analisi: `node scripts/trova-chi-crea-klines-non-valide.js`
2. Verificare varianti nel database
3. Identificare se c'è normalizzazione del simbolo
