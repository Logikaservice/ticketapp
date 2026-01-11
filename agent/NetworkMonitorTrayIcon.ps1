# NetworkMonitorTrayIcon.ps1
# Applicazione separata per mostrare l'icona nella system tray
# Si avvia automaticamente all'accesso utente (via registro di sistema)
# Comunica con il servizio tramite file di stato condivisi

param(
    [string]$ConfigPath = "$env:ProgramData\NetworkMonitorAgent\config.json",
    [string]$StatusFilePath = "$env:ProgramData\NetworkMonitorAgent\.agent_status.json",
    [string]$CurrentScanIPsPath = "$env:ProgramData\NetworkMonitorAgent\.current_scan_ips.json"
)

# Aggiungi Windows Forms
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Variabili globali
$script:trayIcon = $null
$script:isRunning = $true
$script:statusFile = $StatusFilePath
$script:configPath = $ConfigPath
$script:currentScanIPsPath = $CurrentScanIPsPath
$script:config = $null
$script:statusWindow = $null
$script:statusWindowListBox = $null
$script:countdownLabel = $null
$script:updateTimer = $null
$script:countdownTimer = $null

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

# Leggi IP trovati durante la scansione corrente
function Get-CurrentScanIPs {
    if (Test-Path $script:currentScanIPsPath) {
        try {
            $content = Get-Content $script:currentScanIPsPath -Raw
            if ([string]::IsNullOrWhiteSpace($content)) {
                return @()
            }
            
            $ips = $content | ConvertFrom-Json
            
            # ConvertFrom-Json può ritornare:
            # - Un array se il JSON è un array: ["ip1", "ip2"]
            # - Una stringa se il JSON è una stringa: "ip1ip2ip3" (caso errato da versioni precedenti)
            # - Un oggetto PSCustomObject
            if ($ips -is [System.Array]) {
                # È già un array, ritorna come array di stringhe
                return @($ips | ForEach-Object { $_.ToString().Trim() } | Where-Object { $_ })
            } elseif ($ips -is [System.String]) {
                # È una stringa concatenata (caso errato da versioni precedenti)
                # Prova a separare gli IP (ogni IP è 192.168.100.xxx)
                $ipPattern = '\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b'
                $matches = [regex]::Matches($ips, $ipPattern)
                if ($matches.Count -gt 0) {
                    $ipList = @()
                    foreach ($match in $matches) {
                        $ipList += $match.Groups[1].Value
                    }
                    return $ipList
                }
                return @()
            } else {
                # È un oggetto, convertilo in stringa
                return @($ips.ToString().Trim())
            }
        } catch {
            return @()
        }
    }
    return @()
}

