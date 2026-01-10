# NetworkMonitorInstaller.ps1
# Script di installazione automatica per Network Monitor Agent

param(
    [string]$ConfigFile = "config.json",
    [switch]$SkipConfig = $false
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Network Monitor Agent - Installer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verifica PowerShell version
if ($PSVersionTable.PSVersion.Major -lt 5) {
    Write-Host "❌ Richiesto PowerShell 5.1 o superiore!" -ForegroundColor Red
    exit 1
}

# Directory corrente (dove si trova lo script)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AgentScript = Join-Path $ScriptDir "NetworkMonitor.ps1"
$ConfigPath = Join-Path $ScriptDir $ConfigFile

# Verifica che NetworkMonitor.ps1 esista
if (-not (Test-Path $AgentScript)) {
    Write-Host "❌ File NetworkMonitor.ps1 non trovato in: $ScriptDir" -ForegroundColor Red
    Write-Host "Assicurati che NetworkMonitor.ps1 sia nella stessa cartella di questo installer." -ForegroundColor Yellow
    exit 1
}

# Verifica config.json
if (-not $SkipConfig) {
    if (-not (Test-Path $ConfigPath)) {
        Write-Host "⚠️  File config.json non trovato!" -ForegroundColor Yellow
        Write-Host "Devi scaricare il config.json dalla dashboard TicketApp." -ForegroundColor Yellow
        Write-Host ""
        $proceed = Read-Host "Vuoi continuare comunque? (S/N)"
        if ($proceed -ne "S" -and $proceed -ne "s") {
            Write-Host "Installazione annullata." -ForegroundColor Yellow
            exit 0
        }
        $SkipConfig = $true
    } else {
        # Valida config.json
        try {
            $config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
            if (-not $config.server_url -or -not $config.api_key) {
                Write-Host "❌ config.json non valido: mancano server_url o api_key" -ForegroundColor Red
                exit 1
            }
            Write-Host "✅ Config.json valido trovato" -ForegroundColor Green
        } catch {
            Write-Host "❌ Errore lettura config.json: $_" -ForegroundColor Red
            exit 1
        }
    }
}

Write-Host ""
Write-Host "Configurazione installazione:" -ForegroundColor White
Write-Host "  • Script Agent: $AgentScript" -ForegroundColor Gray
Write-Host "  • Config: $ConfigPath" -ForegroundColor Gray
Write-Host "  • Directory: $ScriptDir" -ForegroundColor Gray
Write-Host ""

# Test connessione al server (se config disponibile)
if (-not $SkipConfig) {
    Write-Host "Test connessione al server..." -ForegroundColor Yellow
    try {
        $testUrl = "$($config.server_url)/api/network-monitoring/agent/heartbeat"
        $headers = @{
            "Content-Type" = "application/json"
            "X-API-Key" = $config.api_key
        }
        
        $testResponse = Invoke-RestMethod -Uri $testUrl -Method POST -Headers $headers -Body '{"version":"1.0.0"}' -TimeoutSec 10 -ErrorAction Stop
        Write-Host "✅ Connessione al server riuscita!" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Impossibile testare connessione al server: $_" -ForegroundColor Yellow
        Write-Host "   L'installazione continuerà comunque." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Creazione Scheduled Task..." -ForegroundColor Yellow

# Nome task
$TaskName = "NetworkMonitorAgent"

# Verifica se task esiste già
$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

if ($existingTask) {
    Write-Host "⚠️  Task esistente trovato - Rimuovo..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# Determina intervallo scansione dal config (default 15 minuti)
$scanIntervalMinutes = 15
if (-not $SkipConfig -and $config.scan_interval_minutes) {
    $scanIntervalMinutes = $config.scan_interval_minutes
}

# Crea azione
$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File `"$AgentScript`"" `
    -WorkingDirectory $ScriptDir

# Crea trigger (ogni X minuti)
$trigger = New-ScheduledTaskTrigger `
    -Once `
    -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Minutes $scanIntervalMinutes)

# Crea settings
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

# Registra task con privilegi elevati
try {
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Description "Network Monitor Agent - Scansione rete automatica ogni $scanIntervalMinutes minuti" `
        -User "SYSTEM" `
        -RunLevel Highest
    
    Write-Host "✅ Scheduled Task creato con successo!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Configurazione Task:" -ForegroundColor White
    Write-Host "  • Nome: $TaskName" -ForegroundColor Gray
    Write-Host "  • Frequenza: Ogni $scanIntervalMinutes minuti" -ForegroundColor Gray
    Write-Host "  • Script: $AgentScript" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "❌ Errore creazione Scheduled Task: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "⚠️  Tentativo con utente corrente..." -ForegroundColor Yellow
    
    try {
        Register-ScheduledTask `
            -TaskName $TaskName `
            -Action $action `
            -Trigger $trigger `
            -Settings $settings `
            -Description "Network Monitor Agent - Scansione rete automatica ogni $scanIntervalMinutes minuti" `
            -User $env:USERNAME `
            -RunLevel Limited
        
        Write-Host "✅ Task creato con privilegi limitati (potrebbe richiedere password all'avvio)" -ForegroundColor Green
    } catch {
        Write-Host "❌ Errore anche con utente corrente: $_" -ForegroundColor Red
        exit 1
    }
}

# Test esecuzione immediata
Write-Host ""
Write-Host "Test esecuzione agent..." -ForegroundColor Yellow
try {
    & $AgentScript -TestMode
    Write-Host "✅ Test completato con successo!" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Errore durante test: $_" -ForegroundColor Yellow
    Write-Host "   Verifica manualmente l'esecuzione con: .\NetworkMonitor.ps1 -TestMode" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Installazione completata!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Comandi utili:" -ForegroundColor White
Write-Host "  • Test manuale: .\NetworkMonitor.ps1 -TestMode" -ForegroundColor Gray
Write-Host "  • Disabilitare task: Disable-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Gray
Write-Host "  • Abilitare task: Enable-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Gray
Write-Host "  • Rimuovere task: Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false" -ForegroundColor Gray
Write-Host "  • Vedere task: Get-ScheduledTask -TaskName '$TaskName' | Get-ScheduledTaskInfo" -ForegroundColor Gray
Write-Host ""
Write-Host "L'agent ora scansiona automaticamente la rete ogni $scanIntervalMinutes minuti." -ForegroundColor White
Write-Host ""
