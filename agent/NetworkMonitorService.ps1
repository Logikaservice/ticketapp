# NetworkMonitorService.ps1
# Servizio Windows permanente per Network Monitor Agent
# Rimane sempre attivo e esegue scansioni periodicamente

param(
    [string]$ConfigPath = "config.json",
    [switch]$ServiceMode = $false  # Modalità servizio (senza GUI)
)

# Aggiungi Windows Forms per la tray icon
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Variabili globali
$script:isRunning = $true
$script:trayIcon = $null
$script:lastScanTime = $null
$script:lastScanDevices = 0
$script:statusFile = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) ".agent_status.json"

# Funzioni helper (importate da NetworkMonitor.ps1 o duplicate qui)
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    
    if ($ServiceMode) {
        # In modalità servizio, salva solo su file
        $logPath = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "NetworkMonitorService.log"
        $logMessage | Out-File -FilePath $logPath -Append -Encoding UTF8
    } else {
        Write-Host $logMessage
        # Salva anche su file
        $logPath = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "NetworkMonitorService.log"
        $logMessage | Out-File -FilePath $logPath -Append -Encoding UTF8
    }
}

function Update-StatusFile {
    param(
        [string]$Status,  # "running", "stopping", "error"
        [int]$DevicesFound = 0,
        [datetime]$LastScan = $null,
        [string]$Message = ""
    )
    
    $statusData = @{
        status = $Status
        devices_found = $DevicesFound
        last_scan = if ($LastScan) { $LastScan.ToString("yyyy-MM-dd HH:mm:ss") } else { $null }
        message = $Message
        updated_at = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    } | ConvertTo-Json
    
    try {
        $statusData | Out-File -FilePath $script:statusFile -Encoding UTF8 -Force
    } catch {
        # Ignora errori scrittura status
    }
}

# Importa funzioni da NetworkMonitor.ps1
$networkMonitorPath = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "NetworkMonitor.ps1"
if (Test-Path $networkMonitorPath) {
    # Esegui in uno scope separato per ottenere le funzioni
    . $networkMonitorPath -ConfigPath $ConfigPath -ServiceMode:$true 2>$null
    
    # Le funzioni vengono esportate automaticamente, ma per sicurezza le definiamo direttamente
    # In realtà, meglio duplicare le funzioni necessarie qui o usarle come script module
}

# Carica funzioni necessarie da NetworkMonitor.ps1 usando dot sourcing
# Per ora, le richiamiamo direttamente dallo script originale

function Start-ScanCycle {
    param(
        [hashtable]$Config
    )
    
    Write-Log "=== Avvio ciclo scansione ==="
    Update-StatusFile -Status "running" -Message "Scansione in corso..."
    
    try {
        # Esegui lo script NetworkMonitor.ps1 in modalità servizio
        $networkMonitorScript = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "NetworkMonitor.ps1"
        
        if (-not (Test-Path $networkMonitorScript)) {
            Write-Log "ERRORE: NetworkMonitor.ps1 non trovato!" "ERROR"
            Update-StatusFile -Status "error" -Message "NetworkMonitor.ps1 non trovato"
            return $false
        }
        
        # Chiama la funzione di scansione direttamente
        # Per ora, eseguiamo lo script completo ma in modalità "servizio" (silenzioso)
        $scanResult = & powershell.exe -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File $networkMonitorScript -ConfigPath $ConfigPath
        
        # Aggiorna status
        $script:lastScanTime = Get-Date
        $script:lastScanDevices = 0  # Non abbiamo il conteggio diretto, ma possiamo leggerlo dai log
        
        Update-StatusFile -Status "running" -Message "Ultima scansione completata" -LastScan $script:lastScanTime
        
        Write-Log "Ciclo scansione completato"
        return $true
        
    } catch {
        Write-Log "Errore durante scansione: $_" "ERROR"
        Update-StatusFile -Status "error" -Message "Errore: $_"
        return $false
    }
}

