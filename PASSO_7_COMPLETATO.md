# ✅ Passo 7 Completato: Gestione Stop Loss / Take Profit Automatica Migliorata

## 📋 Riepilogo

Il Passo 7 implementa due funzionalità avanzate per la gestione automatica delle posizioni:

1. **Trailing Stop Loss**: Lo stop loss si muove automaticamente seguendo il prezzo favorevole
2. **Partial Close (Chiusura Parziale)**: Chiude il 50% della posizione a TP1, mantiene il 50% per TP2

## 🔧 Modifiche al Database

### Nuove colonne in `open_positions`:

- `trailing_stop_enabled` (INTEGER): Abilita/disabilita trailing stop loss
- `trailing_stop_distance_pct` (REAL): Distanza percentuale per il trailing stop
- `highest_price` (REAL): Prezzo massimo/minimo raggiunto (per calcolare trailing stop)
- `volume_closed` (REAL): Volume già chiuso (per partial close)
- `take_profit_1` (REAL): Primo take profit (chiude 50%)
- `take_profit_2` (REAL): Secondo take profit (chiude il restante 50%)
- `tp1_hit` (INTEGER): Flag per indicare se TP1 è stato raggiunto

### Migrazione automatica:
- Il database verifica automaticamente se le nuove colonne esistono
- Se mancano, vengono aggiunte automaticamente all'avvio

## 📝 Modifiche Backend

### 1. Funzione `partialClosePosition` (Nuova)
- Chiude parzialmente una posizione (es. 50%)
- Aggiorna il portfolio con il P&L parziale
- Registra il trade nella history
- Emette notifica real-time via WebSocket

### 2. Funzione `updatePositionsPnL` (Aggiornata)
**Trailing Stop Loss:**
- Traccia il prezzo massimo/minimo raggiunto
- Calcola automaticamente il nuovo stop loss in base alla distanza percentuale
- Aggiorna lo stop loss solo se si muove in direzione favorevole

**Partial Close:**
- Verifica se TP1 è stato raggiunto
- Chiude automaticamente il 50% della posizione a TP1
- Mantiene il 50% per TP2 (o stop loss)

### 3. Funzione `openPosition` (Aggiornata)
- Accetta parametri opzionali per trailing stop e partial close
- Salva le configurazioni nella posizione

### 4. Funzione `executeTrade` (Aggiornata)
- Passa i parametri del bot quando apre posizioni
- Supporta trailing stop e partial close nelle nuove posizioni

### 5. Parametri Bot (Aggiornati)
Nuovi parametri configurabili:
- `trailing_stop_enabled`: Abilita/disabilita trailing stop
- `trailing_stop_distance_pct`: Distanza percentuale (0.1-5%)
- `partial_close_enabled`: Abilita/disabilita chiusura parziale
- `take_profit_1_pct`: Prima chiusura (0.1-5%)
- `take_profit_2_pct`: Seconda chiusura (0.1-10%)

### 6. Validazione Parametri (Aggiornata)
- Validazione che TP1 < TP2 quando partial close è abilitato
- Range checks per tutti i nuovi parametri

## 🎨 Modifiche Frontend

### Componente `BotSettings` (Aggiornato)

**Nuovi campi aggiunti:**

1. **Checkbox "Abilita Trailing Stop Loss"**
   - Attiva/disattiva il trailing stop loss
   - Quando attivo, mostra il campo "Distanza Trailing Stop (%)"

2. **Campo "Distanza Trailing Stop (%)"** (0.1-5%)
   - Visibile solo quando trailing stop è abilitato
   - Distanza percentuale dal prezzo massimo/minimo

3. **Checkbox "Abilita Chiusura Parziale"**
   - Attiva/disattiva la chiusura parziale
   - Quando attivo, mostra i campi TP1 e TP2

4. **Campo "Take Profit 1 - Prima Chiusura (%)"** (0.1-5%)
   - Visibile solo quando chiusura parziale è abilitata
   - Chiude 50% della posizione a questo livello

