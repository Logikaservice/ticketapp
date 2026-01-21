# NetworkMonitor.ps1
# Agent PowerShell per monitoraggio rete - Invio dati al server TicketApp
# Versione: 2.2.0 - Trust ARP + Auto-update

param(
    [string]$ConfigPath = "config.json",
    [switch]$TestMode = $false
)

$AGENT_VERSION = "2.2.0"

# Forza TLS 1.2 per Invoke-RestMethod (compatibilità hardening TLS su Windows/Server)
function Enable-Tls12 {
    try {
        [Net.ServicePointManager]::SecurityProtocol = `
            ([Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls)
    } catch {
        try { [Net.ServicePointManager]::SecurityProtocol = 192 -bor 768 -bor 3072 } catch { }
    }
}
Enable-Tls12

# Funzioni helper
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    Write-Host $logMessage
    # Opzionale: salva anche in file log
    # $logMessage | Out-File -FilePath "NetworkMonitor.log" -Append
}

function Check-AgentUpdate {
    param(
        [string]$ServerUrl,
        [string]$CurrentVersion
    )
    
    try {
        Write-Log "🔍 Controllo aggiornamenti agent... (versione corrente: $CurrentVersion)" "INFO"
        
        # Endpoint per controllare versione
        $versionUrl = "$ServerUrl/api/network-monitoring/agent-version"
        
        # Richiedi informazioni versione
        $response = Invoke-RestMethod -Uri $versionUrl -Method Get -TimeoutSec 10 -ErrorAction Stop
        
        $serverVersion = $response.version
        $downloadUrl = $response.download_url
        
        Write-Log "📡 Versione disponibile sul server: $serverVersion" "INFO"
        
        # Confronta versioni (semplice confronto stringa)
        if ($serverVersion -ne $CurrentVersion) {
            Write-Log "🆕 Nuova versione disponibile! Avvio aggiornamento..." "INFO"
            
            # Percorso file corrente
            $currentScriptPath = $PSCommandPath
            if (-not $currentScriptPath) {
                $currentScriptPath = Join-Path $PSScriptRoot "NetworkMonitor.ps1"
            }
            
            # Percorso temporaneo per download
            $tempFilePath = Join-Path $PSScriptRoot "NetworkMonitor.ps1.new"
            $backupFilePath = Join-Path $PSScriptRoot "NetworkMonitor.ps1.backup"
            
            # Scarica nuova versione
            Write-Log "📥 Download nuova versione da: $downloadUrl" "INFO"
            Invoke-WebRequest -Uri $downloadUrl -OutFile $tempFilePath -TimeoutSec 30 -ErrorAction Stop
            
            # Verifica download
            if (Test-Path $tempFilePath) {
                $fileSize = (Get-Item $tempFilePath).Length
                Write-Log "✅ Download completato ($fileSize bytes)" "INFO"
                
                # Backup versione corrente
                if (Test-Path $currentScriptPath) {
                    Copy-Item $currentScriptPath $backupFilePath -Force
                    Write-Log "💾 Backup versione precedente creato" "INFO"
                }
                
                # Sostituisci file
                Move-Item $tempFilePath $currentScriptPath -Force
                Write-Log "✅ File aggiornato con successo!" "INFO"
                
                # Riavvia il servizio per applicare l'aggiornamento
                Write-Log "🔄 Riavvio servizio NetworkMonitorAgent..." "INFO"
                try {
                    Restart-Service -Name "NetworkMonitorAgent" -Force -ErrorAction Stop
                    Write-Log "✅ Servizio riavviato! Aggiornamento completato alla v$serverVersion" "INFO"
                } catch {
                    Write-Log "⚠️ Impossibile riavviare servizio: $_" "WARN"
                    Write-Log "⚠️ Riavviare manualmente il servizio per applicare l'aggiornamento" "WARN"
                }
                
                # Termina script corrente (verrà riavviato dal servizio)
                exit 0
            } else {
                Write-Log "❌ Download fallito, file non trovato" "ERROR"
            }
        } else {
            Write-Log "✅ Agent già aggiornato alla versione corrente" "INFO"
        }
    } catch {
        Write-Log "⚠️ Errore controllo aggiornamenti: $_" "WARN"
        Write-Log "⚠️ Continuo con la versione corrente..." "WARN"
    }
}

function Get-ArpTable {
    param([string]$NetworkPrefix)
    
    $arpDevices = @{}
    
    try {
        # Metodo 1: Get-NetNeighbor (Windows 8+, più affidabile)
        $neighbors = Get-NetNeighbor -AddressFamily IPv4 -ErrorAction SilentlyContinue | 
            Where-Object { $_.IPAddress -like "$NetworkPrefix*" -and $_.State -ne "Unreachable" }
        
        foreach ($neighbor in $neighbors) {
            $ip = $neighbor.IPAddress
            $mac = $neighbor.LinkLayerAddress
            
            if ($mac -and $mac -ne "00-00-00-00-00-00" -and $mac -ne "FF-FF-FF-FF-FF-FF") {
                $arpDevices[$ip] = $mac
                Write-Log "ARP: $ip → $mac" "DEBUG"
            }
        }
    } catch {
        Write-Log "Get-NetNeighbor fallito, provo arp.exe: $_" "WARN"
    }
    
    # Metodo 2: arp.exe (fallback per sistemi più vecchi)
    if ($arpDevices.Count -eq 0) {
        try {
            $arpOutput = arp -a | Select-String -Pattern "^\s+(\d+\.\d+\.\d+\.\d+)\s+([0-9a-f]{2}[-:][0-9a-f]{2}[-:][0-9a-f]{2}[-:][0-9a-f]{2}[-:][0-9a-f]{2}[-:][0-9a-f]{2})" -AllMatches
            
            foreach ($match in $arpOutput.Matches) {
                $ip = $match.Groups[1].Value
                $mac = $match.Groups[2].Value.ToUpper() -replace ':', '-'
                
                if ($ip -like "$NetworkPrefix*" -and $mac -ne "00-00-00-00-00-00" -and $mac -ne "FF-FF-FF-FF-FF-FF") {
                    $arpDevices[$ip] = $mac
                    Write-Log "ARP (arp.exe): $ip → $mac" "DEBUG"
                }
            }
        } catch {
            Write-Log "arp.exe fallito: $_" "ERROR"
        }
    }
    
    return $arpDevices
}

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
        Write-Log "Scansione range: $range (Trust ARP mode)"
        
        # Estrai subnet e calcola range IP
        if ($range -match '^(\d+\.\d+\.\d+)\.(\d+)/(\d+)$') {
            $baseIP = $matches[1]
            $subnetMask = [int]$matches[3]
            
            # FASE 1: Scansiona tabella ARP per dispositivi già presenti
            Write-Log "Scansionando tabella ARP per range $baseIP.*" "DEBUG"
            $arpTable = Get-ArpTable -NetworkPrefix $baseIP
            Write-Log "Trovati $($arpTable.Count) dispositivi in ARP table" "INFO"
            
            # FASE 2: Forza aggiornamento ARP con ping broadcast (opzionale, aiuta a popolare ARP)
            # Questo aiuta a rilevare dispositivi che non hanno comunicato di recente
            $calcHostBits = 32 - $subnetMask
            $numHosts = [Math]::Pow(2, $calcHostBits) - 2
            
            if ($subnetMask -ge 24) {
                $maxIP = [Math]::Min(254, $numHosts)
                
                # Ping veloce per popolare ARP table (solo se non già presente)
                Write-Log "Aggiornando ARP table con ping veloce..." "DEBUG"
                $jobs = @()
                for ($i = 1; $i -le $maxIP; $i++) {
                    $ip = "$baseIP.$i"
                    # Ping async per velocità (max 10 job paralleli)
                    if ($jobs.Count -ge 10) {
                        $jobs | Wait-Job -Any | Out-Null
                        $jobs = $jobs | Where-Object { $_.State -eq 'Running' }
                    }
                    $jobs += Start-Job -ScriptBlock {
                        param($targetIP)
                        Test-Connection -ComputerName $targetIP -Count 1 -Quiet -ErrorAction SilentlyContinue | Out-Null
                    } -ArgumentList $ip
                }
                # Attendi completamento ping jobs
                $jobs | Wait-Job -Timeout 5 | Out-Null
                $jobs | Remove-Job -Force -ErrorAction SilentlyContinue
                
                # FASE 3: Ri-scansiona ARP dopo ping
                Start-Sleep -Milliseconds 500
                $arpTable = Get-ArpTable -NetworkPrefix $baseIP
                Write-Log "Dopo ping: $($arpTable.Count) dispositivi in ARP table" "INFO"
                
                # FASE 4: Processa ogni dispositivo in ARP table
                foreach ($ip in $arpTable.Keys) {
                    $macAddress = $arpTable[$ip]
                    
                    Write-Log "Processando dispositivo ARP: $ip ($macAddress)" "DEBUG"
                    
                    # Test se risponde al ping (per distinguere Online vs No Ping)
                    $pingResponsive = Test-Connection -ComputerName $ip -Count 1 -Quiet -ErrorAction SilentlyContinue
                    
                    # Se è l'IP locale, marca sempre come ping responsive
                    if ($localIP -and $ip -eq $localIP) {
                        $pingResponsive = $true
                        $hostname = $env:COMPUTERNAME
                    } else {
                        # Prova risoluzione hostname
                        $hostname = $null
                        try {
                            $dnsResult = Resolve-DnsName -Name $ip -ErrorAction SilentlyContinue -DnsOnly
                            if ($dnsResult -and $dnsResult.NameHost) {
                                $hostname = $dnsResult.NameHost
                            }
                        } catch {
                            # Ignora errori DNS
                        }
                    }
                    
                    # Vendor lookup da MAC (se disponibile)
                    $vendor = $null
                    if ($macAddress -and $macAddress -match '^([0-9A-F]{2}[:-][0-9A-F]{2}[:-][0-9A-F]{2})') {
                        $oui = $matches[1] -replace '[:-]', ''
                        # TODO: Implementa lookup vendor (API o database locale)
                        # Per ora lasciamo null
                    }
                    
                    # Crea device object con nuovo campo ping_responsive
                    $device = @{
                        ip_address = $ip
                        mac_address = $macAddress
                        hostname = $hostname
                        vendor = $vendor
                        status = "online"  # Sempre online se presente in ARP
                        ping_responsive = $pingResponsive
                    }
                    
                    $devices += $device
                    
                    $statusLabel = if ($pingResponsive) { "✓ Ping OK" } else { "⚠️ No Ping" }
                    Write-Log "Dispositivo: $ip → $statusLabel" "INFO"
                }
                
            } else {
                Write-Log "Subnet mask troppo grande per scansione completa: $range" "WARN"
            }
        } else {
            Write-Log "Formato range IP non supportato: $range (atteso: x.x.x.x/24)" "WARN"
        }
    }
    
    Write-Log "Scansione completata: $($devices.Count) dispositivi rilevati" "INFO"
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

function Update-ScheduledTaskInterval {
    param(
        [int]$IntervalMinutes,
        [string]$AgentScript = "",
        [string]$InstallDir = ""
    )
    
    $TaskName = "NetworkMonitorAgent"
    
    try {
        # Ottieni percorso script corrente se non specificato
        if (-not $AgentScript) {
            $AgentScript = $MyInvocation.PSCommandPath
        }
        if (-not $InstallDir) {
            $InstallDir = Split-Path -Parent $AgentScript
        }
        
        Write-Log "Rilevato cambio intervallo scansione a $IntervalMinutes minuti. Aggiorno Scheduled Task..." "INFO"
        
        # Rimuovi task esistente
        try {
            $existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
            if ($existingTask) {
                Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction Stop
                Write-Log "Scheduled Task '$TaskName' rimosso." "DEBUG"
            }
        } catch {
            Write-Log "Errore rimozione Scheduled Task '$TaskName': $_" "ERROR"
            return $false
        }
        
        # Crea azione
        $action = New-ScheduledTaskAction `
            -Execute "powershell.exe" `
            -Argument "-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File `"$AgentScript`"" `
            -WorkingDirectory $InstallDir
        
        # Crea trigger con il nuovo intervallo
        $trigger = New-ScheduledTaskTrigger `
            -Once `
            -At (Get-Date) `
            -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes)
        
        # Crea settings
        $settings = New-ScheduledTaskSettingsSet `
            -AllowStartIfOnBatteries `
            -DontStopIfGoingOnBatteries `
            -StartWhenAvailable `
            -RunOnlyIfNetworkAvailable `
            -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
            -RestartCount 3 `
            -RestartInterval (New-TimeSpan -Minutes 1)
        
        # Registra nuovo task
        try {
            Register-ScheduledTask `
                -TaskName $TaskName `
                -Action $action `
                -Trigger $trigger `
                -Settings $settings `
                -Description "Network Monitor Agent - Scansione rete automatica ogni $IntervalMinutes minuti" `
                -User "SYSTEM" `
                -RunLevel Highest -ErrorAction Stop | Out-Null
            Write-Log "Scheduled Task '$TaskName' ricreato con successo per ogni $IntervalMinutes minuti." "INFO"
            return $true
    } catch {
        Write-Log "Errore aggiornamento Scheduled Task: $_" "WARN"
        return $false
    }
}

