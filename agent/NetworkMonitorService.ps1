# NetworkMonitorService.ps1
# Servizio Windows permanente per Network Monitor Agent
# Rimane sempre attivo e esegue scansioni periodicamente
# Gestisce tutto internamente senza dipendere da Scheduled Task
# Nota: Questo script viene eseguito SOLO come servizio Windows (senza GUI)
# Per la GUI tray icon, usare NetworkMonitorTrayIcon.ps1

param(
    [string]$ConfigPath = "config.json"
)

# Aggiungi definizione SendARP API per recupero MAC diretto (come Advanced IP Scanner)
Add-Type -TypeDefinition @"
using System;
using System.Net;
using System.Net.NetworkInformation;
using System.Runtime.InteropServices;

public class ArpHelper {
    [DllImport("iphlpapi.dll", ExactSpelling = true)]
    public static extern int SendARP(uint destIP, uint srcIP, byte[] pMacAddr, ref uint phyAddrLen);
    
    public static string GetMacAddress(string ipAddress) {
        try {
            IPAddress ip = IPAddress.Parse(ipAddress);
            byte[] macAddr = new byte[6];
            uint macAddrLen = (uint)macAddr.Length;
            
            // Converti IP in uint (network byte order - big endian)
            byte[] ipBytes = ip.GetAddressBytes();
            // SendARP si aspetta IP in network byte order (big endian)
            uint destIP = (uint)((ipBytes[0] << 24) | (ipBytes[1] << 16) | (ipBytes[2] << 8) | ipBytes[3]);
            
            int result = SendARP(destIP, 0, macAddr, ref macAddrLen);
            if (result == 0 && macAddrLen == 6) {
                // Verifica che non sia tutto zero
                bool allZero = true;
                foreach (byte b in macAddr) {
                    if (b != 0) {
                        allZero = false;
                        break;
                    }
                }
                if (!allZero) {
                    return string.Format("{0:X2}-{1:X2}-{2:X2}-{3:X2}-{4:X2}-{5:X2}",
                        macAddr[0], macAddr[1], macAddr[2], macAddr[3], macAddr[4], macAddr[5]);
                }
            }
        } catch {
            // Ignora errori
        }
        return null;
    }
}
"@

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
$script:forceScanTriggerFile = Join-Path $script:scriptDir ".force_scan.trigger"

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
    
    # Leggi status corrente per preservare last_scan se non fornito
    $currentLastScan = $null
    if (-not $LastScan -and (Test-Path $script:statusFile)) {
        try {
            $currentStatus = Get-Content $script:statusFile -Raw | ConvertFrom-Json
            # Preserva last_scan se esiste e non è vuoto
            if ($currentStatus.last_scan -and $currentStatus.last_scan.ToString().Trim() -ne '') {
                $currentLastScan = $currentStatus.last_scan.ToString().Trim()
            }
        } catch {
            # Ignora errori lettura status corrente
        }
    }
    
    # Usa LastScan fornito o preserva quello corrente (mai null o vuoto se esisteva prima)
    $lastScanValue = if ($LastScan) { 
        $LastScan.ToString("yyyy-MM-dd HH:mm:ss") 
    } elseif ($currentLastScan) { 
        $currentLastScan 
    } else { 
        $null 
    }
    
    $statusData = @{
        status = $Status
        devices_found = $DevicesFound
        last_scan = $lastScanValue
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
    $foundIPs = [System.Collections.Generic.List[string]]::new()
    # Dizionario per tracciare MAC trovati (inclusi quelli da lookup diretto)
    $foundMACs = @{}
    
    # Ottieni IP locale del PC dove gira l'agent
    $localIP = $null
    $localIPOctet = $null
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
    
    # Carica tabella ARP una volta per tutte (più veloce di lookup singoli)
    $arpTable = @{}
    try {
        $arpEntries = Get-NetNeighbor -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Reachable" -or $_.State -eq "Stale" }
        foreach ($entry in $arpEntries) {
            if ($entry.IPAddress -and $entry.LinkLayerAddress) {
                $arpTable[$entry.IPAddress] = $entry.LinkLayerAddress
            }
        }
    } catch {
        # Fallback: arp.exe
        try {
            $arpOutput = arp -a 2>$null
            $arpOutput | ForEach-Object {
                if ($_ -match '^\s*(\d+\.\d+\.\d+\.\d+)\s+([0-9A-F]{2}[:-][0-9A-F]{2}[:-][0-9A-F]{2}[:-][0-9A-F]{2}[:-][0-9A-F]{2}[:-][0-9A-F]{2})') {
                    $arpTable[$matches[1]] = $matches[2]
                }
            }
        } catch {
            # Ignora errori
        }
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
                
                # Scansiona IP range (ottimizzato con parallelizzazione)
                $maxIP = [Math]::Min(254, $endIP)
                $ipListToScan = @()
                
                # Prepara lista IP da scansionare (escludendo IP locale)
                for ($i = 1; $i -le $maxIP; $i++) {
                    $ip = "$baseIP.$i"
                    
                    # Se è l'IP locale, aggiungilo sempre (anche se il ping fallisce)
                    if ($localIPInRange -and $i -eq $localIPOctet) {
                        Write-Log "Aggiungendo IP locale: $ip" "DEBUG"
                        
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
                        
                        # Salva MAC trovato per uso successivo
                        if ($macAddress) {
                            $foundMACs[$ip] = $macAddress
                        }
                        
                        $devices += $device
                        $foundIPs.Add($ip)
                    } else {
                        $ipListToScan += $ip
                    }
                }
                
                # Parallelizza scansione IP usando RunspacePool (molto più veloce)
                if ($ipListToScan.Count -gt 0) {
                    $runspacePool = [runspacefactory]::CreateRunspacePool(1, 100)
                    $runspacePool.Open()
                    $jobs = New-Object System.Collections.ArrayList
                    
                    # ScriptBlock per ping parallelo
                    $pingScriptBlock = {
                        param($targetIP, $timeoutMs)
                        
                        $ping = $null
                        try {
                            $ping = New-Object System.Net.NetworkInformation.Ping
                            $reply = $ping.Send($targetIP, $timeoutMs)
                            if ($reply.Status -eq 'Success') {
                                return $targetIP
                            }
                        } catch {
                            # Ignora errori ping
                        } finally {
                            if ($ping) {
                                $ping.Dispose()
                            }
                        }
                        return $null
                    }
                    
                    # Avvia ping paralleli
                    foreach ($ip in $ipListToScan) {
                        $job = [powershell]::Create().AddScript($pingScriptBlock).AddArgument($ip).AddArgument(150)
                        $job.RunspacePool = $runspacePool
                        $asyncResult = $job.BeginInvoke()
                        [void]$jobs.Add(@{
                            Job = $job
                            AsyncResult = $asyncResult
                            IP = $ip
                        })
                    }
                    
                    # Raccogli risultati
                    $activeIPs = New-Object System.Collections.ArrayList
                    foreach ($jobInfo in $jobs) {
                        try {
                            $resultIP = $jobInfo.Job.EndInvoke($jobInfo.AsyncResult)
                            if ($resultIP) {
                                [void]$activeIPs.Add($resultIP)
                            }
                        } catch {
                            # Ignora errori
                        } finally {
                            $jobInfo.Job.Dispose()
                        }
                    }
                    
                    $runspacePool.Close()
                    $runspacePool.Dispose()
                    
                    # Processa IP attivi trovati
                    foreach ($ip in $activeIPs) {
                        Write-Log "Dispositivo rilevato: $ip" "DEBUG"
                        $foundIPs.Add($ip)
                        
                        # Ottieni MAC address dalla tabella ARP pre-caricata
                        $macAddress = $null
                        if ($arpTable.ContainsKey($ip)) {
                            $macFromTable = $arpTable[$ip]
                            # Verifica che non sia un MAC invalido (tutti zeri o formato errato)
                            if ($macFromTable -and 
                                $macFromTable -notmatch '^00-00-00-00-00-00' -and 
                                $macFromTable -ne '00:00:00:00:00:00' -and
                                $macFromTable -match '^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$') {
                                $macAddress = $macFromTable
                                Write-Log "MAC trovato per $ip dalla tabella ARP: $macAddress" "DEBUG"
                            } else {
                                Write-Log "MAC invalido per $ip nella tabella ARP: $macFromTable" "DEBUG"
                            }
                        }
                        
                        # Se MAC non trovato nella tabella ARP pre-caricata, prova ARP lookup diretto
                        # (alcuni dispositivi non appaiono nella tabella ARP globale ma rispondono al ping)
                        if (-not $macAddress) {
                            # Advanced IP Scanner usa tecniche avanzate per trovare MAC
                            # Proviamo multiple strategie: ping multipli, WMI, SendARP API
                            
                            # Primo tentativo: ping multipli per forzare ARP
                            try {
                                $ping = New-Object System.Net.NetworkInformation.Ping
                                # Fai 3-4 ping per assicurarti che ARP venga aggiornato
                                for ($pingAttempt = 1; $pingAttempt -le 4; $pingAttempt++) {
                                    $pingReply = $ping.Send($ip, 300)  # Timeout più lungo
                                    if ($pingReply.Status -eq 'Success') {
                                        Start-Sleep -Milliseconds 200  # Attesa tra ping
                                    }
                                }
                                $ping.Dispose()
                                # Attesa più lunga per permettere al sistema di aggiornare la tabella ARP
                                Start-Sleep -Milliseconds 500
                            } catch {
                                # Ignora errori ping
                            }
                            
                            # Prova SendARP API direttamente (come Advanced IP Scanner) - PRIMA di tutto
                            if (-not $macAddress) {
                                try {
                                    $macFromSendArp = [ArpHelper]::GetMacAddress($ip)
                                    if ($macFromSendArp -and 
                                        $macFromSendArp -notmatch '^00-00-00-00-00-00' -and
                                        $macFromSendArp -match '^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$') {
                                        $macAddress = $macFromSendArp
                                        Write-Log "MAC trovato per $ip tramite SendARP API: $macAddress" "DEBUG"
                                    }
                                } catch {
                                    # Ignora errori
                                }
                            }
                            
                            # Prova WMI Win32_PingStatus (a volte più affidabile)
                            if (-not $macAddress) {
                                try {
                                    $pingStatus = Get-WmiObject -Class Win32_PingStatus -Filter "Address='$ip'" -ErrorAction SilentlyContinue | Select-Object -First 1
                                    if ($pingStatus -and $pingStatus.StatusCode -eq 0) {
                                        Start-Sleep -Milliseconds 300
                                        # Dopo WMI ping, riprova SendARP
                                        try {
                                            $macFromSendArp = [ArpHelper]::GetMacAddress($ip)
                                            if ($macFromSendArp -and 
                                                $macFromSendArp -notmatch '^00-00-00-00-00-00' -and
                                                $macFromSendArp -match '^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$') {
                                                $macAddress = $macFromSendArp
                                                Write-Log "MAC trovato per $ip tramite SendARP dopo WMI ping: $macAddress" "DEBUG"
                                            }
                                        } catch {
                                            # Ignora errori
                                        }
                                    }
                                } catch {
                                    # Ignora errori
                                }
                            }
                            
                            # Prova Get-NetNeighbor (include tutti gli stati possibili)
                            try {
                                $arpEntry = Get-NetNeighbor -IPAddress $ip -ErrorAction SilentlyContinue | Select-Object -First 1
                                if ($arpEntry -and $arpEntry.LinkLayerAddress) {
                                    $macFromNeighbor = $arpEntry.LinkLayerAddress
                                    # Verifica che non sia un MAC invalido
                                    if ($macFromNeighbor -notmatch '^00-00-00-00-00-00' -and 
                                        $macFromNeighbor -ne '00:00:00:00:00:00' -and
                                        $macFromNeighbor -match '^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$') {
                                        $macAddress = $macFromNeighbor
                                        Write-Log "MAC trovato per $ip tramite Get-NetNeighbor: $macAddress" "DEBUG"
                                    }
                                }
                            } catch {
                                # Ignora errori
                            }
                            
                            # Se ancora non trovato, prova arp.exe (legge tutta la tabella ARP)
                            if (-not $macAddress) {
                                try {
                                    # arp -a mostra tutta la tabella ARP, cerca l'IP specifico
                                    $arpOutput = arp -a 2>$null
                                    # Cerca pattern più specifico per l'IP (multiline)
                                    if ($arpOutput -match "(?m)^\s*$([regex]::Escape($ip))\s+([0-9A-F]{2}[:-][0-9A-F]{2}[:-][0-9A-F]{2}[:-][0-9A-F]{2}[:-][0-9A-F]{2}[:-][0-9A-F]{2})") {
                                        $macFromArp = $matches[2]
                                        # Verifica che non sia un MAC invalido
                                        if ($macFromArp -notmatch '^00-00-00-00-00-00' -and 
                                            $macFromArp -ne '00:00:00:00:00:00' -and
                                            $macFromArp -match '^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$') {
                                            $macAddress = $macFromArp
                                            Write-Log "MAC trovato per $ip tramite arp -a: $macAddress" "DEBUG"
                                        }
                                    }
                                } catch {
                                    # Ignora errori
                                }
                            }
                            
                            # Secondo tentativo: ricarica Get-NetNeighbor dopo attesa più lunga
                            if (-not $macAddress) {
                                Start-Sleep -Milliseconds 800
                                try {
                                    # Prova con tutti gli stati possibili (incluso Unreachable se ha MAC valido)
                                    $arpEntries = Get-NetNeighbor -IPAddress $ip -ErrorAction SilentlyContinue
                                    foreach ($arpEntry in $arpEntries) {
                                        if ($arpEntry.LinkLayerAddress) {
                                            $macFromNeighbor = $arpEntry.LinkLayerAddress
                                            if ($macFromNeighbor -notmatch '^00-00-00-00-00-00' -and 
                                                $macFromNeighbor -ne '00:00:00:00:00:00' -and
                                                $macFromNeighbor -match '^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$') {
                                                $macAddress = $macFromNeighbor
                                                Write-Log "MAC trovato per $ip al secondo tentativo (stato: $($arpEntry.State)): $macAddress" "DEBUG"
                                                break
                                            }
                                        }
                                    }
                                } catch {
                                    # Ignora errori
                                }
                            }
                            
                            # Terzo tentativo: ricarica tutta la tabella ARP e cerca di nuovo
                            if (-not $macAddress) {
                                Start-Sleep -Milliseconds 500
                                try {
                                    # Ricarica tabella ARP completa con tutti gli stati
                                    $arpEntries = Get-NetNeighbor -ErrorAction SilentlyContinue | Where-Object { 
                                        $_.IPAddress -eq $ip
                                    }
                                    foreach ($arpEntry in $arpEntries) {
                                        if ($arpEntry.LinkLayerAddress) {
                                            $macFromNeighbor = $arpEntry.LinkLayerAddress
                                            if ($macFromNeighbor -notmatch '^00-00-00-00-00-00' -and 
                                                $macFromNeighbor -ne '00:00:00:00:00:00' -and
                                                $macFromNeighbor -match '^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$') {
                                                $macAddress = $macFromNeighbor
                                                Write-Log "MAC trovato per $ip al terzo tentativo (ricarica ARP, stato: $($arpEntry.State)): $macAddress" "DEBUG"
                                                break
                                            }
                                        }
                                    }
                                } catch {
                                    # Ignora errori
                                }
                            }
                        }
                        
                        # Prova risoluzione hostname (opzionale, può essere lento - la saltiamo per velocità)
                        $hostname = $null
                        # Commentato per velocità - può essere riattivato se necessario
                        # try {
                        #     $dnsResult = Resolve-DnsName -Name $ip -ErrorAction SilentlyContinue -TimeoutSec 1
                        #     if ($dnsResult) {
                        #         $hostname = $dnsResult.NameHost
                        #     }
                        # } catch { }
                        
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
                        
                        # Salva MAC trovato per uso successivo
                        if ($macAddress) {
                            $foundMACs[$ip] = $macAddress
                        }
                        
                        $devices += $device
                    }
                }
                
                # Salva IP trovati con MAC in batch (una sola volta invece che per ogni IP)
                try {
                    $ipDataArray = @()
                    # Ordina IP numericamente invece che alfabeticamente
                    $sortedIPs = $foundIPs | Sort-Object -Unique | Sort-Object {
                        $parts = $_ -split '\.'
                        [int]$parts[0] * 16777216 + [int]$parts[1] * 65536 + [int]$parts[2] * 256 + [int]$parts[3]
                    }
                    foreach ($ip in $sortedIPs) {
                        # Usa MAC trovato durante scansione (da lookup diretto) o dalla tabella ARP iniziale
                        $macAddress = $null
                        if ($foundMACs.ContainsKey($ip)) {
                            $macAddress = $foundMACs[$ip]
                        } elseif ($arpTable.ContainsKey($ip)) {
                            $macAddress = $arpTable[$ip]
                            # Verifica che non sia un MAC invalido
                            if ($macAddress -match '^00-00-00-00-00-00' -or $macAddress -eq '00:00:00:00:00:00') {
                                $macAddress = $null
                            }
                        }
                        $ipDataArray += @{
                            ip = $ip
                            mac = $macAddress
                        }
                    }
                    $ipDataArray | ConvertTo-Json -Compress | Out-File -FilePath $script:currentScanIPsFile -Encoding UTF8 -Force
                } catch {
                    # Ignora errori salvataggio IP per tray icon
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
        
        # Controlla se c'è una richiesta di scansione forzata
        $forceScan = $false
        if (Test-Path $script:forceScanTriggerFile) {
            Write-Log "Richiesta scansione forzata rilevata..."
            $forceScan = $true
            # Elimina il file trigger dopo averlo letto
            try {
                Remove-Item $script:forceScanTriggerFile -Force -ErrorAction SilentlyContinue
            } catch {
                # Ignora errori eliminazione file
            }
        }
        
        # Controlla se è il momento di eseguire una scansione (programmata o forzata)
        if ($now -ge $nextScanTime -or $forceScan) {
            if ($forceScan) {
                Write-Log "Esecuzione scansione FORZATA..."
            } else {
                Write-Log "Esecuzione scansione programmata..."
            }
            Update-StatusFile -Status "scanning" -Message "Scansione in corso..."
            
            # Reset lista IP trovati per la tray icon
            try {
                @() | ConvertTo-Json -Compress | Out-File -FilePath $script:currentScanIPsFile -Encoding UTF8 -Force
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
                
                # 4. Ricalcola prossima scansione basandosi sul nuovo last_scan
                # Questo è importante anche per scansioni forzate, così il conto alla rovescia riparte correttamente
                $nextScanTime = $script:lastScanTime.AddMinutes($script:scanIntervalMinutes)
                if ($forceScan) {
                    Write-Log "Scansione forzata completata. Prossima scansione programmata: $($nextScanTime.ToString('HH:mm:ss')) (intervallo: $script:scanIntervalMinutes minuti)"
                } else {
                    Write-Log "Prossima scansione: $($nextScanTime.ToString('HH:mm:ss')) (intervallo: $script:scanIntervalMinutes minuti)"
                }
                
            } catch {
                Write-Log "Errore durante scansione: $_" "ERROR"
                Write-Log "Stack trace: $($_.Exception.StackTrace)" "ERROR"
                Update-StatusFile -Status "error" -Message "Errore: $_"
                
                # Anche in caso di errore, ricalcola nextScanTime per evitare loop infiniti
                if ($forceScan) {
                    # Per scansione forzata fallita, ricalcola comunque basandosi su ora
                    $nextScanTime = (Get-Date).AddMinutes($script:scanIntervalMinutes)
                } else {
                    # Per scansione programmata fallita, ricalcola normalmente
                    $nextScanTime = (Get-Date).AddMinutes($script:scanIntervalMinutes)
                }
            }
        }
        
        # Dormi per 5 secondi prima di controllare di nuovo (ridotto da 30 per reattività migliore)
        # Questo permette di rilevare scansioni forzate più rapidamente
        Start-Sleep -Seconds 5
        
    } catch {
        Write-Log "Errore nel loop principale: $_" "ERROR"
        Start-Sleep -Seconds 60
    }
}

Write-Log "=== Network Monitor Service Arrestato ==="
Update-StatusFile -Status "stopping" -Message "Servizio in arresto"
