$SCRIPT_VERSION = "1.2.16"
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
        [string]$Type = "info" 
    )

    if ($script:activeNotificationForm -and !$script:activeNotificationForm.IsDisposed) {
        try { $script:activeNotificationForm.Close() } catch {}
    }

    $aR=99; $aG=102; $aB=241;
    switch ($Type.ToLower()) {
        "warning"     { $aR=245;  $aG=158; $aB=11 }
        "maintenance" { $aR=16;   $aG=185; $aB=129 }
        "update"      { $aR=59;   $aG=130; $aB=246 }
        "urgent"      { $aR=239;  $aG=68;  $aB=68 }
        "error"       { $aR=239;  $aG=68;  $aB=68 }
        default       { $aR=99;   $aG=102; $aB=241 } 
    }
    $colorAccent   = [System.Drawing.Color]::FromArgb($aR, $aG, $aB)
    $colorAccentDim= [System.Drawing.Color]::FromArgb(40, $aR, $aG, $aB)
    $colorBg       = [System.Drawing.Color]::FromArgb(13,  17,  23 )
    $colorBgHeader = [System.Drawing.Color]::FromArgb(22,  27,  34 )
    $colorText     = [System.Drawing.Color]::FromArgb(230, 237, 243)
    $colorSub      = [System.Drawing.Color]::FromArgb(110, 118, 129)

    $fW=400; $fH=175; $bdr=5; $hH=38;

    $form = New-Object System.Windows.Forms.Form
    $form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None
    $form.Size            = New-Object System.Drawing.Size($fW, $fH)
    $form.BackColor       = $colorBg
    $form.TopMost         = $true
    $form.ShowInTaskbar   = $false
    $form.Opacity         = 0
    $form.StartPosition   = [System.Windows.Forms.FormStartPosition]::Manual

    $screen = [System.Windows.Forms.Screen]::PrimaryScreen
    $form.Location = New-Object System.Drawing.Point(($screen.WorkingArea.Right - $fW - 16), ($screen.WorkingArea.Bottom - $fH - 16))

    $panelBdr = New-Object System.Windows.Forms.Panel
    $panelBdr.Location  = New-Object System.Drawing.Point(0, 0)
    $panelBdr.Size      = New-Object System.Drawing.Size($bdr, $fH)
    $panelBdr.BackColor = $colorAccent
    $form.Controls.Add($panelBdr)

    $panelHdr = New-Object System.Windows.Forms.Panel
    $panelHdr.Location  = New-Object System.Drawing.Point($bdr, 0)
    $panelHdr.Size      = New-Object System.Drawing.Size($fW - $bdr, $hH)
    $panelHdr.BackColor = $colorBgHeader
    $form.Controls.Add($panelHdr)

    $lblBrand = New-Object System.Windows.Forms.Label
    $lblBrand.Text      = "LOGIKA SERVICE"
    $lblBrand.Font      = New-Object System.Drawing.Font("Segoe UI", 8.5, [System.Drawing.FontStyle]::Bold)
    $lblBrand.ForeColor = $colorAccent
    $lblBrand.AutoSize  = $true
    $lblBrand.Location  = New-Object System.Drawing.Point(10, 11)
    $panelHdr.Controls.Add($lblBrand)

    $lblBy = New-Object System.Windows.Forms.Label
    $lblBy.Text      = "by Rapa Alessandro"
    $lblBy.Font      = New-Object System.Drawing.Font("Segoe UI", 7, [System.Drawing.FontStyle]::Italic)
    $lblBy.ForeColor = $colorSub
    $lblBy.AutoSize  = $true
    $lblBy.Location  = New-Object System.Drawing.Point(122, 13)
    $panelHdr.Controls.Add($lblBy)

    $lblBadge = New-Object System.Windows.Forms.Label
    $lblBadge.Text      = $Type.ToUpper()
    $lblBadge.Font      = New-Object System.Drawing.Font("Segoe UI", 6.5, [System.Drawing.FontStyle]::Bold)
    $lblBadge.ForeColor = $colorAccent
    $lblBadge.BackColor = $colorAccentDim
    $lblBadge.AutoSize  = $false
    $lblBadge.Size      = New-Object System.Drawing.Size(62, 16)
    $lblBadge.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter
    $lblBadge.Location  = New-Object System.Drawing.Point(($fW - $bdr - 94), 11)
    $panelHdr.Controls.Add($lblBadge)

    $btnX = New-Object System.Windows.Forms.Button
    $btnX.Text      = "X"
    $btnX.Font      = New-Object System.Drawing.Font("Segoe UI", 9)
    $btnX.ForeColor = $colorSub
    $btnX.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
    $btnX.FlatAppearance.BorderSize = 0
    $btnX.BackColor = [System.Drawing.Color]::Transparent
    $btnX.Size      = New-Object System.Drawing.Size(26, 26)
    $btnX.Location  = New-Object System.Drawing.Point(($fW - $bdr - 28), 6)
    $btnX.Cursor    = [System.Windows.Forms.Cursors]::Hand
    $btnX.Add_Click({ try { $this.FindForm().Close() } catch {} })
    $panelHdr.Controls.Add($btnX)

    $lblTitleCont = New-Object System.Windows.Forms.Label
    $lblTitleCont.Text      = $Title
    $lblTitleCont.Font      = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
    $lblTitleCont.ForeColor = $colorText
    $lblTitleCont.Location  = New-Object System.Drawing.Point(($bdr + 10), ($hH + 8))
    $lblTitleCont.Size      = New-Object System.Drawing.Size($fW - $bdr - 20, 22)
    $form.Controls.Add($lblTitleCont)

    $lblMsg = New-Object System.Windows.Forms.Label
    $lblMsg.Text      = $Message
    $lblMsg.Font      = New-Object System.Drawing.Font("Segoe UI", 9.5)
    $lblMsg.ForeColor = $colorSub
    $lblMsg.Location  = New-Object System.Drawing.Point(($bdr + 10), ($hH + 34))
    $lblMsg.Size      = New-Object System.Drawing.Size($fW - $bdr - 20, 56)
    $form.Controls.Add($lblMsg)

    $btnClose = New-Object System.Windows.Forms.Button
    $btnClose.Text      = "HO CAPITO"
    $btnClose.Font      = New-Object System.Drawing.Font("Segoe UI", 8.5, [System.Drawing.FontStyle]::Bold)
    $btnClose.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
    $btnClose.FlatAppearance.BorderSize = 0
    $btnClose.BackColor = $colorAccent
    $btnClose.ForeColor = [System.Drawing.Color]::White
    $btnClose.Size      = New-Object System.Drawing.Size(108, 26)
    $btnClose.Location  = New-Object System.Drawing.Point(($fW - 118), ($fH - 34))
    $btnClose.Cursor    = [System.Windows.Forms.Cursors]::Hand
    $btnClose.Add_Click({ try { $this.FindForm().Close() } catch {} })
    $form.Controls.Add($btnClose)

    $pgBg = New-Object System.Windows.Forms.Panel
    $pgBg.Location  = New-Object System.Drawing.Point($bdr, ($fH - 4))
    $pgBg.Size      = New-Object System.Drawing.Size($fW - $bdr, 4)
    $pgBg.BackColor = [System.Drawing.Color]::FromArgb(30, $aR, $aG, $aB)
    $form.Controls.Add($pgBg)

    $script:toastPgBar = New-Object System.Windows.Forms.Panel
    $script:toastPgBar.Location  = New-Object System.Drawing.Point(0, 0)
    $script:toastPgBar.Size      = New-Object System.Drawing.Size($fW - $bdr, 4)
    $script:toastPgBar.BackColor = $colorAccent
    $pgBg.Controls.Add($script:toastPgBar)

    $script:toastTick  = 0
    $script:toastTotal = 200
    $script:toastPgW   = $fW - $bdr
    $script:toastForm  = $form

    $script:toastTimer = New-Object System.Windows.Forms.Timer
    $script:toastTimer.Interval = 50
    $script:toastTimer.Add_Tick({
        $f = $script:toastForm
        if (-not $f -or $f.IsDisposed) { $script:toastTimer.Stop(); return }
        if ($f.Opacity -lt 1.0) { $f.Opacity = [Math]::Min(1.0, $f.Opacity + 0.12) }
        $script:toastTick++
        $ratio = [Math]::Max(0.0, 1.0 - ($script:toastTick / $script:toastTotal))
        if ($script:toastPgBar -and !$script:toastPgBar.IsDisposed) { $script:toastPgBar.Width = [int]($script:toastPgW * $ratio) }
        if ($script:toastTick -ge $script:toastTotal) { $script:toastTimer.Stop(); try { $f.Close() } catch {} }
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
    try {
        $script:trayIcon = New-Object System.Windows.Forms.NotifyIcon
        $icon = $null
        try {
            $bmp = New-Object System.Drawing.Bitmap(32, 32)
            $g = [System.Drawing.Graphics]::FromImage($bmp)
            $g.Clear([System.Drawing.Color]::Transparent)
            $g.FillEllipse([System.Drawing.Brushes]::BlueViolet, 1, 1, 30, 30)
            $fontStyle = [System.Drawing.FontStyle]::Bold
            $font = New-Object System.Drawing.Font("Segoe UI", 16, $fontStyle)
            try { $g.DrawString("L", $font, [System.Drawing.Brushes]::White, 6, -2) } finally { if ($font) { $font.Dispose() } }
            $icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
        }
        catch {
            Write-Log "Icona personalizzata non disponibile, uso icona di sistema: $_" "WARN"
            $icon = [System.Drawing.SystemIcons]::Information
        }
        $script:trayIcon.Icon = $icon
        $script:trayIcon.Text = $APP_TOOLTIP
        $menu = New-Object System.Windows.Forms.ContextMenuStrip
        $itemInfo = $menu.Items.Add("Info Logika Agent")
        $itemInfo.Add_Click({ Show-CustomToast "Info" "Logika Service Agent attivo." "Info" })
        $menu.Items.Add("-")
        $itemCheck = $menu.Items.Add("Controlla Aggiornamenti")
        $itemCheck.Add_Click({ Check-Update -Force $true })
        $itemExit = $menu.Items.Add("Esci")
        $itemExit.Add_Click({ $script:trayIcon.Visible = $false; [System.Windows.Forms.Application]::Exit() })
        $script:trayIcon.ContextMenuStrip = $menu
        $script:trayIcon.Visible = $true
        $script:trayIcon.BalloonTipTitle = "Logika Service Agent"
        $script:trayIcon.BalloonTipText = "Agent avviato. Clicca l'icona vicino all'orologio per il menu."
        $script:trayIcon.ShowBalloonTip(5000)
        [System.Windows.Forms.Application]::DoEvents()
        Write-Log "Tray icon creata e visibile." "INFO"
    }
    catch {
        Write-Log "Errore creazione tray icon: $_" "ERROR"
        throw
    }
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
        $vData = Invoke-RestMethod -Uri $vUrl -Method GET -ErrorAction Stop
        if ($vData.version -ne $SCRIPT_VERSION) {
            $zipPath = Join-Path $env:TEMP "LogikaCommAgent_Update.zip"
            $extractPath = Join-Path $env:TEMP "LogikaCommAgent_Update"
            $dlUrl = "$($config.server_url)/api/comm-agent/download-agent"
            $headers = @{ "X-Comm-API-Key" = $config.api_key }
            Invoke-WebRequest -Uri $dlUrl -Headers $headers -OutFile $zipPath -ErrorAction Stop
            if (Test-Path $extractPath) { Remove-Item $extractPath -Recurse -Force }
            Expand-Archive -Path $zipPath -DestinationPath $extractPath -Force -ErrorAction Stop
            $updaterBat = Join-Path $env:TEMP "LogikaUpdate.bat"
            $myPath = $script:scriptDir
            $vbsLauncher = Join-Path $myPath "Start-CommAgent-Hidden.vbs"
            $vbsContent = "Set WshShell = CreateObject(`"WScript.Shell`")`r`nWshShell.Run `"powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File `"`"$myPath\CommAgentService.ps1`"`"`, 0`r`nSet WshShell = Nothing"
            $vbsContent | Out-File -FilePath $vbsLauncher -Encoding ASCII -Force
            
            $batContent = "@echo off`r`ntimeout /t 2 /nobreak >nul`r`ntaskkill /F /IM powershell.exe /FI `"WINDOWTITLE eq $APP_NAME*`" >nul 2>&1`r`nrobocopy `"$extractPath`" `"$myPath`" /E /IS /IT /NP /XF *.log`r`nexplorer.exe `"$vbsLauncher`"`r`ndel `"%~f0`""
            $batContent | Out-File -FilePath $updaterBat -Encoding ASCII -Force
            Start-Process -FilePath $updaterBat -WindowStyle Hidden
            [System.Windows.Forms.Application]::Exit()
            Stop-Process -Id $PID -Force
        }
    }
    catch {}
}

