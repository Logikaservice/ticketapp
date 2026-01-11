# NetworkMonitorService.ps1
# Servizio Windows permanente per Network Monitor Agent
# Rimane sempre attivo e esegue scansioni periodicamente
# Gestisce tutto internamente senza dipendere da Scheduled Task

param(
    [string]$ConfigPath = "config.json",
    [switch]$ServiceMode = $false  # ModalitÃ  servizio (senza GUI)
)

# Aggiungi Windows Forms per la tray icon (solo se non in modalitÃ  servizio)
if (-not $ServiceMode) {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
}

# Variabili globali
# Determina directory script (funziona anche come servizio)
$script:scriptDir = $null
if ($MyInvocation.MyCommand.Path) {
    $script:scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
} elseif ($PSScriptRoot) {
    $script:scriptDir = $PSScriptRoot
} else {
    # Fallback: usa directory di lavoro corrente (NSSM configura AppDirectory)
    $script:scriptDir = Get-Location | Select-Object -ExpandProperty Path
}

$script:isRunning = $true
$script:trayIcon = $null
$script:lastScanTime = $null
$script:lastScanDevices = 0
$script:scanIntervalMinutes = 15
$script:statusFile = Join-Path $script:scriptDir ".agent_status.json"
$script:lastScanPath = Join-Path $script:scriptDir "last_scan.json"
$script:statusWindow = $null
$script:statusWindowListBox = $null
$script:currentScanIPs = @()
$script:configIPs = @()

# ============================================
# FUNZIONI HELPER
# ============================================

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    
    $logPath = Join-Path $script:scriptDir "NetworkMonitorService.log"
    
    if ($ServiceMode) {
        # In modalitÃ  servizio, salva solo su file
        $logMessage | Out-File -FilePath $logPath -Append -Encoding UTF8
    } else {
        # In modalitÃ  app, mostra anche a console
        Write-Host $logMessage
        $logMessage | Out-File -FilePath $logPath -Append -Encoding UTF8
    }
}

function Update-StatusFile {
    param(
        [string]$Status,  # "running", "stopping", "error", "scanning"
        [int]$DevicesFound = 0,
        [object]$LastScan = $null,
        [string]$Message = ""
    )
    
    $statusData = @{
        status = $Status
        devices_found = $DevicesFound
        last_scan = if ($LastScan) { $LastScan.ToString("yyyy-MM-dd HH:mm:ss") } else { $null }
        message = $Message
        updated_at = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        scan_interval_minutes = $script:scanIntervalMinutes
    } | ConvertTo-Json
    
    try {
        $statusData | Out-File -FilePath $script:statusFile -Encoding UTF8 -Force
    } catch {
        # Ignora errori scrittura status
    }
}

# ============================================
# FUNZIONI NETWORK SCAN (da NetworkMonitor.ps1)
# ============================================

