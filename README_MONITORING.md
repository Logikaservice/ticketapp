# 🏥 Sistema di Monitoring Anti-Blocchi

## 🎯 Problema Risolto

**Problema**: Backend non attivo → WebSocket non funziona → Gap dati → Bot non opera

**Soluzione**: Sistema di health check automatico che verifica ogni 5 minuti:
- Backend attivo ✅
- Database accessibile ✅
- WebSocket salva dati ✅
- Aggregatore crea klines ✅

## 🚀 Quick Start

### 1. Avvia Backend

```batch
# Windows - Doppio click su:
start-backend.bat

# Oppure manuale:
cd backend
node index.js
```

### 2. Verifica Funzionamento

```powershell
# Controllo immediato
node backend/scripts/check-system-health.js

# Dovresti vedere:
# ✅ Backend attivo
# ✅ Database accessibile
# ✅ WebSocket connesso e salva dati
# ✅ Aggregatore crea klines
```

### 3. Setup Monitoring Automatico (Opzionale)

```powershell
# Esegui come amministratore:
.\setup-monitoring-windows.ps1

# Crea Task Scheduler che verifica ogni 5 minuti
```

## 📊 Componenti Creati

### 1. HealthCheckService
- **File**: `backend/services/HealthCheckService.js`
- **Funzione**: Monitora stato sistema completo
- **Verifica**:
  - Backend risponde su porta 3001
  - Database accessibile (query test)
  - WebSocket salva prezzi (ultimi 5 min)
  - Aggregatore crea klines (ultima ora)
- **Auto-attivazione**: Si avvia automaticamente con backend

### 2. Script di Controllo
- **File**: `backend/scripts/check-system-health.js`
- **Uso**: Verifica manuale stato sistema
- **Output**: Report dettagliato + azioni raccomandate

### 3. Script Avvio/Stop
- **start-backend.bat**: Avvia backend (gestisce porta occupata)
- **stop-backend.bat**: Ferma tutti i processi Node

### 4. Monitoring Schedulato
- **setup-monitoring-windows.ps1**: Crea Task Scheduler
- **Frequenza**: Ogni 5 minuti
- **Log**: `backend/health-check.log`

## 🔍 Come Funziona

### Backend Attivo (Automatico)

Quando avvii il backend, si attiva automaticamente:

```javascript
// backend/routes/cryptoRoutes.js

// 1. WebSocket si connette
initWebSocketService();

// 2. Aggregatore si avvia (dopo 5 sec)
KlinesAggregatorService.start();

// 3. Health Check si attiva (dopo 10 sec)
HealthCheckService.start(5); // Verifica ogni 5 min
```

Ogni 5 minuti, il sistema verifica:

```
[17:50:00] 🔍 Inizio verifica...
   ✅ Backend attivo
   ✅ Database accessibile
   ✅ WebSocket: 127 aggiornamenti ultimi 5 min
   ✅ Aggregatore: 4 klines ultima ora
   ✅ SISTEMA SANO

[17:55:00] 🔍 Inizio verifica...
   ❌ Backend NON risponde
   ❌ WebSocket inattivo
   🚨 SISTEMA NON SANO
   💡 Avvia backend: node backend/index.js
```

### Monitoring Schedulato (Opzionale)

Se attivi il Task Scheduler:

```
Ogni 5 minuti:
├─ Windows Task Scheduler esegue
├─ node backend/scripts/check-system-health.js
├─ Verifica stato
├─ Salva log in backend/health-check.log
└─ Se problemi: Log dettagliato + suggerimenti
```

## 📋 Comandi Utili

```powershell
# Avvia backend
start-backend.bat

# Ferma backend
stop-backend.bat

# Verifica stato
node backend/scripts/check-system-health.js

# Vedi log health check (se scheduler attivo)
Get-Content backend/health-check.log -Wait

# Vedi log backend
cd backend
Get-Content backend.log -Wait  # Se configurato

# Setup monitoring automatico
.\setup-monitoring-windows.ps1

# Disabilita monitoring
Disable-ScheduledTask -TaskName "TicketApp-HealthCheck"

# Rimuovi monitoring
Unregister-ScheduledTask -TaskName "TicketApp-HealthCheck"
```

