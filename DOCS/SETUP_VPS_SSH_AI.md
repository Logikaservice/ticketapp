# 🤖 Setup SSH VPS per AI Assistant

Questa guida spiega come configurare l'accesso SSH alla VPS per permettere all'AI di eseguire comandi di controllo automaticamente.

## 🎯 Obiettivo

Permettere all'AI Assistant di eseguire comandi sulla VPS senza intervento manuale, simile a come funziona Antigravity.

## 📋 Prerequisiti

1. **OpenSSH Client installato** (di solito già presente su Windows 10/11)
2. **Chiave SSH configurata** per la VPS

## 🚀 Setup Rapido

### Passo 1: Configura Chiave SSH

```powershell
# Esegui questo script per configurare la chiave SSH
.\CONFIGURA_CHIAVE_SSH.ps1
```

### Passo 2: Test Connessione

```powershell
# Verifica che tutto funzioni
.\scripts\Test-VpsConnection.ps1
```

### Passo 3: Carica Helper

```powershell
# Carica le funzioni helper
. .\scripts\VpsHelper.ps1

# Vedi tutte le funzioni disponibili
Show-VpsHelp
```

## 📚 Come Usare

### Per l'Utente

```powershell
# Carica il modulo
. .\scripts\VpsHelper.ps1

# Usa le funzioni
Get-VpsStatus
Restart-VpsBackend
Deploy-Vps
```

### Per l'AI Assistant

L'AI può eseguire comandi in due modi:

#### Metodo 1: Script Standalone
```powershell
.\scripts\Invoke-VpsCommand.ps1 -Command "pm2 status"
```

#### Metodo 2: Helper Functions
```powershell
. .\scripts\VpsHelper.ps1
Get-VpsStatus
```

## 🔧 Funzioni Disponibili

### Controllo Stato
- `Get-VpsStatus` - Stato PM2
- `Test-VpsBackendPort` - Verifica porta 3001
- `Get-VpsDiskSpace` - Spazio disco
- `Get-VpsMemory` - Memoria
- `Get-VpsNodeProcesses` - Processi Node.js
- `Test-VpsDatabase` - Test database

### Gestione Backend
- `Restart-VpsBackend` - Riavvia backend
- `Restart-VpsAll` - Riavvia tutti PM2
- `Get-VpsBackendLogs` - Log backend
- `Watch-VpsBackendLogs` - Log in tempo reale

### Deploy
- `Update-VpsCode` - Git pull
- `Build-VpsFrontend` - Build frontend
- `Deploy-Vps` - Deploy completo

### Personalizzato
- `Invoke-VpsCustom -Command "..."` - Comando personalizzato

## 💡 Esempi di Uso AI

### Controllo Automatico Dopo Push
```powershell
# L'AI può eseguire automaticamente dopo un push
. .\scripts\VpsHelper.ps1
Update-VpsCode
Build-VpsFrontend
Restart-VpsBackend
```

### Diagnostica Automatica
```powershell
# L'AI può fare diagnostica automatica
. .\scripts\VpsHelper.ps1
Get-VpsStatus
Get-VpsDiskSpace
Get-VpsMemory
Test-VpsDatabase
```

### Debug Automatico
```powershell
# L'AI può controllare i log automaticamente
. .\scripts\VpsHelper.ps1
Get-VpsBackendLogs -Lines 100
```

## 🔐 Sicurezza

- La chiave SSH è salvata in `~/.ssh/vps_key` con permessi ristretti
- Non salvare password in chiaro negli script
- Usa sempre `-o StrictHostKeyChecking=no` per evitare prompt interattivi

## 🐛 Troubleshooting

### Errore: "ssh non trovato"
```powershell
# Installa OpenSSH Client
# Settings → Apps → Optional Features → OpenSSH Client
```

### Errore: "Chiave SSH non trovata"
```powershell
.\CONFIGURA_CHIAVE_SSH.ps1
```

### Errore: "Permission denied"
```powershell
# Verifica permessi chiave
icacls ~/.ssh/vps_key

# Se necessario, reimposta permessi
icacls ~/.ssh/vps_key /inheritance:r
icacls ~/.ssh/vps_key /grant:r "$env:USERNAME:(R)"
```

### Timeout
Aumenta il timeout nel comando:
```powershell
.\scripts\Invoke-VpsCommand.ps1 -Command "..." -Timeout 60
```

## 📝 Note per l'AI

Quando l'utente chiede di controllare o eseguire comandi sulla VPS:

1. **Usa sempre il modulo helper**:
   ```powershell
   . .\scripts\VpsHelper.ps1
   ```

2. **Per comandi semplici**, usa le funzioni predefinite:
   ```powershell
   Get-VpsStatus
   ```

3. **Per comandi personalizzati**, usa:
   ```powershell
   Invoke-VpsCustom -Command "comando personalizzato"
   ```

4. **Per script complessi**, usa:
   ```powershell
   .\scripts\Invoke-VpsCommand.ps1 -Command "comando complesso"
   ```

## ✅ Checklist Setup

- [ ] Chiave SSH configurata (`.\CONFIGURA_CHIAVE_SSH.ps1`)
- [ ] Test connessione OK (`.\scripts\Test-VpsConnection.ps1`)
- [ ] Helper caricato e testato (`. .\scripts\VpsHelper.ps1`)
- [ ] Funzioni helper testate (`Get-VpsStatus`)

## 🎉 Pronto!

Ora l'AI può eseguire comandi sulla VPS automaticamente. Basta chiedere:
- "Controlla lo stato della VPS"
- "Riavvia il backend"
- "Fai il deploy"
- "Mostra i log del backend"