function Get-NetworkDevices {
    param([string[]]$NetworkRanges)
    
    $devices = @()
    
    # Ottieni IP locale del PC dove gira l'agent
    $localIP = $null
    try {
        $networkAdapters = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { 
            $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" 
        }
        if ($networkAdapters) {
            $localIP = $networkAdapters[0].IPAddress
            Write-Log "IP locale rilevato: $localIP" "DEBUG"
        }
    } catch {
        Write-Log "Impossibile ottenere IP locale: $_" "WARN"
    }
    
    foreach ($range in $NetworkRanges) {
        Write-Log "Scansione range: $range"
        
        # Estrai subnet e calcola range IP
        if ($range -match '^(\d+\.\d+\.\d+)\.(\d+)/(\d+)$') {
            $baseIP = $matches[1]
            $subnetMask = [int]$matches[3]
            
            # Calcola numero di host nella subnet
            $hostBits = 32 - $subnetMask
            $numHosts = [Math]::Pow(2, $hostBits) - 2  # -2 per network e broadcast
            
            # Per ora limitiamo a /24 (max 254 host) per performance
            if ($subnetMask -ge 24) {
                $startIP = if ($range -match '\.(\d+)/') { [int]$matches[1] } else { 1 }
                $endIP = if ($subnetMask -eq 24) { 254 } else { $numHosts }
                
                # Aggiungi sempre l'IP locale se Ã¨ nel range configurato
                $localIPInRange = $false
                if ($localIP -and $localIP -like "$baseIP.*") {
                    $localIPInRange = $true
                    $localIPOctet = [int]($localIP -split '\.')[3]
                    Write-Log "IP locale ($localIP) Ã¨ nel range configurato" "DEBUG"
                }
                
                # Scansiona IP range (aumentato a 254 per includere tutti gli IP in una /24)
                $maxIP = [Math]::Min(254, $endIP)
                for ($i = 1; $i -le $maxIP; $i++) {
                    $ip = "$baseIP.$i"
                    
                    # Se Ã¨ l'IP locale, aggiungilo sempre (anche se il ping fallisce)
                    if ($localIPInRange -and $i -eq $localIPOctet) {
                        Write-Log "Aggiungendo IP locale: $ip" "DEBUG"
                        
                        # Aggiungi IP locale alla lista scan corrente
                        if (-not ($script:currentScanIPs -contains $ip)) {
                            $script:currentScanIPs += $ip
                            Update-StatusWindowIPs -IPs $script:currentScanIPs
                        }
                        
                        # Ottieni MAC address locale
                        $macAddress = $null
                        try {
                            $adapter = Get-NetAdapter | Where-Object { $_.Status -eq "Up" } | Select-Object -First 1
                            if ($adapter) {
                                $macAddress = ($adapter.MacAddress -replace '-', '-')  # Mantieni formato originale
                            }
                        } catch {
                            # Ignora errori
                        }
                        
                        # Ottieni hostname locale
                        $hostname = $env:COMPUTERNAME
                        
                        $device = @{
                            ip_address = $ip
                            mac_address = $macAddress
                            hostname = $hostname
                            vendor = $null
                            status = "online"
                        }
                        
                        $devices += $device
                        continue  # Skip ping per IP locale
                    }
                    
                    # Ping test
                    $pingResult = Test-Connection -ComputerName $ip -Count 1 -Quiet -ErrorAction SilentlyContinue
                    
                    if ($pingResult) {
                        Write-Log "Dispositivo rilevato: $ip" "DEBUG"
                        
                        # Aggiungi IP alla lista scan corrente
                        if (-not ($script:currentScanIPs -contains $ip)) {
                            $script:currentScanIPs += $ip
                            Update-StatusWindowIPs -IPs $script:currentScanIPs
                        }
                        
                        # Ottieni MAC address dalla tabella ARP
                        $macAddress = $null
                        try {
                            # Metodo 1: Get-NetNeighbor (Windows 8+)
                            $arpEntry = Get-NetNeighbor -IPAddress $ip -ErrorAction SilentlyContinue
                            if ($arpEntry) {
                                $macAddress = $arpEntry.LinkLayerAddress
                            }
                        } catch {
                            # Metodo 2: arp.exe (compatibilitÃ )
                            try {
                                $arpOutput = arp -a $ip 2>$null
                                if ($arpOutput -match '([0-9A-F]{2}[:-]){5}([0-9A-F]{2})') {
                                    $macAddress = $matches[0]
                                }
                            } catch {
                                # Ignora se anche questo fallisce
                            }
                        }
                        
                        # Prova risoluzione hostname
                        $hostname = $null
                        try {
                            $dnsResult = Resolve-DnsName -Name $ip -ErrorAction SilentlyContinue
                            if ($dnsResult) {
                                $hostname = $dnsResult.NameHost
                            }
                        } catch {
                            # Se DNS fallisce, prova WMI (solo per Windows devices)
                            try {
                                $wmiResult = Get-WmiObject -Class Win32_ComputerSystem -ComputerName $ip -ErrorAction SilentlyContinue
                                if ($wmiResult) {
                                    $hostname = $wmiResult.Name
                                }
                            } catch {
                                # Ignora errori
                            }
                        }
                        
                        # Vendor lookup da MAC (se disponibile)
                        $vendor = $null
                        if ($macAddress -and $macAddress -match '^([0-9A-F]{2}[:-][0-9A-F]{2}[:-][0-9A-F]{2})') {
                            $oui = $matches[1] -replace '[:-]', ''
                            # TODO: Implementa lookup vendor (API o database locale)
                            # Per ora lasciamo null
                        }
                        
                        $device = @{
                            ip_address = $ip
                            mac_address = $macAddress
                            hostname = $hostname
                            vendor = $vendor
                            status = "online"
                        }
                        
                        $devices += $device
                    }
                    
                    # Piccola pausa per non sovraccaricare la rete
                    Start-Sleep -Milliseconds 50
                }
            } else {
                Write-Log "Subnet mask troppo grande per scansione completa: $range" "WARN"
            }
        } else {
            Write-Log "Formato range IP non supportato: $range (atteso: x.x.x.x/24)" "WARN"
        }
    }
    
    return $devices
}

