# Rimozione Database PostgreSQL Locale

Questa guida spiega come rimuovere in sicurezza il database PostgreSQL locale per evitare confusione con il database VPS.

## 🎯 Perché Rimuovere il Database Locale?

- **Evitare confusione**: Un solo database (VPS) da gestire
- **Risparmiare risorse**: PostgreSQL locale consuma RAM e CPU
- **Semplicità**: Tutti gli script puntano al database VPS
- **Sicurezza**: Nessun rischio di modificare il database sbagliato

## 🚀 Procedura Automatica (CONSIGLIATA)

### Passo 1: Esegui lo Script di Rimozione

```powershell
cd C:\TicketApp\backend
.\scripts\backup-and-remove-local-db.ps1
```

Lo script esegue automaticamente:
1. ✅ Verifica installazione PostgreSQL locale
2. 💾 Backup di sicurezza dei database locali
3. ⏸️ Arresto servizi PostgreSQL
4. 🔧 Disabilita avvio automatico
5. 📋 Fornisce istruzioni per disinstallazione completa

### Passo 2: Disinstalla PostgreSQL (Opzionale)

Se vuoi rimuovere completamente PostgreSQL:

1. Premi `Win + X` → **App e funzionalità**
2. Cerca **"PostgreSQL"**
3. Clicca **Disinstalla**
4. Segui la procedura guidata
5. Elimina manualmente le cartelle residue (se richiesto):
   - `C:\Program Files\PostgreSQL\`
   - `C:\ProgramData\PostgreSQL\`

## 🔧 Procedura Manuale (Alternativa)

### Opzione 1: Solo Arresto e Disabilita

Se vuoi tenere PostgreSQL installato ma non in esecuzione:

```powershell
# Trova servizi PostgreSQL
Get-Service | Where-Object { $_.Name -like "*postgres*" }

# Ferma i servizi (sostituisci NOME_SERVIZIO)
Stop-Service -Name "postgresql-x64-14" -Force

# Disabilita avvio automatico
Set-Service -Name "postgresql-x64-14" -StartupType Disabled
```

### Opzione 2: Backup Manuale

Se vuoi fare backup manuale prima di rimuovere:

```bash
# Backup database principale
pg_dump -h localhost -U postgres -d ticketapp > ticketapp_backup.sql

# Backup crypto_db
pg_dump -h localhost -U postgres -d crypto_db > crypto_db_backup.sql

# Backup vivaldi_db
pg_dump -h localhost -U postgres -d vivaldi_db > vivaldi_db_backup.sql
```

## ✅ Verifica Post-Rimozione

Dopo la rimozione, verifica che tutto funzioni:

### 1. Verifica Servizi Arrestati

```powershell
Get-Service | Where-Object { $_.Name -like "*postgres*" -and $_.Status -eq "Running" }
```

**Output atteso**: Nessun servizio in esecuzione

### 2. Verifica Backend Connesso a VPS

```powershell
cd C:\TicketApp\backend
node scripts\check-min-volume-db.js
```

**Output atteso**: Connessione al database VPS funzionante

### 3. Test Applicazione

- Apri il frontend: http://localhost:5173
- Vai su **Bot Settings**
- Verifica che i parametri si carichino correttamente
- Prova a modificare un parametro e salvare

## 🔄 Come Ripristinare (Se Necessario)

Se in futuro dovessi aver bisogno del database locale:

### 1. Riavvia Servizi

```powershell
# Riabilita servizio
Set-Service -Name "postgresql-x64-14" -StartupType Automatic

# Avvia servizio
Start-Service -Name "postgresql-x64-14"
```

### 2. Ripristina da Backup

```bash
# Ripristina database
psql -h localhost -U postgres -d ticketapp < ticketapp_backup.sql
```

## 📋 Checklist Finale

Prima di considerare completata la rimozione:

- [ ] ✅ Backup eseguito (se necessario)
- [ ] ✅ Servizi PostgreSQL locali arrestati
- [ ] ✅ Avvio automatico disabilitato
- [ ] ✅ Backend si connette correttamente alla VPS
- [ ] ✅ Frontend funziona correttamente
- [ ] ✅ Bot Settings carica e salva parametri
- [ ] ✅ (Opzionale) PostgreSQL disinstallato

## ⚠️ Note Importanti

### Database VPS

Da ora in poi, **TUTTI** gli script e il backend useranno il database VPS:
- **Host**: `159.69.121.162` (o `localhost` se eseguiti sulla VPS)
- **Database**: `crypto_db`
- **Configurazione**: `DATABASE_URL_CRYPTO` in `.env`

### Sviluppo Locale

Se sviluppi in locale su Windows ma vuoi testare con dati VPS:
1. **Opzione A**: Usa tunnel SSH (script già creati)
2. **Opzione B**: Connetti direttamente alla VPS (porta 5432 aperta)
3. **Opzione C**: Lavora direttamente sulla VPS via SSH

### Backup Automatici VPS

Assicurati di avere backup regolari del database VPS:
```bash
# Sulla VPS
cd /var/www/ticketapp/TicketApp/backend
./scripts/backup-vps-database.ps1 -VpsHost "localhost"
```

## 🆘 Troubleshooting

### Errore: "Servizio non può essere fermato"

```powershell
# Forza arresto processo
Get-Process postgres* | Stop-Process -Force
```

### Errore: "pg_dump non trovato"

PostgreSQL non è nel PATH. Usa il percorso completo:
```powershell
& "C:\Program Files\PostgreSQL\14\bin\pg_dump.exe" ...
```

### Port 5432 ancora occupata

```powershell
# Trova processo che usa la porta
netstat -ano | findstr :5432

# Termina processo (sostituisci PID)
taskkill /PID <PID> /F
```

## 📞 Supporto

Se hai problemi:
1. Verifica che il backend VPS sia raggiungibile
2. Controlla i log del backend: `pm2 logs ticketapp-backend`
3. Verifica connessione database: `scripts/check-min-volume-db.js`

---

**Ricorda**: Una volta rimosso il database locale, lavorerai sempre e solo sul database VPS. Questo elimina ogni confusione! 🎉
