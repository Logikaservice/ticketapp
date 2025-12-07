# Verifica Posizioni Aperte e Balance

## Problema
- Total Balance: €533.02
- P&L Totale: +€0.03
- Open Position P&L: +€0.00
- Operazioni Bot: 0 operazioni aperte

## Possibili cause

1. **Posizione aperta non mostrata correttamente**
   - Verifica nel database: `SELECT * FROM open_positions WHERE status = 'open'`
   - Verifica holdings: `SELECT holdings FROM portfolio`

2. **Holdings residue**
   - Se ci sono holdings residue (crypto possedute), il Total Balance le include
   - Total Balance = balance_usd + (holdings × prezzo_corrente)
   - Se holdings > 0, il balance può essere diverso dal P&L

3. **Discrepanza tra balance e P&L**
   - Il balance viene aggiornato quando si chiude una posizione
   - Il P&L Totale viene calcolato da posizioni chiuse + aperte
   - Potrebbe esserci un arrotondamento o un calcolo diverso

## Query SQL per verificare

```sql
-- Verifica balance attuale
SELECT balance_usd, holdings FROM portfolio LIMIT 1;

-- Verifica posizioni aperte
SELECT * FROM open_positions WHERE status = 'open';

-- Verifica posizioni chiuse con P&L
SELECT ticket_id, symbol, type, entry_price, close_price, profit_loss, closed_at 
FROM open_positions 
WHERE status != 'open' 
ORDER BY closed_at DESC 
LIMIT 10;

-- Verifica tutti i trades
SELECT * FROM trades ORDER BY timestamp DESC LIMIT 10;
```

