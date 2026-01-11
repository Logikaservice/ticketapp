# Debug Agent Offline

## Problema
L'agent risulta "offline" nella dashboard anche se il Scheduled Task è stato creato correttamente.

## Diagnostica

### 1. Verifica stato Scheduled Task

```powershell
# Verifica stato task
Get-ScheduledTask -TaskName "NetworkMonitorAgent" | Select-Object State, LastRunTime, LastTaskResult

# Verifica prossima esecuzione
Get-ScheduledTaskInfo -TaskName "NetworkMonitorAgent"

# Verifica trigger (quando si esegue)
(Get-ScheduledTask -TaskName "NetworkMonitorAgent").Triggers
```

### 2. Verifica esecuzioni precedenti

```powershell
# Verifica storia esecuzioni (eventi)
Get-WinEvent -LogName Microsoft-Windows-TaskScheduler/Operational | Where-Object {$_.Message -like "*NetworkMonitorAgent*"} | Select-Object -First 10 TimeCreated, Message
```

### 3. Esegui manualmente l'agent

```powershell
cd "D:\NetworkMonitor-Agent-Casa-Mia"
.\NetworkMonitor.ps1 -TestMode
```

Se vedi errori, sono quelli che impediscono l'esecuzione automatica.

### 4. Verifica che il task sia stato avviato

Il task potrebbe non essere ancora partito se:
- È stato creato da poco (il trigger "Once" parte subito, ma potrebbe non essere ancora scattato)
- C'è un errore durante l'esecuzione

### 5. Verifica permessi e Working Directory

Il task potrebbe fallire se:
- Non può accedere ai file (permessi)
- La Working Directory non è corretta
- Il file config.json non è nella directory corretta

### 6. Verifica connessione al server

```powershell
# Test connessione HTTPS
Test-NetConnection -ComputerName ticket.logikaservice.it -Port 443

# Test con PowerShell
Invoke-WebRequest -Uri "https://ticket.logikaservice.it" -UseBasicParsing
```

## Soluzione comune: Esegui manualmente il task

```powershell
# Forza esecuzione immediata
Start-ScheduledTask -TaskName "NetworkMonitorAgent"

# Attendi qualche secondo e verifica
Start-Sleep -Seconds 5
Get-ScheduledTaskInfo -TaskName "NetworkMonitorAgent"
```

## Verifica log backend

Sul server VPS, controlla i log del backend:
```bash
pm2 logs backend | grep -i "heartbeat\|network-monitoring\|agent"
```

Se non vedi richieste di heartbeat, l'agent non sta chiamando il server.
