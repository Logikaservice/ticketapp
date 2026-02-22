$SCRIPT_VERSION = "1.2.23"
$HEARTBEAT_INTERVAL_SECONDS = 10
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
try { Write-Log "Avvio script, versione $SCRIPT_VERSION" "INFO" } catch {}

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
    $Title = if ($Title -is [array]) { [string]($Title[0]) } else { [string]$Title }
    $Message = if ($Message -is [array]) { [string]($Message[0]) } else { [string]$Message }
    $Type = if ($Type -is [array]) { [string]($Type[0]) } else { [string]$Type }
    if (-not $Type) { $Type = "info" }

    if ($script:activeNotificationForm -and !$script:activeNotificationForm.IsDisposed) {
        try { $script:activeNotificationForm.Close() } catch {}
    }

    [int]$aR=99; [int]$aG=102; [int]$aB=241
    switch ([string]$Type.ToLower()) {
        "warning"     { $aR=245;  $aG=158; $aB=11 }
        "maintenance" { $aR=16;   $aG=185; $aB=129 }
        "update"      { $aR=59;   $aG=130; $aB=246 }
        "urgent"      { $aR=239;  $aG=68;  $aB=68 }
        "error"       { $aR=239;  $aG=68;  $aB=68 }
        default       { $aR=99;   $aG=102; $aB=241 }
    }
    $colorAccent   = [System.Drawing.Color]::FromArgb([int]$aR, [int]$aG, [int]$aB)
    $colorAccentDim= [System.Drawing.Color]::FromArgb(40, [int]$aR, [int]$aG, [int]$aB)
    $colorBg       = [System.Drawing.Color]::FromArgb(13,  17,  23 )
    $colorBgHeader = [System.Drawing.Color]::FromArgb(22,  27,  34 )
    $colorText     = [System.Drawing.Color]::FromArgb(230, 237, 243)
    $colorSub      = [System.Drawing.Color]::FromArgb(110, 118, 129)

    [int]$fW=400; [int]$fH=175; [int]$bdr=5; [int]$hH=38
    [int]$badgeW = 100
    [int]$fwMinBdr = $fW - $bdr
    [int]$locX1 = $fW - $bdr - $badgeW
    [int]$locY1 = $hH + 8
    [int]$locY2 = $hH + 34
    [int]$szW1 = $fwMinBdr - 20
    [int]$btnX = $fW - 118
    [int]$btnY = $fH - 34
    [int]$pgY = $fH - 4

    $form = New-Object System.Windows.Forms.Form
    $form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None
    $form.Size            = New-Object System.Drawing.Size($fW, $fH)
    $form.BackColor       = $colorBg
    $form.TopMost         = $true
    $form.ShowInTaskbar   = $false
    $form.Opacity         = 0
    $form.StartPosition   = [System.Windows.Forms.FormStartPosition]::Manual

    $screen = [System.Windows.Forms.Screen]::PrimaryScreen
    $r = $screen.WorkingArea
    $x = [int]$r.Right - [int]$fW - 16
    $y = [int]$r.Bottom - [int]$fH - 16
    $form.Location = New-Object System.Drawing.Point($x, $y)

    $panelBdr = New-Object System.Windows.Forms.Panel
    $panelBdr.Location  = New-Object System.Drawing.Point(0, 0)
    $panelBdr.Size      = New-Object System.Drawing.Size($bdr, $fH)
    $panelBdr.BackColor = $colorAccent
    $form.Controls.Add($panelBdr)

    $panelHdr = New-Object System.Windows.Forms.Panel
    $panelHdr.Location  = New-Object System.Drawing.Point($bdr, 0)
    $panelHdr.Size      = New-Object System.Drawing.Size($fwMinBdr, $hH)
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
    $lblBadge.Size      = New-Object System.Drawing.Size($badgeW, 16)
    $lblBadge.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter
    $lblBadge.Location  = New-Object System.Drawing.Point($locX1, 11)
    $lblBadge.AutoEllipsis = $true
    $panelHdr.Controls.Add($lblBadge)

    $lblTitleCont = New-Object System.Windows.Forms.Label
    $lblTitleCont.Text      = $Title
    $lblTitleCont.Font      = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
    $lblTitleCont.ForeColor = $colorText
    $lblTitleCont.Location  = New-Object System.Drawing.Point(($bdr + 10), $locY1)
    $lblTitleCont.Size      = New-Object System.Drawing.Size($szW1, 22)
    $form.Controls.Add($lblTitleCont)

    $lblMsg = New-Object System.Windows.Forms.Label
    $lblMsg.Text      = $Message
    $lblMsg.Font      = New-Object System.Drawing.Font("Segoe UI", 9.5)
    $lblMsg.ForeColor = $colorSub
    $lblMsg.Location  = New-Object System.Drawing.Point(($bdr + 10), $locY2)
    $lblMsg.Size      = New-Object System.Drawing.Size($szW1, 56)
    $form.Controls.Add($lblMsg)

    $btnClose = New-Object System.Windows.Forms.Button
    $btnClose.Text      = "HO CAPITO"
    $btnClose.Font      = New-Object System.Drawing.Font("Segoe UI", 8.5, [System.Drawing.FontStyle]::Bold)
    $btnClose.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
    $btnClose.FlatAppearance.BorderSize = 0
    $btnClose.BackColor = $colorAccent
    $btnClose.ForeColor = [System.Drawing.Color]::White
    $btnClose.Size      = New-Object System.Drawing.Size(108, 26)
    $btnClose.Location  = New-Object System.Drawing.Point($btnX, $btnY)
    $btnClose.Cursor    = [System.Windows.Forms.Cursors]::Hand
    $btnClose.Add_Click({ try { $this.FindForm().Close() } catch {} })
    $form.Controls.Add($btnClose)

    $pgBg = New-Object System.Windows.Forms.Panel
    $pgBg.Location  = New-Object System.Drawing.Point($bdr, $pgY)
    $pgBg.Size      = New-Object System.Drawing.Size($fwMinBdr, 4)
    $pgBg.BackColor = [System.Drawing.Color]::FromArgb(30, $aR, $aG, $aB)
    $form.Controls.Add($pgBg)

    $script:toastPgBar = New-Object System.Windows.Forms.Panel
    $script:toastPgBar.Location  = New-Object System.Drawing.Point(0, 0)
    $script:toastPgBar.Size      = New-Object System.Drawing.Size($fwMinBdr, 4)
    $script:toastPgBar.BackColor = $colorAccent
    $pgBg.Controls.Add($script:toastPgBar)

    $script:toastTick  = [int]0
    $script:toastTotal = [int]200
    $script:toastPgW   = [int]$fwMinBdr
    $script:toastForm  = $form

    $script:toastTimer = New-Object System.Windows.Forms.Timer
    $script:toastTimer.Interval = 50
    $script:toastTimer.Add_Tick({
        try {
            $f = $script:toastForm
            if (-not $f -or $f.IsDisposed) { $script:toastTimer.Stop(); return }
            if ($f.Opacity -lt 1.0) { $f.Opacity = [Math]::Min(1.0, [double]$f.Opacity + 0.12) }
            else { $script:toastTimer.Stop() }
        } catch {}
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
        $itemInfo.Add_Click({ try { Show-CustomToast "Info" "Logika Service Agent attivo." "Info" } catch { Write-Log "Errore toast Info: $_" "WARN" } })
        $menu.Items.Add("-")
        $itemCheck = $menu.Items.Add("Controlla Aggiornamenti")
        $itemCheck.Add_Click({ try { Check-Update -Force $true } catch { Write-Log "Errore Controlla aggiornamenti: $_" "WARN" } })
        $itemExit = $menu.Items.Add("Esci")
        $itemExit.Add_Click({ try { $script:trayIcon.Visible = $false; [System.Windows.Forms.Application]::Exit() } catch {} })
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
# INVENTARIO DISPOSITIVO (per Dispositivi aziendali)
# ============================================
function Get-DeviceInventory {
    try {
        $os = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction SilentlyContinue | Select-Object -First 1
        $cs = Get-CimInstance -ClassName Win32_ComputerSystem -ErrorAction SilentlyContinue | Select-Object -First 1
        $cpu = Get-CimInstance -ClassName Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1

        # MAC e IP (adattatori attivi)
        $mac = $null
        $ipParts = @()
        try {
            $adapters = Get-NetAdapter -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'Up' }
            foreach ($a in $adapters) {
                if ($a.MacAddress) { $mac = $a.MacAddress; break }
            }
            if (-not $mac) {
                $wmiNic = Get-CimInstance -ClassName Win32_NetworkAdapterConfiguration -ErrorAction SilentlyContinue | Where-Object { $_.IPEnabled -eq $true } | Select-Object -First 1
                if ($wmiNic -and $wmiNic.MACAddress) { $mac = $wmiNic.MACAddress }
            }
            $addrs = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.InterfaceAlias -and $_.IPAddress -and $_.IPAddress -notlike '127.*' }
            foreach ($addr in $addrs) {
                $ipParts += "$($addr.IPAddress) ($($addr.InterfaceAlias))"
            }
        } catch {}
        $ipAddresses = ($ipParts | Select-Object -Unique) -join ', '
        if (-not $ipAddresses) { $ipAddresses = $null }

        # OS
        $osName = $os.Caption
        $osVersion = $os.Version
        $osArch = $os.OSArchitecture
        $osInstallDate = $null
        if ($os.InstallDate) {
            try { $osInstallDate = ([Management.ManagementDateTimeConverter]::ToDateTime($os.InstallDate)).ToString('yyyy-MM-ddTHH:mm:ssZ') } catch {}
        }

        # Hardware: desktop/portatile da ChassisTypes
        $deviceType = 'desktop'
        if ($cs -and $null -ne $cs.ChassisTypes) {
            $ct = [int]$cs.ChassisTypes
            if ($ct -in 8,9,10,11,14,23,30) { $deviceType = 'portatile' }
        }
        $manufacturer = $cs.Manufacturer
        $model = $cs.Model

        # CPU
        $cpuName = $cpu.Name
        $cpuCores = [int]$cpu.NumberOfCores
        $cpuClockMhz = [int]$cpu.MaxClockSpeed

        # RAM (TotalPhysicalMemory in bytes, FreePhysicalMemory in KB)
        $ramTotalBytes = [long]$cs.TotalPhysicalMemory
        $ramTotalGb = [Math]::Round($ramTotalBytes / 1GB, 2)
        $ramFreeKb = [long]$os.FreePhysicalMemory
        $ramFreeGb = [Math]::Round($ramFreeKb / 1MB, 2)

        # Dischi (DriveType 3 = fisso)
        $disks = @()
        Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DriveType=3" -ErrorAction SilentlyContinue | ForEach-Object {
            $totalGb = [Math]::Round([long]$_.Size / 1GB, 2)
            $freeGb = [Math]::Round([long]$_.FreeSpace / 1GB, 2)
            $disks += @{ letter = $_.DeviceID; total_gb = $totalGb; free_gb = $freeGb }
        }

        # Utente
        $currentUser = $env:USERNAME
        if ($cs.UserName) { $currentUser = $cs.UserName }

        # Batteria (portatili)
        $batteryStatus = $null
        $batteryPercent = $null
        $batteryCharging = $false
        try {
            $bat = Get-CimInstance -ClassName Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($bat) {
                $batteryPercent = [int]$bat.EstimatedChargeRemaining
                $batteryStatus = if ($bat.BatteryStatus -eq 2) { 'In carica' } elseif ($bat.BatteryStatus -eq 1) { 'Scarica' } else { 'Altro' }
                $batteryCharging = ($bat.BatteryStatus -eq 2)
            }
        } catch {}

        # Antivirus (SecurityCenter2)
        $antivirusName = $null
        $antivirusState = $null
        try {
            $av = Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntiVirusProduct -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($av -and $av.displayName) {
                $antivirusName = $av.displayName
                $state = [int]$av.productState
                $antivirusState = if ($state -eq 0) { 'Disattivo' } else { 'Attivo' }
            }
        } catch {}

        return @{
            mac             = $mac
            device_name     = $env:COMPUTERNAME
            ip_addresses    = $ipAddresses
            os_name         = $osName
            os_version      = $osVersion
            os_arch         = $osArch
            os_install_date = $osInstallDate
            manufacturer    = $manufacturer
            model           = $model
            device_type     = $deviceType
            cpu_name        = $cpuName
            cpu_cores       = $cpuCores
            cpu_clock_mhz   = $cpuClockMhz
            ram_total_gb    = $ramTotalGb
            ram_free_gb     = $ramFreeGb
            disks           = $disks
            current_user    = $currentUser
            battery_status  = $batteryStatus
            battery_percent = $batteryPercent
            battery_charging = $batteryCharging
            antivirus_name  = $antivirusName
            antivirus_state = $antivirusState
        }
    } catch {
        Write-Log "Errore raccolta inventario: $_" "WARN"
        return $null
    }
}

