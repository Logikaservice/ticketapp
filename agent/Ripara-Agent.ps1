# Ripara-Agent.ps1
# Script di auto-riparazione per Network Monitor Agent
# Rileva problemi e li risolve automaticamente

# Verifica privilegi admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERRORE: Questo script richiede privilegi amministratore!" -ForegroundColor Red
    Write-Host "Esegui PowerShell come amministratore e riprova." -ForegroundColor Yellow
    pause
    exit 1
}

$installDir = "C:\ProgramData\NetworkMonitorAgent"
$serviceName = "NetworkMonitorService"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Network Monitor Agent - Auto-Riparazione" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verifica stato servizio
Write-Host "1. VERIFICA STATO SERVIZIO" -ForegroundColor Yellow
$service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($service) {
    Write-Host "   Servizio trovato: $($service.Status)" -ForegroundColor $(if ($service.Status -eq "Running") { "Green" } else { "Yellow" })
    
    if ($service.Status -eq "Paused" -or $service.Status -eq "Stopped") {
        Write-Host "   ⚠️  Servizio non in esecuzione!" -ForegroundColor Yellow
        
        # Prova a riavviare
        Write-Host "   Tentativo riavvio..." -ForegroundColor Cyan
        try {
            Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 3
            Start-Service -Name $serviceName -ErrorAction Stop
            Start-Sleep -Seconds 5
            $service.Refresh()
            if ($service.Status -eq "Running") {
                Write-Host "   ✅ Servizio riavviato con successo!" -ForegroundColor Green
                exit 0
            } else {
                Write-Host "   ❌ Riavvio fallito, procedo con reinstallazione..." -ForegroundColor Red
            }
        } catch {
            Write-Host "   ❌ Errore riavvio: $_" -ForegroundColor Red
            Write-Host "   Procedo con reinstallazione..." -ForegroundColor Yellow
        }
    } else {
        Write-Host "   ✅ Servizio in esecuzione correttamente!" -ForegroundColor Green
        exit 0
    }
} else {
    Write-Host "   ⚠️  Servizio non trovato!" -ForegroundColor Yellow
}

# 2. Verifica file necessari
Write-Host ""
Write-Host "2. VERIFICA FILE NECESSARI" -ForegroundColor Yellow
$requiredFiles = @(
    "NetworkMonitorService.ps1",
    "config.json",
    "nssm.exe"
)

