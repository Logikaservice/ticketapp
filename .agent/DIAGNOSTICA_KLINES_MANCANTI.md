# 🔍 DIAGNOSTICA: Klines Mancanti per Simboli Validi

## 📊 PROBLEMA IDENTIFICATO

Dal file `output.txt` risulta che **26 simboli validi** hanno dati completamente vuoti:
- `bitcoin`, `ethereum`, `polkadot`, `polygon`, `chainlink`, ecc.
- Problemi: `price=0`, `no RSI`, `strength=0`, `no MTF`

## 🔍 POSSIBILI CAUSE

### 1. **Normalizzazione Simboli**
Il bot cycle potrebbe processare simboli in un formato (es: `bitcoin`) ma le klines potrebbero essere salvate in un altro formato (es: `bitcoin_usdt`).

**Verifica necessaria:**
- Come viene normalizzato il simbolo quando viene salvato nel database?
- Il simbolo passato a `runBotCycleForSymbol()` corrisponde a quello salvato nelle klines?

### 2. **Simboli Non Presenti in bot_settings**
Se un simbolo non è in `bot_settings`, potrebbe non essere processato dal bot cycle.

**Verifica necessaria:**
- I simboli con problemi sono presenti in `bot_settings`?
- Hanno `is_active = 1`?

### 3. **Bot Cycle Non Crea Klines**
Il bot cycle potrebbe non creare klines per questi simboli a causa di:
- Prezzo non disponibile (`currentPrice = 0`)
- Errori durante la creazione
- Simboli non validi (ma questi DOVREBBERO essere validi)

**Verifica necessaria:**
- Ci sono errori nei log del bot?
- Il bot cycle viene eseguito per questi simboli?

### 4. **Mapping SYMBOL_TO_PAIR**
I simboli potrebbero non essere correttamente mappati in `SYMBOL_TO_PAIR`.

**Verifica necessaria:**
- I simboli sono presenti in `SYMBOL_TO_PAIR`?
- Il mapping è corretto?

## 🛠️ SCRIPT DI DIAGNOSTICA CREATO

Ho creato `diagnostica-klines-mancanti.js` che verifica:

1. ✅ **Klines esistenti** - Conta klines per ogni simbolo e varianti
2. ✅ **Mapping SYMBOL_TO_PAIR** - Verifica se i simboli sono mappati correttamente
3. ✅ **Normalizzazione** - Cerca varianti del simbolo nel database
4. ✅ **bot_settings** - Verifica se i simboli sono presenti e attivi
5. ✅ **Ultime klines create** - Verifica se ci sono klines create nelle ultime 24 ore
6. ✅ **Top simboli** - Confronta con simboli che hanno più klines

## 📋 COME ESEGUIRE LA DIAGNOSTICA

```bash
# Sul VPS
cd /var/www/ticketapp/backend
node scripts/diagnostica-klines-mancanti.js
```

## 🔧 POSSIBILI SOLUZIONI

### Soluzione 1: Normalizzazione Simboli
Se il problema è la normalizzazione, bisogna:
- Verificare come viene salvato il simbolo nel database
- Assicurarsi che il simbolo processato dal bot corrisponda a quello salvato

### Soluzione 2: Aggiungere Entry in bot_settings
Se i simboli non sono in `bot_settings`:
- Aggiungere entry per simboli mancanti
- Impostare `is_active = 1` se necessario

### Soluzione 3: Scaricare Klines Storiche
Se le klines mancano completamente:
- Eseguire `update_stale_klines.js` per scaricare klines storiche
- Verificare che i simboli siano correttamente mappati

### Soluzione 4: Verificare Log Bot
Se ci sono errori:
- Controllare log del bot per errori durante creazione klines
- Verificare se `currentPrice` è disponibile per questi simboli

## 📝 PROSSIMI PASSI

1. ✅ Eseguire `diagnostica-klines-mancanti.js` sul VPS
2. ✅ Analizzare i risultati
3. ✅ Identificare la causa specifica
4. ✅ Applicare la soluzione appropriata