function Send-Heartbeat {
    param(
        [string]$ServerUrl,
        [string]$ApiKey,
        [string]$Version = "1.0.0",
        [string]$ConfigPath = ""
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
        if ($ConfigPath) {
            try {
                $serverConfigResult = Get-ServerConfig -ServerUrl $ServerUrl -ApiKey $ApiKey
                if ($serverConfigResult.success -and $serverConfigResult.config.scan_interval_minutes) {
                    $serverInterval = $serverConfigResult.config.scan_interval_minutes
                    
                    # Leggi config locale
                    if (Test-Path $ConfigPath) {
                        $localConfig = Get-Content $ConfigPath -Raw | ConvertFrom-Json
                        $localInterval = if ($localConfig.scan_interval_minutes) { $localConfig.scan_interval_minutes } else { 15 }
                        
                        # Se l'intervallo è diverso, aggiorna il Scheduled Task
                        if ($serverInterval -ne $localInterval) {
                            Write-Log "Rilevato cambio intervallo scansione: $localInterval -> $serverInterval minuti" "INFO"
                            $updateResult = Update-ScheduledTaskInterval -IntervalMinutes $serverInterval
                            if ($updateResult) {
                                # Aggiorna config.json locale
                                $localConfig.scan_interval_minutes = $serverInterval
                                $localConfig | ConvertTo-Json -Depth 10 | Out-File -FilePath $ConfigPath -Encoding UTF8 -Force
                                Write-Log "Config.json locale aggiornato con nuovo intervallo ($serverInterval minuti)" "INFO"
                            }
                        }
                    }
                }
            } catch {
                Write-Log "Errore verifica configurazione server: $_" "DEBUG"
                # Non bloccare l'esecuzione se il controllo configurazione fallisce
            }
        }
        
        return @{ success = $true; uninstall = $false }
    } catch {
        Write-Log "Errore heartbeat: $_" "WARN"
        return @{ success = $false; uninstall = $false; error = $_.Exception.Message }
    }
}

