# 🔧 Fix Balance Manuale - Istruzioni

## Problema

Il TOTAL BALANCE mostra un valore assurdo (es. €8,977,428,750.653) a causa di un balance corrotto nel database.

## Soluzione 1: Endpoint Automatico (Raccomandato)

Ho aggiunto un endpoint `/api/crypto/fix-balance` che corregge automaticamente il balance.

### Via Browser/Postman:

```bash
POST https://ticket.logikaservice.it/api/crypto/fix-balance
Headers: Authorization: Bearer <TOKEN>
Body (JSON):
{
  "new_balance": 10000
}
```

### Via cURL:

```bash
curl -X POST https://ticket.logikaservice.it/api/crypto/fix-balance \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"new_balance": 10000}'
```

## Soluzione 2: Fix Automatico (Già Implementato)

Il backend ora corregge automaticamente il balance quando:
- `balance_usd > 10,000,000 EUR` (10 milioni)
- `balance_usd < -1,000,000 EUR` (-1 milione)

**Nota**: Il fix automatico viene applicato quando `getPortfolio()` viene chiamato, quindi potrebbe richiedere un refresh della pagina o una chiamata API.

## Soluzione 3: Reset Completo Portfolio

Se vuoi resettare tutto il portfolio:

```bash
POST https://ticket.logikaservice.it/api/crypto/reset
Body (JSON):
{
  "initial_balance": 10000
}
```

**Attenzione**: Questo cancella TUTTE le posizioni e i trade!

## Soluzione 4: Fix Manuale Database (Solo se hai accesso SSH)

Se hai accesso SSH al server:

```bash
ssh root@159.69.121.162
cd /var/www/ticketapp/backend
sqlite3 crypto.db "UPDATE portfolio SET balance_usd = 10000 WHERE id = 1;"
```

## Verifica

Dopo il fix, verifica che il balance sia corretto:

1. Ricarica la dashboard
2. Controlla che TOTAL BALANCE sia ragionevole (es. €10,000)
3. Controlla i log backend per conferma:
   ```bash
   pm2 logs ticketapp-backend | grep "PORTFOLIO"
   ```

Dovresti vedere:
```
✅ [PORTFOLIO] Balance corretto automaticamente nel database a €10000
```

## Prevenzione

Il fix automatico previene valori anomali in futuro:
- Validazione durante `getPortfolio()`
- Validazione durante `add-funds`
- Validazione nel frontend (fallback a €10000)
