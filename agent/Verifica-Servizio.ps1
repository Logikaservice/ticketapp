# Script di verifica per NetworkMonitor Service
# Verifica lo stato del servizio e mostra i log recenti

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Verifica NetworkMonitor Service" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ServiceName = "NetworkMonitorService"
$InstallDir = "C:\ProgramData\NetworkMonitorAgent"

# 1. Verifica stato servizio
Write-Host "1. Stato Servizio..." -ForegroundColor Yellow
try {
    $service = Get-Service -Name $ServiceName -ErrorAction Stop
    Write-Host "   Servizio: $ServiceName" -ForegroundColor White
    Write-Host "   Stato: $($service.Status)" -ForegroundColor $(if ($service.Status -eq "Running") { "Green" } else { "Red" })
    Write-Host "   Tipo Avvio: $($service.StartType)" -ForegroundColor White
    Write-Host ""
    
    if ($service.Status -ne "Running") {
        Write-Host "   ATTENZIONE: Il servizio NON e' in esecuzione!" -ForegroundColor Red
        Write-Host "   Per avviarlo, esegui PowerShell come Amministratore:" -ForegroundColor Yellow
        Write-Host "   Start-Service -Name '$ServiceName'" -ForegroundColor Gray
        Write-Host ""
    }
} catch {
    Write-Host "   ERRORE: Servizio '$ServiceName' NON trovato!" -ForegroundColor Red
    Write-Host ""
}

# 2. Verifica config.json
Write-Host "2. Configurazione..." -ForegroundColor Yellow
$configPath = Join-Path $InstallDir "config.json"
if (Test-Path $configPath) {
    Write-Host "   config.json trovato: $configPath" -ForegroundColor Green
    try {
        $config = Get-Content $configPath -Raw | ConvertFrom-Json
        Write-Host "   Server URL: $($config.server_url)" -ForegroundColor White
        $apiKeyPreview = if ($config.api_key) { $config.api_key.Substring(0, [Math]::Min(20, $config.api_key.Length)) + "..." } else { "N/A" }
        Write-Host "   API Key: $apiKeyPreview" -ForegroundColor White
        Write-Host "   Network Ranges: $($config.network_ranges -join ', ')" -ForegroundColor White
        Write-Host "   Scan Interval: $($config.scan_interval_minutes) minuti" -ForegroundColor White
        Write-Host ""
    } catch {
        Write-Host "   ERRORE: Impossibile leggere config.json: $_" -ForegroundColor Red
        Write-Host ""
    }
} else {
    Write-Host "   ERRORE: config.json NON trovato in $InstallDir" -ForegroundColor Red
    Write-Host ""
}

# 3. Verifica log principali
Write-Host "3. Log Servizio..." -ForegroundColor Yellow
$logPath = Join-Path $InstallDir "NetworkMonitorService.log"
if (Test-Path $logPath) {
    Write-Host "   Log principale: $logPath" -ForegroundColor Green
    Write-Host "   Ultime 20 righe:" -ForegroundColor White
    Write-Host "   ----------------------------------------" -ForegroundColor Gray
    try {
        Get-Content $logPath -Tail 20 | ForEach-Object {
            Write-Host "   $_" -ForegroundColor $(if ($_ -match "ERROR|ERRORE|Errore") { "Red" } elseif ($_ -match "WARN|ATTENZIONE") { "Yellow" } else { "White" })
        }
    } catch {
        Write-Host "   ERRORE lettura log: $_" -ForegroundColor Red
    }
    Write-Host "   ----------------------------------------" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "   Log principale non trovato: $logPath" -ForegroundColor Yellow
    Write-Host ""
}

# 4. Verifica log stdout/stderr (NSSM)
Write-Host "4. Log NSSM (stdout/stderr)..." -ForegroundColor Yellow
$stdoutPath = Join-Path $InstallDir "NetworkMonitorService_stdout.log"
$stderrPath = Join-Path $InstallDir "NetworkMonitorService_stderr.log"

