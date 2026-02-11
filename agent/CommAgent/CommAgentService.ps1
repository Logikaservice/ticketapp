# CommAgentService.ps1
# Logika Service - Communication Agent
# Riceve notifiche push dal server e le mostra sul desktop del cliente
# Include: System Tray Icon, Auto-Update, Heartbeat
# Versione: 1.0.0

param(
    [string]$ConfigPath = "config.json",
    [switch]$Register
)

$SCRIPT_VERSION = "1.0.0"
$HEARTBEAT_INTERVAL_SECONDS = 15
$UPDATE_CHECK_INTERVAL_SECONDS = 300  # Check update ogni 5 minuti
$APP_NAME = "Logika Service Agent"
$APP_TOOLTIP = "Logika Service - Communication Agent v$SCRIPT_VERSION"

# Forza TLS 1.2
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
}
catch {
    try { [Net.ServicePointManager]::SecurityProtocol = 3072 } catch { }
}

# ============================================
# ASSEMBLIES PER SYSTEM TRAY
# ============================================
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# ============================================
# DIRECTORY E FILE
# ============================================
$script:scriptDir = $null
if ($PSScriptRoot) {
    $script:scriptDir = $PSScriptRoot
}
elseif ($MyInvocation.MyCommand.Path) {
    $script:scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}
else {
    $script:scriptDir = "C:\ProgramData\LogikaCommAgent"
}

$script:configFile = Join-Path $script:scriptDir "config.json"
$script:logFile = Join-Path $script:scriptDir "CommAgent.log"
$script:isRunning = $true
$script:trayIcon = $null
$script:lastUpdateCheck = [DateTime]::MinValue
$script:consecutiveErrors = 0

# ============================================
# LOGGING
# ============================================
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMsg = "[$ts] [$Level] $Message"
    try {
        $logMsg | Out-File -FilePath $script:logFile -Append -Encoding UTF8
        # Ruota log se > 5MB
        if ((Test-Path $script:logFile) -and (Get-Item $script:logFile).Length -gt 5MB) {
            $backupLog = Join-Path $script:scriptDir "CommAgent_old.log"
            Move-Item -Path $script:logFile -Destination $backupLog -Force
            Write-Output "" | Out-File -FilePath $script:logFile -Encoding UTF8
        }
    }
    catch { }
}

# ============================================
# CREA ICONA LOGIKA SERVICE
# ============================================
function New-LogikaIcon {
    param([string]$Status = "online")  # online, offline, error

    $bmp = New-Object System.Drawing.Bitmap(32, 32)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)

    # Colore base in base allo stato
    switch ($Status) {
        "online" { 
            $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
                (New-Object System.Drawing.Point(0, 0)),
                (New-Object System.Drawing.Point(32, 32)),
                [System.Drawing.Color]::FromArgb(255, 99, 102, 241),   # Indigo
                [System.Drawing.Color]::FromArgb(255, 139, 92, 246)    # Purple
            )
            $statusColor = [System.Drawing.Color]::FromArgb(255, 34, 197, 94)  # Green dot
        }
        "offline" { 
            $bgBrush = New-Object System.Drawing.Drawing2D.SolidBrush(
                [System.Drawing.Color]::FromArgb(255, 100, 116, 139)   # Slate
            )
            $statusColor = [System.Drawing.Color]::FromArgb(255, 234, 179, 8)  # Yellow dot
        }
        "error" { 
            $bgBrush = New-Object System.Drawing.Drawing2D.SolidBrush(
                [System.Drawing.Color]::FromArgb(255, 239, 68, 68)     # Red
            )
            $statusColor = [System.Drawing.Color]::FromArgb(255, 239, 68, 68)  # Red dot
        }
    }

    # Cerchio sfondo
    $g.FillEllipse($bgBrush, 1, 1, 30, 30)

    # Lettera "L" per Logika
    $font = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Bold)
    $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    $rect = New-Object System.Drawing.RectangleF(0, -1, 32, 32)
    $g.DrawString("L", $font, $whiteBrush, $rect, $sf)

    # Pallino di stato (in basso a destra)
    $statusBrush = New-Object System.Drawing.SolidBrush($statusColor)
    $g.FillEllipse($statusBrush, 22, 22, 9, 9)
    $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 1.5)
    $g.DrawEllipse($borderPen, 22, 22, 9, 9)

    $g.Dispose()
    $font.Dispose()
    $whiteBrush.Dispose()
    $statusBrush.Dispose()
    $borderPen.Dispose()
    $bgBrush.Dispose()
    $sf.Dispose()

    $hIcon = $bmp.GetHicon()
    $icon = [System.Drawing.Icon]::FromHandle($hIcon)
    return $icon
}

