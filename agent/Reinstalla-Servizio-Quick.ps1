# Reinstalla-Servizio-Quick.ps1
# Reinstalla il servizio NetworkMonitorService con NSSM (senza riavvio PC).
# Usare quando il servizio non parte piu' dopo un update fallito.
# Eseguire come Amministratore.

param([string]$InstallDir = "C:\ProgramData\NetworkMonitorAgent")

$ErrorActionPreference = 'Stop'

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Esegui PowerShell come Amministratore (tasto destro -> Esegui come amministratore)." -ForegroundColor Red
    exit 1
}

$nssm = Join-Path $InstallDir "nssm.exe"
$scriptPath = Join-Path $InstallDir "NetworkMonitorService.ps1"
$configPath = Join-Path $InstallDir "config.json"

if (-not (Test-Path $nssm)) { Write-Host "nssm.exe non trovato in $InstallDir" -ForegroundColor Red; exit 1 }
if (-not (Test-Path $scriptPath)) { Write-Host "NetworkMonitorService.ps1 non trovato in $InstallDir" -ForegroundColor Red; exit 1 }
if (-not (Test-Path $configPath)) { Write-Host "config.json non trovato in $InstallDir" -ForegroundColor Red; exit 1 }

$ps = (Get-Command powershell.exe).Source
$params = "-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File `"$scriptPath`" -ConfigPath `"$configPath`""

Write-Host "Rimozione servizio esistente..." -ForegroundColor Yellow
& $nssm stop NetworkMonitorService 2>$null
Start-Sleep -Seconds 2
& $nssm remove NetworkMonitorService confirm 2>$null
Start-Sleep -Seconds 2

Write-Host "Installazione servizio..." -ForegroundColor Yellow
& $nssm install NetworkMonitorService $ps $params
& $nssm set NetworkMonitorService AppDirectory $InstallDir
& $nssm set NetworkMonitorService AppRestartDelay 60000
& $nssm set NetworkMonitorService AppExit Default Restart
& $nssm set NetworkMonitorService AppStdout (Join-Path $InstallDir "NetworkMonitorService_stdout.log")
& $nssm set NetworkMonitorService AppStderr (Join-Path $InstallDir "NetworkMonitorService_stderr.log")

Write-Host "Avvio servizio..." -ForegroundColor Yellow
Start-Service -Name "NetworkMonitorService" -ErrorAction Stop
Start-Sleep -Seconds 2

$s = Get-Service -Name "NetworkMonitorService" -ErrorAction SilentlyContinue
if ($s -and $s.Status -eq 'Running') {
    Write-Host "Servizio avviato. L'agent dovrebbe tornare online." -ForegroundColor Green
} else {
    Write-Host "Servizio non in esecuzione. Controlla:" -ForegroundColor Yellow
    Write-Host "  - $InstallDir\NetworkMonitorService_bootstrap.log" -ForegroundColor White
    Write-Host "  - $InstallDir\NetworkMonitorService_stderr.log" -ForegroundColor White
    Write-Host "Oppure avvia l'agent in primo piano: .\Avvia-Agent-Manuale.ps1" -ForegroundColor White
}
