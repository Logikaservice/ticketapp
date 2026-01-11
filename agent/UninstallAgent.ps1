# UninstallAgent.ps1
# Script per disinstallare Network Monitor Agent

param(
    [string]$AgentDir = "NetworkMonitorAgent"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Network Monitor Agent - Disinstallazione" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Nome Scheduled Task
$TaskName = "NetworkMonitorAgent"

# Rimuovi Scheduled Task
Write-Host "Rimozione Scheduled Task..." -ForegroundColor Yellow
try {
    $existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($existingTask) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "✅ Scheduled Task rimosso con successo" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Scheduled Task non trovato (già rimosso?)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Errore rimozione Scheduled Task: $_" -ForegroundColor Yellow
    Write-Host "   Prova a eseguire PowerShell come Amministratore" -ForegroundColor Yellow
}

# Rimuovi directory agent (opzionale - commentato per sicurezza)
# Write-Host ""
# Write-Host "Rimozione directory agent..." -ForegroundColor Yellow
# $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
# $agentDirPath = Join-Path $scriptDir $AgentDir
# 
# if (Test-Path $agentDirPath) {
#     try {
#         Remove-Item -Path $agentDirPath -Recurse -Force
#         Write-Host "✅ Directory agent rimossa con successo" -ForegroundColor Green
#     } catch {
#         Write-Host "⚠️  Errore rimozione directory: $_" -ForegroundColor Yellow
#     }
# } else {
#     Write-Host "⚠️  Directory agent non trovata" -ForegroundColor Yellow
# }

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Disinstallazione completata!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "L'agent è stato disinstallato con successo." -ForegroundColor White
Write-Host "La directory con i file di configurazione è stata mantenuta." -ForegroundColor White
Write-Host ""
Write-Host "Premi un tasto per uscire..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
