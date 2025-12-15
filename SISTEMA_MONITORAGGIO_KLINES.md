# 🔄 Sistema di Monitoraggio Continuo Klines

## 📋 Panoramica

Sistema automatico che monitora continuamente i gap nelle klines e li recupera automaticamente quando vengono rilevati.

## 🎯 Componenti

### 1. **Klines Monitor Daemon** (Monitoraggio Continuo)
- **File**: `backend/klines_monitor_daemon.js`
- **Config**: `ecosystem-klines-monitor.config.js`
- **Funzione**: Verifica ogni 15 minuti i gap recenti e li recupera automaticamente
- **Quando usare**: Sempre attivo per prevenire gap

### 2. **Klines Recovery Daemon** (Recovery Notturno)
- **File**: `backend/klines_recovery_daemon.js`
- **Config**: `ecosystem-klines.config.js`
- **Funzione**: Verifica completa ogni notte alle 3:00 AM
- **Quando usare**: Backup notturno per verifica completa

### 3. **Script di Verifica**
- `backend/scripts/verifica-sistema-completa.js` - Verifica completa sistema
- `backend/scripts/analizza-gap-recenti.js` - Analisi dettagliata gap
- `backend/scripts/recupera-gap-immediato.js` - Recovery manuale immediato

## 🚀 Installazione e Avvio

### Opzione 1: Monitoraggio Continuo (Consigliato)

```bash
# Avvia il monitor continuo
pm2 start ecosystem-klines-monitor.config.js --only klines-monitor

# Visualizza log
pm2 logs klines-monitor

# Verifica stato
pm2 status klines-monitor
```

**Caratteristiche:**
- ✅ Verifica ogni 15 minuti
- ✅ Recupera automaticamente i gap
- ✅ Riavvio automatico se crasha
- ✅ Monitoraggio continuo 24/7

### Opzione 2: Recovery Notturno (Backup)

```bash
# Avvia recovery notturno (già configurato per 3:00 AM)
pm2 start ecosystem-klines.config.js --only klines-recovery

# Visualizza log
pm2 logs klines-recovery
```

**Caratteristiche:**
- ✅ Verifica completa ogni notte alle 3:00 AM
- ✅ Recupera gap degli ultimi 7 giorni
- ✅ Blocca aperture nuove durante recovery

### Opzione 3: Entrambi (Massima Copertura)

```bash
# Avvia entrambi
pm2 start ecosystem-klines-monitor.config.js --only klines-monitor
pm2 start ecosystem-klines.config.js --only klines-recovery
```

## 📊 Configurazione

### Modificare Intervallo Verifica (Monitor Continuo)

Edita `backend/klines_monitor_daemon.js`:

```javascript
const CHECK_INTERVAL_MINUTES = 15; // Cambia questo valore (in minuti)
```

Poi riavvia:
```bash
pm2 restart klines-monitor
```

### Modificare Orario Recovery Notturno

Edita `ecosystem-klines.config.js`:

```javascript
cron_restart: '0 3 * * *', // Formato cron: minuto ora giorno mese giorno-settimana
```

Esempi:
- `'0 3 * * *'` = 3:00 AM ogni giorno
- `'0 */6 * * *'` = Ogni 6 ore
- `'0 2,14 * * *'` = 2:00 AM e 14:00 (2 PM) ogni giorno

Poi riavvia:
```bash
pm2 restart klines-recovery
```

## 🔍 Verifica e Diagnostica

### Verifica Sistema Completa

```bash
node backend/scripts/verifica-sistema-completa.js
```

Verifica:
- Stato PM2/Backend
- Connessione Database
- Connessione Binance API
- Attività WebSocket
- Aggiornamenti Klines
- Stato Sistema

### Analisi Gap Dettagliata

```bash
node backend/scripts/analizza-gap-recenti.js
```

Mostra:
- Gap recenti per simbolo
- Quando si sono verificati
- Durata e candele mancanti
- Diagnosi cause

### Recovery Manuale Immediato

```bash
node backend/scripts/recupera-gap-immediato.js
```

Recupera immediatamente i gap per i simboli principali.

## 📈 Monitoraggio

### Log in Tempo Reale

```bash
# Monitor continuo
pm2 logs klines-monitor --lines 100

# Recovery notturno
pm2 logs klines-recovery --lines 100

# Entrambi
pm2 logs
```

### Verifica Stato

```bash
pm2 status
```

Dovresti vedere:
```
┌─────┬─────────────────────┬─────────┬─────────┬──────────┐
│ id  │ name                │ status  │ restart │ uptime   │
├─────┼─────────────────────┼─────────┼─────────┼──────────┤
│ 0   │ klines-monitor      │ online  │ 0       │ 2h       │
│ 1   │ klines-recovery     │ online  │ 0       │ 1d       │
└─────┴─────────────────────┴─────────┴─────────┴──────────┘
```

## 🛠️ Troubleshooting

### Il monitor non si avvia

```bash
# Verifica errori
pm2 logs klines-monitor --err

# Riavvia
pm2 restart klines-monitor

# Se continua a crashare, verifica dipendenze
cd backend
npm install
```

### Gap non vengono recuperati

1. Verifica connessione Binance:
   ```bash
   node backend/scripts/verifica-sistema-completa.js
   ```

2. Verifica manualmente:
   ```bash
   node backend/scripts/analizza-gap-recenti.js
   ```

3. Recupera manualmente:
   ```bash
   node backend/scripts/recupera-gap-immediato.js
   ```

### WebSocket non attivo

Il WebSocket è gestito dal backend principale. Se non è attivo:

```bash
# Verifica backend
pm2 status ticketapp-backend

# Riavvia backend
pm2 restart ticketapp-backend

# Verifica log
pm2 logs ticketapp-backend --lines 50
```

## 📝 Note Importanti

1. **Rate Limiting**: Il sistema rispetta i limiti Binance (100ms delay tra batch)
2. **Validazione**: Tutte le klines vengono validate prima del salvataggio
3. **Conflitti**: Usa `ON CONFLICT` per evitare duplicati
4. **Performance**: Il monitor continuo è leggero (verifica solo ultime 24 ore)
5. **Backup**: Il recovery notturno fa una verifica completa (ultimi 7 giorni)

## 🎯 Best Practice

1. **Attiva sempre il monitor continuo** per prevenire gap
2. **Mantieni attivo il recovery notturno** come backup
3. **Verifica settimanalmente** con `verifica-sistema-completa.js`
4. **Monitora i log** per rilevare problemi precocemente

## 📊 Statistiche

Il sistema mantiene statistiche su:
- Gap rilevati
- Klines recuperate
- Simboli verificati
- Errori riscontrati

Visualizza nei log o esegui:
```bash
node backend/scripts/report-dati-mancanti.js
```



