# Installa-Servizio.ps1
# Installa Network Monitor Agent come servizio Windows permanente con tray icon

param(
    [string]$InstallDir = $PSScriptRoot
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

# Verifica che nssm.exe sia presente (deve essere incluso nel pacchetto)
if (-not (Test-Path $NssmPath)) {
    Write-Host "ERRORE: nssm.exe non trovato in: $InstallDir" -ForegroundColor Red
    Write-Host "nssm.exe deve essere incluso nel pacchetto dell'agent." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Assicurati che nssm.exe sia nella stessa directory degli altri file dell'agent." -ForegroundColor Yellow
    Write-Host "Il pacchetto ZIP deve includere nssm.exe insieme agli altri file." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Premi un tasto per uscire..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
} else {
    Write-Host "nssm.exe trovato (incluso nel pacchetto)" -ForegroundColor Green
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
    & $NssmPath install $ServiceName $powershellPath "-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File `"$ScriptPath`" -ConfigPath `"$ConfigPath`""
    
    # Configura directory di lavoro
    & $NssmPath set $ServiceName AppDirectory $InstallDir
    
    # Configura display name e descrizione
    & $NssmPath set $ServiceName DisplayName "Network Monitor Agent Service"
    & $NssmPath set $ServiceName Description "Servizio permanente per il monitoraggio della rete locale e invio dati al sistema TicketApp"
    
    # Configura start type (Automatico)
    & $NssmPath set $ServiceName Start SERVICE_AUTO_START
    
    # Configura restart automatico in caso di crash
    & $NssmPath set $ServiceName AppRestartDelay 60000  # 60 secondi di attesa prima di riavviare
    & $NssmPath set $ServiceName AppExit Default Restart  # Riavvia se esce con codice default
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
    
    # Configura avvio automatico tray icon (solo per utente corrente)
    Write-Host "Configurazione avvio automatico tray icon..." -ForegroundColor Yellow
    try {
        $trayIconScript = Join-Path $InstallDir "NetworkMonitorTrayIcon.ps1"
        if (Test-Path $trayIconScript) {
            $regPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
            $regName = "NetworkMonitorTrayIcon"
            # Includi i parametri necessari per la tray icon
            $regValue = "powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -NoProfile -File `"$trayIconScript`" -ConfigPath `"$ConfigPath`""
            
            Set-ItemProperty -Path $regPath -Name $regName -Value $regValue -ErrorAction Stop
            Write-Host "Tray icon configurata per avvio automatico all'accesso utente" -ForegroundColor Green
            
            # Avvia immediatamente la tray icon (non aspettare il prossimo accesso)
            Write-Host "Avvio tray icon..." -ForegroundColor Yellow
            try {
                Start-Process powershell.exe -ArgumentList "-WindowStyle Hidden -ExecutionPolicy Bypass -NoProfile -File `"$trayIconScript`" -ConfigPath `"$ConfigPath`"" -ErrorAction Stop
                Start-Sleep -Seconds 2
                Write-Host "Tray icon avviata!" -ForegroundColor Green
            } catch {
                Write-Host "ATTENZIONE: Impossibile avviare tray icon immediatamente: $_" -ForegroundColor Yellow
                Write-Host "   La tray icon si avviera' al prossimo accesso utente." -ForegroundColor Gray
            }
        } else {
            Write-Host "ATTENZIONE: NetworkMonitorTrayIcon.ps1 non trovato, tray icon non configurata" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "ATTENZIONE: Impossibile configurare avvio automatico tray icon: $_" -ForegroundColor Yellow
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
    
    Write-Host "Premi un tasto per uscire..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    
} catch {
    Write-Host "ERRORE installazione servizio: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Premi un tasto per uscire..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}
