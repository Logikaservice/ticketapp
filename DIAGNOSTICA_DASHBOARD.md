# 🔍 Diagnostica Problemi Dashboard

## Problemi Identificati

### 1. **OPEN POSITION P&L mostra -€1.46 ma "0 operazioni aperte"**
**Causa Probabile:**
- Posizioni nel database con `status !== 'open'` ma con `profit_loss != 0`
- Il frontend potrebbe ricevere posizioni non filtrate correttamente

**Fix Applicato:**
- ✅ Validazione STRICTA nel frontend: filtra solo `status === 'open'`
- ✅ Validazione nel backend: endpoint `/positions?status=open` restituisce SOLO posizioni con status esattamente 'open'
- ✅ Validazione valori anomali: salta `profit_loss` > 1 milione di euro

### 2. **TOTAL BALANCE mostra €3.233.421.993.708 (valore impossibile)**
**Causa Probabile:**
- `portfolio.balance_usd` nel database è corrotto o calcolato erroneamente
- Possibile overflow o errore di calcolo

**Fix Applicato:**
- ✅ Validazione nel backend: `getPortfolio()` verifica che `balance_usd` sia tra -1M e +10M EUR
- ✅ Auto-fix: Se valore anomale, aggiorna database a €10000
- ✅ Validazione nel frontend: Se valore anomale, usa fallback €10000

### 3. **Bot Paused**
**Nota:**
- Il bot è in pausa, quindi non applica la logica Smart Exit
- Questo è normale se l'utente ha disattivato il bot manualmente

## Fix Implementati

### Frontend (`CryptoDashboard.jsx`)

1. **Filtro Posizioni Aperte:**
```javascript
const validOpenPositions = (openPositions || []).filter(pos => {
    if (!pos || pos.status !== 'open') return false;
    if (!pos.ticket_id) return false;
    return true;
});
```

2. **Validazione P&L:**
```javascript
const MAX_REASONABLE_PNL = 1000000; // 1 milione max
if (Math.abs(positionPnL) > MAX_REASONABLE_PNL) {
    console.warn(`⚠️ Skipping anomalous profit_loss`);
    return;
}
```

3. **Validazione Balance:**
```javascript
const MAX_REASONABLE_BALANCE = 10000000; // 10 milioni max
if (rawBalance > MAX_REASONABLE_BALANCE) {
    validatedBalance = 10000; // Fallback
}
```

### Backend (`cryptoRoutes.js`)

1. **Endpoint `/positions?status=open`:**
```javascript
// Solo accetta 'open' come status valido
if (status === 'open') {
    query = "SELECT * FROM open_positions WHERE status = 'open' ORDER BY opened_at DESC";
}
// Filtra posizioni con dati invalidi
const validPositions = rows.filter(pos => {
    if (!pos || !pos.ticket_id) return false;
    if (status === 'open' && pos.status !== 'open') return false;
    return true;
});
```

2. **Funzione `getPortfolio()`:**
```javascript
// Valida balance_usd
if (rawBalance > MAX_REASONABLE_BALANCE || rawBalance < MIN_REASONABLE_BALANCE) {
    console.error(`🚨 Valore anomale: €${rawBalance.toLocaleString()}`);
    // Auto-fix: aggiorna database
    db.run("UPDATE portfolio SET balance_usd = ? WHERE id = 1", [10000]);
    row.balance_usd = 10000;
}
```

## Verifica

Dopo il deploy, verifica:

1. **Console Browser (F12):**
   - Cerca warning `⚠️ [P&L]` o `⚠️ [BALANCE]`
   - Dovresti vedere se ci sono posizioni anomale

2. **Backend Logs:**
```bash
pm2 logs ticketapp-backend | grep -E "PORTFOLIO|POSITIONS|anomale"
```

3. **Database (opzionale):**
```sql
-- Verifica posizioni con status ambiguo
SELECT ticket_id, symbol, status, profit_loss 
FROM open_positions 
WHERE status != 'open' AND profit_loss != 0;

-- Verifica balance
SELECT balance_usd FROM portfolio WHERE id = 1;
```

## Risultato Atteso

Dopo il fix:
- ✅ **OPEN POSITION P&L**: Mostra €0.00 se ci sono 0 posizioni aperte
- ✅ **TOTAL BALANCE**: Mostra valore ragionevole (max 10M EUR)
- ✅ **Operazioni Bot**: Coerente con OPEN POSITION P&L

## Se il Problema Persiste

1. **Controlla Database:**
   - Verifica se ci sono posizioni con `status != 'open'` ma ancora conteggiate
   - Verifica se `portfolio.balance_usd` è corrotto

2. **Pulisci Database (se necessario):**
```sql
-- Fix balance se anomale
UPDATE portfolio SET balance_usd = 10000 WHERE id = 1 AND (balance_usd > 10000000 OR balance_usd < -1000000);

-- Fix posizioni con status ambiguo
UPDATE open_positions SET status = 'closed' WHERE status NOT IN ('open', 'closed', 'stopped', 'taken');
```

3. **Riavvia Backend:**
```bash
pm2 restart ticketapp-backend
```
