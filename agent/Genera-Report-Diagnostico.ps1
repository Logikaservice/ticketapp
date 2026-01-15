# Genera-Report-Diagnostico.ps1
# Genera un report completo per diagnosticare problemi dell'agent

$InstallDir = "C:\ProgramData\NetworkMonitorAgent"
$ReportFile = Join-Path $env:TEMP "AgentDiagnostico_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt"

Write-Host "Generazione report diagnostico..." -ForegroundColor Yellow
Write-Host "File report: $ReportFile" -ForegroundColor Cyan
Write-Host ""

$report = @"

========================================
REPORT DIAGNOSTICO NETWORK MONITOR AGENT
Generato: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
========================================

"@

# 1. Stato servizio
$report += "`n[1] STATO SERVIZIO`n"
$report += "=" * 50 + "`n"
try {
    $service = Get-Service -Name "NetworkMonitorService" -ErrorAction Stop
    $report += "Nome: $($service.Name)`n"
    $report += "Status: $($service.Status)`n"
    $report += "StartType: $($service.StartType)`n"
} catch {
    $report += "ERRORE: Servizio non trovato!`n"
}
$report += "`n"

# 2. Configurazione
$report += "`n[2] CONFIGURAZIONE (config.json)`n"
$report += "=" * 50 + "`n"
$configPath = Join-Path $InstallDir "config.json"
if (Test-Path $configPath) {
    try {
        $config = Get-Content $configPath -Raw | ConvertFrom-Json
        $report += "Server URL: $($config.server_url)`n"
        $report += "Agent Name: $($config.agent_name)`n"
        $report += "Network Ranges: $($config.network_ranges -join ', ')`n"
        $report += "Scan Interval: $($config.scan_interval_minutes) minuti`n"
        $report += "Version: $($config.version)`n"
        $report += "API Key: $($config.api_key.Substring(0, [Math]::Min(10, $config.api_key.Length)))... (primi 10 caratteri)`n"
    } catch {
        $report += "ERRORE: Impossibile leggere config.json: $_`n"
    }
} else {
    $report += "ERRORE: config.json non trovato in $configPath`n"
}
$report += "`n"

# 3. File presenti
$report += "`n[3] FILE PRESENTI NELLA DIRECTORY`n"
$report += "=" * 50 + "`n"
if (Test-Path $InstallDir) {
    $files = Get-ChildItem -Path $InstallDir -File | Select-Object Name, Length, LastWriteTime
    foreach ($file in $files) {
        $report += "$($file.Name) - $([Math]::Round($file.Length/1KB, 2)) KB - $($file.LastWriteTime)`n"
    }
} else {
    $report += "ERRORE: Directory $InstallDir non trovata!`n"
}
$report += "`n"

# 4. Log Bootstrap (primi errori)
$report += "`n[4] LOG BOOTSTRAP (Ultime 30 righe)`n"
$report += "=" * 50 + "`n"
$bootstrapLog = Join-Path $InstallDir "NetworkMonitorService_bootstrap.log"
if (Test-Path $bootstrapLog) {
    try {
        $bootstrapContent = Get-Content $bootstrapLog -Tail 30 -ErrorAction Stop
        $report += ($bootstrapContent -join "`n") + "`n"
    } catch {
        $report += "ERRORE: Impossibile leggere bootstrap log: $_`n"
    }
} else {
    $report += "File bootstrap log non trovato.`n"
}
$report += "`n"

# 5. Log Principale (ultime 50 righe)
$report += "`n[5] LOG PRINCIPALE (Ultime 50 righe)`n"
$report += "=" * 50 + "`n"
$mainLog = Join-Path $InstallDir "NetworkMonitorService.log"
if (Test-Path $mainLog) {
    try {
        $mainContent = Get-Content $mainLog -Tail 50 -ErrorAction Stop
        $report += ($mainContent -join "`n") + "`n"
    } catch {
        $report += "ERRORE: Impossibile leggere log principale: $_`n"
    }
} else {
    $report += "File log principale non trovato.`n"
}
$report += "`n"

# 6. Log Errori (ultime 30 righe)
$report += "`n[6] LOG ERRORI (Ultime 30 righe)`n"
$report += "=" * 50 + "`n"
$errorLog = Join-Path $InstallDir "NetworkMonitorService_stderr.log"
if (Test-Path $errorLog) {
    try {
        $errorContent = Get-Content $errorLog -Tail 30 -ErrorAction Stop
        if ($errorContent) {
            $report += ($errorContent -join "`n") + "`n"
        } else {
            $report += "Nessun errore trovato.`n"
        }
    } catch {
        $report += "ERRORE: Impossibile leggere log errori: $_`n"
    }
} else {
    $report += "File log errori non trovato.`n"
}
$report += "`n"

# 7. Test connessione server
$report += "`n[7] TEST CONNESSIONE AL SERVER`n"
$report += "=" * 50 + "`n"
if (Test-Path $configPath) {
    try {
        $config = Get-Content $configPath -Raw | ConvertFrom-Json
        $serverUrl = $config.server_url
        
        # Test ping (se possibile)
        try {
            $uri = [System.Uri]$serverUrl
            $hostname = $uri.Host
            $report += "Test connessione a: $hostname`n"
            
            $ping = Test-Connection -ComputerName $hostname -Count 2 -ErrorAction Stop
            $report += "✅ Ping riuscito (tempo medio: $([Math]::Round(($ping | Measure-Object -Property ResponseTime -Average).Average, 2)) ms)`n"
        } catch {
            $report += "⚠️  Ping fallito: $_`n"
        }
        
        # Test HTTPS
        try {
            $testUrl = "$serverUrl/api/network-monitoring/agent/config"
            $headers = @{
                "X-API-Key" = $config.api_key
            }
            
            # Forza TLS 1.2
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            
            $response = Invoke-WebRequest -Uri $testUrl -Method GET -Headers $headers -TimeoutSec 10 -ErrorAction Stop
            $report += "✅ Test HTTPS riuscito (status: $($response.StatusCode))`n"
        } catch {
            $report += "❌ Test HTTPS fallito: $_`n"
            $report += "   Dettagli: $($_.Exception.Message)`n"
        }
    } catch {
        $report += "ERRORE: Impossibile testare connessione: $_`n"
    }
} else {
    $report += "Impossibile testare connessione: config.json non trovato.`n"
}
$report += "`n"

# 8. Informazioni sistema
$report += "`n[8] INFORMAZIONI SISTEMA`n"
$report += "=" * 50 + "`n"
$report += "Computer Name: $env:COMPUTERNAME`n"
$report += "OS: $((Get-CimInstance Win32_OperatingSystem).Caption)`n"
$report += "PowerShell Version: $($PSVersionTable.PSVersion)`n"
$report += "Architecture: $($env:PROCESSOR_ARCHITECTURE)`n"
$report += "`n"

# Salva report
try {
    $report | Out-File -FilePath $ReportFile -Encoding UTF8
    Write-Host "✅ Report salvato in: $ReportFile" -ForegroundColor Green
    Write-Host ""
    Write-Host "Copia il contenuto del file e incollalo qui nella chat per l'analisi." -ForegroundColor Yellow
    Write-Host ""
    
    # Apri il file nell'editor di testo
    notepad.exe $ReportFile
} catch {
    Write-Host "ERRORE: Impossibile salvare il report: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Contenuto report:" -ForegroundColor Yellow
    Write-Host $report
}
