# 💾 Sistema Backup Automatico Database

## 📋 Panoramica

Il sistema di backup automatico del database è ora integrato nello **Stato Sistema** della dashboard crypto. Esegue backup periodici del database PostgreSQL e monitora lo stato dei backup.

## ✨ Caratteristiche

### 🔄 Backup Automatico Periodico
- **Frequenza**: Ogni 24 ore (configurabile)
- **Formato**: SQL plain text (`.sql`)
- **Posizione**: `backend/backups/`
- **Naming**: `crypto_db_backup_YYYY-MM-DD_HH-MM-SS.sql`
- **Pulizia automatica**: Mantiene solo gli ultimi 7 backup

### 📊 Monitoraggio Stato
- Integrato nella finestra **Stato Sistema**
- Mostra:
  - ✅ **Stato backup**: Sano / Non sano
  - 🕐 **Ultimo backup**: Ore trascorse dall'ultimo backup
  - 📦 **Dimensione**: Dimensione file di backup in MB
- Aggiornamento automatico ogni 30 secondi

### 🚨 Alert e Notifiche
- Avviso se backup non eseguito da più di 36 ore (24h + 50% tolleranza)
- Visibile nella finestra "Stato Sistema" con icona lampeggiante
- Incluso nei "Problemi Rilevati" critici

## 🏗️ Architettura

### Backend Services

#### `BackupService.js`
Gestisce backup automatici periodici:
- `start(intervalHours)` - Avvia servizio backup
- `performBackup()` - Esegue backup database
- `getBackupStatus()` - Restituisce stato corrente
- `forceBackup()` - Forza backup immediato
- `cleanOldBackups()` - Pulisce backup obsoleti

#### `HealthCheckService.js`
Integrato con nuovo metodo:
- `checkBackup()` - Verifica stato backup e include nei check di sistema

### Frontend

#### `SystemHealthMonitor.jsx`
Visualizza stato backup insieme agli altri servizi:
- **Backend** (Activity icon)
- **Database** (Database icon)  
- **WebSocket** (Radio icon)
- **Aggregatore Klines** (Layers icon)
- **Database Backup** (HardDrive icon) ← **NUOVO**

### Database

#### Tabella `system_status`
Salva informazioni su backup e stato sistema:
```sql
CREATE TABLE system_status (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Record salvati**:
- `last_backup`: JSON con info ultimo backup
- `health_check`: JSON con stato sistema

## 🚀 Utilizzo

### Avvio Automatico

Il servizio si avvia automaticamente con il backend:

```javascript
// In cryptoRoutes.js
BackupService.start(24); // Backup ogni 24 ore
```

### Backup Manuale

Per forzare un backup immediato:

```javascript
const BackupService = require('./services/BackupService');
await BackupService.forceBackup();
```

Oppure usa lo script esistente:

```bash
# Windows
node backend/backup_database.js

# Linux/Mac
node backend/backup_database.js
```

### Ripristino Backup

Per ripristinare un backup:

```bash
psql -h HOST -p PORT -U USER -d DATABASE < backend/backups/crypto_db_backup_YYYY-MM-DD_HH-MM-SS.sql
```

O con password:

```bash
PGPASSWORD='your_password' psql -h HOST -p PORT -U USER -d DATABASE < backup_file.sql
```

## 📈 Monitoraggio

### Dashboard Crypto

1. Vai su **Dashboard Crypto**
2. Apri **Impostazioni** (icona ingranaggio)
3. Scorri fino a **Stato Sistema**
4. Verifica stato **Database Backup**

### Stati Possibili

| Stato | Icona | Significato |
|-------|-------|-------------|
| ✅ Sano | CheckCircle (verde) | Backup recente e riuscito |
| ❌ Problema | XCircle (rosso) | Backup fallito o troppo vecchio |
| ⚠️ Avviso | AlertTriangle (giallo) | Backup non recente (>36h) |

### Log Backend

Il servizio logga tutte le operazioni:

```
💾 [BACKUP] Avvio servizio backup automatico
   • Intervallo: ogni 24 ore
✅ [BACKUP] Servizio backup attivato

