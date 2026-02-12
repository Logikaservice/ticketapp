$SCRIPT_VERSION = "1.2.4"
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

    # LABEL: by Rapa Alessandro (allineato a destra, prima del pulsante X)
    $lblSub = New-Object System.Windows.Forms.Label
    $lblSub.Text = "by Rapa Alessandro"
    $lblSub.Font = New-Object System.Drawing.Font("Segoe UI", 8, [System.Drawing.FontStyle]::Italic)
    $lblSub.ForeColor = [System.Drawing.Color]::FromArgb(120, 120, 120)
    $lblSub.AutoSize = $true
    # Usa valore fisso approssimativo per evitare operazioni aritmetiche complesse
    # "by Rapa Alessandro" con font 8pt italic ≈ 110px, pulsante X è a 385px con margine 30px
    $subX = 250  # Posizione fissa: 385 - 110 - 25 (larghezza approx testo)
    $lblSub.Location = New-Object System.Drawing.Point($subX, 14)
    $panelHead.Controls.Add($lblSub)

    # Pulsante X piccolo in alto a destra (usa Button invece di Label per migliore gestione eventi)
    $btnX = New-Object System.Windows.Forms.Button
    $btnX.Text = "×"
    $btnX.Font = New-Object System.Drawing.Font("Segoe UI", 14, [System.Drawing.FontStyle]::Regular)
    $btnX.ForeColor = [System.Drawing.Color]::FromArgb(150, 150, 150)
    $btnX.FlatAppearance.BorderSize = 0
    $btnX.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
    $btnX.BackColor = [System.Drawing.Color]::Transparent
    $btnX.Size = New-Object System.Drawing.Size(25, 25)
    $btnX.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter
    $btnX.Location = New-Object System.Drawing.Point(385, 10)
    $btnX.Cursor = [System.Windows.Forms.Cursors]::Hand
    $btnX.Add_Click({
        if ($form -and !$form.IsDisposed) {
            $form.Close()
            $form.Dispose()
        }
    })
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
    $btnClose.Add_Click({
        if ($form -and !$form.IsDisposed) {
            $form.Close()
            $form.Dispose()
        }
    })
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

:: Se ci sono argomenti, usa quelli invece delle variabili d'ambiente
if not "%~1"=="" (
    set "EXTRACT_PATH=%~1"
    set "TARGET_PATH=%~2"
    set "VBS_LAUNCHER=%~3"
    set "LOG_FILE=%~4"
    echo [%date% %time%] Parametri ricevuti: EXTRACT_PATH=%EXTRACT_PATH%, TARGET_PATH=%TARGET_PATH% >> "%LOG_FILE%"
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
    :: Riavvia con privilegi elevati passando il file parametri
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs -ArgumentList '""%PARAM_FILE%""'"
    exit /b 0
)

:: Se è stato passato un file parametri, leggi da lì
if not "%~1"=="" (
    if exist "%~1" (
        :: Leggi tutte le righe dal file parametri
        set /p "EXTRACT_PATH=" < "%~1"
        set /p "TARGET_PATH=" < "%~1"
        set /p "VBS_LAUNCHER=" < "%~1"
        set /p "LOG_FILE=" < "%~1"
        :: Crea il log file se non esiste e scrivi i parametri
        echo [%date% %time%] Parametri letti da file temporaneo >> "%LOG_FILE%"
        echo [%date% %time%] EXTRACT_PATH=%EXTRACT_PATH% >> "%LOG_FILE%"
        echo [%date% %time%] TARGET_PATH=%TARGET_PATH% >> "%LOG_FILE%"
        del "%~1"
    )
)

echo [%date% %time%] Privilegi amministratore verificati >> "%LOG_FILE%"

echo [%date% %time%] Aggiornamento LogikaCommAgent in corso... > "%LOG_FILE%"
echo [%date% %time%] Privilegi amministratore verificati >> "%LOG_FILE%"
echo [%date% %time%] Attesa chiusura processo agent (10 secondi)... >> "%LOG_FILE%"
timeout /t 10 /nobreak >nul

echo [%date% %time%] Verifica processi PowerShell agent ancora attivi... >> "%LOG_FILE%"
tasklist /FI "IMAGENAME eq powershell.exe" /FO CSV | findstr /I "CommAgentService" >nul
if %errorlevel% equ 0 (
    echo [%date% %time%] Processo agent ancora attivo, attesa aggiuntiva (5 secondi)... >> "%LOG_FILE%"
    timeout /t 5 /nobreak >nul
)

echo [%date% %time%] Copia file da %EXTRACT_PATH% a %TARGET_PATH% >> "%LOG_FILE%"
:: Usa robocopy invece di xcopy per migliore gestione permessi e retry automatico
robocopy "%EXTRACT_PATH%" "%TARGET_PATH%" /E /IS /IT /R:3 /W:2 /NP /NDL /NFL >> "%LOG_FILE%" 2>&1
set "ROBOCOPY_EXIT=%errorlevel%"
if %ROBOCOPY_EXIT% geq 8 (
    echo [%date% %time%] ERRORE: Copia file fallita (codice %ROBOCOPY_EXIT%) >> "%LOG_FILE%"
    exit /b 1
)
echo [%date% %time%] File copiati con successo >> "%LOG_FILE%"
echo [%date% %time%] Verifica file dopo copia... >> "%LOG_FILE%"
if exist "%TARGET_PATH%\CommAgentService.ps1" (
    echo [%date% %time%] CommAgentService.ps1 trovato >> "%LOG_FILE%"
) else (
    echo [%date% %time%] ERRORE: CommAgentService.ps1 non trovato dopo copia >> "%LOG_FILE%"
    exit /b 1
)
echo [%date% %time%] Riavvio agent... >> "%LOG_FILE%"
echo [%date% %time%] Verifica VBS launcher: %VBS_LAUNCHER% >> "%LOG_FILE%"
if exist "%VBS_LAUNCHER%" (
    echo [%date% %time%] VBS launcher trovato, avvio con wscript.exe >> "%LOG_FILE%"
    cd /D "%TARGET_PATH%"
    start "" wscript.exe "Start-CommAgent-Hidden.vbs"
    if errorlevel 1 (
        echo [%date% %time%] ERRORE: Avvio VBS fallito (codice %errorlevel%), uso PowerShell diretto >> "%LOG_FILE%"
        start "" powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File "CommAgentService.ps1"
    ) else (
        echo [%date% %time%] VBS launcher avviato con successo >> "%LOG_FILE%"
    )
) else (
    echo [%date% %time%] VBS launcher non trovato, uso PowerShell diretto >> "%LOG_FILE%"
    cd /D "%TARGET_PATH%"
    start "" powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File "CommAgentService.ps1"
)
echo [%date% %time%] Attesa avvio processo (2 secondi)... >> "%LOG_FILE%"
timeout /t 2 /nobreak >nul
echo [%date% %time%] Aggiornamento completato >> "%LOG_FILE%"
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
