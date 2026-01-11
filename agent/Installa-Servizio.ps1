# Installa-Servizio.ps1
# Installa Network Monitor Agent come servizio Windows permanente con tray icon

param(
    [string]$InstallDir = $PSScriptRoot,
    [switch]$RemoveOldTask = $false  # Rimuove il vecchio Scheduled Task se presente
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Installazione Network Monitor Service" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verifica privilegi amministratore
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERRORE: Questo script richiede privilegi di Amministratore!" -ForegroundColor Red
    Write-Host "Esegui PowerShell come Amministratore e riprova." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Premi un tasto per uscire..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

$ServiceName = "NetworkMonitorService"
$ScriptPath = Join-Path $InstallDir "NetworkMonitorService.ps1"
$ConfigPath = Join-Path $InstallDir "config.json"
$NssmPath = Join-Path $InstallDir "nssm.exe"

# Verifica che NetworkMonitorService.ps1 esista
if (-not (Test-Path $ScriptPath)) {
    Write-Host "ERRORE: NetworkMonitorService.ps1 non trovato in: $InstallDir" -ForegroundColor Red
    exit 1
}

# Verifica config.json
if (-not (Test-Path $ConfigPath)) {
    Write-Host "ATTENZIONE: config.json non trovato!" -ForegroundColor Yellow
    Write-Host "Crea un file config.json prima di installare il servizio." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Premi un tasto per uscire..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Download NSSM se non presente
if (-not (Test-Path $NssmPath)) {
    Write-Host "Download NSSM (Non-Sucking Service Manager)..." -ForegroundColor Yellow
    
    $nssmUrl = "https://nssm.cc/release/nssm-2.24.zip"
    $nssmZip = Join-Path $env:TEMP "nssm.zip"
    
    try {
        Invoke-WebRequest -Uri $nssmUrl -OutFile $nssmZip -UseBasicParsing
        
        # Estrai nssm.exe dalla zip
        Expand-Archive -Path $nssmZip -DestinationPath "$env:TEMP\NSSM" -Force
        $nssmSource = Join-Path $env:TEMP "NSSM\nssm-2.24\win64\nssm.exe"
        
        if (Test-Path $nssmSource) {
            Copy-Item $nssmSource -Destination $NssmPath -Force
            Write-Host "NSSM scaricato e installato" -ForegroundColor Green
        } else {
            throw "NSSM non trovato nell'archivio"
        }
        
        # Pulisci file temporanei
        Remove-Item $nssmZip -Force -ErrorAction SilentlyContinue
        Remove-Item "$env:TEMP\NSSM" -Recurse -Force -ErrorAction SilentlyContinue
        
    } catch {
        Write-Host "Errore download NSSM: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "Download manuale:" -ForegroundColor Yellow
        Write-Host "1. Vai su https://nssm.cc/download" -ForegroundColor White
        Write-Host "2. Scarica nssm-2.24.zip" -ForegroundColor White
        Write-Host "3. Estrai win64\nssm.exe nella directory dell'agent: $InstallDir" -ForegroundColor White
        Write-Host ""
        Write-Host "Premi un tasto per uscire..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
}

# Rimuovi vecchio Scheduled Task se richiesto
if ($RemoveOldTask) {
    $TaskName = "NetworkMonitorAgent"
    Write-Host "Rimozione vecchio Scheduled Task..." -ForegroundColor Yellow
    try {
        $existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        if ($existingTask) {
            Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
            Write-Host "Scheduled Task rimosso" -ForegroundColor Green
        } else {
            Write-Host "Scheduled Task non trovato" -ForegroundColor Gray
        }
    } catch {
        Write-Host "Impossibile rimuovere Scheduled Task: $_" -ForegroundColor Yellow
    }
    Write-Host ""
}

# Rimuovi servizio esistente se presente
Write-Host "Verifica servizio esistente..." -ForegroundColor Yellow
try {
    $existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($existingService) {
        Write-Host "Servizio esistente trovato. Rimozione..." -ForegroundColor Yellow
        
        # Ferma il servizio se e' in esecuzione
        if ($existingService.Status -eq "Running") {
            Stop-Service -Name $ServiceName -Force
            Start-Sleep -Seconds 2
        }
        
        # Rimuovi servizio usando nssm
        & $NssmPath remove $ServiceName confirm
        Start-Sleep -Seconds 2
        
        Write-Host "Servizio esistente rimosso" -ForegroundColor Green
    }
} catch {
    Write-Host "Nessun servizio esistente trovato" -ForegroundColor Gray
}
Write-Host ""

# Crea servizio usando NSSM
Write-Host "Creazione servizio Windows..." -ForegroundColor Yellow

$powershellPath = (Get-Command powershell.exe).Source

try {
    # Installa servizio
    & $NssmPath install $ServiceName $powershellPath "-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File `"$ScriptPath`" -ConfigPath `"$ConfigPath`" -ServiceMode"
    
    # Configura directory di lavoro
    & $NssmPath set $ServiceName AppDirectory $InstallDir
    
    # Configura display name e descrizione
    & $NssmPath set $ServiceName DisplayName "Network Monitor Agent Service"
    & $NssmPath set $ServiceName Description "Servizio permanente per il monitoraggio della rete locale e invio dati al sistema TicketApp"
    
    # Configura start type (Automatico)
    & $NssmPath set $ServiceName Start SERVICE_AUTO_START
    
    # Configura restart automatico in caso di crash
    & $NssmPath set $ServiceName AppRestartDelay 60000  # 60 secondi
    & $NssmPath set $ServiceName AppRestartDelay 0 Restart
    & $NssmPath set $ServiceName AppExit Default Restart
    & $NssmPath set $ServiceName AppStopMethodSkip 0
    
    # Configura output e error log
    $stdoutLog = Join-Path $InstallDir "NetworkMonitorService_stdout.log"
    $stderrLog = Join-Path $InstallDir "NetworkMonitorService_stderr.log"
    & $NssmPath set $ServiceName AppStdout $stdoutLog
    & $NssmPath set $ServiceName AppStderr $stderrLog
    & $NssmPath set $ServiceName AppRotateFiles 1
    & $NssmPath set $ServiceName AppRotateOnline 1
    & $NssmPath set $ServiceName AppRotateSeconds 86400  # 1 giorno
    & $NssmPath set $ServiceName AppRotateBytes 10485760  # 10 MB
    
    Write-Host "Servizio installato con successo!" -ForegroundColor Green
    Write-Host ""
    
    # Avvia servizio
    Write-Host "Avvio servizio..." -ForegroundColor Yellow
    Start-Service -Name $ServiceName
    Start-Sleep -Seconds 2
    
    $serviceStatus = Get-Service -Name $ServiceName
    if ($serviceStatus.Status -eq "Running") {
        Write-Host "Servizio avviato con successo!" -ForegroundColor Green
    } else {
        Write-Host "Servizio installato ma non e' riuscito ad avviarsi" -ForegroundColor Yellow
        Write-Host "   Stato: $($serviceStatus.Status)" -ForegroundColor Yellow
        Write-Host "   Controlla i log per dettagli: $stdoutLog" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Installazione completata!" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Servizio: $ServiceName" -ForegroundColor White
    Write-Host "Stato: $($serviceStatus.Status)" -ForegroundColor White
    Write-Host ""
    Write-Host "Comandi utili:" -ForegroundColor Yellow
    Write-Host "  - Avvia:   Start-Service -Name '$ServiceName'" -ForegroundColor Gray
    Write-Host "  - Ferma:   Stop-Service -Name '$ServiceName'" -ForegroundColor Gray
    Write-Host "  - Stato:   Get-Service -Name '$ServiceName'" -ForegroundColor Gray
    Write-Host "  - Rimuovi: .\Rimuovi-Servizio.ps1" -ForegroundColor Gray
    Write-Host ""
    
    # Suggerimento per tray icon
    Write-Host "Per mostrare l'icona nella system tray:" -ForegroundColor Yellow
    Write-Host "  Esegui: .\NetworkMonitorService.ps1 -ConfigPath `"$ConfigPath`"" -ForegroundColor Gray
    Write-Host "  (Questo avvia l'applicazione con tray icon senza installare come servizio)" -ForegroundColor Gray
    Write-Host ""
    
    Write-Host "Premi un tasto per uscire..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    
} catch {
    Write-Host "ERRORE installazione servizio: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Premi un tasto per uscire..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}
