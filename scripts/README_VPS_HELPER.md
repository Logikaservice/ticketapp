# 🚀 Helper VPS - Esecuzione Comandi SSH

Questo modulo permette di eseguire comandi sulla VPS in modo semplice, simile ad Antigravity.

## Setup Iniziale

1. **Configura chiave SSH** (se non già fatto):
   ```powershell
   .\CONFIGURA_CHIAVE_SSH.ps1
   ```

2. **Verifica connessione SSH**:
   ```powershell
   ssh -i ~/.ssh/vps_key root@159.69.121.162 "echo 'OK'"
   ```

## Uso Base

### Metodo 1: Script Standalone

```powershell
# Esegui un comando singolo
.\scripts\Invoke-VpsCommand.ps1 -Command "pm2 status"

# Con timeout personalizzato
.\scripts\Invoke-VpsCommand.ps1 -Command "df -h" -Timeout 10
```

### Metodo 2: Helper Functions (Consigliato)

```powershell
# Carica il modulo helper
. .\scripts\VpsHelper.ps1

# Vedi tutte le funzioni disponibili
Show-VpsHelp

# Esempi di uso
Get-VpsStatus              # Stato PM2
Restart-VpsBackend         # Riavvia backend
Get-VpsBackendLogs         # Log backend
Deploy-Vps                 # Deploy completo
```

## Funzioni Disponibili

### Controllo Stato
- `Get-VpsStatus` - Stato PM2
- `Test-VpsBackendPort` - Verifica porta 3001
- `Get-VpsDiskSpace` - Spazio disco
- `Get-VpsMemory` - Memoria
- `Get-VpsNodeProcesses` - Processi Node.js
- `Test-VpsDatabase` - Test connessione database

### Gestione Backend
- `Restart-VpsBackend` - Riavvia backend
- `Restart-VpsAll` - Riavvia tutti i processi PM2
- `Get-VpsBackendLogs` - Log backend (ultimi 50)
- `Watch-VpsBackendLogs` - Log backend in tempo reale

### Deploy
- `Update-VpsCode` - Git pull
- `Build-VpsFrontend` - Build frontend
- `Deploy-Vps` - Deploy completo (pull + build + restart)

### Comandi Personalizzati
- `Invoke-VpsCustom -Command "comando"` - Esegui comando personalizzato

## Esempi Pratici

### Controllo Rapido
```powershell
. .\scripts\VpsHelper.ps1
Get-VpsStatus
Get-VpsDiskSpace
```

### Deploy Dopo Push GitHub
```powershell
. .\scripts\VpsHelper.ps1
Deploy-Vps
```

### Debug Backend
```powershell
. .\scripts\VpsHelper.ps1
Get-VpsBackendLogs -Lines 100
Test-VpsDatabase
```

### Comando Personalizzato
```powershell
. .\scripts\VpsHelper.ps1
Invoke-VpsCustom -Command "cd /var/www/ticketapp && ls -la"
```

## Uso da AI Assistant

L'AI può usare queste funzioni per eseguire controlli automatici:

```powershell
# L'AI può chiamare direttamente
. .\scripts\Invoke-VpsCommand.ps1 -Command "pm2 status"
```

Oppure caricare il modulo e usare le funzioni helper:

```powershell
. .\scripts\VpsHelper.ps1
Get-VpsStatus
```

## Configurazione

Le impostazioni predefinite sono in `VpsHelper.ps1`:
- **VPS_HOST**: `159.69.121.162`
- **VPS_USER**: `root`
- **VPS_PATH**: `/var/www/ticketapp`
- **SSH_KEY**: `~/.ssh/vps_key`

Puoi modificarle se necessario.

## Troubleshooting

### Errore: "ssh non trovato"
Installa OpenSSH Client:
- Settings → Apps → Optional Features → OpenSSH Client

### Errore: "Chiave SSH non trovata"
Esegui: `.\CONFIGURA_CHIAVE_SSH.ps1`

### Errore: "Permission denied"
Verifica permessi chiave:
```powershell
icacls ~/.ssh/vps_key
```

### Timeout
Aumenta il timeout:
```powershell
.\scripts\Invoke-VpsCommand.ps1 -Command "comando" -Timeout 60
```
