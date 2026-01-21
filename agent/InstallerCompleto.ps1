# Network Monitor Agent - Installer Completo
# Questo script può essere convertito in .exe con PS2EXE
# Chiede solo l'API Key e fa tutto il resto automaticamente

param(
    [string]$ApiKey = "",
    [string]$ServerUrl = "https://ticket.logikaservice.it"
)

$ErrorActionPreference = "Stop"

function Enable-Tls12 {
    # Su alcuni Windows/NET l'impostazione di default può essere TLS 1.0 (spesso disabilitato),
    # causando: "Impossibile creare un canale sicuro SSL/TLS" con Invoke-RestMethod.
    try {
        # Prova con enum (funziona su .NET moderni)
        [Net.ServicePointManager]::SecurityProtocol = `
            ([Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls)
    } catch {
        try {
            # Fallback numerico (più compatibile)
            # Tls 1.0 = 192, Tls 1.1 = 768, Tls 1.2 = 3072
            [Net.ServicePointManager]::SecurityProtocol = 192 -bor 768 -bor 3072
        } catch { }
    }
}

function Exit-WithPause {
    param(
        [int]$Code = 0
    )
    Write-Host ""
    Write-Host "Premi un tasto per chiudere..." -ForegroundColor Yellow
    try { $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") } catch {}
    exit $Code
}

trap {
    Write-Host ""
    Write-Host "❌ ERRORE: $($_.Exception.Message)" -ForegroundColor Red
    try {
        if ($_.Exception.StackTrace) {
            Write-Host ""
            Write-Host "StackTrace:" -ForegroundColor DarkGray
            Write-Host $_.Exception.StackTrace -ForegroundColor DarkGray
        }
    } catch {}
    Exit-WithPause 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Network Monitor Agent - Installer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Forza TLS 1.2 per evitare errori SSL/TLS su alcuni sistemi (Server/Policy hardening)
Enable-Tls12

# Verifica PowerShell version
# Compatibilità: su Windows Server 2012 spesso c'è PowerShell 3/4. L'installer può funzionare comunque.
if ($PSVersionTable.PSVersion.Major -lt 3) {
    Write-Host "❌ Richiesto PowerShell 3.0 o superiore!" -ForegroundColor Red
    Exit-WithPause 1
}
if ($PSVersionTable.PSVersion.Major -lt 5) {
    Write-Host "⚠️ PowerShell 5.1 non presente (rilevata versione $($PSVersionTable.PSVersion)). Provo comunque (compatibilità Server 2012)." -ForegroundColor Yellow
    Write-Host "   Se qualcosa non funziona, la soluzione migliore è installare Windows Management Framework 5.1." -ForegroundColor Gray
    Write-Host ""
}

# Auto-elevazione: serve per fermare/aggiornare il servizio e scrivere in ProgramData senza errori
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Richiesti privilegi amministratore (UAC)..." -ForegroundColor Yellow
    Write-Host "Se non vedi il prompt, controlla la barra delle applicazioni: potrebbe essere dietro altre finestre." -ForegroundColor Gray
    try {
        $self = $PSCommandPath
        # Non aspettare: questa finestra serve solo ad aprire il prompt amministratore.
        Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$self`""
        exit 0
    } catch {
        Write-Host "❌ Impossibile ottenere privilegi amministratore." -ForegroundColor Red
        Exit-WithPause 1
    }
}

# Prova a leggere automaticamente API Key e Server URL dal config.json nello ZIP
$SourceDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($SourceDir)) { $SourceDir = $PWD.Path }
$zipConfigPath = Join-Path $SourceDir "config.json"
$programDataConfigPath = Join-Path "$env:ProgramData\NetworkMonitorAgent" "config.json"

try {
    $autoConfig = $null
    if (Test-Path $zipConfigPath) {
        $autoConfig = Get-Content $zipConfigPath -Raw | ConvertFrom-Json
    } elseif (Test-Path $programDataConfigPath) {
        $autoConfig = Get-Content $programDataConfigPath -Raw | ConvertFrom-Json
    }

    if ($autoConfig) {
        if ([string]::IsNullOrWhiteSpace($ApiKey) -and $autoConfig.api_key) {
            $ApiKey = $autoConfig.api_key.ToString()
        }
        if (($ServerUrl -eq "https://ticket.logikaservice.it" -or [string]::IsNullOrWhiteSpace($ServerUrl)) -and $autoConfig.server_url) {
            $ServerUrl = $autoConfig.server_url.ToString()
        }
    }
} catch {
    # non bloccare
}

