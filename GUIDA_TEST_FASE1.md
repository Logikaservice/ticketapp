# 🧪 Guida Test - Fase 1: Sistema Trading Serio

## 🎯 Cosa Testiamo

Stiamo testando:
1. **Risk Manager** - Protegge il capitale
2. **Bidirectional Signals** - Segnali LONG e SHORT
3. **Bot Serio** - Apre posizioni solo con segnali forti e rischio OK

---

## 📋 Preparazione

### 1. Verifica che il sistema sia attivo

**Sul Dashboard:**
- Vai su **Crypto Dashboard**
- Verifica che il grafico si carichi
- Verifica che il prezzo BTC/EUR sia visibile

### 2. Controlla lo stato del bot

**Nel dashboard dovresti vedere:**
- Stato bot: `Attivo` o `Non Attivo`
- Prezzo corrente BTC/EUR
- RSI corrente
- Portafoglio con balance

---

## 🧪 Test 1: Verifica Risk Manager

### Obiettivo
Verificare che il Risk Manager funzioni e blocchi il trading se necessario.

### Come fare:

1. **Apri la console del browser** (F12 → Console)
   - Vedrai i log del bot in tempo reale

2. **Osserva i log ogni 30 secondi** (il bot gira ogni 30 secondi)

3. **Cerca questi messaggi:**

   **✅ Se tutto OK:**
   ```
   ✅ RISK MANAGER: OK - Max Position: €X.XX | Available Exposure: X%
   ```

   **🛑 Se bloccato:**
   ```
   🛑 RISK MANAGER: Trading blocked - [motivo]
   Daily Loss: X% | Exposure: X% | Drawdown: X%
   ```

4. **Cosa aspettarsi:**
   - Se hai poco capitale (< €250) → Blocca
   - Se hai già troppe posizioni aperte (40% esposizione) → Blocca
   - Se hai perso > 5% oggi → Blocca

### ✅ Risultato Atteso:
Dovresti vedere i log del Risk Manager che verifica i limiti ad ogni ciclo.

---

## 🧪 Test 2: Verifica Segnali LONG

### Obiettivo
Verificare che il bot generi segnali LONG quando RSI è oversold.

### Come fare:

1. **Verifica RSI corrente:**
   - Nel dashboard vedi il valore RSI
   - **Segnale LONG** si attiva quando:
     - RSI < 30 (oversold)
     - Trend rialzista
     - Volume alto

2. **Attendi un segnale LONG:**
   - Il bot controlla ogni 30 secondi
   - Quando rileva RSI < 30 + altri indicatori → Genera segnale

3. **Cerca nei log:**

   **Segnale generato:**
   ```
   📡 SIGNAL: LONG | Strength: 65/100 | Reasons: RSI oversold (28.5) + uptrend, High volume (1.8x)
   ```

   **Posizione aperta (se rischio OK):**
   ```
   ✅ BOT LONG: Opened position @ €XX.XX | Size: €XX.XX | Signal: [motivi]
   ```

4. **Verifica sul grafico:**
   - Dovresti vedere un **marker verde ↑** (freccia su)
   - Questo indica apertura LONG

5. **Verifica nella tabella "Open Positions":**
   - Dovresti vedere una nuova posizione
   - Tipo: `BUY` (LONG)
   - Entry Price: Prezzo di apertura
   - Stop Loss: Prezzo sotto entry
   - Take Profit: Prezzo sopra entry

### ✅ Risultato Atteso:
- Segnale LONG generato quando RSI < 30
- Posizione LONG aperta se rischio OK
- Marker verde sul grafico
- Posizione visibile nella tabella

---

## 🧪 Test 3: Verifica Segnali SHORT

### Obiettivo
Verificare che il bot generi segnali SHORT quando RSI è overbought.

### Come fare:

1. **Attendi un segnale SHORT:**
   - **Segnale SHORT** si attiva quando:
     - RSI > 70 (overbought)
     - Trend ribassista
     - Volume alto

