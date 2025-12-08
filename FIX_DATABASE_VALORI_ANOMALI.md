# Fix Database - Valori Anomali Profit/Loss

## 📋 Problema

Dopo la creazione dello storico delle posizioni chiuse, i numeri nelle statistiche sono diventati errati (es. P&L Totale: €-34.631.349,4).

### Cause Identificate:

1. **Doppio conteggio del volume**: Il volume veniva contato sia dalle posizioni chiuse che da tutti i trades BUY
2. **Valori anomali di profit_loss**: Alcuni record nel database hanno `profit_loss` con valori enormi (> ±1 milione EUR)
3. **Mancanza di validazione**: Il codice non validava i valori prima di sommarli

## ✅ Fix Applicati

### 1. Codice Backend (`cryptoRoutes.js`)
- ✅ Rimosso doppio conteggio del volume
- ✅ Aggiunta validazione per valori anomali (> ±1 milione EUR)
- ✅ Aggiunta sanitizzazione dei valori finali nelle statistiche

### 2. Script di Pulizia Database
- ✅ Script per identificare record anomali
- ✅ Script per correggere/resettare valori anomali

## 🛠️ Uso dello Script

### Modalità Report (Nessuna Modifica)

```bash
# Su VPS o localmente
cd /var/www/ticketapp  # o c:\TicketApp su Windows
node backend/scripts/fix-anomalous-profit-loss.js --dry-run
```

Mostra un report dettagliato di tutti i record anomali senza modificare nulla.

### Modalità Correzione

```bash
# ATTENZIONE: Questo modifica il database!
node backend/scripts/fix-anomalous-profit-loss.js --fix
```

Corregge automaticamente:
- **Posizioni chiuse anomale**: Prova a ricalcolare il P&L corretto, altrimenti lo resetta a 0
- **Trades anomali**: Resetta il `profit_loss` a NULL

### Opzioni Aggiuntive

```bash
# Report con dettagli verbosi
node backend/scripts/fix-anomalous-profit-loss.js --dry-run --verbose

# Correzione con dettagli verbosi
node backend/scripts/fix-anomalous-profit-loss.js --fix --verbose
```

## 📊 Esempio Output

```
🔍 Analisi Database per Valori Anomali di Profit/Loss

📁 Database: /var/www/ticketapp/crypto.db
📊 Limite ragionevole: ±€1,000,000

📊 Analisi Posizioni Chiuse...
   ✅ Totale posizioni chiuse: 133
   ⚠️  Posizioni anomale: 5
   💰 Valore anomalo totale: €34632357.39
   📋 Dettagli:
      - abc12345... | bitcoin_usdt | P&L: €-34632349.34 (-13192374.66%) | 2024-12-07 22:56:00
      ...

📊 Analisi Trades...
   ✅ Totale trades con profit_loss: 150
   ⚠️  Trades anomali: 2
   💰 Valore anomalo totale: €8.05
   ...

============================================================
📊 REPORT RIEPILOGATIVO
============================================================
⚠️  Posizioni chiuse anomale: 5
⚠️  Trades anomali: 2
⚠️  TOTALE RECORD ANOMALI: 7
💰 Valore anomalo totale: €34632365.44

💡 Per correggere i valori anomali, esegui:
   node backend/scripts/fix-anomalous-profit-loss.js --fix
```

## ⚠️ IMPORTANTE

### Prima di Eseguire lo Script

1. **Fai backup del database**:
```bash
# Su VPS
cd /var/www/ticketapp
cp crypto.db crypto.db.backup.$(date +%Y%m%d_%H%M%S)

# O su Windows
copy crypto.db crypto.db.backup
```

2. **Esegui prima in modalità `--dry-run`** per vedere cosa verrà modificato

3. **Verifica che il backup sia stato creato correttamente**

### Dopo la Correzione

1. Ricarica la pagina del dashboard con Hard Refresh (`Ctrl + Shift + R`)
2. Verifica che le statistiche siano corrette
3. Se qualcosa non va, puoi ripristinare il backup:
```bash
# Su VPS
cp crypto.db.backup.YYYYMMDD_HHMMSS crypto.db

# O su Windows
copy crypto.db.backup crypto.db
```

## 🔍 Verifica Manuale nel Database

Se vuoi verificare manualmente i valori anomali:

```sql
-- Posizioni chiuse anomali
SELECT ticket_id, symbol, entry_price, volume, profit_loss, closed_at 
FROM open_positions 
WHERE status != 'open' 
  AND ABS(CAST(profit_loss AS REAL)) > 1000000;

-- Trades anomali
SELECT id, ticket_id, symbol, type, amount, price, profit_loss, timestamp 
FROM trades 
WHERE profit_loss IS NOT NULL 
  AND ABS(CAST(profit_loss AS REAL)) > 1000000;
```

## 🐛 Troubleshooting

### Errore: "Cannot find module 'sqlite3'"
```bash
cd backend
npm install sqlite3
```

### Errore: "Database is locked"
- Assicurati che nessun altro processo stia usando il database
- Riavvia il backend se necessario

### I valori sono ancora errati dopo la correzione
1. Verifica che lo script abbia effettivamente modificato i record
2. Controlla che il frontend stia usando la nuova API (hard refresh)
3. Verifica i log del backend per eventuali errori

## 📝 Note Tecniche

- Il limite di ±1 milione EUR è configurabile nello script (`MAX_REASONABLE_PNL`)
- Lo script prova a ricalcolare il P&L per le posizioni chiuse usando `entry_price`, `volume`, e `current_price`
- Se il calcolo dà ancora valori anomali, il valore viene resettato a 0
- I trades anomali vengono resettati a NULL (non 0) perché potrebbero essere stati creati erroneamente
