# 🔄 KLINES RECOVERY DAEMON

Verifica automatica notturna dell'integrità dei dati di prezzo (klines) con recovery automatico da Binance.

## 📋 Cosa fa

1. **3:00 AM ogni notte**: Avvia la verifica automatica
2. **Verifica gap**: Controlla gli ultimi 7 giorni di klines 15m per ogni simbolo attivo
3. **Trova mancanze**: Identifica buchi nei dati
4. **Recupera da Binance**: Se trova gap, scarica i dati mancanti
5. **Blocca il bot**: Durante il recovery, impedisce al bot di aprire nuove posizioni
6. **Ricostruisce DB**: Salva i dati recuperati nel database
7. **Sblocca il bot**: Al termine del recovery, il bot torna operativo

## 🚀 Avvio

### Avvio unico (test)
```bash
node backend/klines_recovery_daemon.js
```

### Avvio pianificato (3:00 AM ogni notte)
```bash
pm2 start ecosystem-klines.config.js --only klines-recovery
```

### Visualizzare log
```bash
pm2 logs klines-recovery
```

### Disabilitare temporaneamente
```bash
pm2 delete klines-recovery
```

## 📊 Output Esempio

```
[2024-12-13 03:00:00] ℹ️  🌙 INIZIO VERIFICA NOTTURNA KLINES (3:00 AM)
[2024-12-13 03:00:01] ✅ Tabella system_status pronta
[2024-12-13 03:00:02] 🔄 ATTIVATO blocco aperture nuove posizioni
[2024-12-13 03:00:02] ℹ️  Verificando 15 simboli attivi...

[2024-12-13 03:00:03] ✅ bitcoin: OK (672 klines trovate)
[2024-12-13 03:00:04] ✅ ethereum: OK (672 klines trovate)
[2024-12-13 03:00:05] 🔄 solana: Trovati 2 gap! Inizio recovery...
[2024-12-13 03:00:05]   Recuperando 45 klines da 2024-12-12T10:15:00Z
[2024-12-13 03:00:06]     ↳ Salvate 45 klines
[2024-12-13 03:00:07] ✅ solana: Recuperate 45 klines

[2024-12-13 03:15:30] ✅ 
📊 RECOVERY COMPLETATO:
  • Simboli controllati: 15
  • Klines recuperate: 127
  • Total klines nel DB: 12450

[2024-12-13 03:15:30] ✅ Recovery completo - Bot tornato operativo
```

## 🔧 Configurazione

File: `ecosystem-klines.config.js`

**Parametri modificabili in `klines_recovery_daemon.js`:**

```javascript
const KLINE_INTERVAL = '15m';     // Timeframe da controllare
const LOOKBACK_DAYS = 7;           // Ultimi 7 giorni
const BATCH_SIZE = 100;            // Klines per batch da Binance
const REQUEST_TIMEOUT = 5000;      // Timeout Binance (ms)
```

## 📈 Monitoraggio

### Verificare status recovery
```sql
SELECT status_value FROM system_status WHERE status_key = 'klines_recovery_in_progress';
```

### Contare klines per simbolo
```sql
SELECT symbol, COUNT(*) as klines_count 
FROM klines 
WHERE interval = '15m' 
GROUP BY symbol 
ORDER BY klines_count DESC;
```

### Vedere ultimi gap risolti
```sql
SELECT * FROM klines 
WHERE symbol = 'bitcoin' AND interval = '15m' 
ORDER BY open_time DESC 
LIMIT 100;
```

## ⚠️ Note

1. **Simboli attivi**: Lo script recupera solo simboli con `is_active = 1` in `bot_settings`
2. **Rate limiting**: Tra i batch da Binance c'è un delay di 200ms (rispetto ai limiti Binance)
3. **Blocco bot**: Durante il recovery, il backend rifiuta aperture con motivo `🔄 Sistema in recovery klines`
4. **Log dettagliati**: Tutti gli output vanno in `pm2 logs klines-recovery`

## 🐛 Troubleshooting

### "Nessun simbolo attivo trovato"
→ Verifica che ci siano simboli con `is_active = 1` in `bot_settings`

### "Errore: Tabella system_status non trovata"
→ Lo script la crea automaticamente al primo avvio

### "Timeout download Binance"
→ Aumenta `REQUEST_TIMEOUT` in `klines_recovery_daemon.js`

### Il bot non si sblocca dopo il recovery
→ Esegui manualmente:
```javascript
await db.query(`
    UPDATE system_status 
    SET status_value = 'false' 
    WHERE status_key = 'klines_recovery_in_progress'
`);
```

## 📅 Schedule cron

La pianificazione segue il formato cron standard:

```
0 3 * * *    = 3:00 AM ogni giorno
0 3 * * 0    = 3:00 AM ogni domenica
0 2,14 * * * = 2:00 AM e 14:00 (14 hr) ogni giorno
```

Per modificare l'orario, edita `ecosystem-klines.config.js`:

```javascript
cron_restart: '0 23 * * *',  // Cambia a 23:00
```

Poi esegui:
```bash
pm2 restart ecosystem-klines.config.js
```