# ============================================
# SYSTEM TRAY ICON
# ============================================
function Initialize-TrayIcon {
    param($Config)

    $script:trayIcon = New-Object System.Windows.Forms.NotifyIcon
    $script:trayIcon.Icon = New-LogikaIcon -Status "online"
    $script:trayIcon.Text = $APP_TOOLTIP
    $script:trayIcon.Visible = $true

    # Menu contestuale
    $contextMenu = New-Object System.Windows.Forms.ContextMenuStrip

    # Header (non cliccabile)
    $headerItem = $contextMenu.Items.Add("$APP_NAME v$SCRIPT_VERSION")
    $headerItem.Enabled = $false
    $headerItem.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)

    $contextMenu.Items.Add("-")  # Separatore

    # Info
    $infoItem = $contextMenu.Items.Add("ℹ️  Info Connessione")
    $infoItem.Add_Click({
            $config = Load-Config
            $infoText = "Logika Service - Communication Agent`n`n"
            $infoText += "Versione: $SCRIPT_VERSION`n"
            $infoText += "Utente: $($config.user_email)`n"
            $infoText += "Azienda: $($config.user_azienda)`n"
            $infoText += "PC: $($config.machine_name)`n"
            $infoText += "Server: $($config.server_url)`n"
            $infoText += "Agent ID: $($config.agent_id)`n`n"
            $infoText += "Directory: $($script:scriptDir)"
            [System.Windows.Forms.MessageBox]::Show($infoText, "Logika Service Agent", 0, [System.Windows.Forms.MessageBoxIcon]::Information)
        })

    # Apri Log
    $logItem = $contextMenu.Items.Add("📋  Apri Log")
    $logItem.Add_Click({
            if (Test-Path $script:logFile) {
                Start-Process notepad.exe -ArgumentList $script:logFile
            }
            else {
                [System.Windows.Forms.MessageBox]::Show("Nessun file di log trovato.", "Logika Service Agent", 0, [System.Windows.Forms.MessageBoxIcon]::Warning)
            }
        })

    # Check Update
    $updateItem = $contextMenu.Items.Add("🔄  Controlla Aggiornamenti")
    $updateItem.Add_Click({
            $config = Load-Config
            $updated = Check-Update -Config $config -Force
            if (-not $updated) {
                [System.Windows.Forms.MessageBox]::Show("Sei già alla versione più recente ($SCRIPT_VERSION).", "Logika Service Agent", 0, [System.Windows.Forms.MessageBoxIcon]::Information)
            }
        })

    $contextMenu.Items.Add("-")  # Separatore

    # Apri Portale
    $portalItem = $contextMenu.Items.Add("🌐  Apri Portale Logika")
    $portalItem.Add_Click({
            $config = Load-Config
            $url = if ($config.server_url) { $config.server_url } else { "https://ticket.logikaservice.it" }
            Start-Process $url
        })

    $contextMenu.Items.Add("-")  # Separatore

    # Riavvia
    $restartItem = $contextMenu.Items.Add("🔃  Riavvia Agent")
    $restartItem.Add_Click({
            Write-Log "Riavvio manuale richiesto dall'utente" "INFO"
            $vbsPath = Join-Path $script:scriptDir "Start-CommAgent-Hidden.vbs"
            if (Test-Path $vbsPath) {
                Start-Process -FilePath "wscript.exe" -ArgumentList "`"$vbsPath`""
            }
            $script:isRunning = $false
            if ($script:trayIcon) {
                $script:trayIcon.Visible = $false
                $script:trayIcon.Dispose()
            }
            [System.Windows.Forms.Application]::Exit()
        })

    # Esci
    $exitItem = $contextMenu.Items.Add("❌  Esci")
    $exitItem.Add_Click({
            Write-Log "Chiusura richiesta dall'utente" "INFO"
            $script:isRunning = $false
            if ($script:trayIcon) {
                $script:trayIcon.Visible = $false
                $script:trayIcon.Dispose()
            }
            [System.Windows.Forms.Application]::Exit()
        })

    $script:trayIcon.ContextMenuStrip = $contextMenu

    # Double-click apre info
    $script:trayIcon.Add_DoubleClick({
            $config = Load-Config
            $infoText = "Logika Service - Communication Agent`n`n"
            $infoText += "Versione: $SCRIPT_VERSION`n"
            $infoText += "Stato: Online ✅`n"
            $infoText += "Utente: $($config.user_email)`n"
            $infoText += "PC: $($config.machine_name)"
            [System.Windows.Forms.MessageBox]::Show($infoText, "Logika Service Agent", 0, [System.Windows.Forms.MessageBoxIcon]::Information)
        })

    Write-Log "System Tray icon inizializzata" "INFO"
}