function Send-ScanResults {
    param(
        [array]$Devices,
        [string]$ServerUrl,
        [string]$ApiKey
    )
    
    try {
        # Carica ultimo scan per confronto (se esiste)
        $lastScan = $null
        if (Test-Path $script:lastScanPath) {
            try {
                $lastScanJson = Get-Content $script:lastScanPath -Raw | ConvertFrom-Json
                $lastScan = $lastScanJson.devices
            } catch {
                Write-Log "Errore lettura last_scan.json: $_" "WARN"
            }
        }
        
        # Rileva cambiamenti
        $changes = @()
        if ($lastScan) {
            # Nuovi dispositivi
            foreach ($device in $Devices) {
                $exists = $lastScan | Where-Object { $_.ip_address -eq $device.ip_address }
                if (-not $exists) {
                    $changes += @{
                        device_ip = $device.ip_address
                        change_type = "new_device"
                        old_value = $null
                        new_value = $device.ip_address
                    }
                }
            }
            
            # Dispositivi offline (non piÃ¹ nella scansione)
            foreach ($oldDevice in $lastScan) {
                $exists = $Devices | Where-Object { $_.ip_address -eq $oldDevice.ip_address }
                if (-not $exists) {
                    $changes += @{
                        device_ip = $oldDevice.ip_address
                        change_type = "device_offline"
                        old_value = $oldDevice.ip_address
                        new_value = $null
                    }
                }
            }
        } else {
            # Primo scan: tutti i dispositivi sono nuovi
            foreach ($device in $Devices) {
                $changes += @{
                    device_ip = $device.ip_address
                    change_type = "new_device"
                    old_value = $null
                    new_value = $device.ip_address
                }
            }
        }
        
        # Prepara payload
        $payload = @{
            devices = $Devices
            changes = $changes
        } | ConvertTo-Json -Depth 10
        
        # Invio dati al server
        $headers = @{
            "Content-Type" = "application/json"
            "X-API-Key" = $ApiKey
        }
        
        $url = "$ServerUrl/api/network-monitoring/agent/scan-results"
        Write-Log "Invio dati a: $url"
        
        $response = Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body $payload -ErrorAction Stop
        
        Write-Log "Dati inviati con successo: $($response.devices_processed) dispositivi, $($response.changes_processed) cambiamenti"
        
        # Salva scan corrente come last_scan.json
        $scanData = @{
            timestamp = (Get-Date -Format "o")
            devices = $Devices
        } | ConvertTo-Json -Depth 10
        
        $scanData | Out-File -FilePath $script:lastScanPath -Encoding UTF8
        
        return $response
    } catch {
        Write-Log "Errore invio dati: $_" "ERROR"
        Write-Log "Stack trace: $($_.Exception.StackTrace)" "ERROR"
        throw
    }
}

function Get-ServerConfig {
    param(
        [string]$ServerUrl,
        [string]$ApiKey
    )
    
    try {
        $headers = @{
            "X-API-Key" = $ApiKey
        }
        
        $url = "$ServerUrl/api/network-monitoring/agent/config?api_key=$ApiKey"
        $response = Invoke-RestMethod -Uri $url -Method GET -Headers $headers -ErrorAction Stop
        
        return @{
            success = $true
            config = $response
        }
    } catch {
        Write-Log "Errore recupero configurazione server: $_" "WARN"
        return @{ success = $false; error = $_.Exception.Message }
    }
}

