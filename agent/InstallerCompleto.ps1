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

# Directory di installazione (fissa, per evitare che dopo reboot parta una "vecchia" copia da Downloads/Desktop)
$SourceDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($SourceDir)) { $SourceDir = $PWD.Path }
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

foreach ($f in $filesToCopy) {
    $src = Join-Path $SourceDir $f
    $dst = Join-Path $InstallDir $f
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $dst -Force -ErrorAction SilentlyContinue
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
        # -Force per evitare prompt e garantire sovrascrittura/riconfigurazione
        Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$autoInstaller`" -Force" -Wait
        Write-Host "✅ Installazione/aggiornamento servizio completato." -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Errore durante installazione servizio: $_" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "Premi un tasto per uscire..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 0
}

Write-Host ""
Write-Host "❌ Installa-Automatico.ps1 non trovato in: $InstallDir" -ForegroundColor Red
Write-Host "Scarica nuovamente il pacchetto ZIP completo dalla dashboard TicketApp." -ForegroundColor Yellow
Write-Host ""
Write-Host "Premi un tasto per uscire..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
exit 1