# ============================================
# API & UPDATE LOGIC
# ============================================
$script:lastDeviceInfoSent = $null
$script:deviceInfoIntervalSec = 60

function Send-Heartbeat {
    param($Config)
    $url = "$($Config.server_url)/api/comm-agent/agent/heartbeat"
    try {
        $payload = @{ version = $SCRIPT_VERSION; status = "online" }
        $now = Get-Date
        if (-not $script:lastDeviceInfoSent -or (($now - $script:lastDeviceInfoSent).TotalSeconds -ge $script:deviceInfoIntervalSec)) {
            $inv = Get-DeviceInventory
            if ($inv) {
                $payload['device_info'] = $inv
                $script:lastDeviceInfoSent = $now
            }
        }
        $body = $payload | ConvertTo-Json -Depth 5 -Compress
        $headers = @{ "X-Comm-API-Key" = $Config.api_key; "Content-Type" = "application/json" }
        $resp = Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body $body -ErrorAction Stop
        $msgList = @($resp.messages)
        if ($msgList -and $msgList.Count -gt 0) {
            Write-Log "Messaggi ricevuti: $($msgList.Count). Mostro avvisi." "INFO"
            foreach ($m in $msgList) {
                try {
                    $msgType = if ($m.category) { $m.category } else { "info" }
                    $tit = if ($m.title) { $m.title } else { "Notifica" }
                    $bod = if ($m.body) { $m.body } else { "" }
                    Show-CustomToast -Title $tit -Message $bod -Type $msgType
                }
                catch {
                    Write-Log "Errore mostrando toast per messaggio: $_" "WARN"
                }
            }
        }
        return $true
    }
    catch {
        Write-Log "Heartbeat fallito (messaggi non recuperati): $_" "WARN"
        return $false
    }
}

