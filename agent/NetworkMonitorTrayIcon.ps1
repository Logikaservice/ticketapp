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

# Leggi IP trovati durante la scansione corrente (con MAC)
function Get-CurrentScanIPs {
    if (Test-Path $script:currentScanIPsPath) {
        try {
            $content = Get-Content $script:currentScanIPsPath -Raw
            if ([string]::IsNullOrWhiteSpace($content)) {
                return @()
            }
            
            $data = $content | ConvertFrom-Json
            
            # Nuovo formato: array di oggetti con ip e mac
            # Formato: [{"ip":"192.168.100.1","mac":"AA-BB-CC-DD-EE-FF"},...]
            if ($data -is [System.Array]) {
                $result = @()
                foreach ($item in $data) {
                    # Gestisci diversi tipi di oggetti
                    if ($item -is [PSCustomObject]) {
                        # Nuovo formato con oggetti PSCustomObject
                        if ($item.ip) {
                            $ipValue = if ($item.ip -is [System.Array]) { $item.ip[0] } else { $item.ip.ToString() }
                            $macValue = if ($item.mac) {
                                if ($item.mac -is [System.Array]) { $item.mac[0] } else { $item.mac.ToString() }
                            } else { $null }
                            $result += @{
                                ip = $ipValue
                                mac = $macValue
                            }
                        }
                    } elseif ($item -is [System.String]) {
                        # Vecchio formato: array di stringhe IP (compatibilità)
                        $result += @{
                            ip = $item.ToString().Trim()
                            mac = $null
                        }
                    } elseif ($item -is [Hashtable]) {
                        # Formato hashtable (compatibilità)
                        if ($item.ContainsKey('ip')) {
                            $result += @{
                                ip = $item.ip.ToString()
                                mac = if ($item.ContainsKey('mac') -and $item.mac) { $item.mac.ToString() } else { $null }
                            }
                        }
                    }
                }
                return $result
            } elseif ($data -is [System.String]) {
                # Vecchio formato: stringa concatenata (compatibilità)
                $ipPattern = '\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b'
                $matches = [regex]::Matches($data, $ipPattern)
                if ($matches.Count -gt 0) {
                    $result = @()
                    foreach ($match in $matches) {
                        $result += @{
                            ip = $match.Groups[1].Value
                            mac = $null
                        }
                    }
                    return $result
                }
                return @()
            } else {
                # Caso fallback
                return @()
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
    
    # Crea nuova finestra con design moderno
    $script:statusWindow = New-Object System.Windows.Forms.Form
    $script:statusWindow.Text = "Network Monitor Agent - Stato"
    $script:statusWindow.Size = New-Object System.Drawing.Size(580, 680)
    $script:statusWindow.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
    $script:statusWindow.MinimizeBox = $false
    $script:statusWindow.MaximizeBox = $false
    $script:statusWindow.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedSingle
    $script:statusWindow.BackColor = [System.Drawing.Color]::FromArgb(245, 247, 250)
    
    # Header con sfondo colorato
    $headerPanel = New-Object System.Windows.Forms.Panel
    $headerPanel.Location = New-Object System.Drawing.Point(0, 0)
    $headerPanel.Size = New-Object System.Drawing.Size(580, 80)
    $headerPanel.BackColor = [System.Drawing.Color]::FromArgb(30, 58, 138)
    $script:statusWindow.Controls.Add($headerPanel)
    
    # Label titolo nel header (bianco, grande)
    $titleLabel = New-Object System.Windows.Forms.Label
    $titleLabel.Text = "Network Monitor Agent"
    $titleLabel.Location = New-Object System.Drawing.Point(20, 15)
    $titleLabel.Size = New-Object System.Drawing.Size(540, 30)
    $titleLabel.Font = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Bold)
    $titleLabel.ForeColor = [System.Drawing.Color]::White
    $titleLabel.BackColor = [System.Drawing.Color]::Transparent
    $headerPanel.Controls.Add($titleLabel)
    
    # Sottotitolo nel header
    $subtitleLabel = New-Object System.Windows.Forms.Label
    $subtitleLabel.Text = "Monitoraggio Rete in Tempo Reale"
    $subtitleLabel.Location = New-Object System.Drawing.Point(20, 45)
    $subtitleLabel.Size = New-Object System.Drawing.Size(540, 20)
    $subtitleLabel.Font = New-Object System.Drawing.Font("Segoe UI", 9)
    $subtitleLabel.ForeColor = [System.Drawing.Color]::FromArgb(200, 200, 220)
    $subtitleLabel.BackColor = [System.Drawing.Color]::Transparent
    $headerPanel.Controls.Add($subtitleLabel)
    
    # Panel per conto alla rovescia (card style)
    $countdownPanel = New-Object System.Windows.Forms.Panel
    $countdownPanel.Location = New-Object System.Drawing.Point(20, 100)
    $countdownPanel.Size = New-Object System.Drawing.Size(320, 70)
    $countdownPanel.BackColor = [System.Drawing.Color]::White
    $countdownPanel.BorderStyle = [System.Windows.Forms.BorderStyle]::FixedSingle
    $script:statusWindow.Controls.Add($countdownPanel)
    
    # Label "Prossima scansione" (piccola, sopra)
    $countdownTitleLabel = New-Object System.Windows.Forms.Label
    $countdownTitleLabel.Text = "Prossima scansione"
    $countdownTitleLabel.Location = New-Object System.Drawing.Point(15, 8)
    $countdownTitleLabel.Size = New-Object System.Drawing.Size(290, 18)
    $countdownTitleLabel.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Regular)
    $countdownTitleLabel.ForeColor = [System.Drawing.Color]::FromArgb(100, 100, 120)
    $countdownPanel.Controls.Add($countdownTitleLabel)
    
    # Label conto alla rovescia (grande, centrale)
    $script:countdownLabel = New-Object System.Windows.Forms.Label
    $script:countdownLabel.Text = "--:--"
    $script:countdownLabel.Location = New-Object System.Drawing.Point(15, 28)
    $script:countdownLabel.Size = New-Object System.Drawing.Size(290, 35)
    $script:countdownLabel.Font = New-Object System.Drawing.Font("Segoe UI", 24, [System.Drawing.FontStyle]::Bold)
    $script:countdownLabel.ForeColor = [System.Drawing.Color]::FromArgb(30, 58, 138)
    $script:countdownLabel.TextAlign = [System.Drawing.ContentAlignment]::MiddleLeft
    $countdownPanel.Controls.Add($script:countdownLabel)
    
    # Panel per lista IP (card style)
    $ipListPanel = New-Object System.Windows.Forms.Panel
    $ipListPanel.Location = New-Object System.Drawing.Point(20, 185)
    $ipListPanel.Size = New-Object System.Drawing.Size(320, 420)
    $ipListPanel.BackColor = [System.Drawing.Color]::White
    $ipListPanel.BorderStyle = [System.Windows.Forms.BorderStyle]::FixedSingle
    $script:statusWindow.Controls.Add($ipListPanel)
    
    # Label per IP trovati (dentro il panel)
    $foundLabel = New-Object System.Windows.Forms.Label
    $foundLabel.Text = "IP trovati durante la scansione"
    $foundLabel.Location = New-Object System.Drawing.Point(12, 12)
    $foundLabel.Size = New-Object System.Drawing.Size(296, 20)
    $foundLabel.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
    $foundLabel.ForeColor = [System.Drawing.Color]::FromArgb(50, 50, 70)
    $ipListPanel.Controls.Add($foundLabel)
    
    # ListBox per IP trovati (dentro il panel) - aggiornato in tempo reale
    $script:statusWindowListBox = New-Object System.Windows.Forms.ListBox
    $script:statusWindowListBox.Location = New-Object System.Drawing.Point(12, 35)
    $script:statusWindowListBox.Size = New-Object System.Drawing.Size(296, 375)
    $script:statusWindowListBox.Font = New-Object System.Drawing.Font("Consolas", 9.5)
    $script:statusWindowListBox.SelectionMode = [System.Windows.Forms.SelectionMode]::None
    $script:statusWindowListBox.BackColor = [System.Drawing.Color]::FromArgb(250, 250, 252)
    $script:statusWindowListBox.BorderStyle = [System.Windows.Forms.BorderStyle]::None
    $ipListPanel.Controls.Add($script:statusWindowListBox)
    
    # Panel per pulsanti (card style)
    $buttonPanel = New-Object System.Windows.Forms.Panel
    $buttonPanel.Location = New-Object System.Drawing.Point(360, 100)
    $buttonPanel.Size = New-Object System.Drawing.Size(200, 505)
    $buttonPanel.BackColor = [System.Drawing.Color]::White
    $buttonPanel.BorderStyle = [System.Windows.Forms.BorderStyle]::FixedSingle
    $script:statusWindow.Controls.Add($buttonPanel)
    
    # Pulsante Forza Scansione (moderno, con gradiente simulato)
    $forceScanButton = New-Object System.Windows.Forms.Button
    $forceScanButton.Text = "Forza Scansione"
    $forceScanButton.Location = New-Object System.Drawing.Point(15, 20)
    $forceScanButton.Size = New-Object System.Drawing.Size(170, 65)
    $forceScanButton.Font = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
    $forceScanButton.BackColor = [System.Drawing.Color]::FromArgb(30, 58, 138)
    $forceScanButton.ForeColor = [System.Drawing.Color]::White
    $forceScanButton.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
    $forceScanButton.FlatAppearance.BorderSize = 0
    $forceScanButton.Cursor = [System.Windows.Forms.Cursors]::Hand
    $forceScanButton.Add_Click({
        $triggerFile = Join-Path (Split-Path -Parent $script:configPath) ".force_scan.trigger"
        try {
            # Pulisci lista IP per vedere la scansione in tempo reale
            if ($script:statusWindowListBox) {
                if ($script:statusWindow.InvokeRequired) {
                    $script:statusWindow.Invoke([System.Windows.Forms.MethodInvoker]{
                        $script:statusWindowListBox.Items.Clear()
                    })
                } else {
                    $script:statusWindowListBox.Items.Clear()
                }
            }
            
            # Pulisci file IP corrente
            $currentScanIPsFile = Join-Path (Split-Path -Parent $script:configPath) ".current_scan_ips.json"
            try {
                @() | ConvertTo-Json -Compress | Out-File -FilePath $currentScanIPsFile -Encoding UTF8 -Force
            } catch { }
            
            # Crea file di segnale per forzare la scansione
            $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            $triggerFile | Out-File -FilePath $triggerFile -Encoding UTF8 -Force
            
            # Riazzera conto alla rovescia (aggiorna subito)
            Update-Countdown
            
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
    # Effetto hover per il pulsante (cattura la variabile in una closure)
    $hoverColorEnter = [System.Drawing.Color]::FromArgb(37, 99, 235)
    $hoverColorLeave = [System.Drawing.Color]::FromArgb(30, 58, 138)
    $forceScanButton.Add_MouseEnter({
        $this.BackColor = $hoverColorEnter
    })
    $forceScanButton.Add_MouseLeave({
        $this.BackColor = $hoverColorLeave
    })
    $buttonPanel.Controls.Add($forceScanButton)
    
    # Label statistiche (opzionale, sotto il pulsante)
    $statsLabel = New-Object System.Windows.Forms.Label
    $statsLabel.Text = "Statistiche"
    $statsLabel.Location = New-Object System.Drawing.Point(15, 100)
    $statsLabel.Size = New-Object System.Drawing.Size(170, 20)
    $statsLabel.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
    $statsLabel.ForeColor = [System.Drawing.Color]::FromArgb(50, 50, 70)
    $buttonPanel.Controls.Add($statsLabel)
    
    # Label per statistiche (da aggiornare)
    $script:statsInfoLabel = New-Object System.Windows.Forms.Label
    $script:statsInfoLabel.Text = "Caricamento..."
    $script:statsInfoLabel.Location = New-Object System.Drawing.Point(15, 125)
    $script:statsInfoLabel.Size = New-Object System.Drawing.Size(170, 80)
    $script:statsInfoLabel.Font = New-Object System.Drawing.Font("Segoe UI", 8.5)
    $script:statsInfoLabel.ForeColor = [System.Drawing.Color]::FromArgb(100, 100, 120)
    $script:statsInfoLabel.TextAlign = [System.Drawing.ContentAlignment]::TopLeft
    $buttonPanel.Controls.Add($script:statsInfoLabel)
    
    # Pulsante Chiudi (stile moderno)
    $closeButton = New-Object System.Windows.Forms.Button
    $closeButton.Text = "Chiudi"
    $closeButton.Location = New-Object System.Drawing.Point(15, 450)
    $closeButton.Size = New-Object System.Drawing.Size(170, 40)
    $closeButton.Font = New-Object System.Drawing.Font("Segoe UI", 9.5, [System.Drawing.FontStyle]::Regular)
    $closeButton.BackColor = [System.Drawing.Color]::FromArgb(239, 246, 255)
    $closeButton.ForeColor = [System.Drawing.Color]::FromArgb(30, 58, 138)
    $closeButton.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
    $closeButton.FlatAppearance.BorderSize = 1
    $closeButton.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(200, 200, 220)
    $closeButton.Cursor = [System.Windows.Forms.Cursors]::Hand
    $closeButton.Add_Click({
        $script:statusWindow.Hide()
    })
    # Effetto hover per il pulsante chiudi (cattura la variabile in una closure)
    $closeHoverColorEnter = [System.Drawing.Color]::FromArgb(219, 234, 254)
    $closeHoverColorLeave = [System.Drawing.Color]::FromArgb(239, 246, 255)
    $closeButton.Add_MouseEnter({
        $this.BackColor = $closeHoverColorEnter
    })
    $closeButton.Add_MouseLeave({
        $this.BackColor = $closeHoverColorLeave
    })
    $buttonPanel.Controls.Add($closeButton)
    
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
        Update-Stats
    })
    $script:updateTimer.Start()
    
    # Aggiorna subito
    Update-FoundIPsList
    Update-Countdown
    Update-Stats
    
    # Mostra finestra
    $script:statusWindow.Show()
    $script:statusWindow.BringToFront()
}

# Funzione helper per ordinare IP numericamente
function Sort-IPAddresses {
    param([array]$IPs)
    
    # Converte ogni IP in un array di numeri per ordinamento numerico
    $sorted = $IPs | Sort-Object {
        if ($_.ip) {
            $ip = $_.ip
        } else {
            $ip = $_.ToString()
        }
        $parts = $ip -split '\.'
        [int]$parts[0] * 16777216 + [int]$parts[1] * 65536 + [int]$parts[2] * 256 + [int]$parts[3]
    }
    return $sorted
}

# Aggiorna lista IP trovati nella finestra (con MAC, ordinati numericamente)
function Update-FoundIPsList {
    if (-not $script:statusWindowListBox) { return }
    if (-not $script:statusWindow -or -not $script:statusWindow.Visible) { return }
    
    $currentIPs = Get-CurrentScanIPs
    
    # Ordina IP numericamente
    $sortedIPs = Sort-IPAddresses -IPs $currentIPs
    
    # Aggiorna thread-safe
    if ($script:statusWindow.InvokeRequired) {
        $script:statusWindow.Invoke([System.Windows.Forms.MethodInvoker]{
            $script:statusWindowListBox.Items.Clear()
            $index = 0
            foreach ($item in $sortedIPs) {
                $displayText = if ($item.mac) { "$($item.ip) - $($item.mac)" } else { $item.ip }
                $script:statusWindowListBox.Items.Add($displayText)
                # Colore alternato per le righe (solo se supportato)
                if ($index % 2 -eq 0) {
                    # Riga pari: colore leggermente diverso (se possibile)
                    # Nota: ListBox standard non supporta colori per riga, ma miglioriamo il font
                }
                $index++
            }
            if ($script:statusWindowListBox.Items.Count -gt 0) {
                $script:statusWindowListBox.TopIndex = $script:statusWindowListBox.Items.Count - 1
            }
        })
    } else {
        $script:statusWindowListBox.Items.Clear()
        $index = 0
        foreach ($item in $sortedIPs) {
            $displayText = if ($item.mac) { "$($item.ip) - $($item.mac)" } else { $item.ip }
            $script:statusWindowListBox.Items.Add($displayText)
            $index++
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
    $countdownText = "--:--"
    
    # Se lo status è "scanning", mostra "Scansione in corso..."
    if ($status -and $status.status -eq "scanning") {
        $countdownText = "In corso..."
        if ($script:statusWindow.InvokeRequired) {
            $script:statusWindow.Invoke([System.Windows.Forms.MethodInvoker]{
                $script:countdownLabel.Text = $countdownText
                $script:countdownLabel.ForeColor = [System.Drawing.Color]::FromArgb(34, 197, 94)
            })
        } else {
            $script:countdownLabel.Text = $countdownText
            $script:countdownLabel.ForeColor = [System.Drawing.Color]::FromArgb(34, 197, 94)
        }
        return
    }
    
    # Reset colore normale
    if ($script:statusWindow.InvokeRequired) {
        $script:statusWindow.Invoke([System.Windows.Forms.MethodInvoker]{
            $script:countdownLabel.ForeColor = [System.Drawing.Color]::FromArgb(30, 58, 138)
        })
    } else {
        $script:countdownLabel.ForeColor = [System.Drawing.Color]::FromArgb(30, 58, 138)
    }
    
    # Prova a calcolare countdown da last_scan
    if ($status -and $status.last_scan -and $status.last_scan -ne $null) {
        try {
            $dateStr = $status.last_scan.ToString().Trim()
            if ([string]::IsNullOrWhiteSpace($dateStr) -or $dateStr -eq "null") {
                throw "last_scan è vuoto o null"
            }
            
            # Prova diversi formati di data
            $lastScanTime = $null
            
            # Prova formato "yyyy-MM-dd HH:mm:ss"
            try {
                $lastScanTime = [DateTime]::ParseExact($dateStr, "yyyy-MM-dd HH:mm:ss", $null)
            } catch {
                # Prova parsing automatico
                try {
                    $lastScanTime = [DateTime]::Parse($dateStr)
                } catch {
                    # Fallback: usa Get-Date corrente meno intervallo (per countdown provvisorio)
                    $intervalMinutes = if ($status.scan_interval_minutes) { [int]$status.scan_interval_minutes } else { 15 }
                    $lastScanTime = (Get-Date).AddMinutes(-$intervalMinutes)
                }
            }
            
            $intervalMinutes = if ($status.scan_interval_minutes) { [int]$status.scan_interval_minutes } else { 15 }
            $nextScanTime = $lastScanTime.AddMinutes($intervalMinutes)
            $now = Get-Date
            $timeRemaining = $nextScanTime - $now
            
            if ($timeRemaining.TotalSeconds -gt 0) {
                $minutes = [Math]::Floor($timeRemaining.TotalMinutes)
                $seconds = [Math]::Floor($timeRemaining.TotalSeconds % 60)
                $countdownText = "$($minutes.ToString('00')):$($seconds.ToString('00'))"
            } else {
                # Se il tempo è scaduto, mostra "Scansione in corso..." o "In attesa..."
                $countdownText = "In attesa..."
            }
        } catch {
            # In caso di errore, mostra messaggio generico
            $countdownText = "--:--"
        }
    } else {
        # Se non c'è last_scan, mostra messaggio informativo
        $countdownText = "In attesa..."
    }
    
    # Aggiorna thread-safe
    if ($script:statusWindow.InvokeRequired) {
        $script:statusWindow.Invoke([System.Windows.Forms.MethodInvoker]{
            $script:countdownLabel.Text = $countdownText
        })
    } else {
        $script:countdownLabel.Text = $countdownText
    }
}

# Aggiorna statistiche
function Update-Stats {
    if (-not $script:statsInfoLabel) { return }
    if (-not $script:statusWindow -or -not $script:statusWindow.Visible) { return }
    
    $status = Get-Status
    $currentIPs = Get-CurrentScanIPs
    
    $statsText = ""
    if ($status) {
        if ($status.devices_found -ne $null) {
            $statsText += "Dispositivi trovati: $($status.devices_found)`r`n"
        }
        if ($status.status) {
            $statusText = switch ($status.status) {
                "running" { "In esecuzione" }
                "scanning" { "Scansione in corso" }
                "error" { "Errore" }
                default { $status.status }
            }
            $statsText += "Stato: $statusText`r`n"
        }
    }
    if ($currentIPs) {
        $statsText += "IP attuali: $($currentIPs.Count)"
    }
    
    if ([string]::IsNullOrWhiteSpace($statsText)) {
        $statsText = "Nessuna informazione disponibile"
    }
    
    # Aggiorna thread-safe
    if ($script:statusWindow.InvokeRequired) {
        $script:statusWindow.Invoke([System.Windows.Forms.MethodInvoker]{
            $script:statsInfoLabel.Text = $statsText
        })
    } else {
        $script:statsInfoLabel.Text = $statsText
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