[2025-12-13T10:00:00.000Z] 💾 [BACKUP] Inizio backup database...
   Database: crypto_db @ localhost:5432
✅ [BACKUP] Backup completato!
   File: /path/to/backend/backups/crypto_db_backup_2025-12-13_10-00-00.sql
   Dimensione: 15.42 MB
```

## 🔧 Configurazione

### Cambiare Frequenza Backup

Modifica in `cryptoRoutes.js`:

```javascript
// Backup ogni 12 ore
BackupService.start(12);

// Backup ogni 48 ore
BackupService.start(48);
```

### Cambiare Numero Backup Mantenuti

Modifica in `BackupService.js` metodo `cleanOldBackups`:

```javascript
await this.cleanOldBackups(backupDir, 7); // Mantieni ultimi 7
// oppure
await this.cleanOldBackups(backupDir, 14); // Mantieni ultimi 14
```

### Cambiare Directory Backup

Modifica in `BackupService.js` metodo `performBackup`:

```javascript
// Directory personalizzata
const backupDir = '/custom/path/backups';
```

## 🛠️ Requisiti

### PostgreSQL Client Tools

Il servizio richiede `pg_dump` installato sul sistema:

#### Windows
Installa PostgreSQL da [postgresql.org](https://www.postgresql.org/download/windows/)

#### Mac
```bash
brew install postgresql
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt-get install postgresql-client
```

### Variabili d'Ambiente

Richiede `DATABASE_URL_CRYPTO` o `DATABASE_URL`:

```env
DATABASE_URL_CRYPTO=postgresql://user:password@host:port/database
```

## 🐛 Troubleshooting

### Backup Non Eseguito

**Problema**: Backup mostra stato "Non sano"

**Soluzioni**:
1. Verifica log backend per errori
2. Controlla che `pg_dump` sia installato
3. Verifica variabile `DATABASE_URL_CRYPTO`
4. Controlla permessi directory `backend/backups/`

### Errore "pg_dump not found"

**Soluzione**: Installa PostgreSQL client tools (vedi Requisiti)

### Errore Connessione Database

**Problema**: `ERRORE: impossibile connettersi al database`

**Soluzioni**:
1. Verifica che database sia raggiungibile
2. Controlla credenziali in `DATABASE_URL_CRYPTO`
3. Verifica firewall/network

### Spazio Disco Insufficiente

**Problema**: Backup fallisce per spazio disco

**Soluzioni**:
1. Pulisci backup vecchi manualmente
2. Riduci numero backup mantenuti
3. Aumenta spazio disco disponibile

## 📚 File Correlati

- `backend/services/BackupService.js` - Servizio principale backup
- `backend/services/HealthCheckService.js` - Monitoring stato sistema
- `backend/routes/cryptoRoutes.js` - Avvio servizi
- `frontend/src/components/CryptoDashboard/SystemHealthMonitor.jsx` - UI stato sistema
- `backend/scripts/create-system-status-table.js` - Setup tabella database
- `backend/backup_database.js` - Script backup manuale

## 🎯 Best Practices

1. **Monitoraggio Regolare**: Controlla lo stato backup nella dashboard
2. **Test Ripristino**: Testa periodicamente il ripristino backup
3. **Backup Offsite**: Copia backup in posizione esterna (cloud storage)
4. **Notifiche**: Configura alert email per backup falliti
5. **Documentazione**: Mantieni procedure di ripristino aggiornate

## 🔮 Sviluppi Futuri

- [ ] Notifiche email per backup falliti
- [ ] Upload automatico backup su cloud (S3, Dropbox)
- [ ] Compressione automatica backup (.gz)
- [ ] Backup incrementali
- [ ] Dashboard dedicata gestione backup
- [ ] Ripristino punto-nel-tempo (PITR)
- [ ] Backup differenziali
- [ ] Crittografia backup

## 📞 Supporto

Per problemi o domande sul sistema di backup:
1. Controlla i log backend
2. Verifica questa documentazione
3. Controlla file `DOCS/` per altre guide

---

**Ultima Modifica**: Dicembre 2025  
**Autore**: Sistema Automatico di Backup  
**Versione**: 1.0.0



