# 🚀 Roadmap Progetto Crypto Trading

## ✅ Passi Completati

### Passo 1: Sistema Open Positions (MetaTrader 5 Style)
- ✅ Database schema per `open_positions` table
- ✅ API endpoints per aprire/chiudere posizioni
- ✅ Frontend component `OpenPositions.jsx` con visualizzazione stile MT5
- ✅ Integrazione con bot per gestione automatica posizioni
- ✅ Calcolo P&L in tempo reale

### Passo 2: Integrazione Binance Testnet
- ✅ Configurazione API keys (Testnet)
- ✅ Endpoint per price, balance, orders
- ✅ Test market/limit/stop-loss orders
- ✅ Fallback a CoinGecko se Binance non disponibile
- ✅ Rate limiting e retry logic

### Passo 3: Grafico TradingView con Marker
- ✅ Integrazione TradingView Lightweight Charts
- ✅ Visualizzazione candlestick chart
- ✅ Marker buy/sell visibili sul grafico
- ✅ Prezzo corrente con linea blu
- ✅ Caricamento automatico storico da Binance

---

## 🎯 Prossimi Passi

### **Passo 4: Migliorare Strategia RSI - Parametri Configurabili** ⏭️ **PROSSIMO**

**Obiettivo:** Permettere di configurare i parametri della strategia RSI dall'interfaccia

**Implementazione:**
1. **Backend:**
   - Salvare parametri strategia in `bot_settings.parameters` (JSON)
   - Parametri configurabili:
     - `rsi_period`: Periodo RSI (default: 14)
     - `rsi_oversold`: Soglia oversold (default: 30)
     - `rsi_overbought`: Soglia overbought (default: 70)
     - `stop_loss_pct`: Stop Loss percentuale (default: 2%)
     - `take_profit_pct`: Take Profit percentuale (default: 3%)
     - `trade_size_eur`: Dimensione trade in EUR (default: 50€)

2. **Frontend:**
   - Pannello "Bot Settings" nella dashboard
   - Input fields per ogni parametro
   - Salvataggio configurazione
   - Validazione valori (es. RSI period tra 5-30)

**Vantaggi:**
- Testare diverse configurazioni senza modificare il codice
- Ottimizzare parametri per massimizzare profitti
- Personalizzazione basata su risk tolerance

---

### **Passo 5: Dashboard Statistiche Avanzate**

**Obiettivo:** Visualizzare metriche complete di performance

**Statistiche da mostrare:**
1. **P&L Totale:**
   - Profit/Loss complessivo (€)
   - Percentuale guadagno/perdita
   - Grafico storico P&L

2. **Win Rate:**
   - % di trade vincenti
   - Numero trade totali
   - Profit factor (guadagni vs perdite)

3. **Metriche Operative:**
   - Trade aperti
   - Trade chiusi (oggi/settimana/mese)
   - Volume totale scambiato
   - ROI (Return on Investment)

4. **Performance per Strategia:**
   - Se implementiamo più strategie, confronto performance

**Componenti Frontend:**
- Card statistiche in dashboard
- Grafico P&L storico (linea temporale)
- Tabella trade chiusi con dettagli

---

### **Passo 6: Notifiche Real-Time per Operazioni Bot**

**Obiettivo:** Ricevere notifiche immediate quando il bot apre/chiude posizioni

**Implementazione:**
1. **Opzione A: WebSocket (Consigliato)**
   - Eventi: `crypto:position-opened`, `crypto:position-closed`
   - Aggiornamento automatico dashboard
   - Notifiche browser push

2. **Opzione B: Polling Migliorato**
   - Polling ogni 2-3 secondi solo quando bot attivo
   - Badge "Nuove operazioni" nella dashboard

**Cosa notificare:**
- Apertura posizione (buy/sell)
- Chiusura posizione (take profit/stop loss/manuale)
- RSI critico (oversold/overbought)
- Errori bot

---

### **Passo 7: Gestione Stop Loss / Take Profit Automatica Migliorata**

**Obiettivo:** Gestire automaticamente SL/TP anche durante orari in cui il bot non è attivo

**Implementazione:**
1. **Stop Loss/Take Profit su Binance:**
   - Quando si apre una posizione, creare ordine stop-loss su Binance
   - Quando si raggiunge TP, creare ordine limit per vendere
   - Monitorare ordini Binance per esecuzione

2. **Trailing Stop Loss:**
   - Aggiustare SL in base al movimento prezzo favorevole
   - Bloccare profitti mentre si permette di continuare a guadagnare

3. **Partial Close:**
   - Chiudere 50% posizione a TP1
   - Lasciare 50% per TP2 più alto
   - Ridurre rischio mantenendo esposizione

---

### **Passo 8: Sistema Backtesting**

**Obiettivo:** Testare strategie su dati storici prima di usarle live

**Implementazione:**
1. **Backend:**
   - Endpoint `/api/crypto/backtest`
   - Simulare esecuzione strategia su dati storici
   - Parametri: periodo storico, parametri strategia
   - Output: performance metrics, trade log

2. **Frontend:**
   - Pannello "Backtest" nella dashboard
   - Selettore periodo storico (ultimi 7/30/90 giorni)
   - Visualizzazione risultati:
     - P&L totale
     - Numero trade
     - Win rate
     - Grafico equity curve
     - Lista trade simulati

**Vantaggi:**
- Validare strategia prima di attivarla
- Ottimizzare parametri senza rischiare capitale
- Confrontare diverse strategie

---

### **Passo 9: Strategie Multiple (Opzionale)**

**Obiettivo:** Permettere di scegliere tra diverse strategie di trading

**Strategie possibili:**
1. **RSI Strategy** (attuale)
2. **Moving Average Crossover**
3. **Bollinger Bands**
4. **MACD Strategy**
5. **Custom Strategy** (definibile dall'utente)

**Implementazione:**
- Tabella `bot_strategies` con configurazioni
- Switch strategia da dashboard
- Backtesting per ogni strategia

---

### **Passo 10: Integrazione Ordini Real Binance (Opzionale - ATTENZIONE RISCHIO)**

**⚠️ ATTENZIONE:** Questo passo richiede account Binance LIVE con fondi reali. Solo dopo aver testato completamente su Testnet.

**Implementazione:**
1. Variabile ambiente `BINANCE_MODE=live`
2. API keys reali (separate da Testnet)
3. Test con importi minimi
4. Logging dettagliato tutte le operazioni
5. Safe guards per limitare perdite

---

## 📊 Priorità Suggerite

1. **Passo 4** - Strategia configurabile (più impatto, meno complessità)
2. **Passo 5** - Statistiche avanzate (necessarie per valutare performance)
3. **Passo 6** - Notifiche real-time (migliora UX)
4. **Passo 7** - SL/TP automatici (migliora gestione rischio)
5. **Passo 8** - Backtesting (utile per ottimizzazione)
6. **Passo 9** - Strategie multiple (opzionale)
7. **Passo 10** - Live trading (solo dopo test completi)

---

## 🔧 Note Tecniche

- **Database:** SQLite per crypto project (separato da PostgreSQL TicketApp)
- **API:** Binance Testnet attualmente, Live opzionale
- **Frontend:** React con TradingView Lightweight Charts
- **Backend:** Node.js/Express con cron job per bot
- **Sicurezza:** API keys in `.env`, mai committate

---

## 📝 Note Implementazione

- Ogni passo può essere implementato indipendentemente
- Mantenere compatibilità con funzionalità esistenti
- Test su Testnet prima di considerare Live
- Documentare ogni nuova feature