# Funzione per aprire finestra stato (mostra IP configurati e trovati)
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
    
    # Se la finestra è già aperta, portala in primo piano
    if ($script:statusWindow -and $script:statusWindow.Visible) {
        $script:statusWindow.Activate()
        $script:statusWindow.BringToFront()
        return
    }
    
    # Crea nuova finestra
    $script:statusWindow = New-Object System.Windows.Forms.Form
    $script:statusWindow.Text = "Network Monitor Agent - Stato"
    $script:statusWindow.Size = New-Object System.Drawing.Size(500, 640)
    $script:statusWindow.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
    $script:statusWindow.MinimizeBox = $false
    $script:statusWindow.MaximizeBox = $false
    $script:statusWindow.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedSingle
    
    # Label titolo
    $titleLabel = New-Object System.Windows.Forms.Label
    $titleLabel.Text = "Monitoraggio Rete - $($script:config.network_ranges -join ', ')"
    $titleLabel.Location = New-Object System.Drawing.Point(10, 10)
    $titleLabel.Size = New-Object System.Drawing.Size(460, 25)
    $titleLabel.Font = New-Object System.Drawing.Font("Microsoft Sans Serif", 10, [System.Drawing.FontStyle]::Bold)
    $script:statusWindow.Controls.Add($titleLabel)
    
    # Label conto alla rovescia (grande, a sinistra)
    $script:countdownLabel = New-Object System.Windows.Forms.Label
    $script:countdownLabel.Text = "Prossima scansione: --:--"
    $script:countdownLabel.Location = New-Object System.Drawing.Point(10, 45)
    $script:countdownLabel.Size = New-Object System.Drawing.Size(280, 50)
    $script:countdownLabel.Font = New-Object System.Drawing.Font("Microsoft Sans Serif", 18, [System.Drawing.FontStyle]::Bold)
    $script:countdownLabel.ForeColor = [System.Drawing.Color]::FromArgb(0, 123, 255)
    $script:countdownLabel.TextAlign = [System.Drawing.ContentAlignment]::MiddleLeft
    $script:statusWindow.Controls.Add($script:countdownLabel)
    
    # Label per IP trovati
    $foundLabel = New-Object System.Windows.Forms.Label
    $foundLabel.Text = "IP trovati durante la scansione:"
    $foundLabel.Location = New-Object System.Drawing.Point(10, 100)
    $foundLabel.Size = New-Object System.Drawing.Size(300, 20)
    $foundLabel.Font = New-Object System.Drawing.Font("Microsoft Sans Serif", 9, [System.Drawing.FontStyle]::Bold)
    $script:statusWindow.Controls.Add($foundLabel)
    
    # ListBox per IP trovati (sinistra) - aggiornato in tempo reale
    $script:statusWindowListBox = New-Object System.Windows.Forms.ListBox
    $script:statusWindowListBox.Location = New-Object System.Drawing.Point(10, 125)
    $script:statusWindowListBox.Size = New-Object System.Drawing.Size(300, 405)
    $script:statusWindowListBox.Font = New-Object System.Drawing.Font("Consolas", 9)
    $script:statusWindowListBox.SelectionMode = [System.Windows.Forms.SelectionMode]::None
    $script:statusWindow.Controls.Add($script:statusWindowListBox)
    
    # Pulsante Forza Scansione (destra)
    $forceScanButton = New-Object System.Windows.Forms.Button
    $forceScanButton.Text = "Forza Scansione"
    $forceScanButton.Location = New-Object System.Drawing.Point(330, 70)
    $forceScanButton.Size = New-Object System.Drawing.Size(150, 80)
    $forceScanButton.Font = New-Object System.Drawing.Font("Microsoft Sans Serif", 10, [System.Drawing.FontStyle]::Bold)
    $forceScanButton.BackColor = [System.Drawing.Color]::FromArgb(0, 123, 255)
    $forceScanButton.ForeColor = [System.Drawing.Color]::White
    $forceScanButton.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
    $forceScanButton.Add_Click({
        $triggerFile = Join-Path (Split-Path -Parent $script:configPath) ".force_scan.trigger"
        try {
            # Crea file di segnale per forzare la scansione
            $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            $triggerFile | Out-File -FilePath $triggerFile -Encoding UTF8 -Force
            Write-Host "Scansione forzata richiesta" -ForegroundColor Green
            [System.Windows.Forms.MessageBox]::Show(
                "Scansione forzata richiesta al servizio.`n`nLa scansione inizierà entro pochi secondi.`nControlla la lista IP per vedere i risultati.",
                "Network Monitor Agent",
                [System.Windows.Forms.MessageBoxButtons]::OK,
                [System.Windows.Forms.MessageBoxIcon]::Information
            )
        } catch {
            [System.Windows.Forms.MessageBox]::Show(
                "Errore richiesta scansione: $_",
                "Network Monitor Agent - Errore",
                [System.Windows.Forms.MessageBoxButtons]::OK,
                [System.Windows.Forms.MessageBoxIcon]::Error
            )
        }
    })
    $script:statusWindow.Controls.Add($forceScanButton)
    
    # Pulsante Chiudi
    $closeButton = New-Object System.Windows.Forms.Button
    $closeButton.Text = "Chiudi"
    $closeButton.Location = New-Object System.Drawing.Point(330, 540)
    $closeButton.Size = New-Object System.Drawing.Size(150, 35)
    $closeButton.Add_Click({
        $script:statusWindow.Hide()
    })
    $script:statusWindow.Controls.Add($closeButton)
    
    # Handler chiusura finestra
    $script:statusWindow.Add_FormClosing({
        $_.Cancel = $true
        $script:statusWindow.Hide()
    })
    
    # Timer per aggiornare IP trovati e countdown ogni secondo
    $script:updateTimer = New-Object System.Windows.Forms.Timer
    $script:updateTimer.Interval = 1000  # 1 secondo
    $script:updateTimer.Add_Tick({
        Update-FoundIPsList
        Update-Countdown
    })
    $script:updateTimer.Start()
    
    # Aggiorna subito
    Update-FoundIPsList
    Update-Countdown
    
    # Mostra finestra
    $script:statusWindow.Show()
    $script:statusWindow.BringToFront()
}

# Aggiorna lista IP trovati nella finestra
function Update-FoundIPsList {
    if (-not $script:statusWindowListBox) { return }
    if (-not $script:statusWindow -or -not $script:statusWindow.Visible) { return }
    
    $currentIPs = Get-CurrentScanIPs
    
    # Aggiorna thread-safe
    if ($script:statusWindow.InvokeRequired) {
        $script:statusWindow.Invoke([System.Windows.Forms.MethodInvoker]{
            $script:statusWindowListBox.Items.Clear()
            foreach ($ip in $currentIPs) {
                $script:statusWindowListBox.Items.Add($ip)
            }
            if ($script:statusWindowListBox.Items.Count -gt 0) {
                $script:statusWindowListBox.TopIndex = $script:statusWindowListBox.Items.Count - 1
            }
        })
    } else {
        $script:statusWindowListBox.Items.Clear()
        foreach ($ip in $currentIPs) {
            $script:statusWindowListBox.Items.Add($ip)
        }
        if ($script:statusWindowListBox.Items.Count -gt 0) {
            $script:statusWindowListBox.TopIndex = $script:statusWindowListBox.Items.Count - 1
        }
    }
}