2. **Cerca nei log:**

   **Segnale generato:**
   ```
   📡 SIGNAL: SHORT | Strength: 70/100 | Reasons: RSI overbought (72.3) + downtrend, High volume (2.1x)
   ```

   **Posizione aperta (se rischio OK):**
   ```
   ✅ BOT SHORT: Opened position @ €XX.XX | Size: €XX.XX | Signal: [motivi]
   ```

3. **Verifica sul grafico:**
   - Dovresti vedere un **marker rosso ↓** (freccia giù)
   - Questo indica apertura SHORT

4. **Verifica nella tabella "Open Positions":**
   - Dovresti vedere una nuova posizione
   - Tipo: `SELL` (SHORT)
   - Entry Price: Prezzo di apertura
   - Stop Loss: Prezzo SOPRA entry (invertito per SHORT)
   - Take Profit: Prezzo SOTTO entry (invertito per SHORT)

### ✅ Risultato Atteso:
- Segnale SHORT generato quando RSI > 70
- Posizione SHORT aperta se rischio OK
- Marker rosso sul grafico
- Posizione visibile nella tabella con SL/TP invertiti

---

## 🧪 Test 4: Verifica Gestione Posizioni (SL/TP)

### Obiettivo
Verificare che Stop Loss e Take Profit funzionino automaticamente.

### Come fare:

1. **Apri una posizione LONG** (se non ne hai già una)

2. **Osserva la posizione nella tabella:**
   - Nota il prezzo di entry
   - Nota lo Stop Loss (es: entry - 2%)
   - Nota il Take Profit (es: entry + 3%)

3. **Attendi che il prezzo si muova:**

   **Scenario A: Prezzo sale e raggiunge TP**
   - Quando il prezzo sale e raggiunge Take Profit
   - La posizione dovrebbe chiudersi automaticamente
   - Vedrai nei log:
     ```
     ✅ Position closed: TXXXXX @ €XX.XX (Take Profit)
     ```

   **Scenario B: Prezzo scende e raggiunge SL**
   - Quando il prezzo scende e raggiunge Stop Loss
   - La posizione dovrebbe chiudersi automaticamente
     ```
     🛡️ Position closed: TXXXXX @ €XX.XX (Stop Loss)
     ```

4. **Verifica sul grafico:**
   - Dovresti vedere un marker di chiusura
   - Verde se LONG (per chiusura) → marker rosso ↓
   - Rosso se SHORT (per chiusura) → marker verde ↑

### ✅ Risultato Atteso:
- Posizioni si chiudono automaticamente a SL/TP
- Log mostrano il motivo della chiusura
- Marker sul grafico aggiornati

---

## 🧪 Test 5: Verifica Segnali Deboli (Non Apre)

### Obiettivo
Verificare che il bot NON apra posizioni con segnali deboli.

### Come fare:

1. **Osserva i log quando RSI è neutro** (30-70)

2. **Cerca questi messaggi:**

   **Segnale troppo debole:**
   ```
   📡 SIGNAL: NEUTRAL | Strength: 35/100 | Reasons: Signal strength below threshold
   ➡️ BOT: Signal too weak (35/100 < 50) - No action
   ```

   **Segnale debole ma direzionale:**
   ```
   📡 SIGNAL: LONG | Strength: 45/100 | Reasons: ...
   ➡️ BOT: Signal too weak (45/100 < 50) - No action
   ```

### ✅ Risultato Atteso:
- Bot NON apre posizioni se segnale < 50/100
- Log mostrano "No action"
- Nessun marker sul grafico

---

## 🧪 Test 6: Verifica Blocco Risk Manager

### Obiettivo
Verificare che il Risk Manager blocchi il trading quando necessario.

### Come simulare (ATTENZIONE: Solo per test!):

1. **Modifica temporaneamente i limiti** (solo per test):
   - Apri `backend/services/RiskManager.js`
   - Modifica `MAX_DAILY_LOSS_PCT = 0.05` in `0.01` (1%)
   - Riavvia il server