$missingFiles = @()
foreach ($file in $requiredFiles) {
    $filePath = Join-Path $installDir $file
    if (Test-Path $filePath) {
        Write-Host "   ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $file NON TROVATO!" -ForegroundColor Red
        $missingFiles += $file
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host ""
    Write-Host "ERRORE: File mancanti! Reinstalla l'agent dal sito." -ForegroundColor Red
    Write-Host "File mancanti: $($missingFiles -join ', ')" -ForegroundColor Red
    pause
    exit 1
}

# 2.1 Verifica sintassi NetworkMonitorService.ps1
Write-Host ""
Write-Host "2.1 VERIFICA SINTASSI NetworkMonitorService.ps1" -ForegroundColor Yellow
$serviceScript = Join-Path $installDir "NetworkMonitorService.ps1"
$configPath = Join-Path $installDir "config.json"
$needsDownload = $false

if (Test-Path $serviceScript) {
    # Verifica bilanciamento parentesi graffe
    $content = Get-Content $serviceScript -Raw -ErrorAction SilentlyContinue
    if ($content) {
        $openBraces = ([regex]::Matches($content, '\{')).Count
        $closeBraces = ([regex]::Matches($content, '\}')).Count
        
        if ($openBraces -ne $closeBraces) {
            Write-Host "   ❌ ERRORE: Parentesi graffe sbilanciate! ($openBraces aperte, $closeBraces chiuse)" -ForegroundColor Red
            $needsDownload = $true
        } else {
            Write-Host "   ✅ Parentesi graffe bilanciate ($openBraces/$closeBraces)" -ForegroundColor Green
            
            # Verifica sintassi PowerShell
            Write-Host "   Verifica sintassi PowerShell..." -ForegroundColor Cyan
            $syntaxErrors = $null
            try {
                $null = [System.Management.Automation.PSParser]::Tokenize($content, [ref]$syntaxErrors)
                if ($syntaxErrors.Count -gt 0) {
                    Write-Host "   ❌ ERRORE: Errori di sintassi trovati!" -ForegroundColor Red
                    foreach ($err in $syntaxErrors) {
                        Write-Host "      Linea $($err.Token.StartLine): $($err.Message)" -ForegroundColor Red
                    }
                    $needsDownload = $true
                } else {
                    Write-Host "   ✅ Sintassi PowerShell valida" -ForegroundColor Green
                    $needsDownload = $false
                }
            } catch {
                # Se il parser fallisce, prova con PowerShell stesso
                Write-Host "   ⚠️  Verifica sintassi avanzata..." -ForegroundColor Yellow
                $testResult = powershell.exe -NoProfile -Command "& { `$ErrorActionPreference='Stop'; try { . '$serviceScript' -WhatIf 2>&1 | Out-Null; `$true } catch { `$false } }" 2>&1
                if ($LASTEXITCODE -ne 0 -or $testResult -like "*ParserError*" -or $testResult -like "*UnexpectedToken*") {
                    Write-Host "   ❌ ERRORE: File PowerShell corrotto o con errori di sintassi!" -ForegroundColor Red
                    $needsDownload = $true
                } else {
                    Write-Host "   ✅ File PowerShell valido" -ForegroundColor Green
                    $needsDownload = $false
                }
            }
        }
    } else {
        Write-Host "   ❌ ERRORE: File vuoto o non leggibile!" -ForegroundColor Red
        $needsDownload = $true
    }
    
    # Se necessario, scarica file corretto dal server
    if ($needsDownload) {
        Write-Host ""
        Write-Host "   📥 Download file corretto dal server..." -ForegroundColor Cyan
        
        # Leggi config.json per ottenere server_url
        $serverUrl = $null
        if (Test-Path $configPath) {
            try {
                $config = Get-Content $configPath -Raw | ConvertFrom-Json
                $serverUrl = $config.server_url
            } catch {
                Write-Host "   ⚠️  Impossibile leggere config.json: $_" -ForegroundColor Yellow
            }
        }
        
        if (-not $serverUrl) {
            Write-Host "   ❌ ERRORE: Impossibile determinare server URL da config.json!" -ForegroundColor Red
            Write-Host "   Reinstalla l agent dal sito web." -ForegroundColor Yellow
            pause
            exit 1
        }
        
        # Costruisci URL download
        $baseUrl = $serverUrl -replace '/api.*', ''
        $downloadUrl = "$baseUrl/api/network-monitoring/download/agent/NetworkMonitorService.ps1"
        
        Write-Host "   Server: $baseUrl" -ForegroundColor Gray
        Write-Host "   URL: $downloadUrl" -ForegroundColor Gray
        
        try {
            # Backup file corrotto
            $backupFile = "$serviceScript.corrupted.backup"
            Copy-Item $serviceScript $backupFile -Force -ErrorAction SilentlyContinue
            Write-Host "   💾 Backup file corrotto salvato" -ForegroundColor Gray
            
            # Forza TLS 1.2
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            
            # Download file corretto
            $tempFile = "$serviceScript.new"
            Invoke-WebRequest -Uri $downloadUrl -OutFile $tempFile -TimeoutSec 30 -ErrorAction Stop
            
            if (Test-Path $tempFile) {
                # Verifica che il file scaricato sia valido
                $newContent = Get-Content $tempFile -Raw
                $newOpen = ([regex]::Matches($newContent, '\{')).Count
                $newClose = ([regex]::Matches($newContent, '\}')).Count
                
                if ($newOpen -eq $newClose -and $newOpen -gt 0) {
                    # Sostituisci file corrotto
                    Move-Item $tempFile $serviceScript -Force
                    Write-Host "   ✅ File corretto scaricato e installato!" -ForegroundColor Green
                    Write-Host "   ✅ Parentesi graffe: $newOpen/$newClose bilanciate" -ForegroundColor Green
                } else {
                    Write-Host "   ❌ ERRORE: File scaricato è ancora corrotto!" -ForegroundColor Red
                    Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
                    pause
                    exit 1
                }
            } else {
                Write-Host "   ❌ ERRORE: Download fallito!" -ForegroundColor Red
                pause
                exit 1
            }
        } catch {
            Write-Host "   ❌ ERRORE durante download: $_" -ForegroundColor Red
            Write-Host "   Reinstalla l agent dal sito web." -ForegroundColor Yellow
            pause
            exit 1
        }
    }
} else {
    Write-Host "   ⚠️  File NetworkMonitorService.ps1 non trovato!" -ForegroundColor Yellow
}

# 3. Rimuovi servizio esistente
Write-Host ""
Write-Host "3. RIMOZIONE SERVIZIO ESISTENTE" -ForegroundColor Yellow
if ($service) {
    try {
        Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 3
        sc.exe delete $serviceName | Out-Null
        Start-Sleep -Seconds 5
        Write-Host "   ✅ Servizio rimosso" -ForegroundColor Green
    } catch {
        Write-Host "   ⚠️  Errore rimozione: $_" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ℹ️  Nessun servizio da rimuovere" -ForegroundColor Gray
}

# 4. Termina processi vecchi
Write-Host ""
Write-Host "4. TERMINA PROCESSI VECCHI" -ForegroundColor Yellow
$trayProcesses = Get-WmiObject Win32_Process | Where-Object { 
    $_.CommandLine -like "*NetworkMonitorTrayIcon.ps1*" -or
    $_.CommandLine -like "*Start-TrayIcon-Hidden.vbs*"
} | Select-Object ProcessId

if ($trayProcesses) {
    foreach ($proc in $trayProcesses) {
        try {
            Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
        } catch { }
    }
    Write-Host "   ✅ Processi vecchi terminati" -ForegroundColor Green
} else {
    Write-Host "   ℹ️  Nessun processo vecchio da terminare" -ForegroundColor Gray
}

# 5. Reinstalla servizio
Write-Host ""
Write-Host "5. REINSTALLAZIONE SERVIZIO" -ForegroundColor Yellow
$nssmPath = Join-Path $installDir "nssm.exe"
$serviceScript = Join-Path $installDir "NetworkMonitorService.ps1"
$configPath = Join-Path $installDir "config.json"
$psPath = "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"

if (-not (Test-Path $psPath)) {
    $psPath = "C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe"
}

$appParams = "-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File `"$serviceScript`" -ConfigPath `"$configPath`""

try {
    & $nssmPath install $serviceName $psPath $appParams
    if ($LASTEXITCODE -eq 0) {
        & $nssmPath set $serviceName AppDirectory $installDir
        & $nssmPath set $serviceName DisplayName "Network Monitor Agent Service"
        & $nssmPath set $serviceName Start SERVICE_AUTO_START
        & $nssmPath set $serviceName AppRestartDelay 60000
        & $nssmPath set $serviceName AppExit Default Restart
        
        $stdoutLog = Join-Path $installDir "NetworkMonitorService_stdout.log"
        $stderrLog = Join-Path $installDir "NetworkMonitorService_stderr.log"
        & $nssmPath set $serviceName AppStdout $stdoutLog
        & $nssmPath set $serviceName AppStderr $stderrLog
        
        Write-Host "   ✅ Servizio reinstallato" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Errore installazione servizio!" -ForegroundColor Red
        pause
        exit 1
    }
} catch {
    Write-Host "   ❌ Errore: $_" -ForegroundColor Red
    pause
    exit 1
}

# 6. Avvia servizio
Write-Host ""
Write-Host "6. AVVIO SERVIZIO" -ForegroundColor Yellow
try {
    Start-Service -Name $serviceName -ErrorAction Stop
    Start-Sleep -Seconds 5
    $service = Get-Service -Name $serviceName
    if ($service.Status -eq "Running") {
        Write-Host "   ✅ Servizio avviato correttamente!" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Servizio avviato ma stato: $($service.Status)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Errore avvio servizio: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Controlla i log:" -ForegroundColor Yellow
    Write-Host "   - $stdoutLog" -ForegroundColor Gray
    Write-Host "   - $stderrLog" -ForegroundColor Gray
    pause
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Riparazione Completata!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
pause
