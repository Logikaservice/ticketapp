# Setup Monitoring Windows per TicketApp
# Crea Task Scheduler che verifica sistema ogni 5 minuti

$taskName = "TicketApp-HealthCheck"
$scriptPath = "$PSScriptRoot\backend\scripts\check-system-health.js"
$logPath = "$PSScriptRoot\backend\health-check.log"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Monitoring TicketApp" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verifica se task esiste già
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if ($existingTask) {
    Write-Host "⚠️  Task esistente trovato - Rimuovo..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Crea azione
$action = New-ScheduledTaskAction `
    -Execute "node" `
    -Argument "`"$scriptPath`" >> `"$logPath`" 2>&1" `
    -WorkingDirectory "$PSScriptRoot\backend"

# Crea trigger (ogni 5 minuti)
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5)

# Crea settings
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 2)

# Registra task
try {
    Register-ScheduledTask `
        -TaskName $taskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Description "Verifica salute sistema TicketApp ogni 5 minuti" `
        -User $env:USERNAME `
        -RunLevel Highest
    
    Write-Host "✅ Task Scheduler creato con successo!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Configurazione:" -ForegroundColor White
    Write-Host "  • Nome: $taskName"
    Write-Host "  • Frequenza: Ogni 5 minuti"
    Write-Host "  • Log: $logPath"
    Write-Host "  • Script: $scriptPath"
    Write-Host ""
    Write-Host "Comandi utili:" -ForegroundColor White
    Write-Host "  • Vedere log: Get-Content '$logPath' -Wait"
    Write-Host "  • Disabilitare: Disable-ScheduledTask -TaskName '$taskName'"
    Write-Host "  • Abilitare: Enable-ScheduledTask -TaskName '$taskName'"
    Write-Host "  • Rimuovere: Unregister-ScheduledTask -TaskName '$taskName'"
    
} catch {
    Write-Host "❌ Errore creazione task: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Setup completato!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Il sistema ora monitora automaticamente:" -ForegroundColor White
Write-Host "  ✅ Backend attivo" -ForegroundColor White
Write-Host "  ✅ Database accessibile" -ForegroundColor White
Write-Host "  ✅ WebSocket funzionante" -ForegroundColor White
Write-Host "  ✅ Aggregatore klines attivo" -ForegroundColor White
Write-Host ""
Write-Host "In caso di problemi, riceverai notifiche nel log." -ForegroundColor White
Write-Host ""