function Register-Agent {
    param($ServerUrl, $Email, $Password)
    try {
        $body = @{ email=$Email; password=$Password; machine_name=$env:COMPUTERNAME; machine_id=$env:COMPUTERNAME; os_info="Windows" } | ConvertTo-Json
        $resp = Invoke-RestMethod -Uri "$ServerUrl/api/comm-agent/agent/register" -Method POST -Body $body -ContentType "application/json" -ErrorAction Stop
        if ($resp.api_key) {
            $newCfg = @{ server_url=$ServerUrl; api_key=$resp.api_key; agent_id=$resp.agent_id; email=$Email }
            Save-Config $newCfg
            return $newCfg
        }
    } catch {}
    return $null
}

# ============================================
# PRIMA ESECUZIONE: registrazione da install_config.json
# ============================================
function Get-ConfigOrRegister {
    $cfg = Load-Config
    if ($cfg -and $cfg.api_key) { return $cfg }
    $installConfigPath = Join-Path $script:scriptDir "install_config.json"
    if (-not (Test-Path $installConfigPath)) {
        Write-Log "Mancano config.json e install_config.json. Eseguire l'installer." "ERROR"
        return $null
    }
    try {
        $install = Get-Content $installConfigPath -Raw | ConvertFrom-Json
        $serverUrl = $install.server_url
        $email    = $install.email
        $password = $install.password
        if (-not $serverUrl) { $serverUrl = "https://ticket.logikaservice.it" }
        if (-not $email -or -not $password) {
            Write-Log "install_config.json senza email/password. Reinstallare." "ERROR"
            return $null
        }
        Write-Log "Prima esecuzione: registrazione in corso..." "INFO"
        $cfg = Register-Agent -ServerUrl $serverUrl -Email $email -Password $password
        if ($cfg) {
            Write-Log "Registrazione completata. Agent ID: $($cfg.agent_id)" "INFO"
            return $cfg
        }
        Write-Log "Registrazione fallita. Verificare credenziali e URL." "ERROR"
    }
    catch {
        Write-Log "Errore prima esecuzione / registrazione: $_" "ERROR"
    }
    return $null
}

# ============================================
# MAIN
# ============================================
$cfg = Get-ConfigOrRegister
if ($cfg) {
    try {
        Initialize-TrayIcon
        $script:heartbeatTimer = New-Object System.Windows.Forms.Timer
        $script:heartbeatTimer.Interval = 15000
        $script:heartbeatTimer.Add_Tick({ Send-Heartbeat -Config $cfg })
        $script:heartbeatTimer.Start()
        $script:updateTimer = New-Object System.Windows.Forms.Timer
        $script:updateTimer.Interval = 300000
        $script:updateTimer.Add_Tick({ Check-Update })
        $script:updateTimer.Start()
        [System.Windows.Forms.Application]::Run()
    }
    catch {
        Write-Log "Errore avvio tray / message loop: $_" "ERROR"
        Write-Host "Errore avvio: $($_.Exception.Message). Controlla il log: $script:logFile"
    }
} else {
    Write-Log "Configurazione mancante o registrazione fallita. Agent non avviato." "ERROR"
    Write-Host "Configurazione mancante. Controlla il log: $script:logFile"
}
