# NetworkMonitorService.ps1
# Servizio Windows permanente per Network Monitor Agent
# Rimane sempre attivo e esegue scansioni periodicamente
# Gestisce tutto internamente senza dipendere da Scheduled Task
# Nota: Questo script viene eseguito SOLO come servizio Windows (senza GUI)
# Per la GUI tray icon, usare NetworkMonitorTrayIcon.ps1

param(
    [string]$ConfigPath = "config.json"
)

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
$script:lastScanTime = $null
$script:lastScanDevices = 0
$script:scanIntervalMinutes = 15
$script:statusFile = Join-Path $script:scriptDir ".agent_status.json"
$script:lastScanPath = Join-Path $script:scriptDir "last_scan.json"
$script:currentScanIPsFile = Join-Path $script:scriptDir ".current_scan_ips.json"

# ============================================
# FUNZIONI HELPER
# ============================================

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    
    $logPath = Join-Path $script:scriptDir "NetworkMonitorService.log"
    # Salva solo su file (servizio Windows non ha console)
    $logMessage | Out-File -FilePath $logPath -Append -Encoding UTF8
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
                
                # Aggiungi sempre l'IP locale se è nel range configurato
                $localIPInRange = $false
                if ($localIP -and $localIP -like "$baseIP.*") {
                    $localIPInRange = $true
                    $localIPOctet = [int]($localIP -split '\.')[3]
                    Write-Log "IP locale ($localIP) è nel range configurato" "DEBUG"
                }
                
                # Scansiona IP range (aumentato a 254 per includere tutti gli IP in una /24)
                $maxIP = [Math]::Min(254, $endIP)
                for ($i = 1; $i -le $maxIP; $i++) {
                    $ip = "$baseIP.$i"
                    
                    # Se è l'IP locale, aggiungilo sempre (anche se il ping fallisce)
                    if ($localIPInRange -and $i -eq $localIPOctet) {
                        Write-Log "Aggiungendo IP locale: $ip" "DEBUG"
                        
                        # Salva IP locale per la tray icon
                        try {
                            $currentIPs = @()
                            if (Test-Path $script:currentScanIPsFile) {
                                try {
                                    $currentIPs = Get-Content $script:currentScanIPsFile -Raw | ConvertFrom-Json
                                } catch { }
                            }
                            if ($currentIPs -notcontains $ip) {
                                $currentIPs += $ip
                                $currentIPs | ConvertTo-Json | Out-File -FilePath $script:currentScanIPsFile -Encoding UTF8 -Force
                            }
                        } catch {
                            # Ignora errori salvataggio IP per tray icon
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
                        
                        # Salva IP trovato per la tray icon (in tempo reale)
                        try {
                            $currentIPs = @()
                            if (Test-Path $script:currentScanIPsFile) {
                                try {
                                    $currentIPs = Get-Content $script:currentScanIPsFile -Raw | ConvertFrom-Json
                                } catch { }
                            }
                            if ($currentIPs -notcontains $ip) {
                                $currentIPs += $ip
                                $currentIPs | ConvertTo-Json | Out-File -FilePath $script:currentScanIPsFile -Encoding UTF8 -Force
                            }
                        } catch {
                            # Ignora errori salvataggio IP per tray icon
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
                            # Metodo 2: arp.exe (compatibilità)
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
            
            # Dispositivi offline (non più nella scansione)
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
        
        # Recupera configurazione dal server per verificare se scan_interval_minutes è cambiato
        try {
            $serverConfigResult = Get-ServerConfig -ServerUrl $ServerUrl -ApiKey $ApiKey
            if ($serverConfigResult.success -and $serverConfigResult.config.scan_interval_minutes) {
                $serverInterval = $serverConfigResult.config.scan_interval_minutes
                
                # Se l'intervallo è diverso, aggiornalo solo in memoria (il servizio lo usa direttamente)
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
                        Write-Log "Il nuovo intervallo sarà applicato dalla prossima scansione" "INFO"
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
# MAIN
# ============================================

Write-Log "=== Network Monitor Service Avviato ==="
Write-Log "Modalita: Servizio Windows (senza GUI)"

# Carica configurazione
if (-not (Test-Path $ConfigPath)) {
    $errorMsg = "File config.json non trovato! Crea un file config.json con le impostazioni."
    Write-Log $errorMsg "ERROR"
    Update-StatusFile -Status "error" -Message $errorMsg
    exit 1
}

try {
    $config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
} catch {
    $errorMsg = "Errore lettura config.json: $_"
    Write-Log $errorMsg "ERROR"
    Update-StatusFile -Status "error" -Message $errorMsg
    exit 1
}

# Verifica parametri obbligatori
if (-not $config.server_url -or -not $config.api_key -or -not $config.network_ranges) {
    $errorMsg = "Configurazione incompleta! Richiesti: server_url, api_key, network_ranges"
    Write-Log $errorMsg "ERROR"
    Update-StatusFile -Status "error" -Message $errorMsg
    exit 1
}

# Inizializza intervallo scansione
$script:scanIntervalMinutes = $config.scan_interval_minutes
if (-not $script:scanIntervalMinutes) { $script:scanIntervalMinutes = 15 }

Write-Log "Server URL: $($config.server_url)"
Write-Log "Network ranges: $($config.network_ranges -join ', ')"
Write-Log "Scan interval: $script:scanIntervalMinutes minuti"

# Inizializza status
Update-StatusFile -Status "running" -Message "Servizio avviato"

# Loop principale
Write-Log "Avvio loop principale..."
$nextScanTime = Get-Date
$nextHeartbeatTime = Get-Date  # Heartbeat ogni 5 minuti

while ($script:isRunning) {
    try {
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
        
        # Controlla se è il momento di eseguire una scansione
        if ($now -ge $nextScanTime) {
            Write-Log "Esecuzione scansione programmata..."
            Update-StatusFile -Status "scanning" -Message "Scansione in corso..."
            
            # Reset lista IP trovati per la tray icon
            try {
                @() | ConvertTo-Json | Out-File -FilePath $script:currentScanIPsFile -Encoding UTF8 -Force
            } catch {
                # Ignora errori reset file IP
            }
            
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
                Update-StatusFile -Status "running" -Message "Ultima scansione completata" -LastScan $script:lastScanTime -DevicesFound $script:lastScanDevices
                Write-Log "Scansione completata con successo"
                
            } catch {
                Write-Log "Errore durante scansione: $_" "ERROR"
                Write-Log "Stack trace: $($_.Exception.StackTrace)" "ERROR"
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
