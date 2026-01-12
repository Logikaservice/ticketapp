# Script per applicare aggiornamenti agent e riavviare servizio e tray icon
# Richiede privilegi amministratore

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERRORE: Questo script richiede privilegi amministratore!" -ForegroundColor Red
    exit 1
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $scriptDir) { $scriptDir = $PSScriptRoot }
$targetDir = "C:\ProgramData\NetworkMonitorAgent"
$serviceName = "NetworkMonitorService"

Write-Host "=== Applicazione Aggiornamenti ===" -ForegroundColor Cyan

# 1. Ferma servizio
Write-Host "1. Arresto servizio..." -ForegroundColor Yellow
try {
    Stop-Service -Name $serviceName -Force -ErrorAction Stop
    Start-Sleep -Seconds 3
    Write-Host "   OK Servizio arrestato" -ForegroundColor Green
} catch {
    Write-Host "   Avviso: $_" -ForegroundColor Yellow
}

# 2. Copia file
Write-Host "2. Copia file..." -ForegroundColor Yellow
$files = @("NetworkMonitorService.ps1", "NetworkMonitorTrayIcon.ps1", "Avvia-TrayIcon.ps1")
foreach ($file in $files) {
    $src = Join-Path $scriptDir $file
    $dst = Join-Path $targetDir $file
    if (Test-Path $src) {
        Copy-Item $src $dst -Force
        Write-Host "   OK $file" -ForegroundColor Green
    }
}

# 3. Riavvia servizio
Write-Host "3. Avvio servizio..." -ForegroundColor Yellow
try {
    Start-Service -Name $serviceName -ErrorAction Stop
    Start-Sleep -Seconds 2
    Write-Host "   OK Servizio avviato" -ForegroundColor Green
} catch {
    Write-Host "   Errore: $_" -ForegroundColor Red
}

# 4. Ferma tray icon
Write-Host "4. Arresto tray icon..." -ForegroundColor Yellow
Get-Process powershell -ErrorAction SilentlyContinue | Where-Object {
    try {
        $cmd = (Get-WmiObject Win32_Process -Filter "ProcessId = $($_.Id)").CommandLine
        $cmd -like "*NetworkMonitorTrayIcon*"
    } catch { $false }
} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Write-Host "   OK Tray icon arrestata" -ForegroundColor Green

# 5. Avvia tray icon
Write-Host "5. Avvio tray icon..." -ForegroundColor Yellow
$trayScript = Join-Path $targetDir "Avvia-TrayIcon.ps1"
if (Test-Path $trayScript) {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "powershell.exe"
    $psi.Arguments = "-WindowStyle Hidden -ExecutionPolicy Bypass -NoProfile -File `"$trayScript`""
    $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
    $psi.CreateNoWindow = $true
    $psi.UseShellExecute = $false
    [System.Diagnostics.Process]::Start($psi) | Out-Null
    Start-Sleep -Seconds 2
    Write-Host "   OK Tray icon avviata" -ForegroundColor Green
}

Write-Host "=== Completato ===" -ForegroundColor Cyan
