# Fix Database - Query SQL Dirette (Alternativa Rapida)

Se lo script non è ancora disponibile sul VPS, puoi correggere i valori anomali direttamente con query SQL.

## 🔍 Trova il Database

Prima di tutto, trova dove si trova il database:

```bash
cd /var/www/ticketapp
find . -name "crypto.db" -type f
```

Probabilmente è in:
- `/var/www/ticketapp/crypto.db`
- `/var/www/ticketapp/backend/crypto.db`

## 📊 Analisi Valori Anomali

### 1. Verifica Posizioni Chiuse Anomale

```sql
SELECT ticket_id, symbol, entry_price, volume, profit_loss, closed_at 
FROM open_positions 
WHERE status != 'open' 
  AND ABS(CAST(profit_loss AS REAL)) > 1000000;
```

### 2. Verifica Trades Anomali

```sql
SELECT id, ticket_id, symbol, type, amount, price, profit_loss, timestamp 
FROM trades 
WHERE profit_loss IS NOT NULL 
  AND ABS(CAST(profit_loss AS REAL)) > 1000000;
```

## 🔧 Correzione Rapida (Metodo 1: Resetta a 0)

### Posizioni Chiuse Anomali

```sql
-- Backup prima!
-- Poi resetta tutti i profit_loss anomali a 0
UPDATE open_positions 
SET profit_loss = 0 
WHERE status != 'open' 
  AND ABS(CAST(profit_loss AS REAL)) > 1000000;
```

### Trades Anomali

```sql
UPDATE trades 
SET profit_loss = NULL 
WHERE profit_loss IS NOT NULL 
  AND ABS(CAST(profit_loss AS REAL)) > 1000000;
```

## 🔧 Correzione Intelligente (Metodo 2: Ricalcola)

Se vuoi provare a ricalcolare il P&L invece di resettarlo:

### Per Posizioni Chiuse (LONG/BUY)

```sql
-- Ricalcola P&L per posizioni LONG chiuse con valori anomali
UPDATE open_positions
SET profit_loss = (
    CASE 
        WHEN type = 'buy' THEN 
            (CAST(current_price AS REAL) - CAST(entry_price AS REAL)) * CAST(volume AS REAL)
        WHEN type = 'sell' THEN 
            (CAST(entry_price AS REAL) - CAST(current_price AS REAL)) * CAST(volume AS REAL)
        ELSE 0
    END
)
WHERE status != 'open' 
  AND ABS(CAST(profit_loss AS REAL)) > 1000000
  AND entry_price > 0 
  AND volume > 0
  AND current_price > 0;
```

### Poi resetta quelli che rimangono ancora anomali

```sql
UPDATE open_positions 
SET profit_loss = 0 
WHERE status != 'open' 
  AND ABS(CAST(profit_loss AS REAL)) > 1000000;
```

## 🛠️ Esecuzione su VPS

### Opzione A: SQLite CLI

```bash
cd /var/www/ticketapp
sqlite3 crypto.db

# Poi incolla le query SQL sopra
# Quando finisci, digita: .quit
```

### Opzione B: Query da Terminale

```bash
cd /var/www/ticketapp

# Backup database
cp crypto.db crypto.db.backup.$(date +%Y%m%d_%H%M%S)

# Esegui correzione
sqlite3 crypto.db <<EOF
-- Conta quanti record anomali ci sono
SELECT COUNT(*) as posizioni_anomale FROM open_positions WHERE status != 'open' AND ABS(CAST(profit_loss AS REAL)) > 1000000;
SELECT COUNT(*) as trades_anomali FROM trades WHERE profit_loss IS NOT NULL AND ABS(CAST(profit_loss AS REAL)) > 1000000;

-- Resetta posizioni anomale
UPDATE open_positions SET profit_loss = 0 WHERE status != 'open' AND ABS(CAST(profit_loss AS REAL)) > 1000000;

-- Resetta trades anomali
UPDATE trades SET profit_loss = NULL WHERE profit_loss IS NOT NULL AND ABS(CAST(profit_loss AS REAL)) > 1000000;

-- Verifica che siano stati corretti
SELECT COUNT(*) as posizioni_anomale_rimaste FROM open_positions WHERE status != 'open' AND ABS(CAST(profit_loss AS REAL)) > 1000000;
SELECT COUNT(*) as trades_anomali_rimasti FROM trades WHERE profit_loss IS NOT NULL AND ABS(CAST(profit_loss AS REAL)) > 1000000;
EOF
```

## ✅ Verifica Dopo la Correzione

```sql
-- Verifica che non ci siano più valori anomali
SELECT COUNT(*) FROM open_positions WHERE status != 'open' AND ABS(CAST(profit_loss AS REAL)) > 1000000;
-- Dovrebbe restituire 0

SELECT COUNT(*) FROM trades WHERE profit_loss IS NOT NULL AND ABS(CAST(profit_loss AS REAL)) > 1000000;
-- Dovrebbe restituire 0
```

## 📝 Passi Completi da Eseguire

```bash
# 1. Connettiti al VPS
ssh root@ticketapp-server

# 2. Vai nella directory del progetto
cd /var/www/ticketapp

# 3. Trova il database
find . -name "crypto.db" -type f

# 4. Backup (IMPORTANTE!)
cp crypto.db crypto.db.backup.$(date +%Y%m%d_%H%M%S)

# 5. Apri SQLite
sqlite3 crypto.db

# 6. Esegui queste query:
.schema open_positions  # Verifica struttura tabella

-- Conta anomali
SELECT COUNT(*) FROM open_positions WHERE status != 'open' AND ABS(CAST(profit_loss AS REAL)) > 1000000;
SELECT COUNT(*) FROM trades WHERE profit_loss IS NOT NULL AND ABS(CAST(profit_loss AS REAL)) > 1000000;

-- Correggi (sostituisci con metodo 1 o 2 sopra)
UPDATE open_positions SET profit_loss = 0 WHERE status != 'open' AND ABS(CAST(profit_loss AS REAL)) > 1000000;
UPDATE trades SET profit_loss = NULL WHERE profit_loss IS NOT NULL AND ABS(CAST(profit_loss AS REAL)) > 1000000;

-- Verifica
SELECT COUNT(*) FROM open_positions WHERE status != 'open' AND ABS(CAST(profit_loss AS REAL)) > 1000000;

.quit  # Esci da SQLite

# 7. Riavvia il backend (opzionale, ma consigliato)
pm2 restart ticketapp-backend
# oppure
systemctl restart ticketapp-backend
```

## ⚠️ ATTENZIONE

- **Fai sempre backup prima!**
- Chiudi il backend mentre modifichi il database per evitare conflitti
- Dopo le modifiche, ricarica il frontend con Hard Refresh
