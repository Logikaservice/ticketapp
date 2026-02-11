$SCRIPT_VERSION = "1.1.0"
$HEARTBEAT_INTERVAL_SECONDS = 15
$UPDATE_CHECK_INTERVAL_SECONDS = 300
$APP_NAME = "Logika Service Agent"
$APP_TOOLTIP = "Logika Service - Communication Agent v$SCRIPT_VERSION"
$UPDATE_CHECK_INTERVAL_SECONDS = 300
$APP_NAME = "Logika Service Agent"
$APP_TOOLTIP = "Logika Service - Communication Agent v$SCRIPT_VERSION"

# ============================================
# CONFIGURAZIONE SICUREZZA
# ============================================
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls
}
catch {}

# ============================================
# PATHS & VARS
# ============================================
$script:scriptDir = "C:\ProgramData\LogikaCommAgent"
if ($PSScriptRoot) { $script:scriptDir = $PSScriptRoot }

$script:configFile = Join-Path $script:scriptDir "config.json"
$script:logFile = Join-Path $script:scriptDir "CommAgent.log"

$script:isRunning = $true
$script:trayIcon = $null
$script:activeNotificationForm = $null 
$script:lastUpdateCheck = [DateTime]::MinValue

# ============================================
# ASSEMBLIES
# ============================================
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# ============================================
# LOG & CONFIG
# ============================================
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    try { "[$ts] [$Level] $Message" | Out-File -FilePath $script:logFile -Append -Encoding UTF8 -ErrorAction SilentlyContinue } catch {}
}

function Load-Config {
    if (Test-Path $script:configFile) { try { return Get-Content $script:configFile -Raw | ConvertFrom-Json } catch {} }
    return $null
}

function Save-Config {
    param($Config)
    try { $Config | ConvertTo-Json -Depth 4 | Out-File -FilePath $script:configFile -Encoding UTF8 -Force } catch {}
}