function Update-TrayStatus {
    param([string]$Status = "online", [string]$TooltipExtra = "")
    
    if ($script:trayIcon) {
        try {
            $newIcon = New-LogikaIcon -Status $Status
            $script:trayIcon.Icon = $newIcon
            $tooltip = $APP_TOOLTIP
            if ($TooltipExtra) {
                $tooltip += "`n$TooltipExtra"
            }
            # Tooltip max 63 chars
            if ($tooltip.Length -gt 63) { $tooltip = $tooltip.Substring(0, 63) }
            $script:trayIcon.Text = $tooltip
        }
        catch {
            Write-Log "Errore aggiornamento tray: $_" "WARN"
        }
    }
}

# ============================================
# CONFIGURAZIONE
# ============================================
function Load-Config {
    if (Test-Path $script:configFile) {
        try {
            $config = Get-Content $script:configFile -Raw | ConvertFrom-Json
            return $config
        }
        catch {
            Write-Log "Errore lettura config: $_" "ERROR"
        }
    }
    return $null
}

function Save-Config {
    param($Config)
    try {
        $Config | ConvertTo-Json -Depth 4 | Out-File -FilePath $script:configFile -Encoding UTF8 -Force
        Write-Log "Config salvata" "DEBUG"
    }
    catch {
        Write-Log "Errore salvataggio config: $_" "ERROR"
    }
}

# ============================================
# REGISTRAZIONE AGENT
# ============================================
function Register-Agent {
    param(
        [string]$ServerUrl,
        [string]$Email,
        [string]$Password
    )

    Write-Log "Registrazione agent per $Email su $ServerUrl..." "INFO"

    $machineName = $env:COMPUTERNAME
    $machineId = ""
    try {
        $os = Get-WmiObject Win32_OperatingSystem -ErrorAction SilentlyContinue
        $bios = Get-WmiObject Win32_BIOS -ErrorAction SilentlyContinue
        $machineId = "$($bios.SerialNumber)-$machineName"
        $osInfo = "$($os.Caption) $($os.Version)"
    }
    catch {
        $machineId = "$machineName-$(Get-Random)"
        $osInfo = "Windows"
    }

    $payload = @{
        email        = $Email
        password     = $Password
        machine_name = $machineName
        machine_id   = $machineId
        os_info      = $osInfo
    } | ConvertTo-Json

    $headers = @{
        "Content-Type" = "application/json"
    }

    try {
        $response = Invoke-RestMethod -Uri "$ServerUrl/api/comm-agent/agent/register" -Method POST -Headers $headers -Body $payload -TimeoutSec 30 -ErrorAction Stop

        if ($response.success) {
            $config = @{
                server_url   = $ServerUrl
                api_key      = $response.api_key
                agent_id     = $response.agent_id
                user_email   = $Email
                user_nome    = $response.user.nome
                user_azienda = $response.user.azienda
                machine_name = $machineName
                machine_id   = $machineId
                version      = $SCRIPT_VERSION
            }
            Save-Config -Config $config
            Write-Log "Registrazione OK! Agent ID: $($response.agent_id)" "INFO"
            return $config
        }
        else {
            Write-Log "Registrazione fallita: $($response.error)" "ERROR"
            return $null
        }
    }
    catch {
        Write-Log "Errore registrazione: $($_.Exception.Message)" "ERROR"
        return $null
    }
}

