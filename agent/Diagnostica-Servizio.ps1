# Diagnostica-Servizio.ps1
# Script di diagnostica completo per NetworkMonitorService su Windows Server 2012
# Verifica configurazione NSSM, PowerShell, log e identifica problemi

param(
    [string]$InstallDir = "C:\ProgramData\NetworkMonitorAgent"
)

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Diagnostica NetworkMonitorService" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verifica PowerShell
Write-Host "1. VERIFICA POWERSHELL" -ForegroundColor Yellow
Write-Host "   PowerShell Version: $($PSVersionTable.PSVersion)" -ForegroundColor White
Write-Host "   PowerShell Edition: $($PSVersionTable.PSEdition)" -ForegroundColor White
Write-Host "   OS: $($PSVersionTable.OS)" -ForegroundColor White
if ($PSVersionTable.PSVersion.Major -lt 4) {
    Write-Host "   ⚠️  PowerShell 4.0+ consigliato per funzionalità complete" -ForegroundColor Yellow
}
Write-Host ""

# 2. Verifica servizio Windows
Write-Host "2. VERIFICA SERVIZIO WINDOWS" -ForegroundColor Yellow
$ServiceName = "NetworkMonitorService"
try {
    $service = Get-Service -Name $ServiceName -ErrorAction Stop
    Write-Host "   ✅ Servizio '$ServiceName' trovato" -ForegroundColor Green
    Write-Host "   • Display Name: $($service.DisplayName)" -ForegroundColor White
    Write-Host "   • Status: $($service.Status)" -ForegroundColor $(if ($service.Status -eq 'Running') { 'Green' } else { 'Red' })
    Write-Host "   • Start Type: $($service.StartType)" -ForegroundColor White
    
    if ($service.Status -ne "Running") {
        Write-Host "   ⚠️  Il servizio non è in esecuzione!" -ForegroundColor Red
    }
} catch {
    Write-Host "   ❌ Servizio '$ServiceName' NON trovato!" -ForegroundColor Red
    Write-Host "   Il servizio non è stato installato." -ForegroundColor Yellow
}
Write-Host ""

# 3. Verifica NSSM
Write-Host "3. VERIFICA CONFIGURAZIONE NSSM" -ForegroundColor Yellow
$NssmPath = Join-Path $InstallDir "nssm.exe"
if (-not (Test-Path $NssmPath)) {
    Write-Host "   ❌ nssm.exe NON trovato in: $InstallDir" -ForegroundColor Red
} else {
    Write-Host "   ✅ nssm.exe trovato" -ForegroundColor Green
    
    try {
        # Recupera configurazione NSSM
        Write-Host "   Recupero configurazione NSSM..." -ForegroundColor Gray
        
        $appDir = & $NssmPath get $ServiceName AppDirectory 2>&1
        $appExe = & $NssmPath get $ServiceName Application 2>&1
        $appParams = & $NssmPath get $ServiceName AppParameters 2>&1
        $appStdout = & $NssmPath get $ServiceName AppStdout 2>&1
        $appStderr = & $NssmPath get $ServiceName AppStderr 2>&1
        
        Write-Host "   • AppDirectory: $appDir" -ForegroundColor White
        Write-Host "   • Application: $appExe" -ForegroundColor White
        Write-Host "   • AppParameters: $appParams" -ForegroundColor White
        
        # Verifica che AppDirectory esista
        if ($appDir -and (Test-Path $appDir)) {
            Write-Host "   ✅ AppDirectory esiste" -ForegroundColor Green
        } else {
            Write-Host "   ❌ AppDirectory NON esiste: $appDir" -ForegroundColor Red
        }
        
        # Verifica che Application esista
        if ($appExe -and (Test-Path $appExe)) {
            Write-Host "   ✅ Application esiste" -ForegroundColor Green
        } else {
            Write-Host "   ❌ Application NON esiste: $appExe" -ForegroundColor Red
        }
        
        # Verifica che lo script esista
        if ($appParams -match '-File\s+"([^"]+)"') {
            $scriptPath = $matches[1]
            Write-Host "   • Script Path (estratto): $scriptPath" -ForegroundColor White
            if (Test-Path $scriptPath) {
                Write-Host "   ✅ Script trovato" -ForegroundColor Green
            } else {
                Write-Host "   ❌ Script NON trovato: $scriptPath" -ForegroundColor Red
            }
        }
        
        Write-Host "   • Stdout Log: $appStdout" -ForegroundColor White
        Write-Host "   • Stderr Log: $appStderr" -ForegroundColor White
        
    } catch {
        Write-Host "   ⚠️  Errore recupero configurazione NSSM: $_" -ForegroundColor Yellow
    }
}
Write-Host ""

