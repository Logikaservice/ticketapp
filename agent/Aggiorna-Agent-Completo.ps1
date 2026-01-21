# Aggiorna-Agent-Completo.ps1
# Script completo per aggiornare l'agent alla versione più recente

$ErrorActionPreference = "Stop"
$InstallDir = "C:\ProgramData\NetworkMonitorAgent"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "AGGIORNAMENTO AGENT COMPLETO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verifica configurazione
Write-Host "[1] Verifica configurazione..." -ForegroundColor Yellow
$configPath = Join-Path $InstallDir "config.json"
if (-not (Test-Path $configPath)) {
    Write-Host "  ERRORE: config.json non trovato in $InstallDir" -ForegroundColor Red
    exit 1
}

$config = Get-Content $configPath -Raw | ConvertFrom-Json
$baseUrl = $config.server_url -replace '/api.*', ''
Write-Host "  Server URL: $baseUrl" -ForegroundColor Green
Write-Host ""

# 2. Ferma servizio
Write-Host "[2] Ferma servizio..." -ForegroundColor Yellow
$service = Get-Service -Name "NetworkMonitorService" -ErrorAction SilentlyContinue
if ($service) {
    if ($service.Status -eq "Running") {
        Stop-Service -Name "NetworkMonitorService" -Force -ErrorAction SilentlyContinue
        Write-Host "  Servizio fermato" -ForegroundColor Green
    } elseif ($service.Status -eq "Paused") {
        Resume-Service -Name "NetworkMonitorService" -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Stop-Service -Name "NetworkMonitorService" -Force -ErrorAction SilentlyContinue
        Write-Host "  Servizio ripristinato e fermato" -ForegroundColor Green
    } else {
        Write-Host "  Servizio già fermato" -ForegroundColor Yellow
    }
} else {
    Write-Host "  Servizio non trovato" -ForegroundColor Yellow
}
Start-Sleep -Seconds 3
Write-Host ""

# 3. Rimuovi servizio vecchio
Write-Host "[3] Rimuovi servizio vecchio..." -ForegroundColor Yellow
sc.exe delete "NetworkMonitorService" 2>$null | Out-Null
Start-Sleep -Seconds 5
Write-Host "  Servizio rimosso" -ForegroundColor Green
Write-Host ""

# 4. Backup file vecchio
Write-Host "[4] Backup file vecchio..." -ForegroundColor Yellow
$backupDir = Join-Path $InstallDir "backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
$oldFile = Join-Path $InstallDir "NetworkMonitorService.ps1"
if (Test-Path $oldFile) {
    Copy-Item $oldFile (Join-Path $backupDir "NetworkMonitorService.ps1.backup") -Force
    Write-Host "  Backup creato in: $backupDir" -ForegroundColor Green
} else {
    Write-Host "  File vecchio non trovato" -ForegroundColor Yellow
}
Write-Host ""

# 5. Download file nuovo
Write-Host "[5] Download file nuovo..." -ForegroundColor Yellow
$downloadUrl = "$baseUrl/api/network-monitoring/download/agent/NetworkMonitorService.ps1"
$tempFile = Join-Path $InstallDir "NetworkMonitorService.ps1.new"

try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $downloadUrl -OutFile $tempFile -TimeoutSec 30 -ErrorAction Stop
    Write-Host "  File scaricato con successo" -ForegroundColor Green
} catch {
    Write-Host "  ERRORE download: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 6. Verifica versione file scaricato
Write-Host "[6] Verifica versione file scaricato..." -ForegroundColor Yellow
try {
    $content = Get-Content $tempFile -Raw -Encoding UTF8
    if ($content -match '\$SCRIPT_VERSION\s*=\s*["'']([\d\.]+)["'']') {
        $downloadedVersion = $matches[1]
        Write-Host "  Versione scaricata: $downloadedVersion" -ForegroundColor Green
    } else {
        Write-Host "  ATTENZIONE: Versione non trovata nel file!" -ForegroundColor Yellow
    }
    
    # Verifica sintassi base (parentesi graffe)
    $openBraces = ($content -split '{').Count - 1
    $closeBraces = ($content -split '}').Count - 1
    if ($openBraces -ne $closeBraces) {
        Write-Host "  ERRORE: Parentesi graffe sbilanciate! ($openBraces aperte, $closeBraces chiuse)" -ForegroundColor Red
        exit 1
    } else {
        Write-Host "  Sintassi base OK ($openBraces parentesi graffe bilanciate)" -ForegroundColor Green
    }
} catch {
    Write-Host "  ERRORE verifica file: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 7. Sostituisci file
Write-Host "[7] Sostituisci file..." -ForegroundColor Yellow
try {
    # Salva con encoding UTF8 senza BOM
    $content = Get-Content $tempFile -Raw -Encoding UTF8
    [System.IO.File]::WriteAllText($oldFile, $content, [System.Text.UTF8Encoding]::new($false))
    Remove-Item $tempFile -Force
    Write-Host "  File sostituito con successo" -ForegroundColor Green
} catch {
    Write-Host "  ERRORE sostituzione file: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 8. Reinstalla servizio
Write-Host "[8] Reinstalla servizio..." -ForegroundColor Yellow
$nssmPath = Join-Path $InstallDir "nssm.exe"
if (-not (Test-Path $nssmPath)) {
    Write-Host "  ERRORE: nssm.exe non trovato in $InstallDir" -ForegroundColor Red
    exit 1
}

$psPath = "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
if (-not (Test-Path $psPath)) {
    $psPath = "C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe"
}

$appParams = "-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File `"$oldFile`" -ConfigPath `"$configPath`""

try {
    & $nssmPath install "NetworkMonitorService" $psPath $appParams | Out-Null
    & $nssmPath set "NetworkMonitorService" AppDirectory $InstallDir | Out-Null
    & $nssmPath set "NetworkMonitorService" DisplayName "Network Monitor Agent Service" | Out-Null
    & $nssmPath set "NetworkMonitorService" Start SERVICE_AUTO_START | Out-Null
    Write-Host "  Servizio reinstallato" -ForegroundColor Green
} catch {
    Write-Host "  ERRORE reinstallazione servizio: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 9. Avvia servizio
Write-Host "[9] Avvia servizio..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
try {
    Start-Service -Name "NetworkMonitorService" -ErrorAction Stop
    Start-Sleep -Seconds 5
    
    $service = Get-Service -Name "NetworkMonitorService"
    if ($service.Status -eq "Running") {
        Write-Host "  Servizio avviato con successo!" -ForegroundColor Green
    } else {
        Write-Host "  ATTENZIONE: Servizio in stato: $($service.Status)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ERRORE avvio servizio: $_" -ForegroundColor Red
    Write-Host "  Controlla i log in: $InstallDir\NetworkMonitorService.log" -ForegroundColor Yellow
}
Write-Host ""

# 10. Verifica versione finale
Write-Host "[10] Verifica versione finale..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
$finalContent = Get-Content $oldFile -Raw -Encoding UTF8
if ($finalContent -match '\$SCRIPT_VERSION\s*=\s*["'']([\d\.]+)["'']') {
    $finalVersion = $matches[1]
    Write-Host "  Versione installata: $finalVersion" -ForegroundColor Green
} else {
    Write-Host "  ATTENZIONE: Versione non trovata!" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "AGGIORNAMENTO COMPLETATO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Controlla i log in: $InstallDir\NetworkMonitorService.log" -ForegroundColor Yellow
Write-Host ""