5. **Campo "Take Profit 2 - Seconda Chiusura (%)"** (0.1-10%)
   - Visibile solo quando chiusura parziale è abilitata
   - Chiude il restante 50% a questo livello

## 🔄 Funzionalità

### Trailing Stop Loss

**Come funziona:**
1. Quando una posizione viene aperta con trailing stop abilitato, viene salvata la distanza percentuale
2. Ad ogni aggiornamento P&L (ogni 5 secondi), il sistema:
   - Traccia il prezzo massimo raggiunto (per posizioni long) o minimo (per short)
   - Calcola il nuovo stop loss: `prezzo_massimo * (1 - distanza_pct/100)`
   - Aggiorna lo stop loss solo se è più favorevole (più alto per long, più basso per short)
3. Se il prezzo tocca il trailing stop loss, la posizione viene chiusa automaticamente

**Esempio:**
- Entry: €100
- Trailing stop distance: 1%
- Prezzo sale a €105 → Stop loss a €103.95
- Prezzo sale a €110 → Stop loss a €108.90
- Prezzo scende a €108.89 → Posizione chiusa (stop loss hit)

### Partial Close (Chiusura Parziale)

**Come funziona:**
1. Quando una posizione viene aperta con partial close abilitato, vengono salvati TP1 e TP2
2. Quando il prezzo raggiunge TP1:
   - Il sistema chiude automaticamente il 50% della posizione
   - Il P&L viene registrato e il portfolio aggiornato
   - Il flag `tp1_hit` viene impostato
3. Il restante 50% rimane aperto per:
   - Raggiungere TP2 (chiusura completa con più profitto)
   - O essere chiuso da stop loss / trailing stop

**Esempio:**
- Entry: €100, Volume: 1 BTC
- TP1: €101.50 (1.5%), TP2: €103.00 (3%)
- Prezzo sale a €101.50:
  - Chiude 0.5 BTC a €101.50 (P&L: +€0.75)
  - Restano 0.5 BTC aperti
- Prezzo sale a €103.00:
  - Chiude 0.5 BTC a €103.00 (P&L: +€1.50)
  - Posizione completamente chiusa

## 🔔 Notifiche Real-Time

Il sistema emette notifiche WebSocket per:
- `crypto:position-partial-close`: Quando viene chiusa parzialmente una posizione

## ⚙️ Configurazione

### Backend (`bot_settings` table):

```json
{
  "rsi_period": 14,
  "rsi_oversold": 30,
  "rsi_overbought": 70,
  "stop_loss_pct": 2.0,
  "take_profit_pct": 3.0,
  "trade_size_eur": 50,
  "trailing_stop_enabled": false,
  "trailing_stop_distance_pct": 1.0,
  "partial_close_enabled": false,
  "take_profit_1_pct": 1.5,
  "take_profit_2_pct": 3.0
}
```

### Frontend (BotSettings Component):

Tutti i parametri sono configurabili tramite l'interfaccia utente nel modal "Impostazioni Strategia RSI".

## ✅ Test Suggeriti

1. **Trailing Stop Loss:**
   - Abilita trailing stop distance 1%
   - Apri una posizione long
   - Verifica che lo stop loss si muova quando il prezzo sale
   - Verifica che la posizione venga chiusa se il prezzo scende sotto il trailing stop

2. **Partial Close:**
   - Abilita partial close con TP1=1.5%, TP2=3%
   - Apri una posizione long
   - Verifica che al raggiungimento di TP1 venga chiuso il 50%
   - Verifica che al raggiungimento di TP2 venga chiuso il restante 50%

3. **Combinazione:**
   - Abilita sia trailing stop che partial close
   - Verifica che funzionino insieme correttamente

## 🚀 Prossimi Passi

- Passo 8: Backtesting sistema (testa strategia su dati storici)
- Miglioramenti futuri:
  - Configurazione diversa di trailing stop per long/short
  - Multiple partial closes (3 o più livelli)
  - Trailing stop che si attiva solo dopo un certo profitto