## 🚨 Cosa Succede in Caso di Problema

### Scenario: Backend Crasha

```
17:50:00 - Backend attivo
17:52:30 - Backend crasha
17:55:00 - Health Check verifica:
           ❌ Backend non risponde
           ❌ WebSocket inattivo
           🚨 ALERT nel log

Nel log trovi:
  • Timestamp problema
  • Cosa non funziona
  • Azioni raccomandate
```

### Scenario: WebSocket Si Disconnette

```
Backend attivo ma WebSocket non salva dati:

Health Check rileva:
  ✅ Backend risponde
  ❌ WebSocket: 0 aggiornamenti ultimi 5 min
  💡 Suggerimento: Riavvia backend
```

## 🎯 Prevenzione Blocchi

### Strategia a 3 Livelli

1. **Health Check Integrato** (Sempre Attivo)
   - Verifica ogni 5 minuti
   - Log automatico problemi
   - Suggerimenti risoluzione

2. **Monitoring Schedulato** (Opzionale)
   - Task Scheduler Windows
   - Verifica anche se backend offline
   - Log persistente

3. **Verifica Manuale** (On-Demand)
   - Script `check-system-health.js`
   - Report dettagliato
   - Azioni immediate

## 📊 Report Esempio

### Sistema Sano

```
🏥 VERIFICA SALUTE SISTEMA

📊 Risultati:
   • Backend: ✅ Backend attivo (stesso processo)
   • Database: ✅ Database accessibile
   • WebSocket: ✅ WebSocket attivo (127 aggiornamenti ultimi 5 min)
   • Aggregatore: ✅ Aggregatore funziona (4 klines ultima ora)
   • GENERALE: ✅ SANO

📋 AZIONI RACCOMANDATE

🎉 Sistema completamente funzionante!

   Tutto ok:
   ✅ Backend attivo e risponde
   ✅ Database accessibile
   ✅ WebSocket connesso e salva dati
   ✅ Aggregatore crea klines automaticamente

   Il bot può operare senza problemi.
```

### Sistema con Problemi

```
🏥 VERIFICA SALUTE SISTEMA

📊 Risultati:
   • Backend: ❌ Backend non risponde
   • Database: ✅ Database accessibile
   • WebSocket: ❌ WebSocket inattivo (ultimo aggiornamento 20.8 ore fa)
   • Aggregatore: ✅ Aggregatore funziona (12 klines ultima ora)
   • GENERALE: 🚨 PROBLEMI

🚨 SISTEMA NON SANO - Problemi rilevati:
   ❌ Backend offline
   ❌ WebSocket inattivo

📋 AZIONI RACCOMANDATE

1️⃣  BACKEND OFFLINE (Critico)
   Causa: Backend non risponde sulla porta 3001
   Impatto: WebSocket non può funzionare, bot non operativo
   Soluzione:
   → Windows: Doppio click su start-backend.bat
   → Manuale: cd backend && node index.js
```

## ✅ Checklist Setup Completo

- [ ] Backend avviato: `start-backend.bat`
- [ ] Verifica funzionamento: `node backend/scripts/check-system-health.js`
- [ ] (Opzionale) Setup monitoring: `.\setup-monitoring-windows.ps1`
- [ ] Verifica WebSocket salva dati (attendi 1-2 min)
- [ ] Verifica Aggregatore crea klines (attendi 15 min)

## 🎉 Risultato

Con questo sistema:
- ✅ Backend monitora se stesso ogni 5 minuti
- ✅ Alert automatici in caso di problemi
- ✅ Suggerimenti risoluzione automatici
- ✅ Log persistente per analisi
- ✅ **ZERO blocchi non rilevati**

Il sistema ti avvisa PRIMA che i problemi diventino critici.
