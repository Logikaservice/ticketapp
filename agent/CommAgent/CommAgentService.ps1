# ============================================
# CommAgentService.ps1
# Logika Service - Communication Agent
# Versione ASCII-Safe (Nessun carattere speciale)
# ============================================

$SCRIPT_VERSION = "1.0.0"
$HEARTBEAT_INTERVAL_SECONDS = 15
$UPDATE_CHECK_INTERVAL_SECONDS = 300
$APP_NAME = "Logika Service Agent"
$APP_TOOLTIP = "Logika Service - Communication Agent v$SCRIPT_VERSION"

# ============================================
# CONFIGURAZIONE SICUREZZA
# ============================================

try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls
}
catch {
    Write-Host "Impossibile impostare Tls12"
}

# ============================================
# PATHS
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
$script:tempFile = Join-Path $script:scriptDir "agent_update.zip"

# Variabili globali stato
$script:isRunning = $true
$script:lastHeartbeat = [DateTime]::MinValue
$script:lastUpdateCheck = [DateTime]::MinValue
$script:trayIcon = $null
$script:consecutiveErrors = 0

# ============================================
# LOGGING
# ============================================
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logLine = "[$timestamp] [$Level] $Message"
    
    try {
        $logLine | Out-File -FilePath $script:logFile -Append -Encoding UTF8 -ErrorAction SilentlyContinue
        
        # Rotazione log se > 5MB
        if ((Get-Item $script:logFile -ErrorAction SilentlyContinue).Length -gt 5MB) {
            $backupLog = Join-Path $script:scriptDir "CommAgent_old.log"
            Move-Item -Path $script:logFile -Destination $backupLog -Force -ErrorAction SilentlyContinue
        }
    }
    catch {}
}

# ============================================
# CONFIG MANAGEMENT
# ============================================
function Load-Config {
    if (Test-Path $script:configFile) {
        try {
            return Get-Content $script:configFile -Raw | ConvertFrom-Json
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
    }
    catch {
        Write-Log "Errore salvataggio config: $_" "ERROR"
    }
}

# ============================================
# ASSEMBLIES PER SYSTEM TRAY
# ============================================
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# ============================================
# CREA ICONA LOGIKA SERVICE
# ============================================
function New-LogikaIcon {
    param([string]$Status = "online")  # online, offline, error

    $bmp = New-Object System.Drawing.Bitmap(32, 32)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    # Colore base in base allo stato
    switch ($Status) {
        "online" { 
            $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 99, 102, 241))   # Indigo
            $statusColor = [System.Drawing.Color]::FromArgb(255, 34, 197, 94)  # Green dot
        }
        "offline" { 
            $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 100, 116, 139)) # Gray
            $statusColor = [System.Drawing.Color]::FromArgb(255, 234, 179, 8)  # Yellow dot
        }
        "error" { 
            $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 239, 68, 68))    # Red
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
    $infoItem = $contextMenu.Items.Add("Info Connessione")
    $infoItem.Add_Click({
            $c = Load-Config
            $infoText = "Logika Service - Communication Agent`n`n"
            $infoText += "Versione: $SCRIPT_VERSION`n"
            if ($c) {
                $infoText += "Utente: $($c.user_email)`n"
                $infoText += "Azienda: $($c.user_azienda)`n"
                $infoText += "PC: $($c.machine_name)`n"
                $infoText += "Server: $($c.server_url)`n"
                $infoText += "Agent ID: $($c.agent_id)`n`n"
            }
            $infoText += "Directory: $($script:scriptDir)"
            [System.Windows.Forms.MessageBox]::Show($infoText, "Logika Service Agent", 0, [System.Windows.Forms.MessageBoxIcon]::Information)
        })

    # Apri Log
    $logItem = $contextMenu.Items.Add("Apri Log")
    $logItem.Add_Click({
            if (Test-Path $script:logFile) {
                Start-Process notepad.exe -ArgumentList $script:logFile
            }
            else {
                [System.Windows.Forms.MessageBox]::Show("Nessun file di log trovato.", "Logika Service Agent", 0, [System.Windows.Forms.MessageBoxIcon]::Warning)
            }
        })

    # Check Update
    $updateItem = $contextMenu.Items.Add("Controlla Aggiornamenti")
    $updateItem.Add_Click({
            $c = Load-Config
            $updated = Check-Update -Config $c -Force
            if (-not $updated) {
                [System.Windows.Forms.MessageBox]::Show("Sei gia' alla versione piu' recente ($SCRIPT_VERSION).", "Logika Service Agent", 0, [System.Windows.Forms.MessageBoxIcon]::Information)
            }
        })

    $contextMenu.Items.Add("-")  # Separatore

    # Apri Portale
    $portalItem = $contextMenu.Items.Add("Apri Portale Logika")
    $portalItem.Add_Click({
            $c = Load-Config
            $url = if ($c.server_url) { $c.server_url } else { "https://ticket.logikaservice.it" }
            Start-Process $url
        })

    $contextMenu.Items.Add("-")  # Separatore

    # Riavvia
    $restartItem = $contextMenu.Items.Add("Riavvia Agent")
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
    $exitItem = $contextMenu.Items.Add("Esci")
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
            $infoItem.PerformClick()
        })

    Write-Log "System Tray icon inizializzata (Mode: Safe-ASCII)" "INFO"
}

