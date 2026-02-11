# Install-CommAgent.ps1
# Installer per Logika Communication Agent
# Copia i file, registra l'agent e configura l'avvio automatico

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
    Write-Host ""
    Write-Host "  ATTENZIONE: L'installer necessita dei permessi di amministratore." -ForegroundColor Yellow
    Write-Host "  Riavvio con privilegi elevati..." -ForegroundColor Yellow
    Write-Host ""
    
    # Rilancia come admin
    $args = "-ExecutionPolicy Bypass -File `"$($MyInvocation.MyCommand.Path)`""
    if ($ServerUrl) { $args += " -ServerUrl `"$ServerUrl`"" }
    if ($Email) { $args += " -Email `"$Email`"" }
    if ($Password) { $args += " -Password `"$Password`"" }
    
    Start-Process -FilePath "powershell.exe" -ArgumentList $args -Verb RunAs
    exit
}

Clear-Host
Write-Host ""
Write-Host "  ╔═══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║                                                       ║" -ForegroundColor Cyan
Write-Host "  ║     🔔  Logika Communication Agent - Installer        ║" -ForegroundColor Cyan
Write-Host "  ║                                                       ║" -ForegroundColor Cyan
Write-Host "  ╚═══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Step 1: Input credenziali
Write-Host "  [1/4] Configurazione" -ForegroundColor Yellow
Write-Host "  ─────────────────────" -ForegroundColor DarkGray

if (-not $ServerUrl) {
    $ServerUrl = Read-Host "  URL Server (es: https://ticket.logikaservice.it)"
}
if (-not $ServerUrl) { $ServerUrl = "https://ticket.logikaservice.it" }
# Rimuovi trailing slash
$ServerUrl = $ServerUrl.TrimEnd('/')

if (-not $Email) {
    $Email = Read-Host "  La tua Email"
}
if (-not $Password) {
    $Password = Read-Host "  La tua Password"
}

Write-Host ""

# Step 2: Crea directory e copia file
Write-Host "  [2/4] Installazione file..." -ForegroundColor Yellow

if (-not (Test-Path $INSTALL_DIR)) {
    New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null
}

# Copia file necessari
$filesToCopy = @(
    "CommAgentService.ps1",
    "CommAgentNotifier.ps1"
)

foreach ($file in $filesToCopy) {
    $sourcePath = Join-Path $SCRIPT_DIR $file
    $destPath = Join-Path $INSTALL_DIR $file
    
    if (Test-Path $sourcePath) {
        Copy-Item -Path $sourcePath -Destination $destPath -Force
        Write-Host "    ✅ $file" -ForegroundColor Green
    }
    else {
        Write-Host "    ⚠️  $file non trovato in $SCRIPT_DIR" -ForegroundColor Yellow
    }
}

# Crea il VBS launcher (nasconde la finestra della console)
$vbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File ""$INSTALL_DIR\CommAgentService.ps1""", 0, False
"@

$vbsPath = Join-Path $INSTALL_DIR "Start-CommAgent-Hidden.vbs"
$vbsContent | Out-File -FilePath $vbsPath -Encoding ASCII -Force
Write-Host "    ✅ Start-CommAgent-Hidden.vbs (launcher)" -ForegroundColor Green

# Crea file install_config.json per la prima registrazione automatica
$installConfig = @{
    server_url = $ServerUrl
    email      = $Email
    password   = $Password
} | ConvertTo-Json

$installConfigPath = Join-Path $INSTALL_DIR "install_config.json"
$installConfig | Out-File -FilePath $installConfigPath -Encoding UTF8 -Force
Write-Host "    ✅ install_config.json (pre-configurazione)" -ForegroundColor Green

Write-Host ""

# Step 3: Registra in Startup
Write-Host "  [3/4] Configurazione avvio automatico..." -ForegroundColor Yellow

# Metodo 1: Task Scheduler (più affidabile, funziona per tutti gli utenti)
try {
    # Rimuovi task esistente
    schtasks /Delete /TN $STARTUP_NAME /F 2>$null | Out-Null
    
    # Crea nuovo task
    $action = "wscript.exe `"$vbsPath`""
    schtasks /Create /TN $STARTUP_NAME /TR $action /SC ONLOGON /RL HIGHEST /F | Out-Null
    Write-Host "    ✅ Task Scheduler configurato (avvio al login)" -ForegroundColor Green
}
catch {
    Write-Host "    ⚠️  Errore Task Scheduler: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Metodo 2: Shortcut nello Startup folder (backup)
try {
    $startupFolder = [Environment]::GetFolderPath("Startup")
    $shortcutPath = Join-Path $startupFolder "$STARTUP_NAME.lnk"
    
    $wshShell = New-Object -ComObject WScript.Shell
    $shortcut = $wshShell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = "wscript.exe"
    $shortcut.Arguments = "`"$vbsPath`""
    $shortcut.WorkingDirectory = $INSTALL_DIR
    $shortcut.Description = "Logika Communication Agent"
    $shortcut.WindowStyle = 7  # Minimized
    $shortcut.Save()
    Write-Host "    ✅ Shortcut Startup creato" -ForegroundColor Green
}
catch {
    Write-Host "    ⚠️  Errore shortcut: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""

# Step 4: Prima registrazione e avvio
Write-Host "  [4/4] Registrazione e avvio agent..." -ForegroundColor Yellow

# Avvia l'agent (farà la registrazione automatica usando install_config.json)
try {
    Start-Process -FilePath "wscript.exe" -ArgumentList "`"$vbsPath`"" -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
    
    # Verifica se la registrazione è andata a buon fine
    $configFile = Join-Path $INSTALL_DIR "config.json"
    if (Test-Path $configFile) {
        $agentConfig = Get-Content $configFile -Raw | ConvertFrom-Json
        if ($agentConfig.api_key) {
            Write-Host "    ✅ Agent registrato con successo!" -ForegroundColor Green
            Write-Host "    📧 Email: $($agentConfig.user_email)" -ForegroundColor Cyan
            Write-Host "    💻 PC: $($agentConfig.machine_name)" -ForegroundColor Cyan
            Write-Host "    🔑 Agent ID: $($agentConfig.agent_id)" -ForegroundColor Cyan
        }
    }
    else {
        Write-Host "    ⏳ Registrazione in corso (l'agent sta partendo in background)..." -ForegroundColor Yellow
    }
}
catch {
    Write-Host "    ⚠️  Errore avvio: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  ═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "  ✅ Installazione completata!" -ForegroundColor Green
Write-Host ""
Write-Host "  📁 Directory: $INSTALL_DIR" -ForegroundColor White
Write-Host "  🔄 L'agent si avvierà automaticamente ad ogni login" -ForegroundColor White
Write-Host "  🔔 Riceverai le notifiche dal team Logika Service" -ForegroundColor White
Write-Host ""
Write-Host "  Per disinstallare: esegui Uninstall-CommAgent.ps1" -ForegroundColor DarkGray
Write-Host ""
pause