# 4. Verifica file necessari
Write-Host "4. VERIFICA FILE NECESSARI" -ForegroundColor Yellow
$requiredFiles = @(
    "NetworkMonitorService.ps1",
    "config.json",
    "nssm.exe"
)

foreach ($file in $requiredFiles) {
    $filePath = Join-Path $InstallDir $file
    if (Test-Path $filePath) {
        Write-Host "   ✅ $file" -ForegroundColor Green
        if ($file -eq "NetworkMonitorService.ps1") {
            # Verifica sintassi PowerShell
            try {
                $null = [System.Management.Automation.PSParser]::Tokenize((Get-Content $filePath -Raw), [ref]$null)
                Write-Host "      • Sintassi PowerShell: OK" -ForegroundColor Gray
            } catch {
                Write-Host "      • ⚠️  Errore sintassi PowerShell: $_" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "   ❌ $file NON trovato" -ForegroundColor Red
        Write-Host "      Percorso cercato: $filePath" -ForegroundColor Gray
    }
}
Write-Host ""

# 5. Verifica config.json
Write-Host "5. VERIFICA CONFIG.JSON" -ForegroundColor Yellow
$configPath = Join-Path $InstallDir "config.json"
if (Test-Path $configPath) {
    Write-Host "   ✅ config.json trovato" -ForegroundColor Green
    try {
        $config = Get-Content $configPath -Raw | ConvertFrom-Json
        Write-Host "   • Server URL: $($config.server_url)" -ForegroundColor White
        $apiKeyPreview = if ($config.api_key) { $config.api_key.Substring(0, [Math]::Min(10, $config.api_key.Length)) } else { "N/A" }
        Write-Host "   • API Key: $apiKeyPreview..." -ForegroundColor White
        Write-Host "   • Reti: $($config.network_ranges -join ', ')" -ForegroundColor White
        Write-Host "   • Intervallo: $($config.scan_interval_minutes) minuti" -ForegroundColor White
    } catch {
        Write-Host "   ❌ Errore lettura config.json: $_" -ForegroundColor Red
    }
} else {
    Write-Host "   ❌ config.json NON trovato!" -ForegroundColor Red
}
Write-Host ""

# 6. Verifica log
Write-Host "6. VERIFICA LOG" -ForegroundColor Yellow
$logFiles = @(
    "NetworkMonitorService.log",
    "NetworkMonitorService_bootstrap.log",
    "NetworkMonitorService_stdout.log",
    "NetworkMonitorService_stderr.log"
)

foreach ($logFile in $logFiles) {
    $logPath = Join-Path $InstallDir $logFile
    if (Test-Path $logPath) {
        $logSize = (Get-Item $logPath).Length
        $lastWrite = (Get-Item $logPath).LastWriteTime
        Write-Host "   ✅ $logFile" -ForegroundColor Green
        Write-Host "      • Dimensione: $([Math]::Round($logSize / 1KB, 2)) KB" -ForegroundColor Gray
        Write-Host "      • Ultima modifica: $lastWrite" -ForegroundColor Gray
        
        if ($logSize -gt 0) {
            Write-Host "      • Ultime 3 righe:" -ForegroundColor Gray
            $lastLines = Get-Content $logPath -Tail 3 -ErrorAction SilentlyContinue
            foreach ($line in $lastLines) {
                Write-Host "        $line" -ForegroundColor DarkGray
            }
        } else {
            Write-Host "      • ⚠️  File vuoto (nessun output)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   ⚠️  $logFile NON trovato" -ForegroundColor Yellow
    }
}
Write-Host ""

# 7. Test esecuzione manuale script
Write-Host "7. TEST ESECUZIONE MANUALE" -ForegroundColor Yellow
$scriptPath = Join-Path $InstallDir "NetworkMonitorService.ps1"
$configPath = Join-Path $InstallDir "config.json"

if (Test-Path $scriptPath) {
    Write-Host "   Provo a eseguire lo script manualmente..." -ForegroundColor Gray
    Write-Host "   (Questo testerà se lo script funziona prima di arrivare al loop principale)" -ForegroundColor Gray
    Write-Host ""
    
    $testCmd = "& `"$scriptPath`" -ConfigPath `"$configPath`""
    Write-Host "   Comando: powershell.exe -NoProfile -ExecutionPolicy Bypass -Command `"$testCmd; exit`"" -ForegroundColor DarkGray
    Write-Host ""
    
    Write-Host "   ⚠️  ATTENZIONE: Questo avvierà lo script in foreground." -ForegroundColor Yellow
    Write-Host "   Premi Ctrl+C dopo 5 secondi per fermarlo." -ForegroundColor Yellow
    Write-Host ""
    
    $response = Read-Host "   Vuoi eseguire il test? (S/N)"
    if ($response -eq "S" -or $response -eq "s") {
        try {
            Write-Host "   Avvio test..." -ForegroundColor Yellow
            Write-Host ""
            
            # Esegui per 5 secondi poi termina
            $job = Start-Job -ScriptBlock {
                param($script, $config)
                Set-Location (Split-Path $script -Parent)
                & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $script -ConfigPath $config
            } -ArgumentList $scriptPath, $configPath
            
            Start-Sleep -Seconds 5
            Stop-Job -Job $job -ErrorAction SilentlyContinue
            Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
            
            Write-Host "   ✅ Test completato (5 secondi)" -ForegroundColor Green
            Write-Host "   Controlla i log per vedere se ci sono stati errori." -ForegroundColor Gray
        } catch {
            Write-Host "   ❌ Errore durante test: $_" -ForegroundColor Red
            Write-Host "   Stack: $($_.Exception.StackTrace)" -ForegroundColor DarkGray
        }
    } else {
        Write-Host "   Test saltato." -ForegroundColor Gray
    }
} else {
    Write-Host "   ⚠️  Script non trovato, impossibile testare" -ForegroundColor Yellow
}
Write-Host ""

# 8. Verifica problemi comuni Server 2012
Write-Host "8. VERIFICA PROBLEMI COMUNI SERVER 2012" -ForegroundColor Yellow

# Verifica .NET Framework
try {
    $netVersion = (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full\" -ErrorAction SilentlyContinue).Release
    if ($netVersion) {
        Write-Host "   • .NET Framework: Release $netVersion" -ForegroundColor White
        if ($netVersion -lt 378389) {
            Write-Host "   ⚠️  .NET Framework 4.5+ consigliato" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "   ⚠️  Impossibile verificare .NET Framework" -ForegroundColor Yellow
}

# Verifica permessi
$canWrite = $false
try {
    $testFile = Join-Path $InstallDir ".test_write_access.txt"
    "test" | Out-File -FilePath $testFile -ErrorAction Stop
    Remove-Item $testFile -ErrorAction SilentlyContinue
    $canWrite = $true
} catch {
    $canWrite = $false
}

if ($canWrite) {
    Write-Host "   ✅ Permessi scrittura OK" -ForegroundColor Green
} else {
    Write-Host "   ❌ Problemi permessi scrittura in: $InstallDir" -ForegroundColor Red
    Write-Host "      Verifica che il servizio abbia i permessi necessari." -ForegroundColor Yellow
}

Write-Host ""

# 9. Riepilogo e raccomandazioni
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "RIEPILOGO E RACCOMANDAZIONI" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $service) {
    Write-Host "❌ Il servizio non è installato." -ForegroundColor Red
    Write-Host "   Esegui: .\Installa-Servizio.ps1" -ForegroundColor Yellow
} elseif ($service.Status -ne "Running") {
    Write-Host "⚠️  Il servizio è installato ma non è in esecuzione." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   Prova questi comandi:" -ForegroundColor White
    Write-Host "   1. Avvia manualmente:" -ForegroundColor Gray
    Write-Host "      Start-Service -Name '$ServiceName'" -ForegroundColor White
    Write-Host ""
    Write-Host "   2. Se fallisce, controlla i log:" -ForegroundColor Gray
    Write-Host "      Get-Content '$InstallDir\NetworkMonitorService_stderr.log' -Tail 50" -ForegroundColor White
    Write-Host "      Get-Content '$InstallDir\NetworkMonitorService_bootstrap.log' -Tail 50" -ForegroundColor White
    Write-Host ""
    Write-Host "   3. Verifica configurazione NSSM:" -ForegroundColor Gray
    Write-Host "      .\nssm.exe get $ServiceName Application" -ForegroundColor White
    Write-Host "      .\nssm.exe get $ServiceName AppParameters" -ForegroundColor White
    Write-Host ""
    Write-Host "   4. Prova a eseguire lo script manualmente:" -ForegroundColor Gray
    Write-Host "      cd $InstallDir" -ForegroundColor White
    Write-Host "      powershell.exe -NoProfile -ExecutionPolicy Bypass -File NetworkMonitorService.ps1 -ConfigPath config.json" -ForegroundColor White
    Write-Host ""
    Write-Host "   5. Se lo script manuale funziona ma il servizio no, verifica NSSM AppDirectory:" -ForegroundColor Gray
    Write-Host "      .\nssm.exe set $ServiceName AppDirectory $InstallDir" -ForegroundColor White
} else {
    Write-Host "✅ Il servizio è installato e in esecuzione!" -ForegroundColor Green
}

Write-Host ""
Write-Host "Premi un tasto per uscire..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