# Aggiorna conto alla rovescia prossima scansione
function Update-Countdown {
    if (-not $script:countdownLabel) { return }
    if (-not $script:statusWindow -or -not $script:statusWindow.Visible) { return }
    
    $status = Get-Status
    if ($status -and $status.last_scan -and $status.scan_interval_minutes) {
        try {
            $lastScanTime = [DateTime]::Parse($status.last_scan)
            $intervalMinutes = [int]$status.scan_interval_minutes
            $nextScanTime = $lastScanTime.AddMinutes($intervalMinutes)
            $now = Get-Date
            $timeRemaining = $nextScanTime - $now
            
            if ($timeRemaining.TotalSeconds -gt 0) {
                $minutes = [Math]::Floor($timeRemaining.TotalMinutes)
                $seconds = [Math]::Floor($timeRemaining.TotalSeconds % 60)
                $countdownText = "Prossima scansione: {0:D2}:{1:D2}" -f $minutes, $seconds
            } else {
                $countdownText = "Scansione in corso..."
            }
            
            # Aggiorna thread-safe
            if ($script:statusWindow.InvokeRequired) {
                $script:statusWindow.Invoke([System.Windows.Forms.MethodInvoker]{
                    $script:countdownLabel.Text = $countdownText
                })
            } else {
                $script:countdownLabel.Text = $countdownText
            }
        } catch {
            # Ignora errori parsing
        }
    } else {
        $countdownText = "Prossima scansione: --:--"
        if ($script:statusWindow.InvokeRequired) {
            $script:statusWindow.Invoke([System.Windows.Forms.MethodInvoker]{
                $script:countdownLabel.Text = $countdownText
            })
        } else {
            $script:countdownLabel.Text = $countdownText
        }
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
        Exit-Application
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

# Funzione per chiudere l'applicazione
function Exit-Application {
    if ($script:updateTimer) {
        $script:updateTimer.Stop()
        $script:updateTimer.Dispose()
    }
    if ($script:statusWindow) {
        $script:statusWindow.Close()
        $script:statusWindow.Dispose()
    }
    if ($script:trayIcon) {
        $script:trayIcon.Visible = $false
        $script:trayIcon.Dispose()
    }
    $script:isRunning = $false
    [System.Windows.Forms.Application]::ExitThread()
}

# Main
try {
    [System.Windows.Forms.Application]::EnableVisualStyles()
    
    # Carica configurazione
    if (-not (Load-Config)) {
        # Se config non trovato, prova a loggare l'errore
        $logPath = Join-Path (Split-Path -Parent $script:configPath) "NetworkMonitorTrayIcon.log"
        try {
            $errorMsg = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] ERRORE: config.json non trovato in: $script:configPath"
            $errorMsg | Out-File -FilePath $logPath -Append -Encoding UTF8
        } catch {
            # Ignora errori di log
        }
        
        # Mostra messaggio solo se non siamo in modalità nascosta
        # (se WindowStyle è Hidden, MessageBox non viene mostrato)
        try {
            [System.Windows.Forms.MessageBox]::Show(
                "File config.json non trovato: $script:configPath`n`nL'icona della system tray non può essere mostrata.`n`nControlla il log: $logPath",
                "Network Monitor Agent",
                [System.Windows.Forms.MessageBoxButtons]::OK,
                [System.Windows.Forms.MessageBoxIcon]::Warning
            )
        } catch {
            # Se MessageBox fallisce (modalità servizio), esci silenziosamente
        }
        exit 1
    }
    
    # Mostra tray icon
    Show-TrayIcon
    
    # Verifica che l'icona sia stata creata correttamente
    if (-not $script:trayIcon -or -not $script:trayIcon.Visible) {
        $logPath = Join-Path (Split-Path -Parent $script:configPath) "NetworkMonitorTrayIcon.log"
        try {
            $errorMsg = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] ERRORE: Impossibile creare tray icon"
            $errorMsg | Out-File -FilePath $logPath -Append -Encoding UTF8
        } catch {
            # Ignora errori di log
        }
        exit 1
    }
    
    # Usa Application.Run per gestire correttamente i messaggi Windows
    # Questo permette al menu contestuale e ai click di funzionare correttamente
    [System.Windows.Forms.Application]::Run()
    
} catch {
    # Log errore critico
    $logPath = Join-Path (Split-Path -Parent $script:configPath) "NetworkMonitorTrayIcon.log"
    try {
        $errorMsg = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] ERRORE CRITICO: $($_.Exception.Message)`nStack: $($_.Exception.StackTrace)"
        $errorMsg | Out-File -FilePath $logPath -Append -Encoding UTF8
    } catch {
        # Ignora errori di log
    }
    
    # Prova a mostrare errore (se possibile)
    try {
        [System.Windows.Forms.MessageBox]::Show(
            "Errore critico nell'avvio della tray icon:`n$($_.Exception.Message)`n`nControlla il log: $logPath",
            "Network Monitor Agent - Errore",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        )
    } catch {
        # Ignora se MessageBox non può essere mostrato
    }
} finally {
    # Cleanup sempre
    Exit-Application
}