# ============================================
# HEARTBEAT + FETCH MESSAGES
# ============================================
function Send-Heartbeat {
    param($Config)

    $headers = @{
        "Content-Type"   = "application/json"
        "X-Comm-API-Key" = $Config.api_key
    }

    $payload = @{
        version = $SCRIPT_VERSION
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri "$($Config.server_url)/api/comm-agent/agent/heartbeat" -Method POST -Headers $headers -Body $payload -TimeoutSec 15 -ErrorAction Stop

        if ($response.success -and $response.messages -and $response.messages.Count -gt 0) {
            Write-Log "Ricevuti $($response.messages.Count) nuovi messaggi" "INFO"
            return $response.messages
        }

        return @()
    }
    catch {
        Write-Log "Errore heartbeat: $($_.Exception.Message)" "WARN"
        return @()
    }
}

# ============================================
# NOTIFICA MESSAGGIO COME LETTO
# ============================================
function Send-MessageRead {
    param($Config, [int]$MessageId)

    $headers = @{
        "Content-Type"   = "application/json"
        "X-Comm-API-Key" = $Config.api_key
    }

    $payload = @{ message_id = $MessageId } | ConvertTo-Json

    try {
        Invoke-RestMethod -Uri "$($Config.server_url)/api/comm-agent/agent/message-read" -Method POST -Headers $headers -Body $payload -TimeoutSec 10 -ErrorAction Stop | Out-Null
    }
    catch {
        Write-Log "Errore mark read: $($_.Exception.Message)" "WARN"
    }
}