function Send-Heartbeat {
    param(
        [string]$ServerUrl,
        [string]$ApiKey,
        [string]$Version = "1.0.0"
    )
    
    try {
        $headers = @{
            "Content-Type" = "application/json"
            "X-API-Key" = $ApiKey
        }
        
        $payload = @{
            version = $Version
        } | ConvertTo-Json
        
        $url = "$ServerUrl/api/network-monitoring/agent/heartbeat"
        $response = Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body $payload -ErrorAction Stop
        
        # Verifica se il server ha richiesto la disinstallazione
        if ($response.uninstall -eq $true) {
            Write-Log "Server ha richiesto disinstallazione: $($response.message)" "WARN"
            return @{ success = $false; uninstall = $true; message = $response.message }
        }
        
        Write-Log "Heartbeat inviato con successo" "DEBUG"
        
        # Recupera configurazione dal server per verificare se scan_interval_minutes Ã¨ cambiato
        try {
            $serverConfigResult = Get-ServerConfig -ServerUrl $ServerUrl -ApiKey $ApiKey
            if ($serverConfigResult.success -and $serverConfigResult.config.scan_interval_minutes) {
                $serverInterval = $serverConfigResult.config.scan_interval_minutes
                
                # Se l'intervallo Ã¨ diverso, aggiornalo solo in memoria (il servizio lo usa direttamente)
                if ($serverInterval -ne $script:scanIntervalMinutes) {
                    Write-Log "Rilevato cambio intervallo scansione: $($script:scanIntervalMinutes) -> $serverInterval minuti" "INFO"
                    $script:scanIntervalMinutes = $serverInterval
                    
                    # Aggiorna config.json locale per persistenza
                    $configPath = Join-Path $script:scriptDir "config.json"
                    if (Test-Path $configPath) {
                        $localConfig = Get-Content $configPath -Raw | ConvertFrom-Json
                        $localConfig.scan_interval_minutes = $serverInterval
                        $localConfig | ConvertTo-Json -Depth 10 | Out-File -FilePath $configPath -Encoding UTF8 -Force
                        Write-Log "Config.json locale aggiornato con nuovo intervallo ($serverInterval minuti)" "INFO"
                        Write-Log "Il nuovo intervallo sarÃ  applicato dalla prossima scansione" "INFO"
                    }
                }
            }
        } catch {
            Write-Log "Errore verifica configurazione server: $_" "DEBUG"
            # Non bloccare l'esecuzione se il controllo configurazione fallisce
        }
        
        return @{ success = $true; uninstall = $false; config = $serverConfigResult.config }
    } catch {
        Write-Log "Errore heartbeat: $_" "WARN"
        return @{ success = $false; uninstall = $false; error = $_.Exception.Message }
    }
}

# ============================================
# FUNZIONI TRAY ICON (solo se non in modalitÃ  servizio)
# ============================================
# FUNZIONI FINESTRA STATO (solo se non in modalitÃ  servizio)
# ============================================

