# 📋 Istruzioni: Esecuzione Script Verifica Klines

## 🎯 Comando da Eseguire sul VPS

```bash
cd /var/www/ticketapp/backend
node scripts/verifica-klines-ricreate.js
```

---

## 📊 Cosa Verifica lo Script

Lo script verifica:

1. **Simboli non validi in `bot_settings`**
   - Cerca entry in `bot_settings` per simboli che NON sono presenti in `SYMBOL_TO_PAIR`
   - Questi simboli potrebbero causare la ricreazione di klines

2. **Klines esistenti per simboli non validi**
   - Conta quante klines esistono per simboli non validi
   - Mostra l'ultimo timestamp di aggiornamento

3. **Klines create nelle ultime 24 ore**
   - Verifica se ci sono state ricreazioni recenti
   - Indica quali simboli hanno avuto klines create di recente

4. **Statistiche generali**
   - Numero totale di simboli validi
   - Numero di simboli in `bot_settings`
   - Numero di simboli con klines
   - Numero di simboli non validi con klines

---

## 🔍 Output Atteso

### Se NON ci sono problemi:
```
✅ Nessun simbolo non valido in bot_settings
✅ Nessuna kline per simboli non validi
```

### Se CI SONO problemi:
```
⚠️  TROVATI X simboli NON VALIDI in bot_settings:
   - simbolo1 (is_active: 1, strategy: RSI_Strategy)
   - simbolo2 (is_active: 0, strategy: RSI_Strategy)

🚨 TROVATI Y simboli NON VALIDI con klines:
   📌 simbolo1:
      - Klines totali: 1234
      - Ultimo aggiornamento: 2024-01-15T10:30:00.000Z
      - ⚠️  PRESENTE in bot_settings (is_active: 1)
```

---

## 🛠️ Azioni Successive

### Se vengono trovati simboli non validi:

1. **Pulire `bot_settings`**:
   ```bash
   node scripts/pulisci-bot-settings-non-validi.js
   # (dry-run - mostra cosa verrebbe eliminato)
   
   node scripts/pulisci-bot-settings-non-validi.js --confirm
   # (elimina effettivamente)
   ```

2. **Pulire klines** (se necessario):
   ```bash
   node scripts/pulisci-simboli-non-validi.js --confirm
   ```

---

## ⚠️ Note

- Lo script richiede connessione al database PostgreSQL del VPS
- Assicurarsi che il file `.env` sia configurato correttamente
- Lo script non modifica nulla, è solo in modalità lettura

---

## 🔗 Script Correlati

- `pulisci-bot-settings-non-validi.js` - Elimina entry non valide da `bot_settings`
- `pulisci-simboli-non-validi.js` - Elimina klines e altri dati per simboli non validi