2. **Oppure aspetta condizioni naturali:**
   - Se perdi > 5% in un giorno → Blocco automatico
   - Se esposizione > 40% → Blocco automatico
   - Se drawdown > 10% → Blocco automatico

3. **Cerca nei log:**
   ```
   🛑 RISK MANAGER: Trading blocked - Daily loss limit reached
   Daily Loss: 6.23% | Exposure: 35% | Drawdown: 8%
   ```

### ✅ Risultato Atteso:
- Bot si blocca quando supera i limiti
- Log mostrano chiaramente il motivo
- Nessuna nuova posizione aperta

---

## 📊 Cosa Monitorare

### Console Logs (F12 → Console):

**Ogni 30 secondi vedrai:**
```
🤖 BOT: BTC/EUR=€XX.XX | RSI=XX.XX | Active=true
✅ RISK MANAGER: OK - Max Position: €X.XX | Available Exposure: X%
📡 SIGNAL: LONG/SHORT/NEUTRAL | Strength: X/100 | Reasons: ...
✅ BOT LONG/SHORT: Opened position @ €XX.XX
```

### Dashboard:

1. **Grafico:**
   - Marker verdi ↑ = Aperture LONG
   - Marker rossi ↓ = Aperture SHORT
   - Linea blu = Prezzo corrente

2. **Tabella Open Positions:**
   - Lista posizioni aperte
   - P&L in tempo reale
   - SL/TP visibili

3. **Portafoglio:**
   - Balance aggiornato
   - Holdings aggiornati

---

## ⚠️ Cosa Fare Se Qualcosa Non Funziona

### Bot non genera segnali:
- ✅ Verifica che RSI sia < 30 o > 70
- ✅ Attendi (il bot controlla ogni 30 secondi)
- ✅ Verifica che bot sia attivo nel dashboard

### Bot non apre posizioni:
- ✅ Verifica log Risk Manager (potrebbe essere bloccato)
- ✅ Verifica che segnale sia >= 50/100
- ✅ Verifica che non abbia già posizione aperta nella stessa direzione

### Posizioni non si chiudono a SL/TP:
- ✅ Verifica che prezzo raggiunga effettivamente SL/TP
- ✅ Verifica log per errori
- ✅ Verifica che `updatePositionsPnL` sia chiamato (lo è ogni ciclo)

### Grafico non mostra marker:
- ✅ Ricarica la pagina
- ✅ Verifica che ci siano trades nella tabella
- ✅ Verifica console per errori JavaScript

---

## 🎯 Checklist Test Completo

- [ ] Risk Manager verifica limiti ad ogni ciclo
- [ ] Segnale LONG generato quando RSI < 30
- [ ] Posizione LONG aperta quando segnale forte
- [ ] Marker verde sul grafico per LONG
- [ ] Segnale SHORT generato quando RSI > 70
- [ ] Posizione SHORT aperta quando segnale forte
- [ ] Marker rosso sul grafico per SHORT
- [ ] SL/TP funzionano automaticamente
- [ ] Posizioni si chiudono a SL/TP
- [ ] Bot NON apre con segnali deboli (< 50/100)
- [ ] Risk Manager blocca quando necessario

---

## 💡 Tips per Test Efficaci

1. **Sii paziente:**
   - Il bot controlla ogni 30 secondi
   - I segnali non arrivano continuamente
   - Attendi condizioni di mercato giuste

2. **Monitora i log:**
   - Console browser (F12) per log frontend
   - Log server per log backend completi

3. **Testa un aspetto alla volta:**
   - Prima verifica Risk Manager
   - Poi verifica segnali
   - Infine verifica gestione posizioni

4. **Non avere fretta:**
   - È meglio aspettare condizioni reali
   - Non forzare test artificiali

---

## 🚀 Pronto per Testare!

1. **Apri il Crypto Dashboard**
2. **Apri la console (F12)**
3. **Attiva il bot** (se non è già attivo)
4. **Osserva i log e il grafico**
5. **Aspetta i segnali**

**Buon test! 🎉**