function Show-StatusWindow {
    param([object]$ConfigData)
    
    # Se la finestra Ã¨ giÃ  aperta, portala in primo piano
    if ($script:statusWindow -and $script:statusWindow.Visible) {
        $script:statusWindow.Activate()
        $script:statusWindow.BringToFront()
        return
    }
    
    # Usa config passato o quello globale
    if (-not $ConfigData) {
        if ($script:config) {
            $ConfigData = $script:config
        } else {
            Write-Log "Errore: Config non disponibile per finestra stato" "WARN"
            return
        }
    }
    
    # Crea nuova finestra
    $script:statusWindow = New-Object System.Windows.Forms.Form
    $script:statusWindow.Text = "Network Monitor Agent"
    $script:statusWindow.Size = New-Object System.Drawing.Size(800, 600)
    $script:statusWindow.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
    $script:statusWindow.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedSingle
    $script:statusWindow.MaximizeBox = $false
    $script:statusWindow.MinimizeBox = $true
    $script:statusWindow.TopMost = $false
    
    # Label titolo
    $titleLabel = New-Object System.Windows.Forms.Label
    $titleLabel.Text = "Monitoraggio Rete - $($ConfigData.network_ranges -join ', ')"
    $titleLabel.Location = New-Object System.Drawing.Point(10, 10)
    $titleLabel.Size = New-Object System.Drawing.Size(760, 25)
    $titleLabel.Font = New-Object System.Drawing.Font("Microsoft Sans Serif", 10, [System.Drawing.FontStyle]::Bold)
    $script:statusWindow.Controls.Add($titleLabel)
    
    # Label per IP configurati
    $configLabel = New-Object System.Windows.Forms.Label
    $configLabel.Text = "IP Configurati nella Classe:"
    $configLabel.Location = New-Object System.Drawing.Point(10, 45)
    $configLabel.Size = New-Object System.Drawing.Size(380, 20)
    $configLabel.Font = New-Object System.Drawing.Font("Microsoft Sans Serif", 9, [System.Drawing.FontStyle]::Bold)
    $script:statusWindow.Controls.Add($configLabel)
    
    # ListBox per IP configurati (sinistra)
    $configListBox = New-Object System.Windows.Forms.ListBox
    $configListBox.Location = New-Object System.Drawing.Point(10, 70)
    $configListBox.Size = New-Object System.Drawing.Size(380, 450)
    $configListBox.Font = New-Object System.Drawing.Font("Consolas", 9)
    $configListBox.SelectionMode = [System.Windows.Forms.SelectionMode]::None
    $script:statusWindow.Controls.Add($configListBox)
    
    # Popola lista IP configurati
    $configIPsList = @()
    foreach ($range in $ConfigData.network_ranges) {
        if ($range -match '^(\d+\.\d+\.\d+)\.(\d+)/(\d+)$') {
            $baseIP = $matches[1]
            $subnetMask = [int]$matches[3]
            if ($subnetMask -ge 24) {
                $maxIP = if ($subnetMask -eq 24) { 254 } else { [Math]::Pow(2, 32 - $subnetMask) - 2 }
                for ($i = 1; $i -le $maxIP; $i++) {
                    $configIPsList += "$baseIP.$i"
                }
            }
        }
    }
    $script:configIPs = $configIPsList
    $configListBox.Items.AddRange($configIPsList)
    
    # Label per IP trovati
    $foundLabel = New-Object System.Windows.Forms.Label
    $foundLabel.Text = "IP Trovati durante Scansione:"
    $foundLabel.Location = New-Object System.Drawing.Point(400, 45)
    $foundLabel.Size = New-Object System.Drawing.Size(380, 20)
    $foundLabel.Font = New-Object System.Drawing.Font("Microsoft Sans Serif", 9, [System.Drawing.FontStyle]::Bold)
    $script:statusWindow.Controls.Add($foundLabel)
    
    # ListBox per IP trovati (destra)
    $script:statusWindowListBox = New-Object System.Windows.Forms.ListBox
    $script:statusWindowListBox.Location = New-Object System.Drawing.Point(400, 70)
    $script:statusWindowListBox.Size = New-Object System.Drawing.Size(380, 450)
    $script:statusWindowListBox.Font = New-Object System.Drawing.Font("Consolas", 9)
    $script:statusWindowListBox.SelectionMode = [System.Windows.Forms.SelectionMode]::None
    $script:statusWindow.Controls.Add($script:statusWindowListBox)
    
    # Pulsante chiudi
    $closeButton = New-Object System.Windows.Forms.Button
    $closeButton.Text = "Chiudi"
    $closeButton.Location = New-Object System.Drawing.Point(710, 530)
    $closeButton.Size = New-Object System.Drawing.Size(70, 30)
    $closeButton.Add_Click({
        $script:statusWindow.Hide()
    })
    $script:statusWindow.Controls.Add($closeButton)
    
    # Handler chiusura finestra
    $script:statusWindow.Add_FormClosing({
        $_.Cancel = $true
        $script:statusWindow.Hide()
    })
    
    # Mostra finestra
    $script:statusWindow.Show()
    $script:statusWindow.BringToFront()
}

