# NetworkMonitorTrayIcon.ps1
# Applicazione separata per mostrare l'icona nella system tray
# Si avvia automaticamente all'accesso utente (via registro di sistema)
# Comunica con il servizio tramite file di stato condivisi

param(
    [string]$ConfigPath = "$env:ProgramData\NetworkMonitorAgent\config.json",
    [string]$StatusFilePath = "$env:ProgramData\NetworkMonitorAgent\.agent_status.json"
)

# Aggiungi Windows Forms
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Variabili globali
$script:trayIcon = $null
$script:isRunning = $true
$script:statusFile = $StatusFilePath
$script:configPath = $ConfigPath
$script:config = $null

# Carica configurazione
function Load-Config {
    if (Test-Path $script:configPath) {
        try {
            $script:config = Get-Content $script:configPath -Raw | ConvertFrom-Json
            return $true
        } catch {
            return $false
        }
    }
    return $false
}

# Leggi stato dal file
function Get-Status {
    if (Test-Path $script:statusFile) {
        try {
            $status = Get-Content $script:statusFile -Raw | ConvertFrom-Json
            return $status
        } catch {
            return $null
        }
    }
    return $null
}

# Funzione per aprire finestra stato (mostra informazioni base)
function Show-StatusWindow {
    if (-not $script:config) {
        if (-not (Load-Config)) {
            [System.Windows.Forms.MessageBox]::Show(
                "Configurazione non disponibile",
                "Network Monitor Agent",
                [System.Windows.Forms.MessageBoxButtons]::OK,
                [System.Windows.Forms.MessageBoxIcon]::Warning
            )
            return
        }
    }
    
    # Mostra informazioni base
    $status = Get-Status
    if ($status) {
        $message = "Network Monitor Agent`n`n"
        $message += "Stato: $($status.status)`n"
        if ($status.last_scan) {
            $message += "Ultima scansione: $($status.last_scan)`n"
        }
        $message += "Dispositivi trovati: $($status.devices_found)`n"
        if ($status.scan_interval_minutes) {
            $message += "Intervallo: $($status.scan_interval_minutes) minuti"
        }
        
        [System.Windows.Forms.MessageBox]::Show(
            $message,
            "Network Monitor Agent",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information
        )
    } else {
        [System.Windows.Forms.MessageBox]::Show(
            "Servizio in avvio o non disponibile`n`nL'icona della system tray e' attiva.`nIl servizio potrebbe essere ancora in avvio.",
            "Network Monitor Agent",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information
        )
    }
}

# Crea tray icon
function Show-TrayIcon {
    $script:trayIcon = New-Object System.Windows.Forms.NotifyIcon
    $script:trayIcon.Icon = [System.Drawing.SystemIcons]::Information
    $script:trayIcon.Text = "Network Monitor Agent"
    $script:trayIcon.Visible = $true
    
    # Menu contestuale
    $contextMenu = New-Object System.Windows.Forms.ContextMenuStrip
    
    # Voce "Stato"
    $statusItem = New-Object System.Windows.Forms.ToolStripMenuItem
    $statusItem.Text = "Stato"
    $statusItem.Add_Click({
        Show-StatusWindow
    })
    $contextMenu.Items.Add($statusItem)
    
    $contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
    
    # Voce "Apri cartella log"
    $logItem = New-Object System.Windows.Forms.ToolStripMenuItem
    $logItem.Text = "Apri cartella log"
    $logItem.Add_Click({
        $logDir = Split-Path -Parent $script:configPath
        if (Test-Path $logDir) {
            Start-Process "explorer.exe" -ArgumentList "`"$logDir`""
        }
    })
    $contextMenu.Items.Add($logItem)
    
    $contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
    
    # Voce "Esci"
    $exitItem = New-Object System.Windows.Forms.ToolStripMenuItem
    $exitItem.Text = "Esci"
    $exitItem.Add_Click({
        if ($script:trayIcon) {
            $script:trayIcon.Visible = $false
            $script:trayIcon.Dispose()
        }
        [System.Windows.Forms.Application]::ExitThread()
    })
    $contextMenu.Items.Add($exitItem)
    
    $script:trayIcon.ContextMenuStrip = $contextMenu
    
    # Click sinistro sull'icona mostra stato
    $script:trayIcon.Add_Click({
        if ($_.Button -eq [System.Windows.Forms.MouseButtons]::Left) {
            Show-StatusWindow
        }
    })
    
    # Timer per aggiornare tooltip
    $updateTooltip = {
        if ($script:trayIcon) {
            $status = Get-Status
            if ($status) {
                $statusText = "Network Monitor Agent - $($status.status)"
                if ($status.last_scan) {
                    try {
                        $lastScanTime = [DateTime]::Parse($status.last_scan)
                        $timeSince = (Get-Date) - $lastScanTime
                        $minutesAgo = [Math]::Floor($timeSince.TotalMinutes)
                        $statusText = "Agent - Ultima scan: ${minutesAgo}m fa"
                    } catch {
                        # Ignora errori parsing
                    }
                }
                # Limita a 63 caratteri
                if ($statusText.Length -gt 63) {
                    $statusText = $statusText.Substring(0, 63)
                }
                $script:trayIcon.Text = $statusText
            } else {
                $script:trayIcon.Text = "Network Monitor Agent - Avvio..."
            }
        }
    }
    
    # Timer per aggiornare tooltip ogni minuto
    $timer = New-Object System.Windows.Forms.Timer
    $timer.Interval = 60000  # 1 minuto
    $timer.Add_Tick($updateTooltip)
    $timer.Start()
    
    # Aggiorna immediatamente
    & $updateTooltip
}

# Main
[System.Windows.Forms.Application]::EnableVisualStyles()

# Carica configurazione
if (-not (Load-Config)) {
    [System.Windows.Forms.MessageBox]::Show(
        "File config.json non trovato: $script:configPath`n`nL'icona della system tray non può essere mostrata.",
        "Network Monitor Agent",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Warning
    )
    exit 1
}

# Mostra tray icon
Show-TrayIcon

# Loop principale - Processa messaggi Windows
while ($script:isRunning) {
    [System.Windows.Forms.Application]::DoEvents()
    Start-Sleep -Milliseconds 100
}
