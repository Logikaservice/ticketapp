# Installa-Agent.ps1
# Installer unico e completo per Network Monitor Agent
# Gestisce installazione, aggiornamento e configurazione automatica

param(
    [switch]$Force
)

# Verifica privilegi admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host ""
    Write-Host "ERRORE: Questo script richiede privilegi amministratore!" -ForegroundColor Red
    Write-Host "Esegui PowerShell come amministratore e riprova." -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}

# Directory corrente (dove si trova lo script)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $scriptDir) { $scriptDir = $PSScriptRoot }
if (-not $scriptDir) { $scriptDir = Get-Location }

# Directory di installazione
$installDir = "C:\ProgramData\NetworkMonitorAgent"
$serviceName = "NetworkMonitorService"

# Leggi versione da NetworkMonitorService.ps1
$agentVersion = "1.0.0"
$serviceFile = Join-Path $scriptDir "NetworkMonitorService.ps1"
if (Test-Path $serviceFile) {
    try {
        $content = Get-Content $serviceFile -Raw
        if ($content -match '\$SCRIPT_VERSION\s*=\s*"([\d\.]+)"') {
            $agentVersion = $matches[1]
        }
    } catch {
        Write-Host "⚠️  Impossibile leggere versione, uso default: $agentVersion" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Network Monitor Agent v$agentVersion" -ForegroundColor Cyan
Write-Host "  Installer Completo" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verifica file necessari
Write-Host "1. VERIFICA FILE NECESSARI" -ForegroundColor Yellow
$requiredFiles = @(
    "NetworkMonitorService.ps1",
    "config.json",
    "nssm.exe"
)

$missingFiles = @()
foreach ($file in $requiredFiles) {
    $filePath = Join-Path $scriptDir $file
    if (Test-Path $filePath) {
        Write-Host "   ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $file NON TROVATO!" -ForegroundColor Red
        $missingFiles += $file
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host ""
    Write-Host "ERRORE: File mancanti:" -ForegroundColor Red
    $missingFiles | ForEach-Object { Write-Host "   - $_" -ForegroundColor Red }
    Write-Host ""
    Write-Host "Assicurati di eseguire lo script dalla directory dell'agent." -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host ""

# Crea directory installazione
Write-Host "2. PREPARAZIONE DIRECTORY" -ForegroundColor Yellow
if (-not (Test-Path $installDir)) {
    try {
        New-Item -ItemType Directory -Path $installDir -Force | Out-Null
        Write-Host "   ✅ Directory creata: $installDir" -ForegroundColor Green
    } catch {
        Write-Host "   ❌ Impossibile creare directory: $_" -ForegroundColor Red
        pause
        exit 1
    }
} else {
    Write-Host "   ✅ Directory esistente: $installDir" -ForegroundColor Green
}
Write-Host ""

# CLEANUP: Termina processi vecchi agent
Write-Host "3. CLEANUP PROCESSI VECCHI" -ForegroundColor Yellow
$processesKilled = 0

# Termina tutte le vecchie tray icon
Write-Host "   Chiusura vecchie tray icon..." -ForegroundColor Cyan
$trayProcesses = Get-WmiObject Win32_Process | Where-Object { 
    $_.CommandLine -like "*NetworkMonitorTrayIcon.ps1*" -or
    $_.CommandLine -like "*Start-TrayIcon-Hidden.vbs*"
} | Select-Object ProcessId, CommandLine

if ($trayProcesses) {
    foreach ($proc in $trayProcesses) {
        try {
            Write-Host "   Terminazione processo PID $($proc.ProcessId)..." -ForegroundColor Gray
            Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop
            $processesKilled++
            Write-Host "   ✅ Processo $($proc.ProcessId) terminato" -ForegroundColor Green
        } catch {
            Write-Host "   ⚠️  Impossibile terminare processo $($proc.ProcessId): $_" -ForegroundColor Yellow
        }
    }
    Start-Sleep -Seconds 2
}

# Termina eventuali processi NetworkMonitor.ps1 residui
$monitorProcesses = Get-WmiObject Win32_Process | Where-Object { 
    $_.CommandLine -like "*NetworkMonitor.ps1*" -and $_.CommandLine -notlike "*Installa-Agent.ps1*"
} | Select-Object ProcessId, CommandLine

if ($monitorProcesses) {
    foreach ($proc in $monitorProcesses) {
        try {
            Write-Host "   Terminazione processo monitor PID $($proc.ProcessId)..." -ForegroundColor Gray
            Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop
            $processesKilled++
            Write-Host "   ✅ Processo $($proc.ProcessId) terminato" -ForegroundColor Green
        } catch {
            Write-Host "   ⚠️  Impossibile terminare processo $($proc.ProcessId): $_" -ForegroundColor Yellow
        }
    }
    Start-Sleep -Seconds 2
}

if ($processesKilled -gt 0) {
    Write-Host "   ✅ $processesKilled processi vecchi terminati" -ForegroundColor Green
} else {
    Write-Host "   ℹ️  Nessun processo vecchio da terminare" -ForegroundColor Gray
}
Write-Host ""

# Ferma servizio esistente
Write-Host "4. GESTIONE SERVIZIO ESISTENTE" -ForegroundColor Yellow
try {
    $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if ($service) {
        if ($service.Status -eq "Running") {
            Write-Host "   Arresto servizio esistente..." -ForegroundColor Cyan
            Stop-Service -Name $serviceName -Force -ErrorAction Stop
            Start-Sleep -Seconds 3
            
            # Attendi che si fermi completamente
            $timeout = 30
            $elapsed = 0
            while ($service.Status -ne "Stopped" -and $elapsed -lt $timeout) {
                Start-Sleep -Seconds 1
                $elapsed++
                $service.Refresh()
            }
            
            if ($service.Status -eq "Stopped") {
                Write-Host "   ✅ Servizio arrestato" -ForegroundColor Green
            } else {
                Write-Host "   ⚠️  Servizio ancora in esecuzione dopo $timeout secondi" -ForegroundColor Yellow
            }
        } else {
            Write-Host "   ℹ️  Servizio già fermo" -ForegroundColor Gray
        }
    } else {
        Write-Host "   ℹ️  Nessun servizio esistente" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ⚠️  Errore gestione servizio: $_" -ForegroundColor Yellow
}
Write-Host ""

# Copia file
Write-Host "5. COPIA FILE" -ForegroundColor Yellow
$filesToCopy = @(
    "NetworkMonitorService.ps1",
    "NetworkMonitorTrayIcon.ps1",
    "Start-TrayIcon-Hidden.vbs",
    "config.json",
    "nssm.exe"
)

# File opzionali (se presenti)
$optionalFiles = @(
    "Avvia-TrayIcon.bat",
    "Verifica-TrayIcon.ps1",
    "Verifica-Servizio.ps1",
    "Ripara-Servizio.ps1",
    "Diagnostica-Servizio.ps1"
)

$filesCopied = 0
$filesFailed = 0

foreach ($file in $filesToCopy) {
    $src = Join-Path $scriptDir $file
    $dst = Join-Path $installDir $file
    
    if (Test-Path $src) {
        try {
            # Prova fino a 3 volte
            $copied = $false
            for ($i = 1; $i -le 3; $i++) {
                try {
                    Copy-Item $src $dst -Force -ErrorAction Stop
                    $copied = $true
                    break
                } catch {
                    if ($i -lt 3) {
                        Start-Sleep -Seconds 1
                    }
                }
            }
            
            if ($copied) {
                Write-Host "   ✅ $file" -ForegroundColor Green
                $filesCopied++
            } else {
                Write-Host "   ❌ $file (fallito dopo 3 tentativi)" -ForegroundColor Red
                $filesFailed++
            }
        } catch {
            Write-Host "   ❌ $file : $_" -ForegroundColor Red
            $filesFailed++
        }
    } else {
        Write-Host "   ⚠️  $file non trovato" -ForegroundColor Yellow
        $filesFailed++
    }
}

# Copia file opzionali
foreach ($file in $optionalFiles) {
    $src = Join-Path $scriptDir $file
    $dst = Join-Path $installDir $file
    
    if (Test-Path $src) {
        try {
            Copy-Item $src $dst -Force -ErrorAction SilentlyContinue
            Write-Host "   ✅ $file (opzionale)" -ForegroundColor Gray
        } catch {
            # Ignora errori per file opzionali
        }
    }
}

if ($filesFailed -gt 0) {
    Write-Host ""
    Write-Host "⚠️  ATTENZIONE: $filesFailed file non copiati!" -ForegroundColor Yellow
    Write-Host "Prova a chiudere eventuali processi PowerShell in esecuzione." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "   ✅ $filesCopied file copiati con successo" -ForegroundColor Green
Write-Host ""

# Aggiorna versione nel config.json
Write-Host "6. AGGIORNAMENTO CONFIGURAZIONE" -ForegroundColor Yellow
$configFile = Join-Path $installDir "config.json"
if (Test-Path $configFile) {
    try {
        $config = Get-Content $configFile -Raw | ConvertFrom-Json
        $config.version = $agentVersion
        $config | ConvertTo-Json -Depth 10 | Set-Content -Path $configFile -Encoding UTF8
        Write-Host "   ✅ Versione aggiornata in config.json: $agentVersion" -ForegroundColor Green
    } catch {
        Write-Host "   ⚠️  Errore aggiornamento config.json: $_" -ForegroundColor Yellow
    }
}
Write-Host ""

# Installa servizio con NSSM
Write-Host "7. INSTALLAZIONE SERVIZIO WINDOWS" -ForegroundColor Yellow
$nssmPath = Join-Path $installDir "nssm.exe"
$serviceScriptPath = Join-Path $installDir "NetworkMonitorService.ps1"
$configPath = Join-Path $installDir "config.json"

# Trova PowerShell
$psPath = "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
if (-not (Test-Path $psPath)) {
    $psPath = "C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe"
}

if (-not (Test-Path $psPath)) {
    Write-Host "   ❌ PowerShell non trovato!" -ForegroundColor Red
    pause
    exit 1
}

# Rimuovi servizio esistente se presente
try {
    & $nssmPath remove $serviceName confirm 2>&1 | Out-Null
    Start-Sleep -Seconds 2
} catch {
    # Ignora se non esiste
}

# Installa servizio
try {
    # NSSM richiede i parametri come stringa singola - usa stesso formato di Installa-Servizio.ps1
    $appParamsString = "-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File `"$serviceScriptPath`" -ConfigPath `"$configPath`""
    & $nssmPath install $serviceName $psPath $appParamsString
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Servizio installato" -ForegroundColor Green
        
        # Configura servizio
        & $nssmPath set $serviceName AppDirectory $installDir | Out-Null
        & $nssmPath set $serviceName Application $psPath | Out-Null
        & $nssmPath set $serviceName AppParameters $appParamsString | Out-Null
        & $nssmPath set $serviceName DisplayName "Network Monitor Agent Service" | Out-Null
        & $nssmPath set $serviceName Description "Servizio permanente per il monitoraggio della rete locale e invio dati al sistema TicketApp" | Out-Null
        & $nssmPath set $serviceName Start SERVICE_AUTO_START | Out-Null
        & $nssmPath set $serviceName AppRestartDelay 60000 | Out-Null
        & $nssmPath set $serviceName AppExit Default Restart | Out-Null
        
        # Configura log
        $stdoutLog = Join-Path $installDir "NetworkMonitorService_stdout.log"
        $stderrLog = Join-Path $installDir "NetworkMonitorService_stderr.log"
        & $nssmPath set $serviceName AppStdout $stdoutLog | Out-Null
        & $nssmPath set $serviceName AppStderr $stderrLog | Out-Null
        & $nssmPath set $serviceName AppRotateFiles 1 | Out-Null
        & $nssmPath set $serviceName AppRotateOnline 1 | Out-Null
        & $nssmPath set $serviceName AppRotateSeconds 86400 | Out-Null
        & $nssmPath set $serviceName AppRotateBytes 10485760 | Out-Null
        
        Write-Host "   ✅ Configurazione servizio completata" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Errore installazione servizio!" -ForegroundColor Red
        pause
        exit 1
    }
} catch {
    Write-Host "   ❌ Errore installazione servizio: $_" -ForegroundColor Red
    pause
    exit 1
}
Write-Host ""

# Avvia servizio
Write-Host "8. AVVIO SERVIZIO" -ForegroundColor Yellow
try {
    Start-Service -Name $serviceName -ErrorAction Stop
    Start-Sleep -Seconds 3
    
    $service = Get-Service -Name $serviceName -ErrorAction Stop
    if ($service.Status -eq "Running") {
        Write-Host "   ✅ Servizio avviato correttamente" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Servizio avviato ma stato: $($service.Status)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Errore avvio servizio: $_" -ForegroundColor Red
    Write-Host "   Controlla i log in $installDir" -ForegroundColor Yellow
}
Write-Host ""

# Configura tray icon (opzionale)
Write-Host "9. CONFIGURAZIONE TRAY ICON" -ForegroundColor Yellow
$vbsLauncher = Join-Path $installDir "Start-TrayIcon-Hidden.vbs"
if (Test-Path $vbsLauncher) {
    try {
        # Configura avvio automatico
        $regPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
        $vbsLauncherQuoted = $vbsLauncher
        $regValue = "wscript.exe " + $vbsLauncherQuoted
        Set-ItemProperty -Path $regPath -Name "NetworkMonitorTrayIcon" -Value $regValue -ErrorAction SilentlyContinue
        
        # Avvia tray icon
        Start-Process "wscript.exe" -ArgumentList $vbsLauncher -WindowStyle Hidden -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        
        Write-Host "   ✅ Tray icon configurata e avviata" -ForegroundColor Green
        Write-Host "   ℹ️  Se non vedi l'icona, controlla l'area nascosta della system tray" -ForegroundColor Gray
    } catch {
        Write-Host "   ⚠️  Errore configurazione tray icon: $_" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ℹ️  Tray icon non disponibile" -ForegroundColor Gray
}
Write-Host ""

# Riepilogo
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Installazione Completata!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Versione Agent: $agentVersion" -ForegroundColor White
Write-Host "Directory: $installDir" -ForegroundColor White
Write-Host "Servizio: $serviceName" -ForegroundColor White
Write-Host ""
Write-Host "Log files:" -ForegroundColor Yellow
Write-Host "  - $installDir\NetworkMonitorService.log" -ForegroundColor Gray
Write-Host "  - $installDir\NetworkMonitorService_stdout.log" -ForegroundColor Gray
Write-Host "  - $installDir\NetworkMonitorService_stderr.log" -ForegroundColor Gray
Write-Host ""
Write-Host "Per verificare lo stato:" -ForegroundColor Yellow
Write-Host "  Get-Service -Name $serviceName" -ForegroundColor White
Write-Host ""
pause