# ============================================
# AUTO-UPDATE
# ============================================
function Check-Update {
    param($Config, [switch]$Force)

    # Non controllare troppo spesso
    $now = Get-Date
    if (-not $Force -and ($now - $script:lastUpdateCheck).TotalSeconds -lt $UPDATE_CHECK_INTERVAL_SECONDS) {
        return $false
    }
    $script:lastUpdateCheck = $now

    try {
        $versionResponse = Invoke-RestMethod -Uri "$($Config.server_url)/api/comm-agent/agent-version" -Method GET -TimeoutSec 10 -ErrorAction Stop
        $serverVersion = $versionResponse.version

        if ($serverVersion -and $serverVersion -ne $SCRIPT_VERSION) {
            Write-Log "Nuova versione disponibile: $serverVersion (attuale: $SCRIPT_VERSION)" "INFO"

            # Notifica l'utente
            if ($script:trayIcon) {
                $script:trayIcon.BalloonTipTitle = "Logika Service - Aggiornamento"
                $script:trayIcon.BalloonTipText = "Aggiornamento da v$SCRIPT_VERSION a v$serverVersion in corso..."
                $script:trayIcon.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
                $script:trayIcon.ShowBalloonTip(5000)
            }

            # Scarica file aggiornati
            $filesToUpdate = @("CommAgentService.ps1", "CommAgentNotifier.ps1")
            $updateSuccess = $true

            foreach ($file in $filesToUpdate) {
                try {
                    $downloadUrl = "$($Config.server_url)/api/comm-agent/download/agent/$file"
                    $tempFile = Join-Path $script:scriptDir "$file.tmp"
                    $destFile = Join-Path $script:scriptDir $file

                    Invoke-WebRequest -Uri $downloadUrl -OutFile $tempFile -TimeoutSec 30 -ErrorAction Stop

                    # Verifica che il file scaricato non sia vuoto o un errore JSON
                    $content = Get-Content $tempFile -Raw -ErrorAction SilentlyContinue
                    if ($content -and $content.Length -gt 100 -and $content -notlike '*"error"*') {
                        # Backup del file attuale
                        $backupFile = Join-Path $script:scriptDir "$file.bak"
                        if (Test-Path $destFile) {
                            Copy-Item -Path $destFile -Destination $backupFile -Force
                        }
                        # Sostituisci
                        Move-Item -Path $tempFile -Destination $destFile -Force
                        Write-Log "Aggiornato: $file" "INFO"
                    }
                    else {
                        Write-Log "File scaricato non valido: $file" "WARN"
                        $updateSuccess = $false
                        if (Test-Path $tempFile) { Remove-Item $tempFile -Force }
                    }
                }
                catch {
                    Write-Log "Errore download $file : $($_.Exception.Message)" "WARN"
                    $updateSuccess = $false
                    $tempFile = Join-Path $script:scriptDir "$file.tmp"
                    if (Test-Path $tempFile) { Remove-Item $tempFile -Force }
                }
            }

            if ($updateSuccess) {
                Write-Log "Auto-update completato. Riavvio agent..." "INFO"

                if ($script:trayIcon) {
                    $script:trayIcon.BalloonTipTitle = "Logika Service"
                    $script:trayIcon.BalloonTipText = "Aggiornamento completato! Riavvio in corso..."
                    $script:trayIcon.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
                    $script:trayIcon.ShowBalloonTip(3000)
                    Start-Sleep -Seconds 2
                }

                # Riavvia l'agent
                $vbsPath = Join-Path $script:scriptDir "Start-CommAgent-Hidden.vbs"
                if (Test-Path $vbsPath) {
                    Start-Process -FilePath "wscript.exe" -ArgumentList "`"$vbsPath`""
                }
                
                $script:isRunning = $false
                if ($script:trayIcon) {
                    $script:trayIcon.Visible = $false
                    $script:trayIcon.Dispose()
                }
                [System.Windows.Forms.Application]::Exit()
                return $true
            }
        }
    }
    catch {
        Write-Log "Errore check update: $($_.Exception.Message)" "DEBUG"
    }
    return $false
}

# ============================================
# NOTIFICA WPF
# ============================================
function Show-Notification {
    param(
        [string]$Title,
        [string]$Body,
        [string]$Sender,
        [string]$Priority = "normal",
        [string]$Category = "info",
        [string]$Timestamp = ""
    )

    # Lancia il notificatore come processo separato
    $notifierScript = Join-Path $script:scriptDir "CommAgentNotifier.ps1"

    if (-not (Test-Path $notifierScript)) {
        Write-Log "Notifier non trovato: $notifierScript" "WARN"
        Show-FallbackNotification -Title $Title -Body $Body
        return
    }

    try {
        $encodedTitle = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Title))
        $encodedBody = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Body))
        $encodedSender = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Sender))

        Start-Process -FilePath "powershell.exe" -ArgumentList @(
            "-ExecutionPolicy", "Bypass",
            "-WindowStyle", "Hidden",
            "-File", $notifierScript,
            "-Title", "`"$encodedTitle`"",
            "-Body", "`"$encodedBody`"",
            "-Sender", "`"$encodedSender`"",
            "-Priority", $Priority,
            "-Category", $Category
        ) -NoNewWindow -ErrorAction SilentlyContinue

        Write-Log "Notifica mostrata: $Title" "INFO"
    }
    catch {
        Write-Log "Errore lancio notificatore: $($_.Exception.Message)" "WARN"
        Show-FallbackNotification -Title $Title -Body $Body
    }
}

function Show-FallbackNotification {
    param([string]$Title, [string]$Body)
    try {
        if ($script:trayIcon) {
            $script:trayIcon.BalloonTipTitle = "Logika Service: $Title"
            $script:trayIcon.BalloonTipText = $Body
            $script:trayIcon.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
            $script:trayIcon.ShowBalloonTip(10000)
        }
    }
    catch {
        Write-Log "Errore fallback notification: $_" "WARN"
    }
}

# ============================================
# TIMER + LOOP PRINCIPALE
# ============================================
function Start-MainLoop {
    param($Config)

    Write-Log "=== Logika Service Agent avviato (v$SCRIPT_VERSION) ===" "INFO"
    Write-Log "Server: $($Config.server_url)" "INFO"
    Write-Log "Utente: $($Config.user_email)" "INFO"
    Write-Log "PC: $($Config.machine_name)" "INFO"
    Write-Log "Heartbeat: ogni ${HEARTBEAT_INTERVAL_SECONDS}s | Update check: ogni ${UPDATE_CHECK_INTERVAL_SECONDS}s" "INFO"

    # Inizializza tray icon
    Initialize-TrayIcon -Config $Config

    # Mostra notifica di avvio
    if ($script:trayIcon) {
        $script:trayIcon.BalloonTipTitle = "Logika Service"
        $script:trayIcon.BalloonTipText = "Communication Agent attivo - $($Config.user_email)"
        $script:trayIcon.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
        $script:trayIcon.ShowBalloonTip(3000)
    }

    # Timer per heartbeat (usa timer WinForms per non bloccare il message pump)
    $timer = New-Object System.Windows.Forms.Timer
    $timer.Interval = $HEARTBEAT_INTERVAL_SECONDS * 1000

    $timer.Add_Tick({
            try {
                $config = Load-Config
                if (-not $config -or -not $config.api_key) { return }

                # Heartbeat
                $messages = Send-Heartbeat -Config $config

                if ($messages -and $messages.Count -gt 0) {
                    foreach ($msg in $messages) {
                        $sender = ""
                        if ($msg.sender_nome) {
                            $sender = "$($msg.sender_nome) $($msg.sender_cognome)"
                        }
                        elseif ($msg.sender_email) {
                            $sender = $msg.sender_email
                        }
                        else {
                            $sender = "Logika Service"
                        }

                        Show-Notification `
                            -Title $msg.title `
                            -Body $msg.body `
                            -Sender $sender `
                            -Priority $msg.priority `
                            -Category $msg.category `
                            -Timestamp $msg.created_at

                        Send-MessageRead -Config $config -MessageId $msg.id
                        Start-Sleep -Milliseconds 500
                    }
                }

                # Reset errori
                $script:consecutiveErrors = 0
                Update-TrayStatus -Status "online" -TooltipExtra "Ultimo check: $(Get-Date -Format 'HH:mm:ss')"

                # Check update periodico
                Check-Update -Config $config
            }
            catch {
                $script:consecutiveErrors++
                Write-Log "Errore nel tick: $($_.Exception.Message) (#$($script:consecutiveErrors))" "WARN"
            
                if ($script:consecutiveErrors -gt 5) {
                    Update-TrayStatus -Status "error" -TooltipExtra "Errore connessione"
                }
            }
        })

    $timer.Start()
    Write-Log "Timer heartbeat avviato" "INFO"

    # Avvia il message pump di WinForms (necessario per il tray icon)
    [System.Windows.Forms.Application]::Run()

    # Cleanup
    $timer.Stop()
    $timer.Dispose()
    if ($script:trayIcon) {
        $script:trayIcon.Visible = $false
        $script:trayIcon.Dispose()
    }
}

# ============================================
# ENTRY POINT
# ============================================

Write-Log "CommAgentService.ps1 avviato (PID=$PID)" "INFO"

# Carica config
$config = Load-Config

if (-not $config -or -not $config.api_key) {
    # Nessuna config: chiedi registrazione interattiva
    Write-Host ""
    Write-Host "  ╔════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "  ║     Logika Service - Communication Agent      ║" -ForegroundColor Cyan
    Write-Host "  ║                 v$SCRIPT_VERSION                        ║" -ForegroundColor Cyan
    Write-Host "  ╠════════════════════════════════════════════════╣" -ForegroundColor Cyan
    Write-Host "  ║  Registra il tuo PC per ricevere notifiche    ║" -ForegroundColor White
    Write-Host "  ║  dal team Logika Service                      ║" -ForegroundColor White
    Write-Host "  ╚════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""

    # Leggi da file di config pre-compilato se esiste (dall'installer)
    $preConfig = $null
    $preConfigFile = Join-Path $script:scriptDir "install_config.json"
    if (Test-Path $preConfigFile) {
        $preConfig = Get-Content $preConfigFile -Raw | ConvertFrom-Json
    }

    $serverUrl = if ($preConfig -and $preConfig.server_url) { $preConfig.server_url } else { Read-Host "  URL Server (es: https://ticket.logikaservice.it)" }
    $email = if ($preConfig -and $preConfig.email) { $preConfig.email } else { Read-Host "  Email" }
    $password = if ($preConfig -and $preConfig.password) { $preConfig.password } else { Read-Host "  Password" }

    $config = Register-Agent -ServerUrl $serverUrl -Email $email -Password $password

    if (-not $config) {
        Write-Host ""
        Write-Host "  [ERRORE] Registrazione fallita. Verifica credenziali." -ForegroundColor Red
        Write-Host ""
        pause
        exit 1
    }

    Write-Host ""
    Write-Host "  [OK] Registrazione completata!" -ForegroundColor Green
    Write-Host "  L'agent Logika Service è ora attivo." -ForegroundColor Green
    Write-Host ""

    # Rimuovi file di pre-config se presente
    if (Test-Path $preConfigFile) {
        Remove-Item $preConfigFile -Force -ErrorAction SilentlyContinue
    }
}

# Avvia il loop principale con tray icon
Start-MainLoop -Config $config
