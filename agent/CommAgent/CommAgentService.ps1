$SCRIPT_VERSION = "1.2.13"
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
# CUSTOM NOTIFICATION UI (TOAST) - FUTURISTIC DARK THEME
# ============================================
function Show-CustomToast {
    param(
        [string]$Title = "Notifica",
        [string]$Message = "",
        [string]$Type = "info"  # info, warning, maintenance, update, urgent, error
    )

    # Chiudi notifica precedente
    if ($script:activeNotificationForm -and !$script:activeNotificationForm.IsDisposed) {
        try { $script:activeNotificationForm.Close() } catch {}
    }

    # ---- PALETTE COLORI PER CATEGORIA ----
    switch ($Type.ToLower()) {
        "warning" { $aR = 245; $aG = 158; $aB = 11; $icon = "⚠" }
        "maintenance" { $aR = 16; $aG = 185; $aB = 129; $icon = "🔧" }
        "update" { $aR = 59; $aG = 130; $aB = 246; $icon = "⬆" }
        "urgent" { $aR = 239; $aG = 68; $aB = 68; $icon = "🚨" }
        "error" { $aR = 239; $aG = 68; $aB = 68; $icon = "✖" }
        default { $aR = 99; $aG = 102; $aB = 241; $icon = "💬" }  # info = indigo
    }
    $colorAccent = [System.Drawing.Color]::FromArgb($aR, $aG, $aB)
    $colorAccentDim = [System.Drawing.Color]::FromArgb(40, $aR, $aG, $aB)
    $colorBg = [System.Drawing.Color]::FromArgb(13, 17, 23 )   # #0D1117
    $colorBgHeader = [System.Drawing.Color]::FromArgb(22, 27, 34 )   # #16181E
    $colorText = [System.Drawing.Color]::FromArgb(230, 237, 243)   # quasi bianco
    $colorSub = [System.Drawing.Color]::FromArgb(110, 118, 129)   # grigio

    # ---- DIMENSIONI ----
    $fW = 400
    $fH = 175
    $bdr = 5    # bordo sinistro
    $hH = 38   # altezza header

    # ---- FORM PRINCIPALE ----
    $form = New-Object System.Windows.Forms.Form
    $form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None
    $form.Size = New-Object System.Drawing.Size($fW, $fH)
    $form.BackColor = $colorBg
    $form.TopMost = $true
    $form.ShowInTaskbar = $false
    $form.Opacity = 0
    $form.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual

    $screen = [System.Windows.Forms.Screen]::PrimaryScreen
    $form.Location = New-Object System.Drawing.Point(
        ($screen.WorkingArea.Right - $fW - 16),
        ($screen.WorkingArea.Bottom - $fH - 16)
    )

    # ---- BORDO SINISTRO COLORATO ----
    $panelBdr = New-Object System.Windows.Forms.Panel
    $panelBdr.Location = New-Object System.Drawing.Point(0, 0)
    $panelBdr.Size = New-Object System.Drawing.Size($bdr, $fH)
    $panelBdr.BackColor = $colorAccent
    $form.Controls.Add($panelBdr)

    # ---- HEADER ----
    $panelHdr = New-Object System.Windows.Forms.Panel
    $panelHdr.Location = New-Object System.Drawing.Point($bdr, 0)
    $panelHdr.Size = New-Object System.Drawing.Size($fW - $bdr, $hH)
    $panelHdr.BackColor = $colorBgHeader
    $form.Controls.Add($panelHdr)

    # Brand label
    $lblBrand = New-Object System.Windows.Forms.Label
    $lblBrand.Text = "LOGIKA SERVICE"
    $lblBrand.Font = New-Object System.Drawing.Font("Segoe UI", 8.5, [System.Drawing.FontStyle]::Bold)
    $lblBrand.ForeColor = $colorAccent
    $lblBrand.AutoSize = $true
    $lblBrand.Location = New-Object System.Drawing.Point(10, 11)
    $panelHdr.Controls.Add($lblBrand)

    # Sub-brand label
    $lblBy = New-Object System.Windows.Forms.Label
    $lblBy.Text = "by Rapa Alessandro"
    $lblBy.Font = New-Object System.Drawing.Font("Segoe UI", 7, [System.Drawing.FontStyle]::Italic)
    $lblBy.ForeColor = $colorSub
    $lblBy.AutoSize = $true
    $lblBy.Location = New-Object System.Drawing.Point(122, 13)
    $panelHdr.Controls.Add($lblBy)

    # Badge categoria (top-right)
    $lblBadge = New-Object System.Windows.Forms.Label
    $lblBadge.Text = $Type.ToUpper()
    $lblBadge.Font = New-Object System.Drawing.Font("Segoe UI", 6.5, [System.Drawing.FontStyle]::Bold)
    $lblBadge.ForeColor = $colorAccent
    $lblBadge.BackColor = $colorAccentDim
    $lblBadge.AutoSize = $false
    $lblBadge.Size = New-Object System.Drawing.Size(62, 16)
    $lblBadge.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter
    $lblBadge.Location = New-Object System.Drawing.Point(($fW - $bdr - 94), 11)
    $panelHdr.Controls.Add($lblBadge)

    # Pulsante X
    $btnX = New-Object System.Windows.Forms.Button
    $btnX.Text = "✕"
    $btnX.Font = New-Object System.Drawing.Font("Segoe UI", 9)
    $btnX.ForeColor = $colorSub
    $btnX.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
    $btnX.FlatAppearance.BorderSize = 0
    $btnX.FlatAppearance.MouseOverBackColor = [System.Drawing.Color]::FromArgb(45, 50, 60)
    $btnX.BackColor = [System.Drawing.Color]::Transparent
    $btnX.Size = New-Object System.Drawing.Size(26, 26)
    $btnX.Location = New-Object System.Drawing.Point(($fW - $bdr - 28), 6)
    $btnX.Cursor = [System.Windows.Forms.Cursors]::Hand
    $btnX.Add_Click({ try { $this.FindForm().Close() } catch {} })
    $panelHdr.Controls.Add($btnX)

    # ---- SEPARATORE (linea accent) ----
    $panelSep = New-Object System.Windows.Forms.Panel
    $panelSep.Location = New-Object System.Drawing.Point($bdr, $hH)
    $panelSep.Size = New-Object System.Drawing.Size($fW - $bdr, 1)
    $panelSep.BackColor = $colorAccentDim
    $form.Controls.Add($panelSep)

    # ---- TITOLO NOTIFICA (il vero $Title dal messaggio) ----
    $lblTitle = New-Object System.Windows.Forms.Label
    $lblTitle.Text = $Title
    $lblTitle.Font = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
    $lblTitle.ForeColor = $colorText
    $lblTitle.Location = New-Object System.Drawing.Point(($bdr + 10), ($hH + 8))
    $lblTitle.Size = New-Object System.Drawing.Size($fW - $bdr - 20, 22)
    $lblTitle.AutoEllipsis = $true
    $form.Controls.Add($lblTitle)

    # ---- CORPO MESSAGGIO ----
    $lblMsg = New-Object System.Windows.Forms.Label
    $lblMsg.Text = $Message
    $lblMsg.Font = New-Object System.Drawing.Font("Segoe UI", 9.5)
    $lblMsg.ForeColor = $colorSub
    $lblMsg.Location = New-Object System.Drawing.Point(($bdr + 10), ($hH + 34))
    $lblMsg.Size = New-Object System.Drawing.Size($fW - $bdr - 20, 56)
    $lblMsg.AutoEllipsis = $true
    $form.Controls.Add($lblMsg)

    # ---- PULSANTE "HO CAPITO" ----
    $btnClose = New-Object System.Windows.Forms.Button
    $btnClose.Text = "HO CAPITO"
    $btnClose.Font = New-Object System.Drawing.Font("Segoe UI", 8.5, [System.Drawing.FontStyle]::Bold)
    $btnClose.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
    $btnClose.FlatAppearance.BorderSize = 0
    $btnClose.BackColor = $colorAccent
    $btnClose.ForeColor = [System.Drawing.Color]::White
    $btnClose.Size = New-Object System.Drawing.Size(108, 26)
    $btnClose.Location = New-Object System.Drawing.Point(($fW - 118), ($fH - 34))
    $btnClose.Cursor = [System.Windows.Forms.Cursors]::Hand
    $btnClose.Add_Click({ try { $this.FindForm().Close() } catch {} })
    $form.Controls.Add($btnClose)

    # ---- PROGRESS BAR AUTO-DISMISS (10s) ----
    $pgBg = New-Object System.Windows.Forms.Panel
    $pgBg.Location = New-Object System.Drawing.Point($bdr, ($fH - 4))
    $pgBg.Size = New-Object System.Drawing.Size($fW - $bdr, 4)
    $pgBg.BackColor = [System.Drawing.Color]::FromArgb(30, $aR, $aG, $aB)
    $form.Controls.Add($pgBg)

    $script:toastPgBar = New-Object System.Windows.Forms.Panel
    $script:toastPgBar.Location = New-Object System.Drawing.Point(0, 0)
    $script:toastPgBar.Size = New-Object System.Drawing.Size($fW - $bdr, 4)
    $script:toastPgBar.BackColor = $colorAccent
    $pgBg.Controls.Add($script:toastPgBar)

    # ---- TIMER: fade-in + progress ----
    $script:toastTick = 0
    $script:toastTotal = 200   # 200 tick x 50ms = 10 secondi
    $script:toastPgW = $fW - $bdr
    $script:toastForm = $form

    $script:toastTimer = New-Object System.Windows.Forms.Timer
    $script:toastTimer.Interval = 50
    $script:toastTimer.Add_Tick({
            $f = $script:toastForm
            if (-not $f -or $f.IsDisposed) { $script:toastTimer.Stop(); return }

            # Fade-in nei primi 10 tick (500ms)
            if ($f.Opacity -lt 1.0) {
                $f.Opacity = [Math]::Min(1.0, $f.Opacity + 0.12)
            }

            # Aggiorna progress bar
            $script:toastTick++
            $ratio = [Math]::Max(0.0, 1.0 - ($script:toastTick / $script:toastTotal))
            $pb = $script:toastPgBar
            if ($pb -and !$pb.IsDisposed) {
                $pb.Width = [int]($script:toastPgW * $ratio)
            }

            # Auto-chiusura
            if ($script:toastTick -ge $script:toastTotal) {
                $script:toastTimer.Stop()
                try { $f.Close() } catch {}
            }
        })

    $form.Add_FormClosed({
            try { $script:toastTimer.Stop(); $script:toastTimer.Dispose() } catch {}
            $script:activeNotificationForm = $null
        })

    $script:activeNotificationForm = $form
    $form.Show()
    $script:toastTimer.Start()
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
                # Usa la categoria del messaggio per il colore giusto
                $msgType = if ($m.category) { $m.category } else { "info" }
                Show-CustomToast -Title $m.title -Message $m.body -Type $msgType
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
            
            # Notifica inizio update (solo balloon, no toast per evitare errori durante update)
            if ($script:trayIcon) {
                $script:trayIcon.BalloonTipTitle = "Aggiornamento in corso..."
                $script:trayIcon.BalloonTipText = "Scaricamento versione $($vData.version)"
                $script:trayIcon.ShowBalloonTip(3000)
            }
            # NON mostrare toast durante aggiornamento per evitare errori che bloccano il processo
             
            # 1. Download ZIP (usa Invoke-WebRequest, non Invoke-RestMethod!)
            $zipPath = Join-Path $env:TEMP "LogikaCommAgent_Update.zip"
            $extractPath = Join-Path $env:TEMP "LogikaCommAgent_Update"
            $dlUrl = "$($config.server_url)/api/comm-agent/download-agent"
            
            Write-Log "Download da: $dlUrl" "INFO"
            
            # Usa Invoke-WebRequest per download file binario
            $headers = @{ "X-Comm-API-Key" = $config.api_key }
            Write-Log "API Key usata per download: $($config.api_key.Substring(0, [Math]::Min(8, $config.api_key.Length)))..." "INFO"
            try {
                $response = Invoke-WebRequest -Uri $dlUrl -Headers $headers -OutFile $zipPath -ErrorAction Stop
                Write-Log "Download completato: $zipPath, Status: $($response.StatusCode)" "INFO"
                
                # Verifica dimensione file
                if (Test-Path $zipPath) {
                    $fileSize = (Get-Item $zipPath).Length
                    Write-Log "Dimensione file ZIP: $fileSize bytes" "INFO"
                    if ($fileSize -lt 1000) {
                        Write-Log "ERRORE: File ZIP troppo piccolo, possibile errore download" "ERROR"
                        return $false
                    }
                }
            }
            catch {
                Write-Log "ERRORE download: $_" "ERROR"
                Write-Log "Dettagli errore: $($_.Exception.Message)" "ERROR"
                if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
                return $false
            }
            
            # Verifica che il file sia stato scaricato
            if (-not (Test-Path $zipPath)) {
                Write-Log "ERRORE: File ZIP non trovato dopo download" "ERROR"
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
                # Non mostrare toast durante aggiornamento per evitare errori
                return $false
            }
             
            # 3. Create Updater Script (BAT) per sovrascrivere i file mentre questo processo muore
            $updaterBat = Join-Path $env:TEMP "LogikaUpdate.bat"
            $myPath = $script:scriptDir
            $vbsLauncher = Join-Path $myPath "Start-CommAgent-Hidden.vbs"
            
            Write-Log "Creazione script aggiornamento: $updaterBat" "INFO"
            Write-Log "Directory agent: $myPath" "INFO"
            Write-Log "Launcher VBS: $vbsLauncher" "INFO"
             
            # Crea/ricrea VBS launcher sempre (per assicurarsi che sia aggiornato)
            Write-Log "Creazione/aggiornamento VBS launcher: $vbsLauncher" "INFO"
            $vbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File ""$myPath\CommAgentService.ps1""", 0
Set WshShell = Nothing
"@
            $vbsContent | Out-File -FilePath $vbsLauncher -Encoding ASCII -Force
            Write-Log "VBS launcher creato/aggiornato" "INFO"
            
            # Escapa i percorsi per il BAT (sostituisci \ con \\ e " con "")
            $extractPathEscaped = $extractPath -replace '\\', '\\' -replace '"', '""'
            $myPathEscaped = $myPath -replace '\\', '\\' -replace '"', '""'
            $vbsLauncherEscaped = $vbsLauncher -replace '\\', '\\' -replace '"', '""'
            $logFile = Join-Path $env:TEMP "LogikaUpdate.log"
            
            $batContent = @"
@echo off
setlocal enabledelayedexpansion
set "EXTRACT_PATH=$extractPathEscaped"
set "TARGET_PATH=$myPathEscaped"
set "VBS_LAUNCHER=$vbsLauncherEscaped"
set "LOG_FILE=$logFile"
set "AGENT_PID=$PID"

:: Se ci sono argomenti, usa quelli invece delle variabili d'ambiente
if not "%~1"=="" (
    set "EXTRACT_PATH=%~1"
    set "TARGET_PATH=%~2"
    set "VBS_LAUNCHER=%~3"
    set "LOG_FILE=%~4"
    set "AGENT_PID=%~5"
    echo [%date% %time%] Parametri ricevuti: EXTRACT_PATH=%EXTRACT_PATH%, AGENT_PID=%AGENT_PID% >> "%LOG_FILE%"
)

:: Verifica privilegi amministratore
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [%date% %time%] Privilegi amministratore non disponibili, riavvio con privilegi elevati... >> "%LOG_FILE%"
    :: Crea un file temporaneo con i parametri per passarli al processo elevato
    set "PARAM_FILE=%TEMP%\LogikaUpdateParams.txt"
    echo %EXTRACT_PATH% > "%PARAM_FILE%"
    echo %TARGET_PATH% >> "%PARAM_FILE%"
    echo %VBS_LAUNCHER% >> "%PARAM_FILE%"
    echo %LOG_FILE% >> "%PARAM_FILE%"
    echo %AGENT_PID% >> "%PARAM_FILE%"
    :: Riavvia con privilegi elevati passando il file parametri
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs -ArgumentList '""%PARAM_FILE%""'"
    exit /b 0
)

:: Se è stato passato un file parametri, leggi da lì
if not "%~1"=="" (
    if exist "%~1" (
        :: Leggi tutte le righe dal file parametri (ordine fisso)
        < "%~1" (
            set /p "EXTRACT_PATH="
            set /p "TARGET_PATH="
            set /p "VBS_LAUNCHER="
            set /p "LOG_FILE="
            set /p "AGENT_PID="
        )
        :: Crea il log file se non esiste e scrivi i parametri
        echo [%date% %time%] Parametri letti da file temporaneo >> "%LOG_FILE%"
        echo [%date% %time%] EXTRACT_PATH=%EXTRACT_PATH% >> "%LOG_FILE%"
        echo [%date% %time%] AGENT_PID=%AGENT_PID% >> "%LOG_FILE%"
        del "%~1"
    )
)

echo [%date% %time%] Aggiornamento LogikaCommAgent in corso... > "%LOG_FILE%"
echo [%date% %time%] Target PID da terminare: %AGENT_PID% >> "%LOG_FILE%"

:: Attesa iniziale
echo [%date% %time%] Attesa chiusura processo agent (5 secondi)... >> "%LOG_FILE%"
timeout /t 5 /nobreak >nul

:: Verifica se il processo esiste ancora usando il PID specifico
echo [%date% %time%] Verifica processo PID %AGENT_PID%... >> "%LOG_FILE%"
tasklist /FI "PID eq %AGENT_PID%" /FO CSV | findstr "%AGENT_PID%" >nul
if %errorlevel% equ 0 (
    echo [%date% %time%] Processo %AGENT_PID% ancora attivo. Tentativo di chiusura forzata... >> "%LOG_FILE%"
    taskkill /PID %AGENT_PID% /F >> "%LOG_FILE%" 2>&1
    
    timeout /t 2 /nobreak >nul
    
    :: Verifica finale
    tasklist /FI "PID eq %AGENT_PID%" /FO CSV | findstr "%AGENT_PID%" >nul
    if !errorlevel! equ 0 (
        echo [%date% %time%] ERRORE CRITICO: Impossibile arrestare il processo %AGENT_PID%. L'aggiornamento potrebbe fallire se i file sono bloccati. >> "%LOG_FILE%"
    ) else (
        echo [%date% %time%] Processo terminato con successo. >> "%LOG_FILE%"
    )
) else (
    echo [%date% %time%] Processo %AGENT_PID% già terminato. >> "%LOG_FILE%"
)

:: Kill wscript.exe
taskkill /F /IM wscript.exe >> "%LOG_FILE%" 2>&1

echo [%date% %time%] Avvio copia Robocopy... >> "%LOG_FILE%"
robocopy "%EXTRACT_PATH%" "%TARGET_PATH%" /E /IS /IT /R:3 /W:2 /NP /NDL /NFL /XF *.log >> "%LOG_FILE%" 2>&1
set "ROBOCOPY_EXIT=%errorlevel%"
echo [%date% %time%] Robocopy terminato con codice %ROBOCOPY_EXIT% >> "%LOG_FILE%"

:: Verifica esistenza file servizio (critico)
if not exist "%TARGET_PATH%\CommAgentService.ps1" (
    echo [%date% %time%] ERRORE CRITICO: CommAgentService.ps1 MANCANTE. Impossibile avviare. >> "%LOG_FILE%"
    exit /b 1
)

echo [%date% %time%] File servizio presente. Procedo con avvio. >> "%LOG_FILE%"

:: Riavvio
cd /D "%TARGET_PATH%"
if exist "Start-CommAgent-Hidden.vbs" (
    echo [%date% %time%] Avvio tramite VBS... >> "%LOG_FILE%"
    start "" wscript.exe "Start-CommAgent-Hidden.vbs"
) else (
    echo [%date% %time%] VBS mancante, avvio diretto PowerShell... >> "%LOG_FILE%"
    start "" powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File "CommAgentService.ps1"
)

echo [%date% %time%] Comando di avvio inviato. >> "%LOG_FILE%"
echo [%date% %time%] Script completato. >> "%LOG_FILE%"
timeout /t 2 /nobreak >nul
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
                # Non mostrare toast durante aggiornamento per evitare errori
                return $false
            }
            
            # Notifica riavvio solo con balloon (no toast durante aggiornamento)
            if ($script:trayIcon) {
                $script:trayIcon.BalloonTipTitle = "Riavvio Agent"
                $script:trayIcon.BalloonTipText = "L'agent si riavvierà tra pochi secondi..."
                $script:trayIcon.ShowBalloonTip(2000)
            }
            
            try {
                # Verifica che i file da copiare esistano
                $serviceFile = Join-Path $extractPath "CommAgentService.ps1"
                if (-not (Test-Path $serviceFile)) {
                    Write-Log "ERRORE: CommAgentService.ps1 non trovato in $extractPath" "ERROR"
                    Write-Log "File presenti in extractPath:" "ERROR"
                    Get-ChildItem $extractPath | ForEach-Object { Write-Log "  - $($_.Name)" "ERROR" }
                    return $false
                }
                
                # Avvia il BAT script con privilegi amministratore (necessario per scrivere in ProgramData)
                Write-Log "Avvio BAT script con privilegi amministratore: $updaterBat" "INFO"
                Write-Log "Parametri BAT: extractPath=$extractPath, myPath=$myPath" "INFO"
                
                # Usa PowerShell per avviare il BAT con privilegi elevati
                # Il BAT stesso gestirà l'auto-elevazione se necessario
                try {
                    $proc = Start-Process -FilePath $updaterBat -Verb RunAs -WindowStyle Hidden -PassThru -ErrorAction Stop
                    Write-Log "Processo BAT avviato con privilegi elevati: PID $($proc.Id)" "INFO"
                }
                catch {
                    Write-Log "ERRORE: Impossibile avviare BAT con privilegi elevati: $_" "ERROR"
                    Write-Log "Dettagli: $($_.Exception.Message)" "ERROR"
                    # Fallback: prova senza privilegi elevati (il BAT stesso si eleverà)
                    try {
                        $proc = Start-Process -FilePath $updaterBat -WindowStyle Hidden -PassThru -ErrorAction Stop
                        Write-Log "Processo BAT avviato senza privilegi elevati (si eleverà automaticamente): PID $($proc.Id)" "INFO"
                    }
                    catch {
                        Write-Log "ERRORE CRITICO: Impossibile avviare BAT script: $_" "ERROR"
                        return $false
                    }
                }
                
                # Attendi che il BAT inizi l'esecuzione
                Start-Sleep -Seconds 3
                
                # Verifica che il processo BAT sia ancora in esecuzione
                if ($proc.HasExited) {
                    Write-Log "ERRORE: Processo BAT terminato prematuramente con codice $($proc.ExitCode)" "ERROR"
                    # Leggi il log del BAT se esiste
                    $batLog = Join-Path $env:TEMP "LogikaUpdate.log"
                    if (Test-Path $batLog) {
                        Write-Log "Contenuto LogikaUpdate.log:" "ERROR"
                        Get-Content $batLog | ForEach-Object { Write-Log "  $_" "ERROR" }
                    }
                    return $false
                }
                
                # Chiudi l'applicazione
                Write-Log "Chiusura agent per permettere aggiornamento..." "INFO"
                
                # Ferma tutti i timer prima di chiudere
                if ($script:heartbeatTimer) {
                    $script:heartbeatTimer.Stop()
                    $script:heartbeatTimer.Dispose()
                    Write-Log "Timer heartbeat fermato" "INFO"
                }
                if ($script:updateTimer) {
                    $script:updateTimer.Stop()
                    $script:updateTimer.Dispose()
                    Write-Log "Timer aggiornamenti fermato" "INFO"
                }
                if ($script:startupTimer) {
                    $script:startupTimer.Stop()
                    $script:startupTimer.Dispose()
                    Write-Log "Timer startup fermato" "INFO"
                }
                
                # Chiudi tray icon
                if ($script:trayIcon) {
                    $script:trayIcon.Visible = $false
                    $script:trayIcon.Dispose()
                }
                
                # Chiudi tutti i form aperti
                [System.Windows.Forms.Application]::Exit()
                
                # Forza terminazione processo dopo breve delay per permettere cleanup
                Start-Sleep -Seconds 2
                
                # Termina forzatamente questo processo PowerShell
                Write-Log "Terminazione forzata processo..." "INFO"
                Stop-Process -Id $PID -Force
                exit 0
            }
            catch {
                Write-Log "ERRORE avvio script aggiornamento: $_" "ERROR"
                Write-Log "Stack: $($_.ScriptStackTrace)" "ERROR"
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
        # Non mostrare toast durante aggiornamento per evitare errori che bloccano il processo
    }
    return $false
}

# ============================================
# MAIN
# ============================================
Write-Log "Avvio Servizio v$SCRIPT_VERSION..."

# Funzione di registrazione agent
function Register-Agent {
    param($ServerUrl, $Email, $Password)
    try {
        $machineName = $env:COMPUTERNAME
        $machineId = (Get-WmiObject Win32_ComputerSystemProduct -ErrorAction SilentlyContinue).UUID
        if (-not $machineId) { $machineId = $env:COMPUTERNAME + "_" + $env:USERNAME }
        $osInfo = "$([System.Environment]::OSVersion.VersionString) | User: $env:USERNAME"

        $body = @{
            email        = $Email
            password     = $Password
            machine_name = $machineName
            machine_id   = $machineId
            os_info      = $osInfo
        } | ConvertTo-Json -Depth 3

        $regUrl = "$ServerUrl/api/comm-agent/agent/register"
        Write-Log "Registrazione agent su: $regUrl (macchina: $machineName)" "INFO"

        $resp = Invoke-RestMethod -Uri $regUrl -Method POST -Body $body -ContentType "application/json" -ErrorAction Stop

        if ($resp.api_key) {
            $newCfg = @{
                server_url    = $ServerUrl
                api_key       = $resp.api_key
                agent_id      = $resp.agent_id
                email         = $Email
                machine_name  = $machineName
                machine_id    = $machineId
                registered_at = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
            }
            Save-Config $newCfg
            Write-Log "Registrazione completata! Agent ID: $($resp.agent_id)" "INFO"
            return $newCfg
        }
        else {
            Write-Log "ERRORE: Risposta registrazione senza api_key" "ERROR"
            return $null
        }
    }
    catch {
        Write-Log "ERRORE registrazione: $($_.Exception.Message)" "ERROR"
        return $null
    }
}

# Carica config esistente
$cfg = Load-Config

# Se non c'e' config.json ma c'e' install_config.json -> tenta registrazione
if (-not $cfg) {
    $preCfg = Join-Path $script:scriptDir "install_config.json"
    if (Test-Path $preCfg) {
        Write-Log "config.json non trovato. Leggo install_config.json per registrazione..." "INFO"
        try {
            $pc = Get-Content $preCfg -Raw | ConvertFrom-Json
            if ($pc.server_url -and $pc.email -and $pc.password) {
                Write-Log "Tentativo registrazione per: $($pc.email)" "INFO"
                $cfg = Register-Agent -ServerUrl $pc.server_url.TrimEnd('/') -Email $pc.email -Password $pc.password
                if ($cfg) {
                    Write-Log "Agent registrato con successo. Avvio tray icon..." "INFO"
                }
                else {
                    Write-Log "Registrazione fallita. Riprovo al prossimo avvio." "ERROR"
                }
            }
            else {
                Write-Log "install_config.json incompleto (mancano server_url, email o password)" "ERROR"
            }
        }
        catch {
            Write-Log "ERRORE lettura install_config.json: $($_.Exception.Message)" "ERROR"
        }
    }
    else {
        Write-Log "Nessun install_config.json trovato. Eseguire Install.bat per configurare l'agent." "WARN"
    }
}

if ($cfg) {
    Initialize-TrayIcon
    
    # Timer heartbeat (ogni 15 secondi) - variabile script per accesso globale
    $script:heartbeatTimer = New-Object System.Windows.Forms.Timer
    $script:heartbeatTimer.Interval = 15000 # 15 sec
    $script:heartbeatTimer.Add_Tick({ 
            Send-Heartbeat -Config $cfg 
        })
    $script:heartbeatTimer.Start()
    
    # Timer controllo aggiornamenti (ogni 5 minuti) - variabile script per accesso globale
    $script:updateTimer = New-Object System.Windows.Forms.Timer
    $script:updateTimer.Interval = $UPDATE_CHECK_INTERVAL_SECONDS * 1000 # 300 secondi = 5 minuti
    $script:updateTimer.Add_Tick({ 
            $now = Get-Date
            $elapsed = ($now - $script:lastUpdateCheck).TotalSeconds
            if ($elapsed -ge $UPDATE_CHECK_INTERVAL_SECONDS) {
                $script:lastUpdateCheck = $now
                Write-Log "Controllo aggiornamenti automatico..." "INFO"
                Check-Update
            }
        })
    $script:updateTimer.Start()
    
    # Controllo aggiornamenti all'avvio (dopo 10 secondi) - variabile script per accesso globale
    $script:startupTimer = New-Object System.Windows.Forms.Timer
    $script:startupTimer.Interval = 10000 # 10 secondi
    $script:startupTimer.Add_Tick({
            Write-Log "Controllo aggiornamenti all'avvio..." "INFO"
            Check-Update
            $script:startupTimer.Stop()
            $script:startupTimer.Dispose()
        })
    $script:startupTimer.Start()
    
    [System.Windows.Forms.Application]::Run()
}
else {
    Write-Host "Configurazione non trovata. Eseguire Install.bat"
    Start-Sleep 5
}