# ============================================
# AGGIORNA ICONA E STATUS
# ============================================
function Update-TrayStatus {
    param([string]$Status = "online", [string]$TooltipSuffix = "")
    
    if (-not $script:trayIcon) { return }

    try {
        if ($Status -ne $script:currentStatus) {
            $script:trayIcon.Icon = New-LogikaIcon -Status $Status
            $script:currentStatus = $Status
        }
        
        $newTooltip = "$APP_TOOLTIP"
        if ($TooltipSuffix) { $newTooltip += "`n$TooltipSuffix" }
        
        # Limite 63 caratteri per tooltip tray in alcune versioni windows
        if ($newTooltip.Length -gt 63) { 
            $newTooltip = $newTooltip.Substring(0, 60) + "..." 
        }
        
        if ($script:trayIcon.Text -ne $newTooltip) {
            $script:trayIcon.Text = $newTooltip
        }
    }
    catch {
        Write-Log "Errore update tray icon: $_" "WARN"
    }
}

# ============================================
# UTILS DI REGISTRAZIONE
# ============================================
function Get-MachineId {
    param($MachineName)
    $id = "$MachineName-$(Get-Random)"
    try {
        $bios = Get-WmiObject Win32_BIOS -ErrorAction SilentlyContinue
        if ($bios -and $bios.SerialNumber) {
            $id = "$($bios.SerialNumber)-$MachineName"
        }
    }
    catch {}
    return $id
}