function Update-StatusWindowIPs {
    param([array]$IPs)
    
    if (-not $script:statusWindowListBox) { return }
    if (-not $script:statusWindow -or -not $script:statusWindow.Visible) { return }
    
    # Invoca aggiornamento UI sul thread corretto
    if ($script:statusWindow.InvokeRequired) {
        $script:statusWindow.Invoke([System.Windows.Forms.MethodInvoker]{
            $script:statusWindowListBox.Items.Clear()
            foreach ($ip in $IPs) {
                $script:statusWindowListBox.Items.Add($ip)
            }
            if ($script:statusWindowListBox.Items.Count -gt 0) {
                $script:statusWindowListBox.TopIndex = $script:statusWindowListBox.Items.Count - 1
            }
        })
    } else {
        $script:statusWindowListBox.Items.Clear()
        foreach ($ip in $IPs) {
            $script:statusWindowListBox.Items.Add($ip)
        }
        if ($script:statusWindowListBox.Items.Count -gt 0) {
            $script:statusWindowListBox.TopIndex = $script:statusWindowListBox.Items.Count - 1
        }
    }
}

function Reset-StatusWindowScan {
    if (-not $script:statusWindowListBox) { return }
    if (-not $script:statusWindow -or -not $script:statusWindow.Visible) { return }
    
    $script:currentScanIPs = @()
    if ($script:statusWindow.InvokeRequired) {
        $script:statusWindow.Invoke([System.Windows.Forms.MethodInvoker]{
            $script:statusWindowListBox.Items.Clear()
        })
    } else {
        $script:statusWindowListBox.Items.Clear()
    }
}
# FUNZIONI TRAY ICON (solo se non in modalitÃ  servizio)
# ============================================

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
    
    # Voce "Mostra Finestra Stato" nel menu
    $showWindowItem = New-Object System.Windows.Forms.ToolStripMenuItem
    $showWindowItem.Text = "Mostra Finestra Stato"
    $showWindowItem.Add_Click({
        Show-StatusWindow -ConfigData $script:config
    })
    $contextMenu.Items.Insert(1, (New-Object System.Windows.Forms.ToolStripSeparator))
    $contextMenu.Items.Insert(2, $showWindowItem)
    
    # Click singolo sull'icona apre finestra stato
    $script:trayIcon.Add_Click({
        if ($_.Button -eq [System.Windows.Forms.MouseButtons]::Left) {
            Show-StatusWindow -ConfigData $script:config
        }
    })
    
    # Aggiorna tooltip periodicamente (massimo 64 caratteri per Windows)
    $updateTooltip = {
        if ($script:trayIcon) {
            $statusText = "Network Monitor Agent"
            if ($script:lastScanTime) {
                $timeSince = (Get-Date) - $script:lastScanTime
                $minutesAgo = [Math]::Floor($timeSince.TotalMinutes)
                $statusText = "Agent - Ultima scan: ${minutesAgo}m fa"
            } else {
                $statusText = "Network Monitor Agent - Running"
            }
            # Limita a 64 caratteri (limite Windows NotifyIcon)
            if ($statusText.Length -gt 63) {
                $statusText = $statusText.Substring(0, 63)
            }
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

# ============================================
# MAIN
# ============================================

Write-Log "=== Network Monitor Service Avviato ==="
Write-Log "ModalitÃ : $(if ($ServiceMode) { 'Servizio' } else { 'Applicazione con Tray Icon' })"

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

# Inizializza intervallo scansione
$script:scanIntervalMinutes = $config.scan_interval_minutes
if (-not $script:scanIntervalMinutes) { $script:scanIntervalMinutes = 15 }

# Salva config globale per finestra stato
$script:config = $config

Write-Log "Server URL: $($config.server_url)"
Write-Log "Network ranges: $($config.network_ranges -join ', ')"
Write-Log "Scan interval: $script:scanIntervalMinutes minuti"

# Inizializza status
Update-StatusFile -Status "running" -Message "Servizio avviato"

# Se non in modalitÃ  servizio, mostra tray icon
if (-not $ServiceMode) {
    # Crea application context per la tray icon
    [System.Windows.Forms.Application]::EnableVisualStyles()
    Show-TrayIcon
}

# Loop principale
Write-Log "Avvio loop principale..."
$nextScanTime = Get-Date
$nextHeartbeatTime = Get-Date  # Heartbeat ogni 5 minuti

while ($script:isRunning) {
    try {
        # Processa messaggi Windows (necessario per tray icon)
        if (-not $ServiceMode) {
            [System.Windows.Forms.Application]::DoEvents()
        }
        
        $now = Get-Date
        
        # Heartbeat periodico (ogni 5 minuti) per verificare configurazione server
        if ($now -ge $nextHeartbeatTime) {
            Write-Log "Invio heartbeat..."
            try {
                $version = if ($config.version) { $config.version } else { "1.0.0" }
            $heartbeatResult = Send-Heartbeat -ServerUrl $config.server_url -ApiKey $config.api_key -Version $version
                
                # Verifica se il server ha richiesto la disinstallazione
                if ($heartbeatResult.uninstall -eq $true) {
                    Write-Log "Server ha richiesto disinstallazione: $($heartbeatResult.message)" "WARN"
                    Update-StatusFile -Status "stopping" -Message "Disinstallazione richiesta dal server"
                    
                    # Esci dal loop
                    $script:isRunning = $false
                    break
                }
                
                # L'intervallo viene aggiornato automaticamente da Send-Heartbeat se diverso
                Write-Log "Heartbeat completato"
            } catch {
                Write-Log "Errore heartbeat: $_" "WARN"
            }
            
            # Prossimo heartbeat tra 5 minuti
            $nextHeartbeatTime = $now.AddMinutes(5)
        }
        
        # Controlla se Ã¨ il momento di eseguire una scansione
        if ($now -ge $nextScanTime) {
            Write-Log "Esecuzione scansione programmata..."
            Update-TrayIconStatus -Status "scanning"
            Update-StatusFile -Status "scanning" -Message "Scansione in corso..."
            
            # Reset lista IP trovati nella finestra stato
            Reset-StatusWindowScan
            
            try {
                # 1. Scan rete
                Write-Log "Avvio scansione rete..."
                $devices = Get-NetworkDevices -NetworkRanges $config.network_ranges
                Write-Log "Trovati $($devices.Count) dispositivi"
                $script:lastScanDevices = $devices.Count
                
                # 2. Invio dati se ci sono dispositivi
                if ($devices.Count -gt 0) {
                    Write-Log "Invio dati al server..."
                    $result = Send-ScanResults -Devices $devices -ServerUrl $config.server_url -ApiKey $config.api_key
                    Write-Log "Dati inviati con successo!"
                } else {
                    Write-Log "Nessun dispositivo trovato, skip invio"
                }
                
                # 3. Aggiorna stato
                $script:lastScanTime = Get-Date
                Update-TrayIconStatus -Status "running"
                Update-StatusFile -Status "running" -Message "Ultima scansione completata" -LastScan $script:lastScanTime -DevicesFound $script:lastScanDevices
                Write-Log "Scansione completata con successo"
                
            } catch {
                Write-Log "Errore durante scansione: $_" "ERROR"
                Write-Log "Stack trace: $($_.Exception.StackTrace)" "ERROR"
                Update-TrayIconStatus -Status "error"
                Update-StatusFile -Status "error" -Message "Errore: $_"
            }
            
            # Calcola prossima scansione usando l'intervallo corrente (che potrebbe essere cambiato dal server)
            $nextScanTime = $now.AddMinutes($script:scanIntervalMinutes)
            Write-Log "Prossima scansione: $($nextScanTime.ToString('HH:mm:ss')) (intervallo: $script:scanIntervalMinutes minuti)"
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
