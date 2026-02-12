$SCRIPT_VERSION = "1.1.1"
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
    $form.Size = New-Object System.Drawing.Size(420, 180)
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
    $panelLeft.Size = New-Object System.Drawing.Size(8, $form.Height)
    $panelLeft.Dock = [System.Windows.Forms.DockStyle]::Left
    $panelLeft.BackColor = $accentColor
    $form.Controls.Add($panelLeft)

    # HEADER PANEL (occupa tutta la larghezza disponibile)
    $panelHead = New-Object System.Windows.Forms.Panel
    $panelHead.Size = New-Object System.Drawing.Size(412, 45)
    $panelHead.Location = New-Object System.Drawing.Point(8, 0)
    $panelHead.BackColor = [System.Drawing.Color]::FromArgb(245, 245, 245)
    $form.Controls.Add($panelHead)

    # LABEL: Logika Service
    $lblTitle = New-Object System.Windows.Forms.Label
    $lblTitle.Text = "LOGIKA SERVICE"
    $lblTitle.Font = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
    $lblTitle.ForeColor = $accentColor
    $lblTitle.AutoSize = $true
    $lblTitle.Location = New-Object System.Drawing.Point(12, 12)
    $panelHead.Controls.Add($lblTitle)

    # LABEL: by Rapa Alessandro (posizionato dopo il titolo con spazio)
    $lblSub = New-Object System.Windows.Forms.Label
    $lblSub.Text = "by Rapa Alessandro"
    $lblSub.Font = New-Object System.Drawing.Font("Segoe UI", 8, [System.Drawing.FontStyle]::Italic)
    $lblSub.ForeColor = [System.Drawing.Color]::FromArgb(120, 120, 120)
    $lblSub.AutoSize = $true
    # Posiziona dopo "LOGIKA SERVICE" con margine
    $titleWidth = $lblTitle.PreferredWidth
    $lblSub.Location = New-Object System.Drawing.Point($titleWidth + 18, 14)
    $panelHead.Controls.Add($lblSub)

    # Pulsante X piccolo in alto a destra (prima del testo per non sovrapporsi)
    $btnX = New-Object System.Windows.Forms.Label
    $btnX.Text = "✕"
    $btnX.Font = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Regular)
    $btnX.ForeColor = [System.Drawing.Color]::FromArgb(150, 150, 150)
    $btnX.Size = New-Object System.Drawing.Size(25, 25)
    $btnX.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter
    $btnX.Location = New-Object System.Drawing.Point(385, 10)
    $btnX.Cursor = [System.Windows.Forms.Cursors]::Hand
    $btnX.Add_Click({ $form.Close() })
    $panelHead.Controls.Add($btnX)

    # BODY TEXT (usa tutta la larghezza disponibile con word wrap)
    $lblMsg = New-Object System.Windows.Forms.Label
    $lblMsg.Text = $Message
    $lblMsg.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Regular)
    $lblMsg.ForeColor = [System.Drawing.Color]::FromArgb(64, 64, 64)
    $lblMsg.Location = New-Object System.Drawing.Point(20, 55)
    $lblMsg.Size = New-Object System.Drawing.Size(380, 70)
    $lblMsg.TextAlign = [System.Drawing.ContentAlignment]::TopLeft
    $lblMsg.AutoSize = $false
    $lblMsg.AutoEllipsis = $false
    # Abilita word wrap per testo lungo
    $lblMsg.MaximumSize = New-Object System.Drawing.Size(380, 0)
    $form.Controls.Add($lblMsg)

    # BOTTONE CHIUDI (HO CAPITO) - centrato o allineato a destra
    $btnClose = New-Object System.Windows.Forms.Button
    $btnClose.Text = "HO CAPITO"
    $btnClose.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
    $btnClose.FlatAppearance.BorderSize = 0
    $btnClose.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
    $btnClose.BackColor = $accentColor
    $btnClose.ForeColor = [System.Drawing.Color]::White
    $btnClose.Size = New-Object System.Drawing.Size(130, 32)
    $btnClose.Location = New-Object System.Drawing.Point(270, 135)
    $btnClose.Cursor = [System.Windows.Forms.Cursors]::Hand
    $btnClose.Add_Click({ $form.Close() })
    $form.Controls.Add($btnClose)

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
        Write-Log "Controllo versione: $vUrl" "INFO"
        $vData = Invoke-RestMethod -Uri $vUrl -Method GET -ErrorAction Stop
        
        Write-Log "Versione server: $($vData.version), agent corrente: $SCRIPT_VERSION" "INFO"
        
        if ($vData.version -ne $SCRIPT_VERSION) {
            Write-Log "Nuova versione disponibile: $($vData.version)" "INFO"
            
            # Notifica inizio update
            if ($script:trayIcon) {
                $script:trayIcon.BalloonTipTitle = "Aggiornamento in corso..."
                $script:trayIcon.BalloonTipText = "Scaricamento versione $($vData.version)"
                $script:trayIcon.ShowBalloonTip(3000)
            }
            Show-CustomToast -Title "Aggiornamento Disponibile" -Message "Scaricamento versione $($vData.version)..." -Type "Info"
             
            # 1. Download ZIP (usa Invoke-WebRequest, non Invoke-RestMethod!)
            $zipPath = Join-Path $env:TEMP "LogikaCommAgent_Update.zip"
            $extractPath = Join-Path $env:TEMP "LogikaCommAgent_Update"
            $dlUrl = "$($config.server_url)/api/comm-agent/download-agent"
            
            Write-Log "Download da: $dlUrl" "INFO"
            
            # Usa Invoke-WebRequest per download file binario
            $headers = @{ "X-Comm-API-Key" = $config.api_key }
            try {
                Invoke-WebRequest -Uri $dlUrl -Headers $headers -OutFile $zipPath -ErrorAction Stop
                Write-Log "Download completato: $zipPath" "INFO"
            }
            catch {
                Write-Log "ERRORE download: $_" "ERROR"
                Show-CustomToast -Title "Errore Download" -Message "Impossibile scaricare l'aggiornamento: $_" -Type "Error"
                return $false
            }
            
            # Verifica che il file sia stato scaricato
            if (-not (Test-Path $zipPath)) {
                Write-Log "ERRORE: File ZIP non trovato dopo download" "ERROR"
                Show-CustomToast -Title "Errore Download" -Message "File ZIP non trovato" -Type "Error"
                return $false
            }
            
            # 2. Extract
            Write-Log "Estrazione ZIP..." "INFO"
            if (Test-Path $extractPath) { Remove-Item $extractPath -Recurse -Force }
            try {
                Expand-Archive -Path $zipPath -DestinationPath $extractPath -Force -ErrorAction Stop
                Write-Log "Estrazione completata: $extractPath" "INFO"
            }
            catch {
                Write-Log "ERRORE estrazione: $_" "ERROR"
                Show-CustomToast -Title "Errore Estrazione" -Message "Impossibile estrarre l'aggiornamento: $_" -Type "Error"
                return $false
            }
             
            # 3. Create Updater Script (BAT) per sovrascrivere i file mentre questo processo muore
            $updaterBat = Join-Path $env:TEMP "LogikaUpdate.bat"
            $myPath = $script:scriptDir
            $vbsLauncher = Join-Path $myPath "Start-CommAgent-Hidden.vbs"
            
            Write-Log "Creazione script aggiornamento: $updaterBat" "INFO"
            Write-Log "Directory agent: $myPath" "INFO"
            Write-Log "Launcher VBS: $vbsLauncher" "INFO"
             
            # Crea VBS launcher se non esiste
            if (-not (Test-Path $vbsLauncher)) {
                Write-Log "Creazione VBS launcher: $vbsLauncher" "INFO"
                $vbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$myPath\CommAgentService.ps1`"", 0
Set WshShell = Nothing
"@
                $vbsContent | Out-File -FilePath $vbsLauncher -Encoding ASCII -Force
            }
            
            # Escapa i percorsi per il BAT (sostituisci \ con \\ e " con "")
            $extractPathEscaped = $extractPath -replace '\\', '\\' -replace '"', '""'
            $myPathEscaped = $myPath -replace '\\', '\\' -replace '"', '""'
            $vbsLauncherEscaped = $vbsLauncher -replace '\\', '\\' -replace '"', '""'
            $logFile = Join-Path $env:TEMP "LogikaUpdate.log"
            
            $batContent = @"
@echo off
echo [%date% %time%] Aggiornamento LogikaCommAgent in corso... > "$logFile"
timeout /t 3 /nobreak >nul
echo [%date% %time%] Copia file da $extractPathEscaped a $myPathEscaped >> "$logFile"
xcopy /Y /E /I "$extractPathEscaped\*" "$myPathEscaped\" >> "$logFile" 2>&1
if errorlevel 1 (
    echo [%date% %time%] ERRORE: Copia file fallita >> "$logFile"
    exit /b 1
)
echo [%date% %time%] File copiati con successo >> "$logFile"
echo [%date% %time%] Riavvio agent... >> "$logFile"
if exist "$vbsLauncherEscaped" (
    start "" wscript.exe "$vbsLauncherEscaped"
) else (
    start "" powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File "$myPathEscaped\CommAgentService.ps1"
)
timeout /t 1 /nobreak >nul
del "%~f0"
"@
            $batContent | Out-File -FilePath $updaterBat -Encoding ASCII -Force
            Write-Log "Script BAT creato: $updaterBat" "INFO"
             
            # 4. Launch Updater & Die
            Write-Log "Avvio script aggiornamento: $updaterBat" "INFO"
            Write-Log "Directory estrazione: $extractPath" "INFO"
            Write-Log "Directory destinazione: $myPath" "INFO"
            
            # Verifica che il BAT esista
            if (-not (Test-Path $updaterBat)) {
                Write-Log "ERRORE: Script BAT non creato: $updaterBat" "ERROR"
                Show-CustomToast -Title "Errore Aggiornamento" -Message "Script aggiornamento non creato" -Type "Error"
                return $false
            }
            
            Show-CustomToast -Title "Riavvio Agent" -Message "L'agent si riavvierà tra pochi secondi..." -Type "Info"
            
            try {
                # Avvia il BAT script
                $proc = Start-Process -FilePath $updaterBat -WindowStyle Hidden -PassThru -ErrorAction Stop
                Write-Log "Processo BAT avviato: PID $($proc.Id)" "INFO"
                
                # Attendi un attimo per assicurarsi che il processo sia partito
                Start-Sleep -Seconds 2
                
                # Chiudi l'applicazione
                Write-Log "Chiusura agent per permettere aggiornamento..." "INFO"
                $script:trayIcon.Visible = $false
                [System.Windows.Forms.Application]::Exit()
                
                # Forza exit se Application.Exit non funziona
                Start-Sleep -Seconds 1
                exit 0
            }
            catch {
                Write-Log "ERRORE avvio script aggiornamento: $_" "ERROR"
                Show-CustomToast -Title "Errore Aggiornamento" -Message "Impossibile avviare script: $_" -Type "Error"
                return $false
            }
        }
        elseif ($Force) {
            Show-CustomToast -Title "Nessun Aggiornamento" -Message "Sei gia' all'ultima versione ($SCRIPT_VERSION)." -Type "Info"
        }
    }
    catch {
        $errorMsg = $_.Exception.Message
        Write-Log "ERRORE durante auto-update: $errorMsg" "ERROR"
        Write-Log "Stack: $($_.ScriptStackTrace)" "ERROR"
        Show-CustomToast -Title "Errore Aggiornamento" -Message "Errore: $errorMsg" -Type "Error"
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
    
    # Timer heartbeat (ogni 15 secondi)
    $heartbeatTimer = New-Object System.Windows.Forms.Timer
    $heartbeatTimer.Interval = 15000 # 15 sec
    $heartbeatTimer.Add_Tick({ 
            Send-Heartbeat -Config $cfg 
        })
    $heartbeatTimer.Start()
    
    # Timer controllo aggiornamenti (ogni 5 minuti)
    $updateTimer = New-Object System.Windows.Forms.Timer
    $updateTimer.Interval = $UPDATE_CHECK_INTERVAL_SECONDS * 1000 # 300 secondi = 5 minuti
    $updateTimer.Add_Tick({ 
            $now = Get-Date
            $elapsed = ($now - $script:lastUpdateCheck).TotalSeconds
            if ($elapsed -ge $UPDATE_CHECK_INTERVAL_SECONDS) {
                $script:lastUpdateCheck = $now
                Write-Log "Controllo aggiornamenti automatico..." "INFO"
                Check-Update
            }
        })
    $updateTimer.Start()
    
    # Controllo aggiornamenti all'avvio (dopo 10 secondi)
    $startupTimer = New-Object System.Windows.Forms.Timer
    $startupTimer.Interval = 10000 # 10 secondi
    $startupTimer.Add_Tick({
            Write-Log "Controllo aggiornamenti all'avvio..." "INFO"
            Check-Update
            $startupTimer.Stop()
            $startupTimer.Dispose()
        })
    $startupTimer.Start()
    
    [System.Windows.Forms.Application]::Run()
}
else {
    Write-Host "Configurazione non trovata. Eseguire Install.bat"
    Start-Sleep 5
}