# Se ancora manca API Key, chiedila
if ([string]::IsNullOrWhiteSpace($ApiKey)) {
    Write-Host "Inserisci l'API Key dell'agent (se hai scaricato lo ZIP dalla dashboard dovrebbe essere già in config.json):" -ForegroundColor Yellow
    $ApiKey = Read-Host "API Key"
    if ([string]::IsNullOrWhiteSpace($ApiKey)) {
        Write-Host "❌ API Key richiesta!" -ForegroundColor Red
        Write-Host "Premi un tasto per uscire..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        Exit-WithPause 1
    }
}

# Se ServerUrl è vuoto, chiedilo; altrimenti non chiedere nulla (evita prompt inutile)
if ([string]::IsNullOrWhiteSpace($ServerUrl)) {
    Write-Host ""
    Write-Host "URL del server TicketApp:" -ForegroundColor Yellow
    $ServerUrl = Read-Host "Server URL"
}

# Normalizza URL (https)
if (-not [string]::IsNullOrWhiteSpace($ServerUrl) -and $ServerUrl -notlike "https://*") {
    if ($ServerUrl -like "http://*") {
        $ServerUrl = $ServerUrl -replace "^http://", "https://"
    } else {
        $ServerUrl = "https://" + $ServerUrl.TrimStart('/')
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
    Exit-WithPause 1
}

# Directory di installazione (fissa, per evitare che dopo reboot parta una "vecchia" copia da Downloads/Desktop)
$InstallDir = "$env:ProgramData\NetworkMonitorAgent"

Write-Host "Directory sorgente: $SourceDir" -ForegroundColor Gray
Write-Host "Directory installazione (fissa): $InstallDir" -ForegroundColor Gray
Write-Host ""

# Crea directory installazione se non esiste
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

# Copia (sovrascrive) tutti i file dell'agent dalla directory sorgente alla directory di installazione
$filesToCopy = @(
    "NetworkMonitorService.ps1",
    "NetworkMonitorTrayIcon.ps1",
    "Start-TrayIcon-Hidden.vbs",
    "NetworkMonitor.ps1",
    "Installa-Servizio.ps1",
    "Installa-Automatico.ps1",
    "Rimuovi-Servizio.ps1",
    "Diagnostica-Agent.ps1",
    "README_SERVICE.md",
    "GUIDA_INSTALLAZIONE_SERVIZIO.md",
    "Installa.bat",
    "nssm.exe"
)

# CLEANUP: Ferma servizio e termina TUTTI i processi vecchi
Write-Host "Cleanup processi vecchi agent..." -ForegroundColor Yellow

# 1. Ferma E RIMUOVI servizio esistente
try {
    $serviceName = "NetworkMonitorService"
    $svc = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if ($svc) {
        if ($svc.Status -eq "Running" -or $svc.Status -eq "Paused") {
            Write-Host "  Arresto servizio esistente..." -ForegroundColor Cyan
            Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
        }
        Write-Host "  Rimozione servizio esistente..." -ForegroundColor Cyan
        sc.exe delete $serviceName | Out-Null
        Start-Sleep -Seconds 3
    }
} catch { }

# 2. Termina NSSM
try {
    Get-Process -Name "nssm" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
} catch { }

# 3. Termina TUTTE le vecchie tray icon (PowerShell + VBScript)
try {
    $trayProcesses = Get-WmiObject Win32_Process | Where-Object { 
        $_.CommandLine -like "*NetworkMonitorTrayIcon.ps1*" -or
        $_.CommandLine -like "*Start-TrayIcon-Hidden.vbs*"
    } | Select-Object ProcessId, CommandLine

    if ($trayProcesses) {
        foreach ($proc in $trayProcesses) {
            try {
                Write-Host "  Terminazione tray icon PID $($proc.ProcessId)..." -ForegroundColor Gray
                Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop
            } catch { }
        }
        Start-Sleep -Seconds 1
    }
} catch { }

# 4. Termina eventuali processi NetworkMonitor.ps1 residui
try {
    $monitorProcesses = Get-WmiObject Win32_Process | Where-Object { 
        $_.CommandLine -like "*NetworkMonitor.ps1*" -and 
        $_.CommandLine -notlike "*InstallerCompleto.ps1*" -and
        $_.CommandLine -notlike "*Installa-Agent.ps1*"
    } | Select-Object ProcessId, CommandLine

    if ($monitorProcesses) {
        foreach ($proc in $monitorProcesses) {
            try {
                Write-Host "  Terminazione processo monitor PID $($proc.ProcessId)..." -ForegroundColor Gray
                Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop
            } catch { }
        }
        Start-Sleep -Seconds 1
    }
} catch { }

Write-Host "  ✅ Cleanup completato" -ForegroundColor Green
Write-Host ""

foreach ($f in $filesToCopy) {
    $src = Join-Path $SourceDir $f
    $dst = Join-Path $InstallDir $f
    if (Test-Path $src) {
        $copied = $false
        for ($i = 0; $i -lt 3 -and -not $copied; $i++) {
            try {
                Copy-Item -Path $src -Destination $dst -Force -ErrorAction Stop
                $copied = $true
            } catch {
                # Se nssm.exe è in uso, non bloccare: usa quello già presente
                if ($f -ieq "nssm.exe" -and $_.Exception.Message -match "in uso|in use|accesso al file") {
                    Write-Host "⚠️ nssm.exe è in uso: mantengo la copia esistente (OK)" -ForegroundColor Yellow
                    $copied = $true
                    break
                }
                Start-Sleep -Milliseconds 600
            }
        }
    }
}

# Crea config.json
Write-Host "Creazione config.json..." -ForegroundColor Yellow
$agentVersion = $null
try {
    if ($config.version) { $agentVersion = $config.version.ToString() }
} catch { }
if (-not $agentVersion) {
    try {
        $servicePath = Join-Path $InstallDir "NetworkMonitorService.ps1"
        if (Test-Path $servicePath) {
            $content = Get-Content $servicePath -Raw
            if ($content -match '\$SCRIPT_VERSION\s*=\s*"([\d\.]+)"') {
                $agentVersion = $matches[1]
            }
        }
    } catch { }
}
if (-not $agentVersion) { $agentVersion = "1.0.0" }

$configJson = @{
    server_url = $ServerUrl
    api_key = $ApiKey
    agent_name = $config.agent_name
    version = $agentVersion
    network_ranges = $config.network_ranges
    scan_interval_minutes = $config.scan_interval_minutes
} | ConvertTo-Json -Depth 10

$configPath = Join-Path $InstallDir "config.json"
$configJson | Out-File -FilePath $configPath -Encoding UTF8 -Force
Write-Host "✅ config.json creato" -ForegroundColor Green

Write-Host "Versione agent impostata: $agentVersion" -ForegroundColor Gray

# Preferisci installazione "nuova" come servizio Windows (più stabile di Scheduled Task)
$autoInstaller = Join-Path $InstallDir "Installa-Automatico.ps1"
if (Test-Path $autoInstaller) {
    Write-Host ""
    Write-Host "Avvio installazione come servizio Windows (consigliato)..." -ForegroundColor Yellow
    try {
        # Siamo già admin qui: esegui nello stesso terminale (così non sembra "bloccato")
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $autoInstaller -Force
        Write-Host "✅ Installazione/aggiornamento servizio completato." -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Errore durante installazione servizio: $_" -ForegroundColor Yellow
    }
    Exit-WithPause 0
}

Write-Host ""
Write-Host "❌ Installa-Automatico.ps1 non trovato in: $InstallDir" -ForegroundColor Red
Write-Host "Scarica nuovamente il pacchetto ZIP completo dalla dashboard TicketApp." -ForegroundColor Yellow
Write-Host ""
Write-Host "Premi un tasto per uscire..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
Exit-WithPause 1