function Check-Update {
    param([switch]$Force)
    $config = Load-Config
    try {
        $vUrl = "$($config.server_url)/api/comm-agent/agent-version"
        $vData = Invoke-RestMethod -Uri $vUrl -Method GET -ErrorAction Stop
        if ($vData.version -ne $SCRIPT_VERSION) {
            Write-Log "Aggiornamento rilevato: $SCRIPT_VERSION -> $($vData.version). Download e riavvio..." "INFO"
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
            $vbsContent = "Set WshShell = CreateObject(""WScript.Shell"")" + "`r`n" + "WshShell.Run ""powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File """"$myPath\CommAgentService.ps1"""""", 0, False" + "`r`n" + "Set WshShell = Nothing"
            $vbsContent | Out-File -FilePath $vbsLauncher -Encoding ASCII -Force

            $batContent = "@echo off`r`ntimeout /t 2 /nobreak >nul`r`ntaskkill /F /PID $PID >nul 2>&1`r`ntimeout /t 1 /nobreak >nul`r`nrobocopy `"$extractPath`" `"$myPath`" /E /IS /IT /NP /XF *.log /XF Start-CommAgent-Hidden.vbs`r`nwscript.exe `"$vbsLauncher`"`r`ndel `"%~f0`""
            $batContent | Out-File -FilePath $updaterBat -Encoding ASCII -Force
            Start-Process -FilePath $updaterBat -WindowStyle Hidden
            [System.Windows.Forms.Application]::Exit()
            Stop-Process -Id $PID -Force
        }
    }
    catch {
        Write-Log "Controllo aggiornamenti fallito: $_" "WARN"
    }
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
        $script:heartbeatTimer.Interval = [int]($HEARTBEAT_INTERVAL_SECONDS * 1000)
        $script:heartbeatTimer.Add_Tick({ Send-Heartbeat -Config $cfg })
        Send-Heartbeat -Config $cfg
        $script:heartbeatTimer.Start()
        Write-Log "Agent operativo, versione $SCRIPT_VERSION. Tray e heartbeat attivi." "INFO"
        $script:updateTimer = New-Object System.Windows.Forms.Timer
        $script:updateTimer.Interval = 120000
        $script:updateTimer.Add_Tick({ Check-Update })
        $script:updateTimer.Start()
        $script:updateCheckOnce = New-Object System.Windows.Forms.Timer
        $script:updateCheckOnce.Interval = 30000
        $script:updateCheckOnce.Add_Tick({
            if ($script:updateCheckOnce) { $script:updateCheckOnce.Stop(); $script:updateCheckOnce.Dispose(); $script:updateCheckOnce = $null }
            Check-Update
        })
        $script:updateCheckOnce.Start()
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
