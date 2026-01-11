# NetworkMonitor.ps1
# Agent PowerShell per monitoraggio rete - Invio dati al server TicketApp

param(
    [string]$ConfigPath = "config.json",
    [switch]$TestMode = $false
)

# Funzioni helper
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    Write-Host $logMessage
    # Opzionale: salva anche in file log
    # $logMessage | Out-File -FilePath "NetworkMonitor.log" -Append
}

function Get-NetworkDevices {
    param([string[]]$NetworkRanges)
    
    $devices = @()
    
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
                
                # Scansiona IP range (limitato per ora a prima subnet)
                for ($i = 1; $i -le [Math]::Min(50, $endIP); $i++) {  # Limita a 50 per test
                    $ip = "$baseIP.$i"
                    
                    # Ping test
                    $pingResult = Test-Connection -ComputerName $ip -Count 1 -Quiet -ErrorAction SilentlyContinue
                    
                    if ($pingResult) {
                        Write-Log "Dispositivo rilevato: $ip" "DEBUG"
                        
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
                        
                        # Determina tipo dispositivo (semplificato)
                        $deviceType = "unknown"
                        if ($hostname) {
                            if ($hostname -match 'router|gateway|switch') { $deviceType = "router" }
                            elseif ($hostname -match 'server|srv') { $deviceType = "server" }
                            elseif ($hostname -match 'printer|print') { $deviceType = "printer" }
                            else { $deviceType = "workstation" }
                        }
                        
                        $device = @{
                            ip_address = $ip
                            mac_address = $macAddress
                            hostname = $hostname
                            vendor = $vendor
                            device_type = $deviceType
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
        [string]$ApiKey,
        [string]$LastScanPath = "last_scan.json"
    )
    
    try {
        # Carica ultimo scan per confronto (se esiste)
        $lastScan = $null
        if (Test-Path $LastScanPath) {
            try {
                $lastScanJson = Get-Content $LastScanPath -Raw | ConvertFrom-Json
                $lastScan = $lastScanJson.devices
            } catch {
                Write-Log "Errore lettura last_scan.json: $_" "WARN"
            }
        }
        
        # Rileva cambiamenti (semplificato per ora)
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
        
        $scanData | Out-File -FilePath $LastScanPath -Encoding UTF8
        
        return $response
    } catch {
        Write-Log "Errore invio dati: $_" "ERROR"
        Write-Log "Stack trace: $($_.Exception.StackTrace)" "ERROR"
        throw
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
        
        Write-Log "Heartbeat inviato con successo" "DEBUG"
        return $true
    } catch {
        Write-Log "Errore heartbeat: $_" "WARN"
        return $false
    }
}

# === MAIN SCRIPT ===

Write-Log "=== Network Monitor Agent Avviato ==="

# Carica configurazione
if (-not (Test-Path $ConfigPath)) {
    Write-Log "File config.json non trovato! Crea un file config.json con le impostazioni." "ERROR"
    exit 1
}

try {
    $config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
} catch {
    Write-Log "Errore lettura config.json: $_" "ERROR"
    exit 1
}

# Verifica parametri obbligatori
if (-not $config.server_url -or -not $config.api_key -or -not $config.network_ranges) {
    Write-Log "Configurazione incompleta! Richiesti: server_url, api_key, network_ranges" "ERROR"
    exit 1
}

Write-Log "Server URL: $($config.server_url)"
Write-Log "Network ranges: $($config.network_ranges -join ', ')"
Write-Log "Scan interval: $($config.scan_interval_minutes) minuti"

if ($TestMode) {
    Write-Log "=== MODO TEST - Esecuzione singola ==="
    
    # Scan rete
    Write-Log "Avvio scansione rete..."
    $devices = Get-NetworkDevices -NetworkRanges $config.network_ranges
    Write-Log "Trovati $($devices.Count) dispositivi"
    
    # Mostra dispositivi trovati
    foreach ($device in $devices) {
        Write-Log "  - $($device.ip_address) | MAC: $($device.mac_address) | Hostname: $($device.hostname) | Vendor: $($device.vendor)"
    }
    
    # Invio dati
    if ($devices.Count -gt 0) {
        Write-Log "Invio dati al server..."
        $result = Send-ScanResults -Devices $devices -ServerUrl $config.server_url -ApiKey $config.api_key
        Write-Log "Invio completato!"
    } else {
        Write-Log "Nessun dispositivo trovato, skip invio"
    }
    
    # Heartbeat
    Send-Heartbeat -ServerUrl $config.server_url -ApiKey $config.api_key -Version $config.version
    
    Write-Log "=== Test completato ==="
    exit 0
}

# Modalità normale: esecuzione singola (il Scheduled Task riavvierà lo script)
Write-Log "=== Esecuzione scansione ==="

try {
    # 1. Heartbeat (indica che l'agent è online)
    Write-Log "Invio heartbeat..."
    Send-Heartbeat -ServerUrl $config.server_url -ApiKey $config.api_key -Version $config.version
    
    # 2. Scan rete
    Write-Log "Avvio scansione rete..."
    $devices = Get-NetworkDevices -NetworkRanges $config.network_ranges
    Write-Log "Trovati $($devices.Count) dispositivi"
    
    # 3. Invio dati se ci sono dispositivi
    if ($devices.Count -gt 0) {
        Write-Log "Invio dati al server..."
        $result = Send-ScanResults -Devices $devices -ServerUrl $config.server_url -ApiKey $config.api_key
        Write-Log "Dati inviati con successo!"
    } else {
        Write-Log "Nessun dispositivo trovato, skip invio"
    }
    
    Write-Log "=== Scansione completata ==="
    exit 0
    
} catch {
    Write-Log "Errore durante scansione: $_" "ERROR"
    Write-Log "Stack trace: $($_.Exception.StackTrace)" "ERROR"
    exit 1
}
