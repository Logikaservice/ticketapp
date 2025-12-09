# 📋 Guida Normalizzazione Database: EUR → USDT

## 🎯 Scopo

Normalizzare tutti i dati nel database da EUR a USDT per evitare mismatch di valuta che causano segnali errati.

---

## 📝 Script Disponibili

### 1. `migrate-eur-to-usdt.js`
**Cosa fa:**
- Converte portfolio balance
- Converte posizioni aperte (entry_price, current_price, stop_loss, take_profit, etc.)
- Converte posizioni chiuse
- Converte trades

**Quando eseguirlo:**
- Prima volta che passi da EUR a USDT
- Se hai già eseguito questo script, puoi saltarlo

### 2. `normalize-klines-to-usdt.js` ⭐ **IMPORTANTE**
**Cosa fa:**
- Verifica automaticamente se le klines sono in EUR o USDT confrontando con Binance
- Converte solo se necessario (evita conversioni duplicate)
- Normalizza tutte le klines (open_price, high_price, low_price, close_price)
- Normalizza price_history

**Quando eseguirlo:**
- **SEMPRE** dopo migrate-eur-to-usdt.js
- Quando sospetti mismatch di valuta nelle klines
- Dopo aver cambiato la logica di conversione nel codice

---

## 🚀 Come Eseguire

### Opzione 1: Esegui entrambi gli script (Raccomandato)

```bash
# 1. Vai nella cartella backend
cd backend

# 2. Esegui prima la migrazione generale
node scripts/migrate-eur-to-usdt.js

# 3. Poi normalizza klines e price_history
node scripts/normalize-klines-to-usdt.js
```

### Opzione 2: Solo normalizzazione klines

Se hai già eseguito `migrate-eur-to-usdt.js` in passato, esegui solo:

```bash
cd backend
node scripts/normalize-klines-to-usdt.js
```

---

## 🔍 Cosa Fa lo Script di Normalizzazione

### 1. **Verifica Automatica**
Per ogni simbolo nel database:
- Ottiene prezzo corrente da Binance (USDT)
- Confronta con ultima kline nel database
- Se differenza > 10% e prezzo DB è più basso → **È in EUR, va convertito**
- Se differenza < 10% → **Già in USDT, salta**

### 2. **Conversione Intelligente**
- Converte solo se necessario
- Usa tasso di conversione reale da Binance (EURUSDT)
- Fallback a 1.08 se Binance non disponibile

### 3. **Normalizzazione Completa**
- **Klines**: open_price, high_price, low_price, close_price
- **Price History**: price

---

## 📊 Output Atteso

```
🔄 [NORMALIZZAZIONE] Inizio normalizzazione klines e price_history da EUR a USDT...

📊 [NORMALIZZAZIONE] Recupero tasso di conversione EUR/USDT...
✅ [NORMALIZZAZIONE] Tasso di conversione: 1 EUR = 1.0800 USDT

🔍 [NORMALIZZAZIONE] Analisi simboli nel database...
   📊 Trovati 15 simboli da analizzare

📈 [RENDER] Analisi in corso...
   🔍 RENDER: DB=1.3000, Binance=1.4200 → RILEVATO EUR (diff: 8.45%)
   🔄 Conversione in corso...
   ✅ Klines: 1200 convertite
   ✅ Price History: 500 convertiti

📈 [BITCOIN] Analisi in corso...
   ✅ BITCOIN: DB=95000.0000, Binance=95000.0000 → GIÀ IN USDT (diff: 0.01%)
   ✅ Già normalizzato, salto

...

✅ [NORMALIZZAZIONE] Normalizzazione completata!

📊 Riepilogo:
   - Tasso di conversione: 1 EUR = 1.0800 USDT
   - Simboli analizzati: 15
   - Simboli convertiti: 8
   - Simboli già normalizzati/saltati: 7
   - Klines convertite: 9600
   - Price History convertiti: 4200

🎉 Tutte le klines e price_history sono state normalizzate a USDT!
```

---

## ⚠️ Note Importanti

1. **Backup del Database**: Prima di eseguire, fai un backup del database!
   ```bash
   cp crypto.db crypto.db.backup
   ```

2. **Bot Fermo**: Ferma il bot prima di eseguire gli script per evitare conflitti

3. **Tempo di Esecuzione**: 
   - `migrate-eur-to-usdt.js`: ~1-2 minuti
   - `normalize-klines-to-usdt.js`: ~5-10 minuti (dipende da quanti simboli e klines)

4. **Verifica Post-Esecuzione**:
   - Controlla che i prezzi nel dashboard siano coerenti con Binance
   - Verifica che i segnali del bot siano corretti

---

## 🔧 Risoluzione Problemi

### Errore: "Impossibile ottenere tasso da Binance"
- Lo script usa fallback (1.08)
- Verifica connessione internet
- Riprova più tardi

### Errore: "Impossibile ottenere prezzo Binance per SYMBOL"
- Il simbolo potrebbe non esistere su Binance
- Lo script salta automaticamente quel simbolo
- Verifica manualmente nel database

### Prezzi ancora errati dopo normalizzazione
- Verifica che il bot non stia ancora convertendo a runtime
- Controlla che `getSymbolPrice()` restituisca USDT (non EUR)
- Esegui di nuovo lo script

---

## ✅ Checklist Post-Normalizzazione

- [ ] Tutti i prezzi nel dashboard sono in USDT
- [ ] I prezzi corrispondono a Binance
- [ ] I segnali del bot sono corretti
- [ ] Le posizioni aperte hanno prezzi corretti
- [ ] Il P&L è calcolato correttamente

---

## 🎉 Risultato Atteso

Dopo la normalizzazione:
- ✅ Tutte le klines sono in USDT
- ✅ Tutti i price_history sono in USDT
- ✅ Nessun mismatch di valuta
- ✅ Segnali del bot corretti
- ✅ Nessuna conversione a runtime necessaria