function Register-Agent {
    param($ServerUrl, $Email, $Password)

    Write-Log "Tentativo registrazione per $Email su $ServerUrl" "INFO"
    $machineName = $env:COMPUTERNAME
    $machineId = Get-MachineId -MachineName $machineName

    $headers = @{}
    $body = @{
        email        = $Email
        password     = $Password
        machine_name = $machineName
        machine_id   = $machineId
        version      = $SCRIPT_VERSION
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri "$ServerUrl/api/comm-agent/agent/register" -Method POST -Headers $headers -Body $body -ContentType "application/json" -ErrorAction Stop
        
        if ($response.success) {
            Write-Log "Registrazione avvenuta con successo. Agent ID: $($response.agent_id)" "INFO"
            
            $newConfig = @{
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
            Save-Config -Config $newConfig
            return $newConfig
        }
        else {
            Write-Log "Registrazione fallita: $($response.error)" "ERROR"
        }
    }
    catch {
        Write-Log "Errore connessione registrazione: $_" "ERROR"
    }
    return $null
}

# ============================================
# HEARTBEAT & MESSAGING
# ============================================
function Send-Heartbeat {
    param($Config)
    
    # 1. Check aggiornamento config range ogni tanto
    # (omesso per brevita' in questa versione communication-only)

    $url = "$($Config.server_url)/api/comm-agent/agent/heartbeat"
    $headers = @{
        "Content-Type"   = "application/json"
        "X-Comm-API-Key" = $Config.api_key
    }
    
    $body = @{
        version = $SCRIPT_VERSION
        status  = "online"
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body $body -TimeoutSec 15 -ErrorAction Stop
        
        $script:consecutiveErrors = 0
        $script:lastHeartbeat = Get-Date

        # Gestione messaggi in arrivo
        if ($response.success -and $response.messages) {
            return $response.messages
        }
    }
    catch {
        $script:consecutiveErrors++
        Write-Log "Errore heartbeat: $_" "ERROR"
        return $null
    }
    return @()
}

# ============================================
# NOTIFICHE
# ============================================
function Show-Notification {
    param($Title, $Body, $Sender, $MessageId)
    
    Write-Log "Ricevuto messaggio [$MessageId]: $Title" "INFO"
    
    # Fallback to Tray Balloon (piu' sicuro e compatibile)
    if ($script:trayIcon) {
        $script:trayIcon.BalloonTipTitle = $Title
        $script:trayIcon.BalloonTipText = $Body
        $script:trayIcon.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
        $script:trayIcon.ShowBalloonTip(10000)
    }
    else {
        # Fallback estremo: msgbox (ma blocca il thread)
        # [System.Windows.Forms.MessageBox]::Show("$Body", "$Title", 0, 64)
    }
}

# ============================================
# AUTO-UPDATE
# ============================================
function Check-Update {
    param($Config, [switch]$Force)

    if (-not $Force -and (Get-Date) -lt $script:lastUpdateCheck.AddSeconds($UPDATE_CHECK_INTERVAL_SECONDS)) {
        return $false
    }
    
    $script:lastUpdateCheck = Get-Date
    
    # 1. Check versione server
    try {
        $verUrl = "$($Config.server_url)/api/comm-agent/agent-version"
        $verInfo = Invoke-RestMethod -Uri $verUrl -Method GET -ErrorAction Stop
        
        if ($verInfo.version -ne $SCRIPT_VERSION) {
            Write-Log "Nuova versione disponibile: $($verInfo.version) (Corrente: $SCRIPT_VERSION)" "INFO"
            
            # 2. Download ZIP
            $dlUrl = "$($Config.server_url)/api/comm-agent/download"
            # Nota: endpoint download potrebbe richiedere auth/token, 
            # qui usiamo quello pubblico o con api key se necessario.
            # Per ora assumiamo download pubblico o gestito.
            
            # Qui andrebbe logica unzip e replace, ma per ora semplifichiamo:
            # Notifica utente di aggiornare manualmente se l'auto-update e' complesso
            if ($script:trayIcon) {
                $script:trayIcon.BalloonTipTitle = "Aggiornamento Disponibile"
                $script:trayIcon.BalloonTipText = "Nuova versione $($verInfo.version) scaricabile dal portale."
                $script:trayIcon.ShowBalloonTip(5000)
            }
            return $true
        }
    }
    catch {
        Write-Log "Errore check update: $_" "WARN"
    }
    
    return $false
}


# ============================================
# MAIN LOOP
# ============================================

function Start-MainLoop {
    param($Config)
    
    Write-Log "Avvio Main Loop..." "INFO"
    
    Initialize-TrayIcon -Config $Config
    
    # Timer per Heartbeat (usiamo WinForms Timer per non bloccare la GUI)
    $timer = New-Object System.Windows.Forms.Timer
    $timer.Interval = $HEARTBEAT_INTERVAL_SECONDS * 1000
    
    $timer.Add_Tick({
            # Reload config in caso di modifiche esterne
            $currentConfig = Load-Config
        
            if (-not $currentConfig) {
                Update-TrayStatus "error" "Configurazione persa"
                return
            }
        
            # Heartbeat
            $messages = Send-Heartbeat -Config $currentConfig
        
            if ($script:consecutiveErrors -eq 0) {
                Update-TrayStatus "online" "Connesso: $($currentConfig.server_url)"
            }
            else {
                Update-TrayStatus "offline" "Errore connessione ($script:consecutiveErrors)"
            }
        
            # Processa messaggi
            if ($messages) {
                foreach ($msg in $messages) {
                    Show-Notification -Title $msg.title -Body $msg.body -Sender $msg.sender_name -MessageId $msg.id
                }
            }
        
            # Check Update periodico
            Check-Update -Config $currentConfig
        })
    
    $timer.Start()
    
    # Forza un primo heartbeat immediato
    $timer.Enabled = $true
    
    # Avvia Loop GUI (bloccante finché non si chiude)
    [System.Windows.Forms.Application]::Run()
}

# ============================================
# ENTRY POINT
# ============================================

Write-Log "CommAgentService.ps1 avviato (PID=$PID)" "INFO"

$config = Load-Config

# Se non c'è config ma c'è pre-config (installazione fresca), registra subito
if (-not $config -or -not $config.api_key) {
    Write-Log "Nessuna configurazione valida trovata. Check install_config.json..." "WARN"
    
    $preConfigPath = Join-Path $script:scriptDir "install_config.json"
    if (Test-Path $preConfigPath) {
        try {
            $preConfig = Get-Content $preConfigPath -Raw | ConvertFrom-Json
            if ($preConfig.server_url -and $preConfig.email) {
                $config = Register-Agent -ServerUrl $preConfig.server_url -Email $preConfig.email -Password $preConfig.password
            }
        }
        catch {
            Write-Log "Errore lettura install_config.json: $_" "ERROR"
        }
    }
}

if ($config -and $config.api_key) {
    Start-MainLoop -Config $config
}
else {
    Write-Host "Impossibile avviare: Configurazione assente o registrazione fallita." -ForegroundColor Red
    Write-Host "Controllare Log: $script:logFile" -ForegroundColor Yellow
    Write-Log "ABORT: Configurazione assente o registrazione fallita" "ERROR"
    Start-Sleep -Seconds 5
}