if (Test-Path $stdoutPath) {
    Write-Host "   stdout.log trovato" -ForegroundColor Green
    Write-Host "   Ultime 10 righe:" -ForegroundColor White
    Write-Host "   ----------------------------------------" -ForegroundColor Gray
    try {
        Get-Content $stdoutPath -Tail 10 | ForEach-Object {
            Write-Host "   $_" -ForegroundColor White
        }
    } catch {
        Write-Host "   ERRORE lettura stdout: $_" -ForegroundColor Red
    }
    Write-Host "   ----------------------------------------" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "   stdout.log non trovato (servizio potrebbe non essere ancora partito)" -ForegroundColor Yellow
    Write-Host ""
}

if (Test-Path $stderrPath) {
    $stderrContent = Get-Content $stderrPath -ErrorAction SilentlyContinue
    if ($stderrContent) {
        Write-Host "   stderr.log trovato (contiene errori!)" -ForegroundColor Red
        Write-Host "   Ultimi errori:" -ForegroundColor White
        Write-Host "   ----------------------------------------" -ForegroundColor Gray
        Get-Content $stderrPath -Tail 10 | ForEach-Object {
            Write-Host "   $_" -ForegroundColor Red
        }
        Write-Host "   ----------------------------------------" -ForegroundColor Gray
        Write-Host ""
    } else {
        Write-Host "   stderr.log vuoto (nessun errore)" -ForegroundColor Green
        Write-Host ""
    }
}

# 5. Test connessione server
Write-Host "5. Test connessione server..." -ForegroundColor Yellow
if ($config -and $config.server_url -and $config.api_key) {
    try {
        $testUrl = "$($config.server_url)/api/health"
        Write-Host "   Test URL: $testUrl" -ForegroundColor White
        
        $response = Invoke-WebRequest -Uri $testUrl -Method GET -TimeoutSec 5 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "   Connessione server: OK" -ForegroundColor Green
        } else {
            Write-Host "   Connessione server: Errore HTTP $($response.StatusCode)" -ForegroundColor Red
        }
        Write-Host ""
    } catch {
        Write-Host "   ERRORE connessione server: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "   Verifica che il server URL sia corretto e raggiungibile" -ForegroundColor Yellow
        Write-Host ""
    }
} else {
    Write-Host "   Configurazione incompleta, impossibile testare connessione" -ForegroundColor Yellow
    Write-Host ""
}

# 6. Status file
Write-Host "6. File Status..." -ForegroundColor Yellow
$statusPath = Join-Path $InstallDir ".agent_status.json"
if (Test-Path $statusPath) {
    try {
        $status = Get-Content $statusPath -Raw | ConvertFrom-Json
        Write-Host "   Status: $($status.status)" -ForegroundColor White
        Write-Host "   Messaggio: $($status.message)" -ForegroundColor White
        if ($status.last_scan) {
            $lastScan = [DateTime]::Parse($status.last_scan)
            Write-Host "   Ultima scansione: $($lastScan.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor White
        }
        if ($status.devices_found) {
            Write-Host "   Dispositivi trovati: $($status.devices_found)" -ForegroundColor White
        }
        Write-Host ""
    } catch {
        Write-Host "   Errore lettura status file: $_" -ForegroundColor Yellow
        Write-Host ""
    }
} else {
    Write-Host "   Status file non trovato" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Verifica completata" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Suggerimenti:" -ForegroundColor Yellow
Write-Host "• Se il servizio non e' Running, avvialo con:" -ForegroundColor White
Write-Host "  Start-Service -Name '$ServiceName'" -ForegroundColor Gray
Write-Host ""
Write-Host "• Per vedere tutti i log:" -ForegroundColor White
Write-Host "  Get-Content '$logPath' -Tail 50" -ForegroundColor Gray
Write-Host ""
Write-Host "• Per riavviare il servizio:" -ForegroundColor White
Write-Host "  Restart-Service -Name '$ServiceName'" -ForegroundColor Gray
Write-Host ""
Write-Host "Premi un tasto per uscire..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