# ============================================
# CUSTOM NOTIFICATION UI (TOAST)
# ============================================
function Show-CustomToast {
    param(
        [string]$Title,
        [string]$Message,
        [string]$Type = "Info" # Info, Warning, Error
    )

    # Chiudi eventuale notifica precedente per non sovrapporle
    if ($script:activeNotificationForm -and !$script:activeNotificationForm.IsDisposed) {
        $script:activeNotificationForm.Close()
    }

    # Definizione Colori
    $accentColor = [System.Drawing.Color]::FromArgb(63, 81, 181) # Blu Logika Default
    $fgColor = [System.Drawing.Color]::White
    
    if ($Type -eq "Warning") { $accentColor = [System.Drawing.Color]::FromArgb(255, 152, 0) } # Arancione
    if ($Type -eq "Error") { $accentColor = [System.Drawing.Color]::FromArgb(244, 67, 54) }   # Rosso

    # FORM PRINCIPALE
    $form = New-Object System.Windows.Forms.Form
    $form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None
    $form.Size = New-Object System.Drawing.Size(420, 180) # Dimensione Grande
    $form.BackColor = [System.Drawing.Color]::White
    $form.TopMost = $true
    $form.ShowInTaskbar = $false
    $form.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual
    
    # Posizionamento in basso a destra
    $screen = [System.Windows.Forms.Screen]::PrimaryScreen
    $x = $screen.WorkingArea.Right - $form.Width - 20
    $y = $screen.WorkingArea.Bottom - $form.Height - 20
    $form.Location = New-Object System.Drawing.Point($x, $y)

    # BORDO SINISTRO COLORATO
    $panelLeft = New-Object System.Windows.Forms.Panel
    $panelLeft.Size = New-Object System.Drawing.Size(10, $form.Height)
    $panelLeft.Dock = [System.Windows.Forms.DockStyle]::Left
    $panelLeft.BackColor = $accentColor
    $form.Controls.Add($panelLeft)

    # HEADER PANEL
    $panelHead = New-Object System.Windows.Forms.Panel
    $panelHead.Size = New-Object System.Drawing.Size($form.Width - 10, 40)
    $panelHead.Location = New-Object System.Drawing.Point(10, 0)
    $panelHead.BackColor = [System.Drawing.Color]::FromArgb(245, 245, 245)
    $form.Controls.Add($panelHead)

    # LABEL: Logika Service
    $lblTitle = New-Object System.Windows.Forms.Label
    $lblTitle.Text = "LOGIKA SERVICE"
    $lblTitle.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
    $lblTitle.ForeColor = $accentColor
    $lblTitle.AutoSize = $true
    $lblTitle.Location = New-Object System.Drawing.Point(10, 10)
    $panelHead.Controls.Add($lblTitle)

    # LABEL: by Rapa Alessandro
    $lblSub = New-Object System.Windows.Forms.Label
    $lblSub.Text = "by Rapa Alessandro"
    $lblSub.Font = New-Object System.Drawing.Font("Segoe UI", 8, [System.Drawing.FontStyle]::Italic)
    $lblSub.ForeColor = [System.Drawing.Color]::Gray
    $lblSub.AutoSize = $true
    $lblSub.Location = New-Object System.Drawing.Point(130, 12)
    $panelHead.Controls.Add($lblSub)

    # BODY TEXT
    $lblMsg = New-Object System.Windows.Forms.Label
    $lblMsg.Text = $Message
    $lblMsg.Font = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Regular)
    $lblMsg.ForeColor = [System.Drawing.Color]::FromArgb(64, 64, 64)
    $lblMsg.Location = New-Object System.Drawing.Point(25, 50)
    $lblMsg.Size = New-Object System.Drawing.Size(380, 80)
    $lblMsg.TextAlign = [System.Drawing.ContentAlignment]::MiddleLeft
    $form.Controls.Add($lblMsg)

    # BOTTONE CHIUDI (HO CAPITO)
    $btnClose = New-Object System.Windows.Forms.Button
    $btnClose.Text = "HO CAPITO"
    $btnClose.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
    $btnClose.FlatApperance.BorderSize = 0
    $btnClose.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
    $btnClose.BackColor = $accentColor
    $btnClose.ForeColor = [System.Drawing.Color]::White
    $btnClose.Size = New-Object System.Drawing.Size(120, 30)
    $btnClose.Location = New-Object System.Drawing.Point(280, 135)
    $btnClose.Cursor = [System.Windows.Forms.Cursors]::Hand
    $btnClose.Add_Click({ $form.Close() })
    $form.Controls.Add($btnClose)

    # Pulsante X piccolo in alto a destra
    $btnX = New-Object System.Windows.Forms.Label
    $btnX.Text = "X"
    $btnX.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
    $btnX.ForeColor = [System.Drawing.Color]::Gray
    $btnX.Location = New-Object System.Drawing.Point(380, 10)
    $btnX.AutoSize = $true
    $btnX.Cursor = [System.Windows.Forms.Cursors]::Hand
    $btnX.Add_Click({ $form.Close() })
    $panelHead.Controls.Add($btnX)

    # Salva riferimento per gestire chiusura
    $script:activeNotificationForm = $form

    # Mostra (NON BLOCANTE per il main loop, ma il loop deve gestire gli eventi)
    $form.Show()
}

# ============================================
# TRAY ICON & MENU
# ============================================
function Initialize-TrayIcon {
    $script:trayIcon = New-Object System.Windows.Forms.NotifyIcon
    
    # Icona generata dinamicamente (L)
    $bmp = New-Object System.Drawing.Bitmap(32, 32)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.FillEllipse([System.Drawing.Brushes]::BlueViolet, 1, 1, 30, 30)
    $g.DrawString("L", (New-Object System.Drawing.Font("Segoe UI", 16, 1)), [System.Drawing.Brushes]::White, 6, -2)
    $icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
    
    $script:trayIcon.Icon = $icon
    $script:trayIcon.Text = $APP_TOOLTIP
    $script:trayIcon.Visible = $true

    # Menu
    $menu = New-Object System.Windows.Forms.ContextMenuStrip
    
    $itemInfo = $menu.Items.Add("Info Logika Agent")
    $itemInfo.Add_Click({ Show-CustomToast "Info" "Logika Service Agent attivo.`nConnesso al monitoraggio." "Info" })
    
    $menu.Items.Add("-")

    $itemCheck = $menu.Items.Add("Controlla Aggiornamenti")
    $itemCheck.Add_Click({ Check-Update -Force $true })
    
    $itemExit = $menu.Items.Add("Esci")
    $itemExit.Add_Click({ 
            $script:trayIcon.Visible = $false
            [System.Windows.Forms.Application]::Exit() 
        })

    $script:trayIcon.ContextMenuStrip = $menu
}

