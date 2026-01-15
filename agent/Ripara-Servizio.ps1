# Ripara-Servizio.ps1
# Script per riparare la configurazione NSSM del NetworkMonitorService
# Risolve il problema quando Application punta a .ps1 invece che a powershell.exe

param(
    [string]$InstallDir = "C:\ProgramData\NetworkMonitorAgent"
)

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Riparazione NetworkMonitorService" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verifica privilegi amministratore
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERRORE: Questo script richiede privilegi di Amministratore!" -ForegroundColor Red
    Write-Host "Esegui PowerShell come Amministratore e riprova." -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}

$ServiceName = "NetworkMonitorService"
$NssmPath = Join-Path $InstallDir "nssm.exe"
$ScriptPath = Join-Path $InstallDir "NetworkMonitorService.ps1"
$ConfigPath = Join-Path $InstallDir "config.json"

# Verifica che i file esistano
if (-not (Test-Path $NssmPath)) {
    Write-Host "ERRORE: nssm.exe non trovato in: $InstallDir" -ForegroundColor Red
    pause
    exit 1
}

if (-not (Test-Path $ScriptPath)) {
    Write-Host "ERRORE: NetworkMonitorService.ps1 non trovato in: $InstallDir" -ForegroundColor Red
    pause
    exit 1
}

if (-not (Test-Path $ConfigPath)) {
    Write-Host "ERRORE: config.json non trovato in: $InstallDir" -ForegroundColor Red
    pause
    exit 1
}

# Verifica che il servizio esista
try {
    $service = Get-Service -Name $ServiceName -ErrorAction Stop
    Write-Host "Servizio '$ServiceName' trovato" -ForegroundColor Green
} catch {
    Write-Host "Servizio '$ServiceName' NON trovato!" -ForegroundColor Red
    Write-Host "Esegui prima Installa-Servizio.ps1" -ForegroundColor Yellow
    pause
    exit 1
}

# Leggi configurazione attuale
Write-Host ""
Write-Host "Configurazione attuale:" -ForegroundColor Yellow
$appExe = & $NssmPath get $ServiceName Application 2>&1
$appParams = & $NssmPath get $ServiceName AppParameters 2>&1
$appDir = & $NssmPath get $ServiceName AppDirectory 2>&1

Write-Host "  Application: $appExe" -ForegroundColor White
Write-Host "  AppParameters: $appParams" -ForegroundColor White
Write-Host "  AppDirectory: $appDir" -ForegroundColor White
Write-Host ""

# Verifica se Application punta a .ps1 (ERRORE!)
if ($appExe -match '\.ps1$') {
    Write-Host "PROBLEMA RILEVATO: Application punta a uno script .ps1 invece che a powershell.exe!" -ForegroundColor Red
    Write-Host "   Questo impedisce al servizio di avviarsi correttamente." -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host "Application sembra corretto (non punta a .ps1)" -ForegroundColor Green
    Write-Host "   Continuo comunque con la riparazione per assicurarmi che tutto sia configurato correttamente..." -ForegroundColor Gray
    Write-Host ""
}

# Ferma il servizio se e in esecuzione
if ($service.Status -eq "Running") {
    Write-Host "Fermo il servizio..." -ForegroundColor Yellow
    try {
        Stop-Service -Name $ServiceName -Force -ErrorAction Stop
        Start-Sleep -Seconds 2
        Write-Host "Servizio fermato" -ForegroundColor Green
    } catch {
        Write-Host "Errore fermando servizio: $_" -ForegroundColor Yellow
    }
}

# Ripara configurazione
Write-Host ""
Write-Host "Riparazione configurazione NSSM..." -ForegroundColor Yellow

# Trova percorso PowerShell
$powershellPath = (Get-Command powershell.exe).Source
Write-Host "  PowerShell trovato: $powershellPath" -ForegroundColor Gray

# Imposta Application (sempre powershell.exe)
Write-Host "  Imposto Application a: $powershellPath" -ForegroundColor Gray
& $NssmPath set $ServiceName Application $powershellPath | Out-Null

# Imposta AppDirectory
Write-Host "  Imposto AppDirectory a: $InstallDir" -ForegroundColor Gray
& $NssmPath set $ServiceName AppDirectory $InstallDir | Out-Null

# Imposta AppParameters (percorsi assoluti)
$absParams = "-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File `"$ScriptPath`" -ConfigPath `"$ConfigPath`""
Write-Host "  Imposto AppParameters (percorsi assoluti)" -ForegroundColor Gray
& $NssmPath set $ServiceName AppParameters $absParams | Out-Null

Write-Host "Configurazione riparata!" -ForegroundColor Green
Write-Host ""

# Verifica configurazione finale
Write-Host "Configurazione finale:" -ForegroundColor Yellow
$newAppExe = & $NssmPath get $ServiceName Application 2>&1
$newAppParams = & $NssmPath get $ServiceName AppParameters 2>&1
$newAppDir = & $NssmPath get $ServiceName AppDirectory 2>&1

Write-Host "  Application: $newAppExe" -ForegroundColor White
Write-Host "  AppDirectory: $newAppDir" -ForegroundColor White
Write-Host "  AppParameters: $newAppParams" -ForegroundColor White
Write-Host ""

# Avvia servizio
Write-Host "Avvio servizio..." -ForegroundColor Yellow
try {
    Start-Service -Name $ServiceName -ErrorAction Stop
    Start-Sleep -Seconds 3
    
    $serviceStatus = Get-Service -Name $ServiceName
    if ($serviceStatus.Status -eq "Running") {
        Write-Host "Servizio avviato con successo!" -ForegroundColor Green
    } else {
        Write-Host "Il servizio non e ancora in esecuzione. Stato: $($serviceStatus.Status)" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Controlla i log per dettagli:" -ForegroundColor Yellow
        $stderrPath = Join-Path $InstallDir "NetworkMonitorService_stderr.log"
        $bootstrapPath = Join-Path $InstallDir "NetworkMonitorService_bootstrap.log"
        Write-Host "  Get-Content '$stderrPath' -Tail 20" -ForegroundColor White
        Write-Host "  Get-Content '$bootstrapPath' -Tail 20" -ForegroundColor White
    }
} catch {
    Write-Host "Errore avvio servizio: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Controlla i log per dettagli:" -ForegroundColor Yellow
    $stderrPath = Join-Path $InstallDir "NetworkMonitorService_stderr.log"
    $bootstrapPath = Join-Path $InstallDir "NetworkMonitorService_bootstrap.log"
    Write-Host "  Get-Content '$stderrPath' -Tail 20" -ForegroundColor White
    Write-Host "  Get-Content '$bootstrapPath' -Tail 20" -ForegroundColor White
}

Write-Host ""
$separator = '========================================'
Write-Host $separator -ForegroundColor Cyan
Write-Host 'Riparazione completata' -ForegroundColor Cyan
Write-Host $separator -ForegroundColor Cyan
Write-Host ""
pause