function Show-TrayIcon {
    # Crea icona nella system tray
    $script:trayIcon = New-Object System.Windows.Forms.NotifyIcon
    $script:trayIcon.Icon = [System.Drawing.SystemIcons]::Information
    $script:trayIcon.Text = "Network Monitor Agent"
    $script:trayIcon.Visible = $true
    
    # Menu contestuale
    $contextMenu = New-Object System.Windows.Forms.ContextMenuStrip
    
    # Voce "Stato"
    $statusItem = New-Object System.Windows.Forms.ToolStripMenuItem
    $statusItem.Text = "Stato: In esecuzione"
    $statusItem.Enabled = $false
    $contextMenu.Items.Add($statusItem)
    
    $contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
    
    # Voce "Apri cartella log"
    $logItem = New-Object System.Windows.Forms.ToolStripMenuItem
    $logItem.Text = "Apri cartella log"
    $logItem.Add_Click({
        $logPath = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "NetworkMonitorService.log"
        if (Test-Path $logPath) {
            Start-Process "explorer.exe" -ArgumentList "/select,`"$logPath`""
        }
    })
    $contextMenu.Items.Add($logItem)
    
    # Voce "Visualizza log"
    $viewLogItem = New-Object System.Windows.Forms.ToolStripMenuItem
    $viewLogItem.Text = "Visualizza log"
    $viewLogItem.Add_Click({
        $logPath = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "NetworkMonitorService.log"
        if (Test-Path $logPath) {
            Start-Process notepad.exe -ArgumentList "`"$logPath`""
        }
    })
    $contextMenu.Items.Add($viewLogItem)
    
    $contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
    
    # Voce "Esci"
    $exitItem = New-Object System.Windows.Forms.ToolStripMenuItem
    $exitItem.Text = "Esci"
    $exitItem.Add_Click({
        $script:isRunning = $false
        if ($script:trayIcon) {
            $script:trayIcon.Visible = $false
            $script:trayIcon.Dispose()
        }
    })
    $contextMenu.Items.Add($exitItem)
    
    $script:trayIcon.ContextMenuStrip = $contextMenu
    
    # Doppio click sull'icona mostra informazioni
    $script:trayIcon.Add_DoubleClick({
        $statusInfo = @{
            Status = "In esecuzione"
            LastScan = if ($script:lastScanTime) { $script:lastScanTime.ToString("HH:mm:ss") } else { "Mai" }
            DevicesFound = $script:lastScanDevices
        }
        
        [System.Windows.Forms.MessageBox]::Show(
            "Network Monitor Agent`n`n" +
            "Stato: $($statusInfo.Status)`n" +
            "Ultima scansione: $($statusInfo.LastScan)`n" +
            "Dispositivi trovati: $($statusInfo.DevicesFound)",
            "Network Monitor Agent",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information
        )
    })
    
    # Aggiorna tooltip periodicamente
    $updateTooltip = {
        if ($script:trayIcon) {
            $statusText = "Network Monitor Agent`n"
            if ($script:lastScanTime) {
                $timeSince = (Get-Date) - $script:lastScanTime
                $statusText += "Ultima scansione: $([Math]::Floor($timeSince.TotalMinutes)) minuti fa`n"
            } else {
                $statusText += "Ultima scansione: Mai`n"
            }
            $statusText += "Stato: In esecuzione"
            $script:trayIcon.Text = $statusText
        }
    }
    
    # Timer per aggiornare tooltip ogni minuto
    $timer = New-Object System.Windows.Forms.Timer
    $timer.Interval = 60000  # 1 minuto
    $timer.Add_Tick($updateTooltip)
    $timer.Start()
    
    # Aggiorna immediatamente
    & $updateTooltip
    
    Write-Log "Tray icon creata e visibile"
}

function Update-TrayIconStatus {
    param(
        [string]$Status,  # "running", "error", "scanning"
        [int]$DevicesFound = 0
    )
    
    if (-not $script:trayIcon) { return }
    
    switch ($Status) {
        "running" {
            $script:trayIcon.Icon = [System.Drawing.SystemIcons]::Information
        }
        "error" {
            $script:trayIcon.Icon = [System.Drawing.SystemIcons]::Error
            $script:trayIcon.ShowBalloonTip(5000, "Network Monitor Agent", "Errore durante la scansione", [System.Windows.Forms.ToolTipIcon]::Error)
        }
        "scanning" {
            $script:trayIcon.Icon = [System.Drawing.SystemIcons]::Exclamation
        }
    }
    
    # Aggiorna tooltip
    $tooltipText = "Network Monitor Agent`nStato: $Status"
    if ($DevicesFound -gt 0) {
        $tooltipText += "`nDispositivi: $DevicesFound"
    }
    $script:trayIcon.Text = $tooltipText
}

# === MAIN ===

Write-Log "=== Network Monitor Service Avviato ==="
Write-Log "Modalità: $(if ($ServiceMode) { 'Servizio' } else { 'Applicazione con Tray Icon' })"

