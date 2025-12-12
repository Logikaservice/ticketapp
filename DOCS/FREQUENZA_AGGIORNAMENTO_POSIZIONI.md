# ⏱️ Frequenza Aggiornamento Posizioni Aperte

## Situazione Attuale

### Frontend (Dashboard)
- **Aggiornamento dati**: Ogni **1.5 secondi** ✅
  - Chiama `fetchData()` che recupera posizioni dal backend
  - Aggiorna prezzo corrente ogni **1 secondo**

### Backend (Calcolo P&L)
- **Prima (PROBLEMA)**: 
  - Aggiornava P&L ogni **5 secondi**
  - **SOLO per Bitcoin** ❌
  - Posizioni su altri simboli (AAVE, SHIB, ecc.) **NON venivano aggiornate**

- **Ora (FIX)**: 
  - Aggiorna P&L ogni **3 secondi** ✅
  - **Per TUTTI i simboli** con posizioni aperte ✅
  - Ogni simbolo ottiene il prezzo corretto da Binance/CoinGecko

## Come Funziona Ora

### Backend - Aggiornamento Automatico

```javascript
// Ogni 3 secondi:
1. Recupera tutti i simboli unici con posizioni aperte
2. Per ogni simbolo:
   - Ottiene prezzo corrente (Binance/CoinGecko)
   - Aggiorna P&L per tutte le posizioni di quel simbolo
   - Aggiorna current_price, profit_loss, profit_loss_pct
   - Controlla stop loss / take profit
   - Aggiorna trailing stop se abilitato
```

### Frontend - Visualizzazione

```javascript
// Ogni 1.5 secondi:
1. Chiama /api/crypto/dashboard
2. Riceve posizioni aggiornate con P&L corrente
3. Aggiorna display "Open Position P&L"
4. Aggiorna grafici e statistiche
```

## Timeline Aggiornamento

```
T+0s    → Backend aggiorna P&L (tutti i simboli)
T+1.5s  → Frontend recupera dati aggiornati
T+3s    → Backend aggiorna P&L di nuovo
T+4.5s  → Frontend recupera dati aggiornati
T+6s    → Backend aggiorna P&L di nuovo
...e così via
```

## Risultato

**I tuoi guadagni vengono aggiornati:**
- ✅ **Backend**: Ogni **3 secondi** (calcolo P&L)
- ✅ **Frontend**: Ogni **1.5 secondi** (visualizzazione)
- ✅ **Tutti i simboli**: Non solo Bitcoin, ma AAVE, SHIB, ETH, ecc.

**Quindi vedi i guadagni aggiornarsi praticamente in tempo reale!**

## Verifica

Per verificare che funzioni:

```bash
# Controlla log backend
pm2 logs ticketapp-backend | grep "UPDATE P&L"

# Dovresti vedere aggiornamenti ogni 3 secondi per tutti i simboli
```

## Configurazione

Se vuoi cambiare la frequenza:

**Backend** (`backend/routes/cryptoRoutes.js`):
```javascript
setInterval(updateAllPositionsPnL, 3000); // 3 secondi
// Cambia a 2000 per 2 secondi, 5000 per 5 secondi, ecc.
```

**Frontend** (`frontend/src/components/CryptoDashboard/CryptoDashboard.jsx`):
```javascript
const dataInterval = setInterval(() => {
    fetchData();
}, 1500); // 1.5 secondi
// Cambia a 1000 per 1 secondo, 2000 per 2 secondi, ecc.
```

**Nota**: Frequenze troppo basse (< 1 secondo) possono:
- Sovraccaricare Binance API (rate limits)
- Consumare più risorse server
- Non essere necessarie (3 secondi è già molto frequente)
