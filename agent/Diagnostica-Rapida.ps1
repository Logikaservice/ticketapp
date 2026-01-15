# Diagnostica-Rapida.ps1
# Script rapido per vedere subito cosa non funziona

$InstallDir = "C:\ProgramData\NetworkMonitorAgent"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "DIAGNOSTICA RAPIDA AGENT" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Stato servizio
Write-Host "[1] STATO SERVIZIO" -ForegroundColor Yellow
try {
    $service = Get-Service -Name "NetworkMonitorService" -ErrorAction Stop
    Write-Host "  Status: $($service.Status)" -ForegroundColor $(if ($service.Status -eq 'Running') { 'Green' } else { 'Red' })
} catch {
    Write-Host "  ERRORE: Servizio non trovato!" -ForegroundColor Red
}
Write-Host ""

# 2. Configurazione
Write-Host "[2] CONFIGURAZIONE" -ForegroundColor Yellow
$configPath = Join-Path $InstallDir "config.json"
if (Test-Path $configPath) {
    $config = Get-Content $configPath | ConvertFrom-Json
    Write-Host "  Server URL: $($config.server_url)"
    Write-Host "  Agent Name: $($config.agent_name)"
    Write-Host "  API Key: $($config.api_key.Substring(0, [Math]::Min(10, $config.api_key.Length)))..."
} else {
    Write-Host "  ERRORE: config.json non trovato!" -ForegroundColor Red
}
Write-Host ""

# 3. Log principali (ultime 10 righe)
Write-Host "[3] LOG PRINCIPALE (ultime 10 righe)" -ForegroundColor Yellow
$logPath = Join-Path $InstallDir "NetworkMonitorService.log"
if (Test-Path $logPath) {
    Get-Content $logPath -Tail 10
} else {
    Write-Host "  Log non trovato" -ForegroundColor Red
}
Write-Host ""

# 4. Log errori (ultime 10 righe)
Write-Host "[4] LOG ERRORI (ultime 10 righe)" -ForegroundColor Yellow
$errorLogPath = Join-Path $InstallDir "NetworkMonitorService_stderr.log"
if (Test-Path $errorLogPath) {
    $errors = Get-Content $errorLogPath -Tail 10
    if ($errors) {
        Write-Host $errors
    } else {
        Write-Host "  Nessun errore"
    }
} else {
    Write-Host "  Log errori non trovato"
}
Write-Host ""

# 5. Test connessione
Write-Host "[5] TEST CONNESSIONE" -ForegroundColor Yellow
if (Test-Path $configPath) {
    $config = Get-Content $configPath | ConvertFrom-Json
    try {
        $uri = [System.Uri]$config.server_url
        $hostname = $uri.Host
        Write-Host "  Test ping a: $hostname"
        $ping = Test-Connection -ComputerName $hostname -Count 2 -ErrorAction Stop
        Write-Host "  ✅ Ping riuscito" -ForegroundColor Green
    } catch {
        Write-Host "  ❌ Ping fallito: $_" -ForegroundColor Red
    }
    
    # Test HTTPS
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $testUrl = "$($config.server_url)/api/network-monitoring/agent/config"
        $headers = @{ "X-API-Key" = $config.api_key }
        $response = Invoke-WebRequest -Uri $testUrl -Method GET -Headers $headers -TimeoutSec 10 -ErrorAction Stop
        Write-Host "  ✅ Test HTTPS riuscito (status: $($response.StatusCode))" -ForegroundColor Green
    } catch {
        Write-Host "  ❌ Test HTTPS fallito: $($_.Exception.Message)" -ForegroundColor Red
    }
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
pause
