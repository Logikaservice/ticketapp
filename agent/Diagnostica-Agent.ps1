# Script di diagnostica per NetworkMonitor Agent
# Verifica lo stato dell'agent e identifica eventuali problemi

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Diagnostica NetworkMonitor Agent" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$TaskName = "NetworkMonitorAgent"

# 1. Verifica esistenza Scheduled Task
Write-Host "1. Verifica Scheduled Task..." -ForegroundColor Yellow
try {
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
    Write-Host "   ✅ Scheduled Task '$TaskName' trovato" -ForegroundColor Green
    
    # Mostra stato
    $taskInfo = Get-ScheduledTaskInfo -TaskName $TaskName
    Write-Host "   • Stato: $($task.State)" -ForegroundColor White
    Write-Host "   • Ultima esecuzione: $($taskInfo.LastRunTime)" -ForegroundColor White
    Write-Host "   • Prossima esecuzione: $($taskInfo.NextRunTime)" -ForegroundColor White
    Write-Host "   • Ultimo risultato: $($taskInfo.LastTaskResult)" -ForegroundColor White
    
    if ($task.State -eq "Disabled") {
        Write-Host "   ⚠️  ATTENZIONE: Il task è DISABILITATO!" -ForegroundColor Red
        Write-Host "   Per abilitarlo, esegui PowerShell come Amministratore e digita:" -ForegroundColor Yellow
        Write-Host "   Enable-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Gray
    }
    
} catch {
    Write-Host "   ❌ Scheduled Task '$TaskName' NON trovato!" -ForegroundColor Red
    Write-Host "   L'agent non è stato installato correttamente." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   Per installare l'agent, esegui InstallerCompleto.ps1" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host ""

# 2. Verifica percorso script
Write-Host "2. Verifica percorso script..." -ForegroundColor Yellow
try {
    $taskActions = $task.Actions
    $action = $taskActions[0]
    
    # Estrai percorso script dagli argomenti
    $arguments = $action.Arguments
    if ($arguments -match '-File\s+"([^"]+)"') {
        $scriptPath = $matches[1]
        Write-Host "   ✅ Percorso script: $scriptPath" -ForegroundColor Green
        
        if (Test-Path $scriptPath) {
            Write-Host "   ✅ File NetworkMonitor.ps1 trovato" -ForegroundColor Green
        } else {
            Write-Host "   ❌ File NetworkMonitor.ps1 NON trovato!" -ForegroundColor Red
            Write-Host "   Il file potrebbe essere stato spostato o cancellato." -ForegroundColor Yellow
        }
    } else {
        Write-Host "   ⚠️  Impossibile estrarre percorso script dagli argomenti" -ForegroundColor Yellow
    }
    
    $workingDir = $action.WorkingDirectory
    if ($workingDir) {
        Write-Host "   • Working Directory: $workingDir" -ForegroundColor White
        if (Test-Path $workingDir) {
            Write-Host "   ✅ Directory di lavoro trovata" -ForegroundColor Green
        } else {
            Write-Host "   ❌ Directory di lavoro NON trovata!" -ForegroundColor Red
        }
    }
    
} catch {
    Write-Host "   ⚠️  Errore lettura configurazione task: $_" -ForegroundColor Yellow
}

Write-Host ""

# 3. Verifica config.json
Write-Host "3. Verifica config.json..." -ForegroundColor Yellow
$configPath = Join-Path (Split-Path -Parent $scriptPath) "config.json"
if ($configPath -and (Test-Path $configPath)) {
    Write-Host "   ✅ config.json trovato: $configPath" -ForegroundColor Green
    try {
        $config = Get-Content $configPath | ConvertFrom-Json
        Write-Host "   • Server URL: $($config.server_url)" -ForegroundColor White
        Write-Host "   • API Key: $($config.api_key.Substring(0, [Math]::Min(20, $config.api_key.Length)))..." -ForegroundColor White
        Write-Host "   • Reti: $($config.network_ranges -join ', ')" -ForegroundColor White
        Write-Host "   • Intervallo scansione: $($config.scan_interval_minutes) minuti" -ForegroundColor White
    } catch {
        Write-Host "   ❌ Errore lettura config.json: $_" -ForegroundColor Red
    }
} else {
    Write-Host "   ❌ config.json NON trovato!" -ForegroundColor Red
    Write-Host "   Percorso cercato: $configPath" -ForegroundColor Yellow
}

Write-Host ""

# 4. Test esecuzione manuale
Write-Host "4. Test esecuzione manuale..." -ForegroundColor Yellow
if ($scriptPath -and (Test-Path $scriptPath)) {
    Write-Host "   Esecuzione test (invio dati al server)..." -ForegroundColor White
    Write-Host ""
    try {
        & $scriptPath -TestMode
        Write-Host ""
        Write-Host "   ✅ Test completato!" -ForegroundColor Green
    } catch {
        Write-Host ""
        Write-Host "   ❌ Errore durante test: $_" -ForegroundColor Red
    }
} else {
    Write-Host "   ⚠️  Impossibile eseguire test: script non trovato" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Diagnostica completata" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 5. Suggerimenti
Write-Host "Suggerimenti:" -ForegroundColor Yellow
Write-Host "• Se il task è disabilitato, abilitalo con:" -ForegroundColor White
Write-Host "  Enable-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Gray
Write-Host ""
Write-Host "• Per forzare l'esecuzione immediata:" -ForegroundColor White
Write-Host "  Start-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Gray
Write-Host ""
Write-Host "• Per vedere i log dell'ultima esecuzione:" -ForegroundColor White
Write-Host "  Get-ScheduledTaskInfo -TaskName '$TaskName' | Format-List" -ForegroundColor Gray
Write-Host ""
