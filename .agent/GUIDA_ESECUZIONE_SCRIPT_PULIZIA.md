# 📋 GUIDA: Quando Eseguire Script di Pulizia

## 🔍 Script Disponibili

### 1. `analizza-simboli-non-validi.js`
**Cosa fa**: Analizza il database per trovare simboli non validi e identificare dove sono presenti.

**Quando eseguirlo**:
- ✅ **PRIMA** di eseguire qualsiasi pulizia (per vedere cosa c'è)
- ✅ Quando sospetti che ci siano simboli non validi
- ✅ Dopo modifiche a `SYMBOL_TO_PAIR`
- ✅ Periodicamente per monitoraggio (es. settimanale)

**Come eseguirlo**:
```bash
cd /var/www/ticketapp/backend
node scripts/analizza-simboli-non-validi.js
```

**Output**: Mostra:
- Simboli non validi trovati
- Dove sono presenti (klines, bot_settings, price_history, ecc.)
- Quando sono stati creati
- Pattern e possibili cause

---

### 2. `pulisci-bot-settings-non-validi.js`
**Cosa fa**: Elimina entry non valide da `bot_settings` per prevenire che il bot cycle le processi.

**Quando eseguirlo**:
- ✅ **DOPO** aver eseguito `analizza-simboli-non-validi.js` e aver visto che ci sono simboli non validi in `bot_settings`
- ✅ Quando il bot cycle crea klines per simboli non validi
- ✅ Dopo aver aggiunto/rimosso simboli da `SYMBOL_TO_PAIR`

**⚠️ IMPORTANTE**: Esegui prima in modalità **dry-run** (senza `--confirm`) per vedere cosa verrà eliminato!

**Come eseguirlo**:
```bash
# 1. PRIMA: Dry-run (vedi cosa verrà eliminato)
cd /var/www/ticketapp/backend
node scripts/pulisci-bot-settings-non-validi.js

# 2. POI: Conferma eliminazione
node scripts/pulisci-bot-settings-non-validi.js --confirm
```

**Output**: 
- Dry-run: Mostra simboli che verranno eliminati (senza eliminarli)
- Con `--confirm`: Elimina le entry e mostra conferma

---

## 📅 QUANDO RIFARLI

### Scenario 1: Prima volta / Verifica iniziale
```bash
# 1. Analizza situazione attuale
node scripts/analizza-simboli-non-validi.js

# 2. Se trova simboli non validi in bot_settings, pulisci
node scripts/pulisci-bot-settings-non-validi.js --confirm
```

### Scenario 2: Dopo modifiche a SYMBOL_TO_PAIR
Se hai aggiunto o rimosso simboli da `SYMBOL_TO_PAIR`:
```bash
# 1. Analizza per vedere se ci sono simboli ora non validi
node scripts/analizza-simboli-non-validi.js

# 2. Pulisci bot_settings se necessario
node scripts/pulisci-bot-settings-non-validi.js --confirm
```

### Scenario 3: Monitoraggio periodico
Esegui settimanalmente o mensilmente:
```bash
# Solo analisi (non modifica nulla)
node scripts/analizza-simboli-non-validi.js
```

Se trova problemi, allora esegui la pulizia.

### Scenario 4: Dopo aver notato klines ricreate
Se noti che klines vengono ricreate per simboli non validi:
```bash
# 1. Verifica situazione
node scripts/verifica-klines-ricreate.js

# 2. Analizza in dettaglio
node scripts/analizza-simboli-non-validi.js

# 3. Pulisci bot_settings
node scripts/pulisci-bot-settings-non-validi.js --confirm
```

---

## ⚠️ ATTENZIONE

1. **SEMPRE eseguire `analizza-simboli-non-validi.js` PRIMA** di `pulisci-bot-settings-non-validi.js`
   - Ti permette di vedere cosa verrà eliminato
   - Ti aiuta a capire se è sicuro procedere

2. **SEMPRE fare dry-run PRIMA** di `--confirm`
   - `node scripts/pulisci-bot-settings-non-validi.js` (senza --confirm)
   - Verifica l'output
   - Poi esegui con `--confirm`

3. **Backup database** (opzionale ma consigliato)
   - Prima di eseguire pulizie importanti, fai backup del database

---

## ✅ CHECKLIST ESECUZIONE

- [ ] Eseguito `analizza-simboli-non-validi.js` per vedere situazione
- [ ] Verificato output e identificato simboli non validi
- [ ] Eseguito `pulisci-bot-settings-non-validi.js` (dry-run)
- [ ] Verificato che i simboli da eliminare siano corretti
- [ ] Eseguito `pulisci-bot-settings-non-validi.js --confirm`
- [ ] Verificato che il bot cycle non processi più simboli non validi

---

## 🔄 FREQUENZA CONSIGLIATA

- **Analisi**: Settimanalmente o dopo modifiche importanti
- **Pulizia**: Solo quando necessario (dopo analisi che mostra problemi)

---

## 📞 Se Qualcosa Va Storto

Se elimini per sbaglio entry valide:
1. Non è un problema critico - il bot creerà nuove entry quando necessario
2. I simboli validi verranno automaticamente aggiunti quando il bot li processa
3. Puoi sempre aggiungere manualmente entry in `bot_settings` se necessario