# Carica configurazione
if (-not (Test-Path $ConfigPath)) {
    $errorMsg = "File config.json non trovato! Crea un file config.json con le impostazioni."
    Write-Log $errorMsg "ERROR"
    Update-StatusFile -Status "error" -Message $errorMsg
    if (-not $ServiceMode) {
        [System.Windows.Forms.MessageBox]::Show($errorMsg, "Network Monitor Service", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
    }
    exit 1
}

try {
    $config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
} catch {
    $errorMsg = "Errore lettura config.json: $_"
    Write-Log $errorMsg "ERROR"
    Update-StatusFile -Status "error" -Message $errorMsg
    if (-not $ServiceMode) {
        [System.Windows.Forms.MessageBox]::Show($errorMsg, "Network Monitor Service", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
    }
    exit 1
}

# Verifica parametri obbligatori
if (-not $config.server_url -or -not $config.api_key -or -not $config.network_ranges) {
    $errorMsg = "Configurazione incompleta! Richiesti: server_url, api_key, network_ranges"
    Write-Log $errorMsg "ERROR"
    Update-StatusFile -Status "error" -Message $errorMsg
    if (-not $ServiceMode) {
        [System.Windows.Forms.MessageBox]::Show($errorMsg, "Network Monitor Service", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
    }
    exit 1
}

$scanIntervalMinutes = $config.scan_interval_minutes
if (-not $scanIntervalMinutes) { $scanIntervalMinutes = 15 }

Write-Log "Server URL: $($config.server_url)"
Write-Log "Network ranges: $($config.network_ranges -join ', ')"
Write-Log "Scan interval: $scanIntervalMinutes minuti"

# Inizializza status
Update-StatusFile -Status "running" -Message "Servizio avviato"

# Se non in modalità servizio, mostra tray icon
if (-not $ServiceMode) {
    # Crea application context per la tray icon
    [System.Windows.Forms.Application]::EnableVisualStyles()
    Show-TrayIcon
}

# Loop principale
Write-Log "Avvio loop principale..."
$nextScanTime = Get-Date

while ($script:isRunning) {
    try {
        # Processa messaggi Windows (necessario per tray icon)
        if (-not $ServiceMode) {
            [System.Windows.Forms.Application]::DoEvents()
        }
        
        # Controlla se è il momento di eseguire una scansione
        $now = Get-Date
        if ($now -ge $nextScanTime) {
            Write-Log "Esecuzione scansione programmata..."
            Update-TrayIconStatus -Status "scanning"
            
            # Importa e chiama le funzioni da NetworkMonitor.ps1
            # Per semplicità, eseguiamo direttamente lo script
            $networkMonitorScript = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "NetworkMonitor.ps1"
            
            if (Test-Path $networkMonitorScript) {
                try {
                    # Esegui lo script originale
                    & powershell.exe -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File $networkMonitorScript -ConfigPath $ConfigPath 2>&1 | Out-Null
                    $script:lastScanTime = Get-Date
                    Update-TrayIconStatus -Status "running"
                    Update-StatusFile -Status "running" -Message "Scansione completata" -LastScan $script:lastScanTime
                    Write-Log "Scansione completata con successo"
                } catch {
                    Write-Log "Errore esecuzione scansione: $_" "ERROR"
                    Update-TrayIconStatus -Status "error"
                    Update-StatusFile -Status "error" -Message "Errore: $_"
                }
            } else {
                Write-Log "ERRORE: NetworkMonitor.ps1 non trovato!" "ERROR"
                Update-StatusFile -Status "error" -Message "NetworkMonitor.ps1 non trovato"
            }
            
            # Calcola prossima scansione
            $nextScanTime = $now.AddMinutes($scanIntervalMinutes)
            Write-Log "Prossima scansione: $($nextScanTime.ToString('HH:mm:ss'))"
        }
        
        # Dormi per 30 secondi prima di controllare di nuovo
        Start-Sleep -Seconds 30
        
    } catch {
        Write-Log "Errore nel loop principale: $_" "ERROR"
        Start-Sleep -Seconds 60
    }
}

Write-Log "=== Network Monitor Service Arrestato ==="
Update-StatusFile -Status "stopping" -Message "Servizio in arresto"

# Pulisci risorse
if ($script:trayIcon) {
    $script:trayIcon.Visible = $false
    $script:trayIcon.Dispose()
}