function Uninstall-Agent {
    param(
        [string]$ScriptDir
    )
    
    Write-Log "=== Avvio disinstallazione agent ===" "WARN"
    
    $TaskName = "NetworkMonitorAgent"
    
    # Rimuovi Scheduled Task
    try {
        $existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        if ($existingTask) {
            Write-Log "Rimozione Scheduled Task: $TaskName" "WARN"
            Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction Stop
            Write-Log "Scheduled Task rimosso con successo" "INFO"
        } else {
            Write-Log "Scheduled Task non trovato (già rimosso?)" "WARN"
        }
    } catch {
        Write-Log "Errore rimozione Scheduled Task: $_" "ERROR"
    }
    
    Write-Log "=== Disinstallazione completata ===" "WARN"
    Write-Log "L'agent è stato disinstallato. Puoi eliminare manualmente la directory: $ScriptDir" "INFO"
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

# Controlla aggiornamenti agent (all'avvio)
Check-AgentUpdate -ServerUrl $config.server_url -CurrentVersion $AGENT_VERSION

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
    # 0. Controlla aggiornamenti (ogni scansione)
    Check-AgentUpdate -ServerUrl $config.server_url -CurrentVersion $AGENT_VERSION
    
    # 1. Heartbeat (indica che l'agent è online)
    Write-Log "Invio heartbeat..."
    $heartbeatResult = Send-Heartbeat -ServerUrl $config.server_url -ApiKey $config.api_key -Version $config.version
    
    # Verifica se il server ha richiesto la disinstallazione
    if ($heartbeatResult.uninstall -eq $true) {
        Write-Log "Server ha richiesto disinstallazione: $($heartbeatResult.message)" "WARN"
        $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
        Uninstall-Agent -ScriptDir $scriptDir
        Write-Log "Agent disinstallato. Uscita." "WARN"
        exit 0
    }
    
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
