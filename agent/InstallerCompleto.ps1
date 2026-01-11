# Network Monitor Agent - Installer Completo
# Questo script può essere convertito in .exe con PS2EXE
# Chiede solo l'API Key e fa tutto il resto automaticamente

param(
    [string]$ApiKey = "",
    [string]$ServerUrl = "https://ticket.logikaservice.it"
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Network Monitor Agent - Installer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verifica PowerShell version
if ($PSVersionTable.PSVersion.Major -lt 5) {
    Write-Host "❌ Richiesto PowerShell 5.1 o superiore!" -ForegroundColor Red
    Write-Host "Premi un tasto per uscire..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Se API Key non passata come parametro, chiedila
if ([string]::IsNullOrWhiteSpace($ApiKey)) {
    Write-Host "Inserisci l'API Key dell'agent (ottienila dalla dashboard TicketApp):" -ForegroundColor Yellow
    $ApiKey = Read-Host "API Key"
    
    if ([string]::IsNullOrWhiteSpace($ApiKey)) {
        Write-Host "❌ API Key richiesta!" -ForegroundColor Red
        Write-Host "Premi un tasto per uscire..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
}

# Chiedi URL server (con default)
Write-Host ""
Write-Host "URL del server TicketApp (premi INVIO per usare il default):" -ForegroundColor Yellow
$inputUrl = Read-Host "Server URL"
if (-not [string]::IsNullOrWhiteSpace($inputUrl)) {
    $ServerUrl = $inputUrl
    # Verifica che inizi con https://
    if ($ServerUrl -notlike "https://*") {
        Write-Host "⚠️  ATTENZIONE: L'URL dovrebbe iniziare con 'https://'" -ForegroundColor Yellow
        if ($ServerUrl -like "http://*") {
            Write-Host "    Correggo automaticamente da http:// a https://" -ForegroundColor Yellow
            $ServerUrl = $ServerUrl -replace "^http://", "https://"
        } else {
            Write-Host "    Aggiungo automaticamente https://" -ForegroundColor Yellow
            $ServerUrl = "https://" + $ServerUrl.TrimStart('/')
        }
        Write-Host "    URL corretto: $ServerUrl" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "Connessione al server..." -ForegroundColor Yellow

# Scarica configurazione dal server
try {
    $configUrl = "$ServerUrl/api/network-monitoring/agent/config?api_key=$ApiKey"
    $response = Invoke-RestMethod -Uri $configUrl -Method GET -TimeoutSec 15 -ErrorAction Stop
    
    if (-not $response -or -not $response.api_key) {
        throw "Configurazione non valida dal server"
    }
    
    $config = $response
    Write-Host "✅ Configurazione scaricata con successo!" -ForegroundColor Green
    Write-Host "  Agent: $($config.agent_name)" -ForegroundColor Gray
    Write-Host "  Reti: $($config.network_ranges -join ', ')" -ForegroundColor Gray
    Write-Host ""
    
} catch {
    Write-Host "❌ Errore connessione al server: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Verifica che:" -ForegroundColor Yellow
    Write-Host "  • L'API Key sia corretta" -ForegroundColor Yellow
    Write-Host "  • Il server sia raggiungibile: $ServerUrl" -ForegroundColor Yellow
    Write-Host "  • La connessione internet funzioni" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Premi un tasto per uscire..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Directory di installazione (dove si trova lo script)
$InstallDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($InstallDir)) {
    $InstallDir = $PWD.Path
}

Write-Host "Directory installazione: $InstallDir" -ForegroundColor Gray
Write-Host "⚠️  IMPORTANTE: I file devono rimanere in questa directory!" -ForegroundColor Yellow
if ($InstallDir -like "*Downloads*" -or $InstallDir -like "*Download*") {
    Write-Host "⚠️  ATTENZIONE: Stai installando nella cartella Download!" -ForegroundColor Red
    Write-Host "    Consigliato: sposta i file in una directory permanente (es: C:\ProgramData\NetworkMonitorAgent\)" -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "Vuoi continuare comunque? (S/N)"
    if ($continue -ne "S" -and $continue -ne "s" -and $continue -ne "Y" -and $continue -ne "y") {
        Write-Host "Installazione annullata." -ForegroundColor Yellow
        exit 0
    }
}
Write-Host ""

# Crea config.json
Write-Host "Creazione config.json..." -ForegroundColor Yellow
$configJson = @{
    server_url = $ServerUrl
    api_key = $ApiKey
    agent_name = $config.agent_name
    version = "1.0.0"
    network_ranges = $config.network_ranges
    scan_interval_minutes = $config.scan_interval_minutes
} | ConvertTo-Json -Depth 10

$configPath = Join-Path $InstallDir "config.json"
$configJson | Out-File -FilePath $configPath -Encoding UTF8 -Force
Write-Host "✅ config.json creato" -ForegroundColor Green

# Verifica che NetworkMonitor.ps1 esista nella stessa directory
$agentScript = Join-Path $InstallDir "NetworkMonitor.ps1"
if (-not (Test-Path $agentScript)) {
    Write-Host ""
    Write-Host "⚠️  File NetworkMonitor.ps1 non trovato in: $InstallDir" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Il file NetworkMonitor.ps1 deve essere nella stessa cartella dell'installer." -ForegroundColor Yellow
    Write-Host "Scarica NetworkMonitor.ps1 dalla cartella agent/ del progetto TicketApp." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Premi un tasto per uscire..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Crea Scheduled Task
Write-Host ""
Write-Host "Creazione Scheduled Task..." -ForegroundColor Yellow

$TaskName = "NetworkMonitorAgent"

# Rimuovi task esistente se presente
$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "  Rimozione task esistente..." -ForegroundColor Gray
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# Crea azione
$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File `"$agentScript`"" `
    -WorkingDirectory $InstallDir

# Crea trigger
$trigger = New-ScheduledTaskTrigger `
    -Once `
    -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Minutes $config.scan_interval_minutes)

# Crea settings
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

# Registra task
try {
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Description "Network Monitor Agent - Scansione rete automatica ogni $($config.scan_interval_minutes) minuti" `
        -User "SYSTEM" `
        -RunLevel Highest | Out-Null
    
    Write-Host "✅ Scheduled Task creato con successo!" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Impossibile creare task come SYSTEM, provo con utente corrente..." -ForegroundColor Yellow
    try {
        Register-ScheduledTask `
            -TaskName $TaskName `
            -Action $action `
            -Trigger $trigger `
            -Settings $settings `
            -Description "Network Monitor Agent - Scansione rete automatica ogni $($config.scan_interval_minutes) minuti" `
            -User $env:USERNAME `
            -RunLevel Limited | Out-Null
        
        Write-Host "✅ Task creato con privilegi limitati" -ForegroundColor Green
    } catch {
        Write-Host "❌ Errore creazione Scheduled Task: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "Esegui PowerShell come Amministratore e riprova." -ForegroundColor Yellow
        Write-Host "Premi un tasto per uscire..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
}

# Test connessione
Write-Host ""
Write-Host "Test connessione..." -ForegroundColor Yellow
try {
    # Esegui test nella directory di installazione (dove si trova config.json)
    Push-Location $InstallDir
    try {
        & $agentScript -TestMode 2>&1 | ForEach-Object {
            if ($_ -match "ERROR") {
                Write-Host $_ -ForegroundColor Red
            } elseif ($_ -match "WARN") {
                Write-Host $_ -ForegroundColor Yellow
            } else {
                Write-Host $_
            }
        }
        # Verifica exit code
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Test completato con successo!" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Test completato con errori (exit code: $LASTEXITCODE)" -ForegroundColor Yellow
            Write-Host "   Verifica manualmente con: .\NetworkMonitor.ps1 -TestMode" -ForegroundColor Yellow
        }
    } finally {
        Pop-Location
    }
} catch {
    Write-Host "⚠️  Errore durante test: $_" -ForegroundColor Yellow
    Write-Host "   Verifica manualmente con: .\NetworkMonitor.ps1 -TestMode" -ForegroundColor Yellow
}

# Fine
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Installazione completata!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "L'agent ora scansiona automaticamente la rete ogni $($config.scan_interval_minutes) minuti." -ForegroundColor White
Write-Host ""
Write-Host "Premi un tasto per uscire..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
