# Install-CommAgent.ps1
# Installer per Logika Service - Communication Agent
# Versione safe per evitare errori di parsing

param(
    [string]$ServerUrl = "",
    [string]$Email = "",
    [string]$Password = ""
)

$INSTALL_DIR = "C:\ProgramData\LogikaCommAgent"
$STARTUP_NAME = "LogikaCommAgent"
$SCRIPT_DIR = $PSScriptRoot

# Richiedi elevation se necessario
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Richiesta permessi amministratore..."
    $args = "-ExecutionPolicy Bypass -File `"$($MyInvocation.MyCommand.Path)`""
    if ($ServerUrl) { $args += " -ServerUrl `"$ServerUrl`"" }
    if ($Email) { $args += " -Email `"$Email`"" }
    if ($Password) { $args += " -Password `"$Password`"" }
    Start-Process -FilePath "powershell.exe" -ArgumentList $args -Verb RunAs
    exit
}

# Leggi versione
$version = "Unknown"
$servicePath = Join-Path $PSScriptRoot "CommAgentService.ps1"
if (Test-Path $servicePath) {
    try {
        $content = Get-Content $servicePath -Raw -ErrorAction SilentlyContinue
        if ($content -match '\$SCRIPT_VERSION = "([^"]+)"') {
            $version = $matches[1]
        }
    }
    catch {}
}

Clear-Host
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Logika Service - Agent Installer v$version" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Controlla se esiste install_config.json precompilato (scarica dal portale)
$preConfigPath = Join-Path $SCRIPT_DIR "install_config.json"
if (Test-Path $preConfigPath) {
    Write-Host "Trovato file di configurazione precompilato..." -ForegroundColor Green
    try {
        $preConfig = Get-Content $preConfigPath -Raw | ConvertFrom-Json
        if ($preConfig.server_url) { $ServerUrl = $preConfig.server_url }
        if ($preConfig.email) { $Email = $preConfig.email }
        if ($preConfig.password) { $Password = $preConfig.password }
        Write-Host "Configurazione caricata: Email = $Email" -ForegroundColor Green
    }
    catch {
        Write-Host "Errore lettura install_config.json: $_" -ForegroundColor Yellow
    }
}

# Configurazione (richiedi solo se non presente in install_config.json)
if (-not $ServerUrl) {
    $ServerUrl = Read-Host "URL Server (es: https://ticket.logikaservice.it)"
}
if (-not $ServerUrl) { $ServerUrl = "https://ticket.logikaservice.it" }
$ServerUrl = $ServerUrl.TrimEnd('/')

if (-not $Email) {
    $Email = Read-Host "Email"
}
if (-not $Password) {
    $Password = Read-Host "Password"
}

# Crea Cartella
Write-Host "Creazione cartella $INSTALL_DIR..."
if (-not (Test-Path $INSTALL_DIR)) {
    New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null
}

# Copia File
Write-Host "Copia file..."
Copy-Item -Path (Join-Path $SCRIPT_DIR "CommAgentService.ps1") -Destination (Join-Path $INSTALL_DIR "CommAgentService.ps1") -Force
Copy-Item -Path (Join-Path $SCRIPT_DIR "CommAgentNotifier.ps1") -Destination (Join-Path $INSTALL_DIR "CommAgentNotifier.ps1") -Force
if (Test-Path (Join-Path $SCRIPT_DIR "Uninstall-CommAgent.ps1")) {
    Copy-Item -Path (Join-Path $SCRIPT_DIR "Uninstall-CommAgent.ps1") -Destination (Join-Path $INSTALL_DIR "Uninstall-CommAgent.ps1") -Force
    Write-Host "  Uninstall-CommAgent.ps1 copiato (per disinstallare: eseguire da $INSTALL_DIR)" -ForegroundColor Gray
}

# Copia install_config.json se presente (precompilato dal download)
if (Test-Path $preConfigPath) {
    Copy-Item -Path $preConfigPath -Destination (Join-Path $INSTALL_DIR "install_config.json") -Force
    Write-Host "File di configurazione precompilato copiato." -ForegroundColor Green
}

# Crea VBS launcher
$vbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File ""$INSTALL_DIR\CommAgentService.ps1""", 0, False
"@
$vbsPath = Join-Path $INSTALL_DIR "Start-CommAgent-Hidden.vbs"
$vbsContent | Out-File -FilePath $vbsPath -Encoding ASCII -Force

# Crea Config
$installConfig = @{
    server_url = $ServerUrl
    email      = $Email
    password   = $Password
} | ConvertTo-Json
$installConfigPath = Join-Path $INSTALL_DIR "install_config.json"
$installConfig | Out-File -FilePath $installConfigPath -Encoding UTF8 -Force

# Task Scheduler
Write-Host "Configurazione avvio automatico..."
try {
    schtasks /Delete /TN $STARTUP_NAME /F 2>$null | Out-Null
    $action = "wscript.exe `"$vbsPath`""
    schtasks /Create /TN $STARTUP_NAME /TR $action /SC ONLOGON /RL HIGHEST /F | Out-Null
    Write-Host "Task Scheduler configurato." -ForegroundColor Green
}
catch {
    Write-Host "Errore Task Scheduler: $($_.Exception.Message)" -ForegroundColor Red
}

# Avvio
Write-Host "Avvio agent in corso..."
try {
    Start-Process -FilePath "wscript.exe" -ArgumentList "`"$vbsPath`""
    Start-Sleep -Seconds 3
    
    $configFile = Join-Path $INSTALL_DIR "config.json"
    if (Test-Path $configFile) {
        $agentConfig = Get-Content $configFile -Raw | ConvertFrom-Json
        if ($agentConfig.api_key) {
            Write-Host "REGISTRAZIONE RIUSCITA!" -ForegroundColor Green
            Write-Host "Agent ID: $($agentConfig.agent_id)"
        }
    }
    else {
        Write-Host "Registrazione in corso in background..."
    }
}
catch {
    Write-Host "Errore avvio: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "INSTALLAZIONE COMPLETATA." -ForegroundColor Green
Write-Host "L'agent e' attivo. Controlla l'icona vicino all'orologio (area notifiche)."
Write-Host "Se non la vedi: clicca la freccia ^ accanto all'orologio per le icone nascoste." -ForegroundColor Cyan
Write-Host "Per disinstallare: esegui come amministratore $INSTALL_DIR\Uninstall-CommAgent.ps1" -ForegroundColor Gray
Write-Host "Log: $INSTALL_DIR\CommAgent.log" -ForegroundColor Gray
Write-Host ""
pause