# ============================================
# API & UPDATE LOGIC
# ============================================
function Send-Heartbeat {
    param($Config)
    $url = "$($Config.server_url)/api/comm-agent/agent/heartbeat"
    try {
        $body = @{ version = $SCRIPT_VERSION; status = "online" } | ConvertTo-Json
        $headers = @{ "X-Comm-API-Key" = $Config.api_key; "Content-Type" = "application/json" }
        $resp = Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body $body -ErrorAction Stop
        
        if ($resp.messages) {
            foreach ($m in $resp.messages) {
                # USA LA NUOVA NOTIFICA PERSONALIZZATA
                Show-CustomToast -Title $m.title -Message $m.body -Type "Info"
            }
        }
        return $true
    }
    catch { return $false }
}

function Check-Update {
    param([switch]$Force)
    $config = Load-Config
    
    try {
        $vUrl = "$($config.server_url)/api/comm-agent/agent-version"
        $vData = Invoke-RestMethod -Uri $vUrl -Method GET -ErrorAction Stop
        
        if ($vData.version -ne $SCRIPT_VERSION) {
            # Notifica inizio update (discreta)
            if ($script:trayIcon) {
                $script:trayIcon.BalloonTipTitle = "Aggiornamento in corso..."
                $script:trayIcon.BalloonTipText = "Scaricamento versione $($vData.version)"
                $script:trayIcon.ShowBalloonTip(3000)
            }
             
            # 1. Download ZIP
            $zipPath = Join-Path $env:TEMP "LogikaCommAgent_Update.zip"
            $extractPath = Join-Path $env:TEMP "LogikaCommAgent_Update"
            $dlUrl = "$($config.server_url)/api/comm-agent/download-agent"
             
            $headerDict = @{ "X-Comm-API-Key" = $config.api_key }
            Invoke-RestMethod -Uri $dlUrl -Headers $headerDict -OutFile $zipPath
             
            # 2. Extract
            if (Test-Path $extractPath) { Remove-Item $extractPath -Recurse -Force }
            Expand-Archive -Path $zipPath -DestinationPath $extractPath -Force
             
            # 3. Create Updater Script (BAT) per sovrascrivere i file mentre questo processo muore
            $updaterBat = Join-Path $env:TEMP "LogikaUpdate.bat"
            $myPath = $script:scriptDir
            $vbsLauncher = Join-Path $myPath "Start-CommAgent-Hidden.vbs"
             
            $batContent = @"
@echo off
timeout /t 3 /nobreak >nul
xcopy /Y /E "$extractPath\*" "$myPath\"
start "" wscript.exe "$vbsLauncher"
del "%~f0"
"@
            $batContent | Out-File -FilePath $updaterBat -Encoding ASCII -Force
             
            # 4. Launch Updater & Die
            Start-Process -FilePath $updaterBat -WindowStyle Hidden
             
            $script:trayIcon.Visible = $false
            [System.Windows.Forms.Application]::Exit()
            Stop-Process -Id $PID -Force
            return $true
        }
        elseif ($Force) {
            Show-CustomToast -Title "Nessun Aggiornamento" -Message "Sei gia' all'ultima versione ($SCRIPT_VERSION)." -Type "Info"
        }
    }
    catch {
        Write-Log "Errore durante auto-update: $_" "ERROR"
    }
    return $false
}

# ============================================
# MAIN
# ============================================
Write-Log "Avvio Servizio..."

# Se install_config.json esiste, prova a registrare
$preCfg = Join-Path $script:scriptDir "install_config.json"
if (Test-Path $preCfg) {
    try {
        $pc = Get-Content $preCfg -Raw | ConvertFrom-Json
        # (Codice registrazione omesso per brevità in questa revisione UI, usare installer per setup)
    }
    catch {}
}

$cfg = Load-Config
if ($cfg) {
    Initialize-TrayIcon
    
    $timer = New-Object System.Windows.Forms.Timer
    $timer.Interval = 15000 # 15 sec
    $timer.Add_Tick({ 
            Send-Heartbeat -Config $cfg 
        })
    $timer.Start()
    
    [System.Windows.Forms.Application]::Run()
}
else {
    Write-Host "Configurazione non trovata. Eseguire Install.bat"
    Start-Sleep 5
}
