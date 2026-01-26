# NetworkMonitorService.ps1
# Servizio Windows permanente per Network Monitor Agent
# Rimane sempre attivo e esegue scansioni periodicamente
# Gestisce tutto internamente senza dipendere da Scheduled Task
# Nota: Questo script viene eseguito SOLO come servizio Windows (senza GUI)
# Per la GUI tray icon, usare NetworkMonitorTrayIcon.ps1
#
# Versione: 2.6.1
# Data ultima modifica: 2026-01-25

param(
    [string]$ConfigPath = "config.json"
)

# Versione dell'agent (usata se non specificata nel config.json)
$SCRIPT_VERSION = "2.6.1"

# Forza TLS 1.2 per Invoke-RestMethod (evita "Impossibile creare un canale sicuro SSL/TLS")
function Enable-Tls12 {
    try {
        [Net.ServicePointManager]::SecurityProtocol = `
        ([Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls)
    }
    catch {
        try {
            [Net.ServicePointManager]::SecurityProtocol = 192 -bor 768 -bor 3072
        }
        catch { }
    }
}
Enable-Tls12

# Bootstrap log: se il servizio crasha subito (prima di Write-Log), almeno qui troviamo l'errore.
$script:bootstrapLogDir = "C:\ProgramData\NetworkMonitorAgent"
try {
    if (-not (Test-Path $script:bootstrapLogDir)) {
        New-Item -ItemType Directory -Path $script:bootstrapLogDir -Force | Out-Null
    }
}
catch { }
$script:bootstrapLogPath = Join-Path $script:bootstrapLogDir "NetworkMonitorService_bootstrap.log"
function Write-BootstrapLog {
    param([string]$Message)
    try {
        $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        "[$ts] $Message" | Out-File -FilePath $script:bootstrapLogPath -Append -Encoding UTF8
    }
    catch { }
}

$script:arpHelperAvailable = $false
Write-BootstrapLog "BOOT: avvio NetworkMonitorService.ps1 (v=$SCRIPT_VERSION, PS=$($PSVersionTable.PSVersion), PID=$PID, ConfigPath=$ConfigPath)"
try {
    # Aggiungi definizione API Windows per recupero MAC (come Advanced IP Scanner)
    Add-Type -TypeDefinition @"
using System;
using System.Net;
using System.Net.NetworkInformation;
using System.Runtime.InteropServices;
using System.Text;

public class ArpHelper {
    [DllImport("iphlpapi.dll", ExactSpelling = true)]
    public static extern int SendARP(uint destIP, uint srcIP, byte[] pMacAddr, ref uint phyAddrLen);
    
    [DllImport("iphlpapi.dll", SetLastError = true)]
    public static extern int GetIpNetTable(IntPtr pIpNetTable, ref int pdwSize, bool bOrder);
    
    public static string GetMacAddress(string ipAddress) {
        try {
            IPAddress ip = IPAddress.Parse(ipAddress);
            byte[] macAddr = new byte[6];
            uint macAddrLen = (uint)macAddr.Length;
            
            // PROVA 1: SendARP con network byte order (big endian)
            byte[] ipBytes = ip.GetAddressBytes();
            uint destIP = (uint)((ipBytes[0] << 24) | (ipBytes[1] << 16) | (ipBytes[2] << 8) | ipBytes[3]);
            
            int result = SendARP(destIP, 0, macAddr, ref macAddrLen);
            if (result == 0 && macAddrLen == 6) {
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
            
            // PROVA 2: SendARP con host byte order (little endian) - alcuni sistemi lo richiedono
            destIP = (uint)(ipBytes[0] | (ipBytes[1] << 8) | (ipBytes[2] << 16) | (ipBytes[3] << 24));
            macAddrLen = (uint)macAddr.Length;
            Array.Clear(macAddr, 0, macAddr.Length);
            
            result = SendARP(destIP, 0, macAddr, ref macAddrLen);
            if (result == 0 && macAddrLen == 6) {
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
    
    public static int GetMacAddressWithError(string ipAddress, out string macAddress) {
        macAddress = null;
        try {
            IPAddress ip = IPAddress.Parse(ipAddress);
            byte[] macAddr = new byte[6];
            uint macAddrLen = (uint)macAddr.Length;
            
            byte[] ipBytes = ip.GetAddressBytes();
            uint destIP = (uint)((ipBytes[0] << 24) | (ipBytes[1] << 16) | (ipBytes[2] << 8) | ipBytes[3]);
            
            int result = SendARP(destIP, 0, macAddr, ref macAddrLen);
            if (result == 0 && macAddrLen == 6) {
                bool allZero = true;
                foreach (byte b in macAddr) {
                    if (b != 0) {
                        allZero = false;
                        break;
                    }
                }
                if (!allZero) {
                    macAddress = string.Format("{0:X2}-{1:X2}-{2:X2}-{3:X2}-{4:X2}-{5:X2}",
                        macAddr[0], macAddr[1], macAddr[2], macAddr[3], macAddr[4], macAddr[5]);
                    return 0;
                }
            }
            return result; // Restituisce codice errore
        } catch {
            return -1;
        }
    }
}
"@
    $script:arpHelperAvailable = $true
}
catch {
    Write-BootstrapLog "WARN: Add-Type ArpHelper fallito: $($_.Exception.Message)"
    try { Write-BootstrapLog "Stack: $($_.Exception.StackTrace)" } catch { }
    # Non bloccare il servizio: useremo fallback (Get-NetNeighbor/arp.exe) dove possibile.
}

# Variabili globali
# Determina directory script (funziona anche come servizio)
# IMPORTANTE: Quando eseguito come servizio Windows, $MyInvocation.MyCommand.Path ├¿ null
# Usa prima $PSScriptRoot, poi percorso fisso come fallback
$script:scriptDir = $null
if ($PSScriptRoot) {
    $script:scriptDir = $PSScriptRoot
}
elseif ($MyInvocation.MyCommand.Path) {
    $script:scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path -ErrorAction SilentlyContinue
}
elseif ($ConfigPath) {
    $parent = Split-Path -Parent $ConfigPath
    if ($parent -and (Test-Path $parent -ErrorAction SilentlyContinue)) {
        $script:scriptDir = (Resolve-Path $parent -ErrorAction SilentlyContinue).Path
    }
}
if (-not $script:scriptDir) {
    # Fallback: usa directory di installazione standard (NSSM configura AppDirectory)
    $script:scriptDir = "C:\ProgramData\NetworkMonitorAgent"
    # Se anche questo non esiste, prova directory corrente
    if (-not (Test-Path $script:scriptDir)) {
        $script:scriptDir = Get-Location | Select-Object -ExpandProperty Path
    }
}

$script:isRunning = $true
$script:lastScanTime = $null
$script:lastScanDevices = 0
$script:scanIntervalMinutes = 15
$script:statusFile = Join-Path $script:scriptDir ".agent_status.json"
$script:lastScanPath = Join-Path $script:scriptDir "last_scan.json"
$script:currentScanIPsFile = Join-Path $script:scriptDir ".current_scan_ips.json"
# Variabili per tracciare problemi rete
$script:lastSuccessfulHeartbeat = $null
$script:failedHeartbeatCount = 0
$script:networkIssueStartTime = $null
$script:forceScanTriggerFile = Join-Path $script:scriptDir ".force_scan.trigger"
# Unifi: in memoria da /agent/config, mai su config.json o disco
$script:unifiConfig = $null
# Ultimo esito check Unifi (login+stat/device) in scansione, inviato al server in heartbeat
$script:lastUnifiOk = $null
$script:lastUnifiCheckAt = $null

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
            # Preserva last_scan se esiste e non ├¿ vuoto
            if ($currentStatus.last_scan -and $currentStatus.last_scan.ToString().Trim() -ne '') {
                $currentLastScan = $currentStatus.last_scan.ToString().Trim()
            }
        }
        catch {
            # Ignora errori lettura status corrente
        }
    }
    
    # Usa LastScan fornito o preserva quello corrente (mai null o vuoto se esisteva prima)
    $lastScanValue = if ($LastScan) { 
        $LastScan.ToString("yyyy-MM-dd HH:mm:ss") 
    }
    elseif ($currentLastScan) { 
        $currentLastScan 
    }
    else { 
        $null 
    }
    
    $statusData = @{
        status                = $Status
        devices_found         = $DevicesFound
        last_scan             = $lastScanValue
        message               = $Message
        updated_at            = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        scan_interval_minutes = $script:scanIntervalMinutes
    } | ConvertTo-Json
    
    try {
        $statusData | Out-File -FilePath $script:statusFile -Encoding UTF8 -Force
    }
    catch {
        # Ignora errori scrittura status
    }
}

# ============================================
# FUNZIONI NETWORK SCAN (da NetworkMonitor.ps1)
# ============================================

function Check-UnifiUpdates {
    param(
        $UnifiConfig
    )

    if (-not $UnifiConfig -or -not $UnifiConfig.url -or -not $UnifiConfig.username -or -not $UnifiConfig.password) {
        return @{}
    }

    $baseUrl = $UnifiConfig.url.TrimEnd('/')
    $username = $UnifiConfig.username
    $password = $UnifiConfig.password
    $upgrades = @{}

    Write-Log "Controllo aggiornamenti firmware Unifi (credenziali da server, mai su disco)..." "INFO"

    try {
        # Ignora errori certificato self-signed
        # Ignora errori certificato self-signed
        if (-not ("TrustAllCertsPolicy" -as [type])) {
            try {
                add-type -ErrorAction Stop @"
                    using System.Net;
                    using System.Security.Cryptography.X509Certificates;
                    public class TrustAllCertsPolicy : ICertificatePolicy {
                        public bool CheckValidationResult(
                            ServicePoint srvPoint, X509Certificate certificate,
                            WebRequest request, int certificateProblem) {
                            return true;
                        }
                    }
"@
            }
            catch { Write-Log "Add-Type TrustAllCertsPolicy error (Check-UnifiUpdates): $_" "WARN" }
        }
        [System.Net.ServicePointManager]::CertificatePolicy = New-Object TrustAllCertsPolicy

        # Sessione Web per mantenere i cookie
        $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

        # 1. Login
        $loginUrl = "$baseUrl/api/auth/login"
        $loginBody = @{ username = $username; password = $password } | ConvertTo-Json
        
        try {
            $loginRes = Invoke-WebRequest -Uri $loginUrl -Method Post -Body $loginBody -ContentType "application/json" -WebSession $session -UseBasicParsing -ErrorAction Stop
        }
        catch {
            if ($_.Exception.Response.StatusCode -eq "NotFound") {
                # Fallback per controller vecchi
                $loginUrl = "$baseUrl/api/login"
                $loginRes = Invoke-WebRequest -Uri $loginUrl -Method Post -Body $loginBody -ContentType "application/json" -WebSession $session -UseBasicParsing -ErrorAction Stop
            }
            else {
                Throw $_
            }
        }

        # 2. Recupera devices (site default)
        # Controller: /api/s/default/stat/device | UDM/UCG: /proxy/network/api/s/default/stat/device
        $devicesRes = $null
        try {
            $devicesRes = Invoke-RestMethod -Uri "$baseUrl/api/s/default/stat/device" -Method Get -WebSession $session -ErrorAction Stop
        }
        catch {
            try {
                $devicesRes = Invoke-RestMethod -Uri "$baseUrl/proxy/network/api/s/default/stat/device" -Method Get -WebSession $session -ErrorAction Stop
            }
            catch {
                Write-Log "Unifi stat/device fallito (prova /api e /proxy/network): $_" "WARN"
            }
        }
        if ($devicesRes -and $devicesRes.data) {
            foreach ($dev in $devicesRes.data) {
                $isUpgradable = ($dev.upgradable -eq $true) -or ($dev.need_upgrade -eq $true)
                if ($dev.mac -and $isUpgradable) {
                    $mac = $dev.mac.ToUpper().Replace(':', '-')
                    $upgrades[$mac] = $true
                }
            }
        }
        Write-Log "Unifi: trovati $($upgrades.Count) dispositivi aggiornabili" "INFO"

        # 3. Recupera clients attivi (stat/sta) per arricchimento nomi
        $clientsRes = $null
        $clientNames = @{}
        try {
            $clientsRes = Invoke-RestMethod -Uri "$baseUrl/api/s/default/stat/sta" -Method Get -WebSession $session -ErrorAction Stop
        }
        catch {
            try {
                $clientsRes = Invoke-RestMethod -Uri "$baseUrl/proxy/network/api/s/default/stat/sta" -Method Get -WebSession $session -ErrorAction Stop
            }
            catch {
                Write-Log "Unifi stat/sta fallito: $_" "WARN"
            }
        }

        if ($clientsRes -and $clientsRes.data) {
            foreach ($cli in $clientsRes.data) {
                if ($cli.mac) {
                    $mac = $cli.mac.ToUpper().Replace(':', '-')
                    # Preferisci 'name' (alias utente), fallback su 'hostname'
                    $n = if ($cli.name) { $cli.name } elseif ($cli.hostname) { $cli.hostname } else { $null }
                    if ($n) {
                        $clientNames[$mac] = $n
                    }
                }
            }
        }
        Write-Log "Unifi: trovati $($clientNames.Count) nomi client per arricchimento" "INFO"

        $script:lastUnifiOk = $true
        $script:lastUnifiCheckAt = (Get-Date).ToString("o")
        
        return @{ Upgrades = $upgrades; Names = $clientNames }
    }
    catch {
        Write-Log "Errore integrazione Unifi: $_" "WARN"
        $script:lastUnifiOk = $false
        $script:lastUnifiCheckAt = (Get-Date).ToString("o")
        return @{ Upgrades = @{}; Names = @{} }
    }
}

# Esegue un test di connessione Unifi (login + stat/device) e invia l'esito al server (per "Prova connessione" da interfaccia)
function Invoke-UnifiConnectionTestAndReport {
    param(
        [string]$TestId,
        [string]$Url,
        [string]$Username,
        [string]$Password,
        [string]$ServerUrl,
        [string]$ApiKey
    )
    $ok = $false
    $msg = ""
    try {
        $base = ($Url -as [string]).Trim().TrimEnd('/')
        if (-not $base) { $msg = "URL non valido"; throw $msg }
        if (-not ("TrustAllCertsPolicy" -as [type])) {
            try {
                add-type -ErrorAction Stop @"
                using System.Net; using System.Security.Cryptography.X509Certificates;
                public class TrustAllCertsPolicy : ICertificatePolicy {
                    public bool CheckValidationResult(ServicePoint s, X509Certificate c, WebRequest r, int p) { return true; }
                }
"@
            }
            catch { Write-Log "Add-Type TrustAllCertsPolicy error: $_" "WARN" }
        }
        [System.Net.ServicePointManager]::CertificatePolicy = New-Object TrustAllCertsPolicy
        $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
        $loginBody = @{ username = $Username; password = $Password } | ConvertTo-Json
        try {
            Invoke-WebRequest -Uri "$base/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -WebSession $session -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop | Out-Null
        }
        catch {
            if ($_.Exception.Response.StatusCode -eq "NotFound") {
                Invoke-WebRequest -Uri "$base/api/login" -Method Post -Body $loginBody -ContentType "application/json" -WebSession $session -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop | Out-Null
            }
            else { throw }
        }
        $dev = $null
        try {
            $dev = Invoke-RestMethod -Uri "$base/api/s/default/stat/device" -Method Get -WebSession $session -TimeoutSec 15 -ErrorAction Stop
        }
        catch {
            $dev = Invoke-RestMethod -Uri "$base/proxy/network/api/s/default/stat/device" -Method Get -WebSession $session -TimeoutSec 15 -ErrorAction Stop
        }
        $ok = $true
        $msg = "Connessione OK"
    }
    catch {
        $ok = $false
        $msg = if ($_.Exception.Message) { $_.Exception.Message } else { "Errore connessione" }
        Write-Log "Test Unifi (Prova connessione): $msg" "WARN"
    }
    $resultUrl = "$ServerUrl/api/network-monitoring/agent/unifi-test-result"
    $body = @{ test_id = $TestId; success = $ok; message = $msg } | ConvertTo-Json
    $h = @{ "Content-Type" = "application/json"; "X-API-Key" = $ApiKey }
    try {
        Invoke-RestMethod -Uri $resultUrl -Method POST -Headers $h -Body $body -TimeoutSec 10 -ErrorAction Stop | Out-Null
        Write-Log "Esito test Unifi inviato: $(if($ok){'OK'}else{'Errore'})" "INFO"
    }
    catch {
        Write-Log "Invio esito test Unifi fallito: $_" "WARN"
    }
}

function Get-NetworkDevices {
    param(
        $NetworkRanges,
        $UnifiConfig = $null
    )
    
    $devices = @()
    $unifiData = @{ Upgrades = @{}; Names = @{} }

    # Se presente config Unifi, scarica info aggiornamenti e nomi
    if ($UnifiConfig) {
        $unifiData = Check-UnifiUpdates -UnifiConfig $UnifiConfig
    }
    $unifiUpgrades = $unifiData.Upgrades
    $unifiNames = $unifiData.Names

    # PS 4.0 non supporta ::new(), usa New-Object per compatibilit├á (Server 2012)
    $foundIPs = New-Object 'System.Collections.Generic.List[string]'
    # Dizionario per tracciare MAC trovati (inclusi quelli da lookup diretto)
    $foundMACs = @{}
    # Dizionario per tracciare dispositivi con ping intermittenti (ping falliti durante i 3 tentativi)
    $script:pingFailures = @{}
    
    # Ottieni IP locale del PC dove gira l'agent
    $localIP = $null
    $localIPOctet = $null
    $localMAC = $null
    $localHostname = $env:COMPUTERNAME
    try {
        $networkAdapters = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { 
            $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" 
        }
        if ($networkAdapters) {
            $localIP = $networkAdapters[0].IPAddress
            
            # Ottieni MAC address dell'interfaccia locale (IMPORTANTE: sempre incluso nei risultati)
            try {
                $localIPConfig = Get-NetIPAddress -AddressFamily IPv4 -IPAddress $localIP -ErrorAction SilentlyContinue
                if ($localIPConfig) {
                    $interfaceIndex = $localIPConfig.InterfaceIndex
                    $adapter = Get-NetAdapter -InterfaceIndex $interfaceIndex -ErrorAction SilentlyContinue
                    if ($adapter -and $adapter.MacAddress) {
                        $localMAC = $adapter.MacAddress
                        # Normalizza formato MAC (usa trattini)
                        $localMAC = $localMAC -replace ':', '-' -replace ' ', ''
                        $localMAC = $localMAC.ToUpper()
                        
                        # Verifica che sia un MAC valido
                        if (-not ($localMAC -match '^([0-9A-F]{2}-){5}[0-9A-F]{2}$')) {
                            $localMAC = $null
                        }
                        else {
                            Write-Log "MAC locale rilevato: $localMAC per IP $localIP" "DEBUG"
                            # Salva nel dizionario MAC trovati
                            $foundMACs[$localIP] = $localMAC
                        }
                    }
                }
                
                # Se non trovato con metodo diretto, prova a cercare tra tutte le interfacce attive
                if (-not $localMAC) {
                    $adapters = Get-NetAdapter -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq "Up" }
                    foreach ($adapter in $adapters) {
                        if ($adapter.MacAddress) {
                            $macNormalized = $adapter.MacAddress -replace '[:-]', '' -replace ' ', ''
                            # Preferisci interfacce fisiche (non virtuali)
                            if ($macNormalized -notmatch '^(005056|000C29|000569|080027|00155D)') {
                                $localMAC = $adapter.MacAddress
                                $localMAC = $localMAC -replace ':', '-' -replace ' ', ''
                                $localMAC = $localMAC.ToUpper()
                                if ($localMAC -match '^([0-9A-F]{2}-){5}[0-9A-F]{2}$') {
                                    Write-Log "MAC locale rilevato (interfaccia fisica): $localMAC" "DEBUG"
                                    $foundMACs[$localIP] = $localMAC
                                    break
                                }
                            }
                        }
                    }
                }
            }
            catch {
                Write-Log "Errore recupero MAC locale: $_" "WARN"
            }
        }
    }
    catch {
        Write-Log "Impossibile ottenere IP locale: $_" "WARN"
    }
    
    # Carica tabella ARP una volta per tutte (pi├╣ veloce di lookup singoli)
    $arpTable = @{}
    try {
        $arpEntries = Get-NetNeighbor -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Reachable" -or $_.State -eq "Stale" }
        foreach ($entry in $arpEntries) {
            if ($entry.IPAddress -and $entry.LinkLayerAddress) {
                $arpTable[$entry.IPAddress] = $entry.LinkLayerAddress
            }
        }
    }
    catch {
        # Fallback: arp.exe
        try {
            $arpOutput = arp -a 2>$null
            $arpOutput | ForEach-Object {
                if ($_ -match '^\s*(\d+\.\d+\.\d+\.\d+)\s+([0-9A-F]{2}[:-][0-9A-F]{2}[:-][0-9A-F]{2}[:-][0-9A-F]{2}[:-][0-9A-F]{2}[:-][0-9A-F]{2})') {
                    $arpTable[$matches[1]] = $matches[2]
                }
            }
        }
        catch {
            # Ignora errori
        }
    }
    
    # Normalizza a array di stringhe CIDR (supporta "192.168.1.0/24" e oggetti con .range)
    $rangesToScan = @()
    $raw = if ($NetworkRanges -is [Array]) { @($NetworkRanges) } else { @($NetworkRanges) }
    foreach ($r in $raw) {
        $s = if ($null -eq $r) { $null } elseif ($r -is [string]) { $r.Trim() } elseif ($r -and $r.range) { $r.range.ToString().Trim() } else { $null }
        if ($s -and -not [string]::IsNullOrWhiteSpace($s)) { $rangesToScan += $s }
    }
    if ($rangesToScan.Count -eq 0) {
        Write-Log "Get-NetworkDevices: nessun range valido. Verifica network_ranges in config.json." "WARN"
        return @()
    }

    foreach ($rangeStr in $rangesToScan) {
        Write-Log "Scansione range: $rangeStr" "INFO"
        
        # Estrai subnet e calcola range IP
        if ($rangeStr -match '^(\d+\.\d+\.\d+)\.(\d+)/(\d+)$') {
            $baseIP = $matches[1]
            $subnetMask = [int]$matches[3]
            
            # Calcola numero di host nella subnet
            $hostBits = 32 - $subnetMask
            $numHosts = [Math]::Pow(2, $hostBits) - 2  # -2 per network e broadcast
            
            # Per ora limitiamo a /24 (max 254 host) per performance
            if ($subnetMask -ge 24) {
                $startIP = if ($rangeStr -match '\.(\d+)/') { [int]$matches[1] } else { 1 }
                $endIP = if ($subnetMask -eq 24) { 254 } else { $numHosts }
                
                # Aggiungi sempre l'IP locale se ├¿ nel range configurato
                $localIPInRange = $false
                if ($localIP -and $localIP -like "$baseIP.*") {
                    $localIPInRange = $true
                    $localIPOctet = [int]($localIP -split '\.')[3]
                }
                
                # Scansiona IP range (ottimizzato con parallelizzazione)
                $maxIP = [Math]::Min(254, $endIP)
                $ipListToScan = @()
                
                # Prepara lista IP da scansionare (escludendo IP locale)
                for ($i = 1; $i -le $maxIP; $i++) {
                    $ip = "$baseIP.$i"
                    
                    # Se ├¿ l'IP locale, aggiungilo sempre (anche se il ping fallisce)
                    if ($localIPInRange -and $i -eq $localIPOctet) {
                        
                        # Ottieni MAC address locale
                        # IMPORTANTE: Preferisci interfacce fisiche rispetto a virtuali (VMware, VirtualBox, Hyper-V)
                        $macAddress = $null
                        try {
                            # Ottieni tutte le interfacce attive (con gestione errori robusta)
                            $adapters = $null
                            try {
                                $adapters = Get-NetAdapter -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq "Up" } | Sort-Object InterfaceDescription
                            }
                            catch {
                                Write-Log "Errore Get-NetAdapter: $_" "WARN"
                                # Fallback: usa Get-NetIPAddress per trovare l'interfaccia corretta
                                try {
                                    $localIPConfig = Get-NetIPAddress -AddressFamily IPv4 -IPAddress $ip -ErrorAction SilentlyContinue
                                    if ($localIPConfig) {
                                        $interfaceIndex = $localIPConfig.InterfaceIndex
                                        $adapter = Get-NetAdapter -InterfaceIndex $interfaceIndex -ErrorAction SilentlyContinue
                                        if ($adapter) {
                                            $adapters = @($adapter)
                                        }
                                    }
                                }
                                catch {
                                    Write-Log "Errore fallback Get-NetIPAddress: $_" "WARN"
                                }
                            }
                            
                            if ($adapters -and $adapters.Count -gt 0) {
                                # Filtra e preferisci interfacce fisiche
                                $physicalAdapter = $null
                                $virtualAdapter = $null
                                
                                foreach ($adapter in $adapters) {
                                    try {
                                        if (-not $adapter.MacAddress) { continue }
                                        
                                        $macNormalized = $adapter.MacAddress -replace '[:-]', '' -replace ' ', ''
                                        $isVirtual = $false
                                        
                                        # Verifica se ├¿ un MAC virtuale (prefissi OUI comuni)
                                        if ($macNormalized -match '^(005056|000C29|000569|080027|00155D)') {
                                            $isVirtual = $true
                                        }
                                        
                                        # Verifica anche dalla descrizione dell'interfaccia
                                        if ($adapter.InterfaceDescription) {
                                            $desc = $adapter.InterfaceDescription
                                            if ($desc -match 'VMware|VirtualBox|Hyper-V|Virtual|TAP|TUN') {
                                                $isVirtual = $true
                                            }
                                        }
                                        
                                        if ($isVirtual) {
                                            if (-not $virtualAdapter) {
                                                $virtualAdapter = $adapter
                                            }
                                        }
                                        else {
                                            if (-not $physicalAdapter) {
                                                $physicalAdapter = $adapter
                                            }
                                        }
                                    }
                                    catch {
                                        # Ignora errori su singolo adapter, continua con il prossimo
                                        continue
                                    }
                                }
                                
                                # Preferisci interfaccia fisica, altrimenti usa virtuale come fallback
                                $selectedAdapter = $physicalAdapter
                                if (-not $selectedAdapter) {
                                    $selectedAdapter = $virtualAdapter
                                }
                                
                                if ($selectedAdapter -and $selectedAdapter.MacAddress) {
                                    $macAddress = $selectedAdapter.MacAddress
                                    # Normalizza formato MAC (usa trattini)
                                    if ($macAddress) {
                                        # Rimuovi spazi e normalizza separatori
                                        $macAddress = $macAddress -replace ':', '-' -replace ' ', ''
                                        # Assicura formato maiuscolo
                                        $macAddress = $macAddress.ToUpper()
                                        
                                        # Verifica che sia un MAC valido
                                        if (-not ($macAddress -match '^([0-9A-F]{2}-){5}[0-9A-F]{2}$')) {
                                            Write-Log "MAC locale non valido: $macAddress" "WARN"
                                            $macAddress = $null
                                        }
                                    }
                                    
                                    if ($macAddress) {
                                        if ($physicalAdapter) {
                                            Write-Log "MAC locale (fisico) per ${ip}: ${macAddress}" "DEBUG"
                                        }
                                        else {
                                            Write-Log "MAC locale (virtuale) per ${ip}: ${macAddress}" "WARN"
                                        }
                                    }
                                }
                            }
                            else {
                                Write-Log "Nessuna interfaccia di rete attiva trovata per IP locale $ip" "WARN"
                            }
                        }
                        catch {
                            Write-Log "Errore recupero MAC locale: $_" "WARN"
                            Write-Log "Stack: $($_.Exception.StackTrace)" "WARN"
                            # Continua anche se c'├¿ un errore nel recupero MAC locale
                            $macAddress = $null
                        }
                        
                        # Ottieni hostname locale
                        $hostname = $env:COMPUTERNAME
                        $upgradeAvailable = $false
                        if ($macAddress -and $unifiUpgrades.Count -gt 0) { $mn = ($macAddress -replace ':', '-').ToUpper(); $upgradeAvailable = $unifiUpgrades.ContainsKey($mn) }
                        $device = @{
                            ip_address        = $ip
                            mac_address       = $macAddress
                            hostname          = $hostname
                            vendor            = $null
                            status            = "online"
                            has_ping_failures = $false
                            ping_responsive   = $true  # IP locale risponde sempre al ping
                            upgrade_available = $upgradeAvailable
                        }
                        
                        # Salva MAC trovato per uso successivo
                        if ($macAddress) {
                            $foundMACs[$ip] = $macAddress
                        }
                        
                        $devices += $device
                        $foundIPs.Add($ip)
                    }
                    else {
                        $ipListToScan += $ip
                    }
                }
                
                # Parallelizza scansione IP usando RunspacePool (molto pi├╣ veloce)
                if ($ipListToScan.Count -gt 0) {
                    $runspacePool = [runspacefactory]::CreateRunspacePool(1, 100)
                    $runspacePool.Open()
                    $jobs = New-Object System.Collections.ArrayList
                    
                    # ScriptBlock per DISCOVERY ibrida (Ping + TCP Port Fallback)
                    # Migliorato per rilevare dispositivi che bloccano ICMP (Ping) come PC Windows con Firewall
                    $discoveryScriptBlock = {
                        param($targetIP, $timeoutMs)
                        
                        $ping = $null
                        $successCount = 0
                        $failureCount = 0
                        $openPort = 0
                        
                        # --- FASE 1: PING (ICMP) ---
                        try {
                            $ping = New-Object System.Net.NetworkInformation.Ping
                            
                            # Fai tentativi di ping
                            for ($attempt = 1; $attempt -le 2; $attempt++) {
                                try {
                                    $reply = $ping.Send($targetIP, $timeoutMs)
                                    if ($reply.Status -eq 'Success') {
                                        $successCount++
                                        break # Se risponde, inutile insistere troppo
                                    }
                                    else {
                                        $failureCount++
                                    }
                                }
                                catch { $failureCount++ }
                                
                                if ($attempt -lt 2) { Start-Sleep -Milliseconds 50 }
                            }
                            
                            if ($successCount -gt 0) {
                                return @{
                                    ip                = $targetIP
                                    has_ping_failures = ($failureCount -gt 0)
                                    ping_responsive   = $true
                                    discovery_method  = "icmp"
                                }
                            }
                        }
                        catch {}
                        finally {
                            if ($ping) { $ping.Dispose() }
                        }
                        
                        # --- FASE 2: TCP PORT SCAN (FALLBACK) ---
                        # Se il ping fallisce, proviamo le porte pi├╣ comuni.
                        # Molti PC Windows bloccano il ping ma hanno la 445 (SMB) o 135 (RPC) aperta.
                        # Stampanti e Router hanno spesso la 80 o 443.
                        $portsToCheck = @(445, 135, 80, 443, 3389, 22) 
                        
                        foreach ($port in $portsToCheck) {
                            $tcp = $null
                            try {
                                $tcp = New-Object System.Net.Sockets.TcpClient
                                # Timeout molto breve (200ms) per non rallentare troppo
                                $connect = $tcp.BeginConnect($targetIP, $port, $null, $null)
                                if ($connect.AsyncWaitHandle.WaitOne(200, $false)) {
                                    try {
                                        $tcp.EndConnect($connect)
                                        $openPort = $port
                                        $tcp.Close()
                                        break # Trovata una porta aperta! Dispositivo online.
                                    }
                                    catch {}
                                }
                            }
                            catch {}
                            finally {
                                if ($tcp) { 
                                    $tcp.Dispose() 
                                }
                            }
                        }
                        
                        if ($openPort -gt 0) {
                            return @{
                                ip                = $targetIP
                                has_ping_failures = $true # Ping fallito
                                ping_responsive   = $false # Non risponde al ping (firewall)
                                discovery_method  = "tcp/$openPort"
                            }
                        }

                        return $null
                    }
                    
                    # Avvia discovery ibrida parallela
                    # Timeout aumentato a 300ms per gestire dispositivi con latenza maggiore o ping intermittenti
                    foreach ($ip in $ipListToScan) {
                        # PowerShell 4.0/5.0 compatibility: crea PowerShell tramite RunspacePool
                        try {
                            $job = [System.Management.Automation.PowerShell]::Create()
                            $job.RunspacePool = $runspacePool
                            $job.AddScript($discoveryScriptBlock).AddArgument($ip).AddArgument(300) | Out-Null
                            $asyncResult = $job.BeginInvoke()
                        }
                        catch {
                            # Fallback per PowerShell 4.0
                            try {
                                $runspace = $runspacePool.AcquireRunspace()
                                $job = [System.Management.Automation.PowerShell]::Create()
                                $job.Runspace = $runspace
                                $job.AddScript($discoveryScriptBlock).AddArgument($ip).AddArgument(300) | Out-Null
                                $asyncResult = $job.BeginInvoke()
                            }
                            catch {
                                Write-Log "Errore creazione PowerShell per ping $ip : $_" "WARN"
                                continue
                            }
                        }
                        [void]$jobs.Add(@{
                                Job         = $job
                                AsyncResult = $asyncResult
                                IP          = $ip
                            })
                    }
                    
                    # Raccogli risultati con timeout per evitare blocchi
                    # IMPORTANTE: Salva gli IP man mano che vengono trovati, cos├¼ appaiono in tempo reale nella tray icon
                    $activeIPs = New-Object System.Collections.ArrayList
                    $pingTimeout = 10  # Timeout 10 secondi per raccolta risultati ping
                    $pingStartTime = Get-Date
                    
                    Write-Log "Raccolta risultati scansione ibrida (Ping+TCP) per $($jobs.Count) job..." "INFO"
                    $jobIndex = 0
                    foreach ($jobInfo in $jobs) {
                        $jobIndex++
                        try {
                            # Verifica timeout totale
                            $elapsed = ((Get-Date) - $pingStartTime).TotalSeconds
                            if ($elapsed -gt $pingTimeout) {
                                Write-Log "Timeout raccolta ping raggiunto dopo $pingTimeout secondi, interrompendo job rimanenti..." "WARN"
                                # Interrompi tutti i job rimanenti
                                for ($i = $jobIndex; $i -lt $jobs.Count; $i++) {
                                    try {
                                        if ($jobs[$i].AsyncResult -and -not $jobs[$i].AsyncResult.IsCompleted) {
                                            $jobs[$i].Job.Stop()
                                        }
                                    }
                                    catch { }
                                }
                                break
                            }
                            
                            # Attendi risultato con timeout (3 secondi per job - aumentato per ping multipli)
                            if ($jobInfo.AsyncResult) {
                                $asyncWait = $jobInfo.AsyncResult.AsyncWaitHandle
                                # Timeout aumentato a 3 secondi per gestire ping multipli (3 tentativi)
                                if ($asyncWait -and $asyncWait.WaitOne(3000)) {
                                    try {
                                        $result = $jobInfo.Job.EndInvoke($jobInfo.AsyncResult)
                                        if ($result) {
                                            # Gestisci sia formato vecchio (stringa IP) che nuovo (oggetto con has_ping_failures)
                                            if ($result -is [string]) {
                                                [void]$activeIPs.Add($result)
                                            }
                                            elseif ($result -is [hashtable] -or $result -is [PSCustomObject]) {
                                                [void]$activeIPs.Add($result.ip)
                                                # Salva info ping failures per uso successivo
                                                if ($result.has_ping_failures) {
                                                    if (-not $script:pingFailures) {
                                                        $script:pingFailures = @{}
                                                    }
                                                    $script:pingFailures[$result.ip] = $true
                                                }
                                            }
                                            else {
                                                # Fallback: se ├¿ un oggetto con propriet├á ip
                                                $ipValue = if ($result.ip) { $result.ip } else { $result }
                                                if ($ipValue) {
                                                    [void]$activeIPs.Add($ipValue)
                                                    if ($result.has_ping_failures) {
                                                        if (-not $script:pingFailures) {
                                                            $script:pingFailures = @{}
                                                        }
                                                        $script:pingFailures[$ipValue] = $true
                                                    }
                                                }
                                            }
                                            
                                            # Salva SUBITO questo IP nella tray icon (aggiornamento in tempo reale)
                                            try {
                                                $currentIPs = @()
                                                if (Test-Path $script:currentScanIPsFile) {
                                                    $existingContent = Get-Content $script:currentScanIPsFile -Raw -ErrorAction SilentlyContinue
                                                    if ($existingContent -and $existingContent.Trim() -ne '[]' -and $existingContent.Trim() -ne '') {
                                                        try {
                                                            $existingData = $existingContent | ConvertFrom-Json
                                                            if ($existingData -is [System.Array]) {
                                                                foreach ($existingItem in $existingData) {
                                                                    if ($existingItem -is [PSCustomObject] -and $existingItem.ip) {
                                                                        $currentIPs += @{ ip = $existingItem.ip.ToString(); mac = if ($existingItem.mac) { $existingItem.mac.ToString() } else { $null } }
                                                                    }
                                                                }
                                                            }
                                                        }
                                                        catch { }
                                                    }
                                                }
                                                
                                                # Aggiungi il nuovo IP se non ├¿ gi├á presente
                                                $ipExists = $false
                                                foreach ($existingIP in $currentIPs) {
                                                    if ($existingIP.ip -eq $resultIP) {
                                                        $ipExists = $true
                                                        break
                                                    }
                                                }
                                                if (-not $ipExists) {
                                                    $currentIPs += @{ ip = $resultIP; mac = $null }
                                                    $currentIPs | ConvertTo-Json -Compress | Out-File -FilePath $script:currentScanIPsFile -Encoding UTF8 -Force
                                                }
                                            }
                                            catch {
                                                # Ignora errori salvataggio in tempo reale
                                            }
                                        }
                                    }
                                    catch {
                                        $ipStr = if ($jobInfo.IP) { $jobInfo.IP } else { "sconosciuto" }
                                        Write-Log "Errore EndInvoke ping per $ipStr : $_" "WARN"
                                    }
                                }
                                else {
                                    $ipStr = if ($jobInfo.IP) { $jobInfo.IP } else { "sconosciuto" }
                                    Write-Log "Timeout ping per $ipStr , continuo..." "WARN"
                                    try {
                                        $jobInfo.Job.Stop()
                                    }
                                    catch { }
                                }
                            }
                            else {
                                Write-Log "AsyncResult nullo per job $jobIndex, salto..." "WARN"
                            }
                        }
                        catch {
                            $ipStr = if ($jobInfo.IP) { $jobInfo.IP } else { "sconosciuto" }
                            Write-Log "Errore raccolta ping per $ipStr : $_" "WARN"
                        }
                        finally {
                            try {
                                if ($jobInfo.Job) {
                                    $jobInfo.Job.Dispose()
                                }
                            }
                            catch { }
                        }
                    }
                    
                    Write-Log "Raccolta ping completata: $($activeIPs.Count) IP attivi trovati su $($jobs.Count) job processati" "INFO"
                    
                    try {
                        $runspacePool.Close()
                        $runspacePool.Dispose()
                    }
                    catch {
                        Write-Log "Errore chiusura runspace pool ping: $_" "WARN"
                    }
                    
                    
                    # Salva SUBITO gli IP trovati (senza MAC) per la tray icon, cos├¼ appaiono durante la scansione
                    # IMPORTANTE: Questo deve essere fatto PRIMA del recupero MAC, cos├¼ gli IP appaiono subito
                    try {
                        $tempIPArray = @()
                        foreach ($ip in $activeIPs) {
                            $tempIPArray += @{ ip = $ip; mac = $null }
                        }
                        $tempIPArray | ConvertTo-Json -Compress | Out-File -FilePath $script:currentScanIPsFile -Encoding UTF8 -Force
                        Write-Log "IP trovati salvati SUBITO per tray icon: $($tempIPArray.Count) IP" "INFO"
                    }
                    catch {
                        Write-Log "Errore salvataggio IP temporanei: $_" "ERROR"
                    }
                    
                    # Processa IP attivi trovati - PARALLELIZZATO per recupero MAC
                    if ($activeIPs.Count -gt 0) {
                    }
                    else {
                    }
                    
                    # Se non ci sono IP attivi, salta il recupero MAC
                    if ($activeIPs.Count -eq 0) {
                    }
                    else {
                        # Crea RunspacePool per recupero MAC parallelo
                        try {
                            $macRunspacePool = [runspacefactory]::CreateRunspacePool(1, [Math]::Min(20, $activeIPs.Count))
                            $macRunspacePool.Open()
                            $macJobs = New-Object System.Collections.ArrayList
                    
                            # ScriptBlock per recupero MAC parallelo
                            $macRecoveryScriptBlock = {
                                param($targetIP, $arpTableData)
                        
                                # Ricrea ArpHelper nel runspace (necessario per SendARP)
                                try {
                                    Add-Type -TypeDefinition @"
using System;
using System.Net;
using System.Net.NetworkInformation;
using System.Runtime.InteropServices;
using System.Text;

public class ArpHelper {
    [DllImport("iphlpapi.dll", ExactSpelling = true)]
    public static extern int SendARP(uint destIP, uint srcIP, byte[] pMacAddr, ref uint phyAddrLen);
    
    public static string GetMacAddress(string ipAddress) {
        try {
            IPAddress ip = IPAddress.Parse(ipAddress);
            byte[] macAddr = new byte[6];
            uint macAddrLen = (uint)macAddr.Length;
            
            byte[] ipBytes = ip.GetAddressBytes();
            uint destIP = (uint)((ipBytes[0] << 24) | (ipBytes[1] << 16) | (ipBytes[2] << 8) | ipBytes[3]);
            
            int result = SendARP(destIP, 0, macAddr, ref macAddrLen);
            if (result == 0 && macAddrLen == 6) {
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
            
            // Prova little endian
            destIP = (uint)(ipBytes[0] | (ipBytes[1] << 8) | (ipBytes[2] << 16) | (ipBytes[3] << 24));
            macAddrLen = (uint)macAddr.Length;
            Array.Clear(macAddr, 0, macAddr.Length);
            
            result = SendARP(destIP, 0, macAddr, ref macAddrLen);
            if (result == 0 && macAddrLen == 6) {
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
                                }
                                catch { }
                        
                                $macAddress = $null
                        
                                # PRIORIT├Ç 1: Tabella ARP pre-caricata (pi├╣ affidabile di SendARP diretto)
                                # Get-NetNeighbor ├¿ pi├╣ accurato perch├® legge direttamente dalla cache ARP aggiornata
                                if ($arpTableData -and $arpTableData.ContainsKey($targetIP)) {
                                    $macFromTable = $arpTableData[$targetIP]
                                    if ($macFromTable -and 
                                        $macFromTable -notmatch '^00-00-00-00-00-00' -and 
                                        $macFromTable -ne '00:00:00:00:00:00' -and
                                        $macFromTable -match '^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$') {
                                        $macAddress = $macFromTable
                                        return @{ ip = $targetIP; mac = $macAddress }
                                    }
                                }
                        
                                # PRIORIT├Ç 2: Get-NetNeighbor diretto (pi├╣ affidabile di SendARP)
                                # Questo legge direttamente dalla cache ARP di Windows, pi├╣ accurato
                                # IMPORTANTE: Filtra MAC virtuali (VMware, VirtualBox, Hyper-V) e preferisci interfacce fisiche
                                try {
                                    $arpEntries = Get-NetNeighbor -IPAddress $targetIP -ErrorAction SilentlyContinue
                                    $physicalMacs = @()
                                    $virtualMacs = @()
                            
                                    foreach ($arpEntry in $arpEntries) {
                                        if ($arpEntry.LinkLayerAddress) {
                                            $macFromNeighbor = $arpEntry.LinkLayerAddress
                                            # Normalizza formato MAC per confronto
                                            $macNormalized = $macFromNeighbor -replace '[:-]', '' -replace ' ', ''
                                    
                                            # Verifica che sia un MAC valido
                                            if ($macFromNeighbor -notmatch '^00-00-00-00-00-00' -and 
                                                $macFromNeighbor -ne '00:00:00:00:00:00' -and
                                                $macFromNeighbor -match '^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$') {
                                        
                                                # Filtra MAC virtuali (prefissi OUI comuni)
                                                # VMware: 00:50:56, 00:0C:29, 00:05:69
                                                # VirtualBox: 08:00:27
                                                # Hyper-V: 00:15:5D
                                                $isVirtual = $false
                                                if ($macNormalized -match '^(005056|000C29|000569|080027|00155D)') {
                                                    $isVirtual = $true
                                                }
                                        
                                                if ($isVirtual) {
                                                    $virtualMacs += $macFromNeighbor
                                                }
                                                else {
                                                    $physicalMacs += $macFromNeighbor
                                                }
                                            }
                                        }
                                    }
                            
                                    # Preferisci MAC fisici rispetto a virtuali
                                    if ($physicalMacs.Count -gt 0) {
                                        return @{ ip = $targetIP; mac = $physicalMacs[0] }
                                    }
                                    elseif ($virtualMacs.Count -gt 0) {
                                        # Se ci sono solo MAC virtuali, usa il primo (meglio di niente)
                                        return @{ ip = $targetIP; mac = $virtualMacs[0] }
                                    }
                                }
                                catch { }
                        
                                # PRIORIT├Ç 3: Ping multipli per forzare ARP + Get-NetNeighbor (come Advanced IP Scanner)
                                # IMPORTANTE: Advanced IP Scanner fa SEMPRE ping prima di leggere MAC
                                # Questo aggiorna la cache ARP e garantisce MAC corretti
                                # CRITICO: Deve essere fatto SEMPRE, anche se la tabella ARP ha gi├á il MAC
                                # perch├® potrebbe essere vecchio o riferirsi all'interfaccia sbagliata
                                try {
                                    $ping = New-Object System.Net.NetworkInformation.Ping
                                    # Fai 3 ping per forzare aggiornamento ARP cache (come Advanced IP Scanner)
                                    $pingSuccess = $false
                                    for ($i = 1; $i -le 3; $i++) {
                                        $pingReply = $ping.Send($targetIP, 500)
                                        if ($pingReply.Status -eq 'Success') {
                                            $pingSuccess = $true
                                            # Attesa per aggiornamento ARP cache (importante!)
                                            Start-Sleep -Milliseconds 400
                                        }
                                    }
                            
                                    # DOPO tutti i ping, attendi un po' per garantire aggiornamento ARP cache
                                    if ($pingSuccess) {
                                        Start-Sleep -Milliseconds 500  # Attesa extra per ARP cache
                                
                                        # Leggi da Get-NetNeighbor (pi├╣ affidabile di SendARP e tabella ARP pre-caricata)
                                        # Questo legge direttamente dalla cache ARP aggiornata dopo i ping
                                        # IMPORTANTE: Filtra MAC virtuali e preferisci interfacce fisiche
                                        $arpEntries = Get-NetNeighbor -IPAddress $targetIP -ErrorAction SilentlyContinue
                                        $physicalMacs = @()
                                        $virtualMacs = @()
                                
                                        foreach ($arpEntry in $arpEntries) {
                                            if ($arpEntry.LinkLayerAddress) {
                                                $macFromNeighbor = $arpEntry.LinkLayerAddress
                                                # Normalizza formato MAC per confronto
                                                $macNormalized = $macFromNeighbor -replace '[:-]', '' -replace ' ', ''
                                        
                                                # Verifica che sia un MAC valido
                                                if ($macFromNeighbor -notmatch '^00-00-00-00-00-00' -and 
                                                    $macFromNeighbor -ne '00:00:00:00:00:00' -and
                                                    $macFromNeighbor -match '^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$') {
                                            
                                                    # Filtra MAC virtuali (prefissi OUI comuni)
                                                    $isVirtual = $false
                                                    if ($macNormalized -match '^(005056|000C29|000569|080027|00155D)') {
                                                        $isVirtual = $true
                                                    }
                                            
                                                    if ($isVirtual) {
                                                        $virtualMacs += $macFromNeighbor
                                                    }
                                                    else {
                                                        $physicalMacs += $macFromNeighbor
                                                    }
                                                }
                                            }
                                        }
                                
                                        # Preferisci MAC fisici rispetto a virtuali
                                        if ($physicalMacs.Count -gt 0) {
                                            $ping.Dispose()
                                            return @{ ip = $targetIP; mac = $physicalMacs[0] }
                                        }
                                        elseif ($virtualMacs.Count -gt 0) {
                                            # Se ci sono solo MAC virtuali, usa il primo (meglio di niente)
                                            $ping.Dispose()
                                            return @{ ip = $targetIP; mac = $virtualMacs[0] }
                                        }
                                
                                        # Se Get-NetNeighbor non ha trovato nulla dopo ping, riprova dopo altra attesa
                                        Start-Sleep -Milliseconds 300
                                        $arpEntries = Get-NetNeighbor -IPAddress $targetIP -ErrorAction SilentlyContinue
                                        $physicalMacs = @()
                                        $virtualMacs = @()
                                
                                        foreach ($arpEntry in $arpEntries) {
                                            if ($arpEntry.LinkLayerAddress) {
                                                $macFromNeighbor = $arpEntry.LinkLayerAddress
                                                $macNormalized = $macFromNeighbor -replace '[:-]', '' -replace ' ', ''
                                        
                                                if ($macFromNeighbor -notmatch '^00-00-00-00-00-00' -and 
                                                    $macFromNeighbor -ne '00:00:00:00:00:00' -and
                                                    $macFromNeighbor -match '^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$') {
                                            
                                                    $isVirtual = $false
                                                    if ($macNormalized -match '^(005056|000C29|000569|080027|00155D)') {
                                                        $isVirtual = $true
                                                    }
                                            
                                                    if ($isVirtual) {
                                                        $virtualMacs += $macFromNeighbor
                                                    }
                                                    else {
                                                        $physicalMacs += $macFromNeighbor
                                                    }
                                                }
                                            }
                                        }
                                
                                        if ($physicalMacs.Count -gt 0) {
                                            $ping.Dispose()
                                            return @{ ip = $targetIP; mac = $physicalMacs[0] }
                                        }
                                        elseif ($virtualMacs.Count -gt 0) {
                                            $ping.Dispose()
                                            return @{ ip = $targetIP; mac = $virtualMacs[0] }
                                        }
                                
                                        # Fallback: SendARP solo se Get-NetNeighbor non ha trovato nulla dopo ping
                                        # NOTA: SendARP pu├▓ restituire MAC sbagliato se ci sono pi├╣ interfacce
                                        $macFromSendArp = [ArpHelper]::GetMacAddress($targetIP)
                                        if ($macFromSendArp -and 
                                            $macFromSendArp -notmatch '^00-00-00-00-00-00' -and
                                            $macFromSendArp -match '^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$') {
                                            $ping.Dispose()
                                            return @{ ip = $targetIP; mac = $macFromSendArp }
                                        }
                                    }
                                    $ping.Dispose()
                            
                                    # Se ping ha funzionato ma non abbiamo ancora MAC, attendi e riprova Get-NetNeighbor
                                    if ($pingSuccess) {
                                        Start-Sleep -Milliseconds 500  # Attesa extra per ARP cache
                                        $arpEntries = Get-NetNeighbor -IPAddress $targetIP -ErrorAction SilentlyContinue
                                        foreach ($arpEntry in $arpEntries) {
                                            if ($arpEntry.LinkLayerAddress) {
                                                $macFromNeighbor = $arpEntry.LinkLayerAddress
                                                if ($macFromNeighbor -notmatch '^00-00-00-00-00-00' -and 
                                                    $macFromNeighbor -ne '00:00:00:00:00:00' -and
                                                    $macFromNeighbor -match '^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$') {
                                                    return @{ ip = $targetIP; mac = $macFromNeighbor }
                                                }
                                            }
                                        }
                                        # Ultimo tentativo con SendARP
                                        $macFromSendArp = [ArpHelper]::GetMacAddress($targetIP)
                                        if ($macFromSendArp -and 
                                            $macFromSendArp -notmatch '^00-00-00-00-00-00' -and
                                            $macFromSendArp -match '^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$') {
                                            return @{ ip = $targetIP; mac = $macFromSendArp }
                                        }
                                    }
                                }
                                catch { }
                        
                                # PRIORIT├Ç 4: SendARP diretto (solo come ultimo fallback - pu├▓ essere impreciso)
                                # NOTA: SendARP senza ping pu├▓ restituire MAC del gateway invece del dispositivo
                                try {
                                    $macFromSendArp = [ArpHelper]::GetMacAddress($targetIP)
                                    if ($macFromSendArp -and 
                                        $macFromSendArp -notmatch '^00-00-00-00-00-00' -and
                                        $macFromSendArp -match '^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$') {
                                        return @{ ip = $targetIP; mac = $macFromSendArp }
                                    }
                                }
                                catch { }
                        
                                # PRIORIT├Ç 5: arp.exe (fallback finale)
                                try {
                                    $arpOutput = arp -a 2>$null
                                    if ($arpOutput -match "(?m)^\s*$([regex]::Escape($targetIP))\s+([0-9A-F]{2}[:-][0-9A-F]{2}[:-][0-9A-F]{2}[:-][0-9A-F]{2}[:-][0-9A-F]{2}[:-][0-9A-F]{2})") {
                                        $macFromArp = $matches[2]
                                        if ($macFromArp -notmatch '^00-00-00-00-00-00' -and 
                                            $macFromArp -ne '00:00:00:00:00:00' -and
                                            $macFromArp -match '^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$') {
                                            return @{ ip = $targetIP; mac = $macFromArp }
                                        }
                                    }
                                }
                                catch { }
                        
                                # Nessun MAC trovato
                                return @{ ip = $targetIP; mac = $null }
                            }
                    
                            # Avvia recupero MAC parallelo
                            foreach ($ip in $activeIPs) {
                                $foundIPs.Add($ip)
                                # PowerShell 4.0/5.0 compatibility: crea PowerShell tramite RunspacePool
                                try {
                                    $job = [System.Management.Automation.PowerShell]::Create()
                                    $job.RunspacePool = $macRunspacePool
                                    $job.AddScript($macRecoveryScriptBlock).AddArgument($ip).AddArgument($arpTable) | Out-Null
                                    $asyncResult = $job.BeginInvoke()
                                }
                                catch {
                                    # Fallback per PowerShell 4.0
                                    try {
                                        $runspace = $macRunspacePool.AcquireRunspace()
                                        $job = [System.Management.Automation.PowerShell]::Create()
                                        $job.Runspace = $runspace
                                        $job.AddScript($macRecoveryScriptBlock).AddArgument($ip).AddArgument($arpTable) | Out-Null
                                        $asyncResult = $job.BeginInvoke()
                                    }
                                    catch {
                                        Write-Log "Errore creazione PowerShell per MAC $ip : $_" "WARN"
                                        continue
                                    }
                                }
                                [void]$macJobs.Add(@{
                                        Job         = $job
                                        AsyncResult = $asyncResult
                                        IP          = $ip
                                    })
                            }
                    
                            # Raccogli risultati MAC con timeout per evitare blocchi
                            $macResults = @{}
                            $maxWaitTime = 15  # Timeout massimo 15 secondi per recupero MAC (ridotto ulteriormente)
                            $startTime = Get-Date
                            
                            
                            $processedJobs = 0
                            foreach ($jobInfo in $macJobs) {
                                try {
                                    # Verifica timeout totale
                                    $elapsed = ((Get-Date) - $startTime).TotalSeconds
                                    if ($elapsed -gt $maxWaitTime) {
                                        Write-Log "Timeout recupero MAC raggiunto dopo $maxWaitTime secondi, interrompendo job rimanenti..." "WARN"
                                        # Interrompi tutti i job rimanenti
                                        foreach ($remainingJob in $macJobs) {
                                            if ($remainingJob -ne $jobInfo) {
                                                try {
                                                    if ($remainingJob.AsyncResult -and -not $remainingJob.AsyncResult.IsCompleted) {
                                                        $remainingJob.Job.Stop()
                                                    }
                                                }
                                                catch { }
                                            }
                                        }
                                        break
                                    }
                                    
                                    # Attendi risultato con timeout per singolo job (ridotto a 1.5 secondi per velocit├á)
                                    $asyncWait = $jobInfo.AsyncResult.AsyncWaitHandle
                                    if ($asyncWait.WaitOne(1500)) {
                                        # Timeout 1.5 secondi per job
                                        try {
                                            $result = $jobInfo.Job.EndInvoke($jobInfo.AsyncResult)
                                            if ($result) {
                                                $macResults[$result.ip] = $result.mac
                                            }
                                            $processedJobs++
                                        }
                                        catch {
                                            Write-Log "Errore EndInvoke per $($jobInfo.IP): $_" "WARN"
                                        }
                                    }
                                    else {
                                        Write-Log "Timeout per recupero MAC di $($jobInfo.IP), continuo con altri..." "WARN"
                                        # Interrompi job in timeout
                                        try {
                                            $jobInfo.Job.Stop()
                                        }
                                        catch { }
                                    }
                                }
                                catch {
                                    Write-Log "Errore recupero MAC per $($jobInfo.IP): $_" "WARN"
                                }
                                finally {
                                    try {
                                        if ($jobInfo.Job) {
                                            $jobInfo.Job.Dispose()
                                        }
                                    }
                                    catch { }
                                }
                            }
                            
                            # Chiudi runspace pool
                            try {
                                $macRunspacePool.Close()
                                $macRunspacePool.Dispose()
                            }
                            catch {
                                Write-Log "Errore chiusura runspace pool: $_" "WARN"
                            }
                            
                        }
                        catch {
                            Write-Log "Errore critico durante recupero MAC parallelo: $_" "ERROR"
                            Write-Log "Stack: $($_.Exception.StackTrace)" "ERROR"
                            $macResults = @{}  # Reset risultati in caso di errore
                        }
                    }
                    
                    # Costruisci array devices con MAC recuperati
                    foreach ($ip in $activeIPs) {
                        $macAddress = $null
                        if ($macResults.ContainsKey($ip)) {
                            $macAddress = $macResults[$ip]
                        }
                        
                        # Se MAC non trovato dal recupero parallelo, prova tentativi aggiuntivi pi├╣ aggressivi (solo per IP problematici)
                        if (-not $macAddress) {
                            
                            # Metodo 1: Ping multipli + Get-NetNeighbor (come Advanced IP Scanner)
                            # IMPORTANTE: Ping PRIMA di leggere MAC per aggiornare cache ARP
                            try {
                                $ping = New-Object System.Net.NetworkInformation.Ping
                                $pingSuccess = $false
                                for ($i = 1; $i -le 3; $i++) {
                                    $pingReply = $ping.Send($ip, 500)
                                    if ($pingReply.Status -eq 'Success') {
                                        $pingSuccess = $true
                                        Start-Sleep -Milliseconds 300  # Attesa per aggiornamento ARP
                                        
                                        # DOPO ping, leggi da Get-NetNeighbor (pi├╣ affidabile)
                                        $arpEntries = Get-NetNeighbor -IPAddress $ip -ErrorAction SilentlyContinue
                                        foreach ($arpEntry in $arpEntries) {
                                            if ($arpEntry.LinkLayerAddress) {
                                                $macFromNeighbor = $arpEntry.LinkLayerAddress
                                                if ($macFromNeighbor -notmatch '^00-00-00-00-00-00' -and 
                                                    $macFromNeighbor -ne '00:00:00:00:00:00' -and
                                                    $macFromNeighbor -match '^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$') {
                                                    $ping.Dispose()
                                                    $macAddress = $macFromNeighbor
                                                    break
                                                }
                                            }
                                        }
                                        
                                        # Se Get-NetNeighbor non ha trovato, prova SendARP come fallback
                                        if (-not $macAddress) {
                                            $macFromSendArp = [ArpHelper]::GetMacAddress($ip)
                                            if ($macFromSendArp -and 
                                                $macFromSendArp -notmatch '^00-00-00-00-00-00' -and
                                                $macFromSendArp -match '^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$') {
                                                $ping.Dispose()
                                                $macAddress = $macFromSendArp
                                                break
                                            }
                                        }
                                        else {
                                            break  # MAC trovato, esci dal loop ping
                                        }
                                    }
                                }
                                $ping.Dispose()
                                
                                # Se ping ha funzionato ma non abbiamo ancora MAC, attendi e riprova
                                if ($pingSuccess -and -not $macAddress) {
                                    Start-Sleep -Milliseconds 500
                                    $arpEntries = Get-NetNeighbor -IPAddress $ip -ErrorAction SilentlyContinue
                                    foreach ($arpEntry in $arpEntries) {
                                        if ($arpEntry.LinkLayerAddress) {
                                            $macFromNeighbor = $arpEntry.LinkLayerAddress
                                            if ($macFromNeighbor -notmatch '^00-00-00-00-00-00' -and 
                                                $macFromNeighbor -ne '00:00:00:00:00:00' -and
                                                $macFromNeighbor -match '^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$') {
                                                $macAddress = $macFromNeighbor
                                                break
                                            }
                                        }
                                    }
                                    # Ultimo tentativo con SendARP
                                    if (-not $macAddress) {
                                        $macFromSendArp = [ArpHelper]::GetMacAddress($ip)
                                        if ($macFromSendArp -and 
                                            $macFromSendArp -notmatch '^00-00-00-00-00-00' -and
                                            $macFromSendArp -match '^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$') {
                                            $macAddress = $macFromSendArp
                                        }
                                    }
                                }
                            }
                            catch {
                            }
                            
                            # Metodo 2: WMI PingStatus + Get-NetNeighbor (fallback)
                            if (-not $macAddress) {
                                try {
                                    $pingStatus = Get-WmiObject -Class Win32_PingStatus -Filter "Address='$ip'" -ErrorAction SilentlyContinue | Select-Object -First 1
                                    if ($pingStatus -and $pingStatus.StatusCode -eq 0) {
                                        Start-Sleep -Milliseconds 400
                                        # Usa Get-NetNeighbor invece di SendARP
                                        $arpEntries = Get-NetNeighbor -IPAddress $ip -ErrorAction SilentlyContinue
                                        foreach ($arpEntry in $arpEntries) {
                                            if ($arpEntry.LinkLayerAddress) {
                                                $macFromNeighbor = $arpEntry.LinkLayerAddress
                                                if ($macFromNeighbor -notmatch '^00-00-00-00-00-00' -and 
                                                    $macFromNeighbor -ne '00:00:00:00:00:00' -and
                                                    $macFromNeighbor -match '^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$') {
                                                    $macAddress = $macFromNeighbor
                                                    break
                                                }
                                            }
                                        }
                                        # Fallback SendARP solo se Get-NetNeighbor non ha trovato
                                        if (-not $macAddress) {
                                            $macFromSendArp = [ArpHelper]::GetMacAddress($ip)
                                            if ($macFromSendArp -and 
                                                $macFromSendArp -notmatch '^00-00-00-00-00-00' -and
                                                $macFromSendArp -match '^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$') {
                                                $macAddress = $macFromSendArp
                                            }
                                        }
                                    }
                                }
                                catch {
                                }
                            }
                            
                            # Metodo 3: Get-NetNeighbor diretto (forza refresh) - OTTIMIZZATO
                            if (-not $macAddress) {
                                try {
                                    # Forza refresh ARP table con 1 ping veloce
                                    $null = Test-Connection -ComputerName $ip -Count 1 -Quiet -ErrorAction SilentlyContinue
                                    Start-Sleep -Milliseconds 300  # Ridotto da 500ms
                                    $arpEntries = Get-NetNeighbor -IPAddress $ip -ErrorAction SilentlyContinue
                                    foreach ($arpEntry in $arpEntries) {
                                        if ($arpEntry.LinkLayerAddress) {
                                            $macFromNeighbor = $arpEntry.LinkLayerAddress
                                            if ($macFromNeighbor -notmatch '^00-00-00-00-00-00' -and 
                                                $macFromNeighbor -ne '00:00:00:00:00:00' -and
                                                $macFromNeighbor -match '^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$') {
                                                $macAddress = $macFromNeighbor
                                                break
                                            }
                                        }
                                    }
                                }
                                catch {
                                }
                            }
                            
                            if (-not $macAddress) {
                            }
                        }
                        
                        # Prova risoluzione hostname (opzionale, pu├▓ essere lento - la saltiamo per velocit├á)
                        $hostname = $null
                        # Commentato per velocit├á - pu├▓ essere riattivato se necessario
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
                        # ... (placeholder, requires correct context)
                        $hasPingFailures = $false
                        if ($script:pingFailures -and $script:pingFailures.ContainsKey($ip)) {
                            $hasPingFailures = $script:pingFailures[$ip]
                        }
                        
                        # Calcola ping_responsive: true se l'IP ├¿ in activeIPs (ha risposto al ping)
                        # false se presente solo in ARP ma non ha risposto al ping (Trust ARP)
                        $pingResponsive = $activeIPs.Contains($ip)
                        $upgradeAvailable = $false
                        $unifiName = $null

                        # Arricchimento dati da Unifi (Upgrade + Name)
                        if ($macAddress) {
                            $macNorm = ($macAddress -replace ':', '-').ToUpper()
                            
                            if ($unifiUpgrades -and $unifiUpgrades.Count -gt 0) {
                                if ($unifiUpgrades.ContainsKey($macNorm)) {
                                    $upgradeAvailable = $true
                                    Write-Log "­ƒôª Aggiornamento Firmware disponibile per $ip ($macAddress)" "INFO"
                                }
                            }
                            
                            if ($unifiNames -and $unifiNames.Count -gt 0) {
                                if ($unifiNames.ContainsKey($macNorm)) {
                                    $unifiName = $unifiNames[$macNorm]
                                    Write-Log "­ƒÅÀ´©Å Unifi Name trovato per $ip ($macAddress): $unifiName" "DEBUG"
                                    
                                    # Usa nome unifi come hostname se hostname ├¿ vuoto
                                    if (-not $hostname) {
                                        $hostname = $unifiName
                                    }
                                }
                            }
                        }
                        
                        $device = @{
                            ip_address        = $ip
                            mac_address       = $macAddress
                            hostname          = $hostname
                            vendor            = $vendor
                            status            = "online"
                            has_ping_failures = $hasPingFailures
                            ping_responsive   = $pingResponsive
                            upgrade_available = $upgradeAvailable
                            unifi_name        = $unifiName
                        }
                        
                        # Salva MAC trovato per uso successivo
                        if ($macAddress) {
                            $foundMACs[$ip] = $macAddress
                        }
                        
                        $devices += $device
                    }
                }
                
                # IMPORTANTE: Inizializza activeIPs se non ├¿ stato inizializzato (caso: nessun IP da scansionare)
                if (-not $activeIPs) {
                    $activeIPs = New-Object System.Collections.ArrayList
                }
                
                # TRUST ARP: Aggiungi dispositivi presenti in ARP ma non in activeIPs (non rispondono al ping)
                # Questo ├¿ cruciale per rilevare tutti i dispositivi presenti sulla rete
                # IMPORTANTE: Verifica che $arpTable e $baseIP siano inizializzati prima di eseguire Trust ARP
                if ($arpTable -and $arpTable.Count -gt 0 -and $baseIP) {
                    try {
                        Write-Log "Trust ARP: Verifica dispositivi in ARP ma non in activeIPs..." "INFO"
                        $trustArpCount = 0
                        foreach ($arpIP in $arpTable.Keys) {
                            try {
                                # Verifica che l'IP sia nel range configurato
                                if ($arpIP -like "$baseIP.*") {
                                    # Se l'IP non ├¿ in activeIPs (non ha risposto al ping) ma ├¿ in ARP, aggiungilo
                                    if (-not $activeIPs.Contains($arpIP)) {
                                        # Verifica che non sia gi├á stato aggiunto ai devices
                                        $alreadyAdded = $false
                                        foreach ($existingDevice in $devices) {
                                            if ($existingDevice.ip_address -eq $arpIP) {
                                                $alreadyAdded = $true
                                                break
                                            }
                                        }
                                    
                                        if (-not $alreadyAdded) {
                                            $arpMAC = $arpTable[$arpIP]
                                            # Verifica che il MAC sia valido
                                            if ($arpMAC -and 
                                                $arpMAC -notmatch '^00-00-00-00-00-00' -and 
                                                $arpMAC -ne '00:00:00:00:00:00' -and
                                                $arpMAC -match '^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$') {
                                                $upgradeAvailable = $false
                                                if ($unifiUpgrades.Count -gt 0) { $mn = ($arpMAC -replace ':', '-').ToUpper(); $upgradeAvailable = $unifiUpgrades.ContainsKey($mn) }
                                                # Aggiungi dispositivo Trust ARP (presente ma non risponde al ping)
                                                $trustArpDevice = @{
                                                    ip_address        = $arpIP
                                                    mac_address       = $arpMAC
                                                    hostname          = $null
                                                    vendor            = $null
                                                    status            = "online"
                                                    has_ping_failures = $true  # Non risponde al ping
                                                    ping_responsive   = $false   # Trust ARP: presente ma non risponde
                                                    upgrade_available = $upgradeAvailable
                                                }
                                                $devices += $trustArpDevice
                                                $trustArpCount++
                                                Write-Log "Trust ARP: Aggiunto $arpIP ($arpMAC) - presente ma non risponde al ping" "INFO"
                                            }
                                        }
                                    }
                                }
                            }
                            catch {
                                Write-Log "Errore processamento Trust ARP per $arpIP : $_" "WARN"
                                # Continua con il prossimo IP invece di bloccare tutto
                            }
                        }
                        if ($trustArpCount -gt 0) {
                            Write-Log "Trust ARP: Aggiunti $trustArpCount dispositivi presenti ma non responsivi al ping" "INFO"
                        }
                    }
                    catch {
                        Write-Log "Errore Trust ARP: $_" "WARN"
                        Write-Log "Stack: $($_.Exception.StackTrace)" "WARN"
                        # Non bloccare la scansione se Trust ARP fallisce
                    }
                }
                else {
                    Write-Log "Trust ARP: Saltato (arpTable vuota o baseIP non definito)" "DEBUG"
                }
                
                # Salva IP trovati con MAC in batch (include anche Trust ARP)
                try {
                    $ipDataArray = @()
                    # Raccogli tutti gli IP dai devices (include sia ping che Trust ARP)
                    $allIPs = @()
                    foreach ($device in $devices) {
                        if ($device.ip_address -and $device.ip_address -like "$baseIP.*") {
                            $allIPs += $device.ip_address
                        }
                    }
                    
                    # Ordina IP numericamente invece che alfabeticamente
                    $sortedIPs = $allIPs | Sort-Object -Unique | Sort-Object {
                        $parts = $_ -split '\.'
                        [int]$parts[0] * 16777216 + [int]$parts[1] * 65536 + [int]$parts[2] * 256 + [int]$parts[3]
                    }
                    
                    foreach ($ip in $sortedIPs) {
                        # Cerca MAC dal device corrispondente (pi├╣ affidabile)
                        $macAddress = $null
                        $deviceMatch = $devices | Where-Object { $_.ip_address -eq $ip } | Select-Object -First 1
                        if ($deviceMatch -and $deviceMatch.mac_address) {
                            $macAddress = $deviceMatch.mac_address
                        }
                        elseif ($foundMACs.ContainsKey($ip)) {
                            $macAddress = $foundMACs[$ip]
                        }
                        elseif ($arpTable.ContainsKey($ip)) {
                            $macAddress = $arpTable[$ip]
                            # Verifica che non sia un MAC invalido
                            if ($macAddress -match '^00-00-00-00-00-00' -or $macAddress -eq '00:00:00:00:00:00') {
                                $macAddress = $null
                            }
                        }
                        $ipDataArray += @{
                            ip  = $ip
                            mac = $macAddress
                        }
                    }
                    $ipDataArray | ConvertTo-Json -Compress | Out-File -FilePath $script:currentScanIPsFile -Encoding UTF8 -Force
                    Write-Log "IP salvati per tray icon: $($ipDataArray.Count) dispositivi (inclusi Trust ARP)" "INFO"
                }
                catch {
                    Write-Log "Errore salvataggio IP per tray icon: $_" "WARN"
                }
            }
            else {
                Write-Log "Subnet mask troppo grande per scansione completa: $rangeStr" "WARN"
            }
        }
        else {
            Write-Log "Formato range IP non supportato: $rangeStr (atteso: x.x.x.x/24)" "WARN"
        }
    }
    
    # IMPORTANTE: Aggiungi sempre il PC locale ai risultati (anche se non appare nella scansione ARP)
    if ($localIP -and $localMAC) {
        $localDeviceExists = $false
        foreach ($device in $devices) {
            if ($device.ip_address -eq $localIP) {
                $localDeviceExists = $true
                # Se esiste ma non ha MAC, aggiorna il MAC
                if (-not $device.mac_address -or $device.mac_address -eq $null) {
                    $device.mac_address = $localMAC
                    Write-Log "MAC locale aggiunto al dispositivo esistente: $localIP -> $localMAC" "DEBUG"
                }
                break
            }
        }
        
        # Se il PC locale non ├¿ presente nei risultati, aggiungilo
        if (-not $localDeviceExists) {
            $upgradeAvailable = $false
            if ($localMAC -and $unifiUpgrades.Count -gt 0) { $mn = ($localMAC -replace ':', '-').ToUpper(); $upgradeAvailable = $unifiUpgrades.ContainsKey($mn) }
            $localDevice = @{
                ip_address        = $localIP
                mac_address       = $localMAC
                hostname          = $localHostname
                vendor            = $null
                status            = "online"
                has_ping_failures = $false
                ping_responsive   = $true  # IP locale risponde sempre al ping
                upgrade_available = $upgradeAvailable
            }
            $devices += $localDevice
            Write-Log "PC locale aggiunto ai risultati: $localIP ($localMAC)" "INFO"
        }
    }
    elseif ($localIP -and -not $localMAC) {
        Write-Log "ATTENZIONE: IP locale $localIP trovato ma MAC non rilevato" "WARN"
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
            }
            catch {
                Write-Log "Errore lettura last_scan.json: $_" "WARN"
            }
        }
        
        # Rileva cambiamenti
        $changes = @()
        if ($lastScan) {
            # Crea dizionario per lookup veloce
            $lastScanDict = @{}
            foreach ($oldDevice in $lastScan) {
                $lastScanDict[$oldDevice.ip_address] = $oldDevice
            }
            
            # Nuovi dispositivi e dispositivi tornati online
            foreach ($device in $Devices) {
                $oldDevice = $lastScanDict[$device.ip_address]
                if (-not $oldDevice) {
                    # Nuovo dispositivo
                    $changes += @{
                        device_ip   = $device.ip_address
                        change_type = "new_device"
                        old_value   = $null
                        new_value   = $device.ip_address
                    }
                }
                else {
                    # Dispositivo esisteva gi├á - verifica se era offline
                    # Se il dispositivo era offline e ora ├¿ online, invia notifica device_online
                    # Nota: Il backend gestisce lo status, ma l'agent pu├▓ rilevare se un dispositivo
                    # che non appariva nella scansione precedente ora appare (tornato online)
                    # Questo ├¿ gi├á gestito dal confronto, ma possiamo essere pi├╣ espliciti
                }
            }
            
            # Dispositivi offline (non pi├╣ nella scansione)
            foreach ($oldDevice in $lastScan) {
                $exists = $Devices | Where-Object { $_.ip_address -eq $oldDevice.ip_address }
                if (-not $exists) {
                    $changes += @{
                        device_ip   = $oldDevice.ip_address
                        change_type = "device_offline"
                        old_value   = $oldDevice.ip_address
                        new_value   = $null
                    }
                }
            }
        }
        else {
            # Primo scan: tutti i dispositivi sono nuovi
            foreach ($device in $Devices) {
                $changes += @{
                    device_ip   = $device.ip_address
                    change_type = "new_device"
                    old_value   = $null
                    new_value   = $device.ip_address
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
            "X-API-Key"    = $ApiKey
        }
        
        $url = "$ServerUrl/api/network-monitoring/agent/scan-results"
        Write-Log "Invio dati a: $url"
        
        $response = Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body $payload -ErrorAction Stop
        
        Write-Log "Dati inviati con successo: $($response.devices_processed) dispositivi, $($response.changes_processed) cambiamenti"
        
        # Salva scan corrente come last_scan.json
        $scanData = @{
            timestamp = (Get-Date -Format "o")
            devices   = $Devices
        } | ConvertTo-Json -Depth 10
        
        $scanData | Out-File -FilePath $script:lastScanPath -Encoding UTF8
        
        return $response
    }
    catch {
        Write-Log "Errore invio dati: $_" "ERROR"
        Write-Log "Stack trace: $($_.Exception.StackTrace)" "ERROR"
        throw
    }
}

# Sincronizza switch gestiti: l'agent (in locale, stessa LAN) esegue snmpwalk su dot1dTpFdbPort
# (o dot1qTpFdbPort se dot1d non restituisce dati), invia la tabella MAC->porta al backend.
# Parsing come Test-SnmpSwitch.ps1: OID numerici e simbolici, ultimi 6 segmenti = MAC.
function Sync-ManagedSwitchesSnmp {
    param(
        [string]$ServerUrl,
        [string]$ApiKey
    )
    try {
        $url = "$ServerUrl/api/network-monitoring/agent/managed-switches"
        $headers = @{ "X-API-Key" = $ApiKey }
        $list = Invoke-RestMethod -Uri $url -Method GET -Headers $headers -TimeoutSec 15 -ErrorAction Stop
        if (-not $list -or ($list -is [Array] -and $list.Count -eq 0)) { return }
        if (-not ($list -is [Array])) { $list = @($list) }

        # snmpwalk: PATH, C:\Program Files\Net-SNMP\bin, C:\usr\bin (install in C:\usr)
        $snmpwalkExe = $null
        try { $snmpwalkExe = (Get-Command snmpwalk -ErrorAction Stop).Source } catch { }
        if (-not $snmpwalkExe -and (Test-Path "C:\Program Files\Net-SNMP\bin\snmpwalk.exe")) {
            $snmpwalkExe = "C:\Program Files\Net-SNMP\bin\snmpwalk.exe"
        }
        if (-not $snmpwalkExe -and (Test-Path "C:\usr\bin\snmpwalk.exe")) { $snmpwalkExe = "C:\usr\bin\snmpwalk.exe" }
        if (-not $snmpwalkExe -and (Test-Path "C:\usr\bin\snmpwalk")) { $snmpwalkExe = "C:\usr\bin\snmpwalk" }
        if (-not $snmpwalkExe) {
            Write-Log "snmpwalk non trovato (Net-SNMP); sync switch SNMP saltata" "WARN"
            return
        }

        # MIB: C:\Program Files\Net-SNMP\share\snmp\mibs oppure C:\usr\share\snmp\mibs; altrimenti MIBS=""
        $prevMibs = $env:MIBS
        $prevMibDirs = $env:MIBDIRS
        $mibDir = $null
        if (Test-Path "C:\Program Files\Net-SNMP\share\snmp\mibs") { $mibDir = "C:\Program Files\Net-SNMP\share\snmp\mibs" }
        elseif (Test-Path "C:\usr\share\snmp\mibs") { $mibDir = "C:\usr\share\snmp\mibs" }
        if ($mibDir) { $env:MIBDIRS = $mibDir } else { $env:MIBS = "" }

        try {
        $oidDot1d = "1.3.6.1.2.1.17.4.3.1.2"
        $oidDot1q = "1.3.6.1.2.1.17.7.1.2.2.1.2"
        foreach ($s in $list) {
            $id = $s.id
            $ip = $s.ip
            $community = if ($s.snmp_community) { $s.snmp_community } else { "public" }
            try {
                $macToPort = @{}
                foreach ($baseOid in @($oidDot1d, $oidDot1q)) {
                    $out = & $snmpwalkExe -v 2c -c $community $ip $baseOid -On 2>&1
                    if ($LASTEXITCODE -ne 0) { continue }
                    if (-not $out) { continue }
                    $m = @{}
                    $lines = $out | Where-Object { $_ -match "=\s*INTEGER:\s*(\d+)" }
                    foreach ($line in $lines) {
                        if ($line -notmatch '=\s*INTEGER:\s*(\d+)') { continue }
                        $port = [int]$Matches[1]
                        $oidPart = ($line -split '=', 2)[0].Trim() -replace '::', '.'
                        $numeric = @()
                        foreach ($seg in ($oidPart -split '\.')) {
                            $n = 0
                            if ([int]::TryParse($seg.Trim(), [ref]$n) -and $n -ge 0 -and $n -le 255) { $numeric += $n }
                        }
                        if ($numeric.Count -lt 6) { continue }
                        $last6 = @($numeric)[-6..-1]
                        $mac = ($last6 | ForEach-Object { '{0:X2}' -f ($_ -band 0xFF) }) -join ''
                        $mac = $mac.ToUpper()
                        if ($mac.Length -eq 12) { $m[$mac] = $port }
                    }
                    if ($m.Count -gt 0) { $macToPort = $m; break }
                }
                if ($macToPort.Count -eq 0) { continue }

                $bodyObj = @{
                    managed_switch_id = $id
                    switch_ip         = $ip
                    mac_to_port       = $macToPort
                }
                $body = $bodyObj | ConvertTo-Json -Depth 4 -Compress
                $postUrl = "$ServerUrl/api/network-monitoring/agent/switch-address-table"
                $postHeaders = @{ "Content-Type" = "application/json"; "X-API-Key" = $ApiKey }
                $resp = Invoke-RestMethod -Uri $postUrl -Method POST -Headers $postHeaders -Body $body -TimeoutSec 15 -ErrorAction Stop
                Write-Log "Sync switch SNMP $ip : $($resp.macs_matched) dispositivi associati ($($resp.macs_found) MAC letti)" "INFO"
            }
            catch {
                Write-Log "Sync switch SNMP $ip fallito: $_" "WARN"
            }
        }
        } finally {
            if ($null -ne $prevMibs) { $env:MIBS = $prevMibs } else { Remove-Item -Path env:MIBS -ErrorAction SilentlyContinue }
            if ($null -ne $prevMibDirs) { $env:MIBDIRS = $prevMibDirs } else { Remove-Item -Path env:MIBDIRS -ErrorAction SilentlyContinue }
        }
    }
    catch {
        Write-Log "Errore Sync-ManagedSwitchesSnmp (GET managed-switches o altro): $_" "WARN"
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
            config  = $response
        }
    }
    catch {
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
            "X-API-Key"    = $ApiKey
        }
        
        # Ottieni system uptime (in secondi)
        $systemUptime = $null
        try {
            $os = Get-WmiObject Win32_OperatingSystem -ErrorAction SilentlyContinue
            if ($os) {
                $systemUptime = [Math]::Floor((Get-Date).Subtract($os.ConvertToDateTime($os.LastBootUpTime)).TotalSeconds)
            }
        }
        catch {
            # Ignora errori recupero uptime
        }
        
        # Prepara payload con system_uptime e network_issue_detected
        $networkIssueDetected = $false
        $networkIssueDuration = $null
        
        # Se c'erano tentativi falliti e ora riusciamo, segnala problema rete
        if ($script:failedHeartbeatCount -gt 0) {
            $networkIssueDetected = $true
            if ($script:networkIssueStartTime) {
                $networkIssueDuration = [Math]::Floor((Get-Date).Subtract($script:networkIssueStartTime).TotalMinutes)
            }
            else {
                $networkIssueDuration = $script:failedHeartbeatCount * 5 # Stima: ogni heartbeat ├¿ ogni 5 minuti
            }
            Write-Log "Rilevato problema rete risolto: durata $networkIssueDuration minuti" "INFO"
        }
        
        # Prepara payload
        $payload = @{
            agent_id       = $script:config.agent_id
            version        = $Version
            timestamp      = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
            system_uptime  = $systemUptime
            network_issue  = $networkIssueDetected
            issue_duration = $networkIssueDuration
        }
        if ($null -ne $script:lastUnifiOk) {
            $payload['unifi_last_ok'] = [bool]$script:lastUnifiOk
            $payload['unifi_last_check_at'] = $script:lastUnifiCheckAt
        }
        $payloadJson = $payload | ConvertTo-Json
        
        $url = "$ServerUrl/api/network-monitoring/agent/heartbeat"
        # Timeout di 30 secondi per evitare che la richiesta si blocchi troppo a lungo
        $response = Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body $payloadJson -TimeoutSec 30 -ErrorAction Stop
        
        # Heartbeat riuscito - reset contatori problemi rete
        $script:lastSuccessfulHeartbeat = Get-Date
        $script:failedHeartbeatCount = 0
        $script:networkIssueStartTime = $null
        
        # Verifica se il server ha richiesto la disinstallazione
        if ($response.uninstall -eq $true) {
            Write-Log "Server ha richiesto disinstallazione: $($response.message)" "WARN"
            return @{ success = $false; uninstall = $true; message = $response.message }
        }

        $pendingUnifi = $response.pending_unifi_test
        
        # Recupera configurazione dal server per verificare se scan_interval_minutes ├¿ cambiato
        try {
            $serverConfigResult = Get-ServerConfig -ServerUrl $ServerUrl -ApiKey $ApiKey
            if ($serverConfigResult.success -and $serverConfigResult.config.scan_interval_minutes) {
                $serverInterval = $serverConfigResult.config.scan_interval_minutes
                
                # Se l'intervallo ├¿ diverso, aggiornalo solo in memoria (il servizio lo usa direttamente)
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
                        Write-Log "Il nuovo intervallo sara' applicato dalla prossima scansione" 'INFO'
                    }
                }
            }
        }
        catch {
            # Non bloccare l'esecuzione se il controllo configurazione fallisce
        }
        
        return @{ success = $true; uninstall = $false; config = $serverConfigResult.config; pending_unifi_test = $pendingUnifi }
    }
    catch {
        Write-Log "Errore heartbeat: $_" "WARN"
        
        # Traccia tentativo fallito
        $script:failedHeartbeatCount++
        if (-not $script:networkIssueStartTime) {
            $script:networkIssueStartTime = Get-Date
        }
        
        return @{ success = $false; uninstall = $false; error = $_.Exception.Message }
    }
}

# Scarica i file della tray (NetworkMonitorTrayIcon.ps1, VBS, BAT) se mancanti.
# Da eseguire all'avvio: il download nel blocco di update non basta perche durante l'update
# e' in esecuzione il vecchio script; dopo restart le versioni coincidono e non si entra nel blocco.
function Ensure-TrayFiles {
    param([string]$ServerUrl, [string]$InstallDir)
    if (-not $ServerUrl -or -not $InstallDir) { return }
    $baseUrl = $ServerUrl -replace '/api.*', '' -replace '/$', ''
    $trayFiles = @(
        @{ Name = "NetworkMonitorTrayIcon.ps1"; Url = "$baseUrl/api/network-monitoring/download/agent/NetworkMonitorTrayIcon.ps1" },
        @{ Name = "Start-TrayIcon-Hidden.vbs"; Url = "$baseUrl/api/network-monitoring/download/agent/Start-TrayIcon-Hidden.vbs" },
        @{ Name = "Avvia-TrayIcon.bat"; Url = "$baseUrl/api/network-monitoring/download/agent/Avvia-TrayIcon.bat" }
    )
    foreach ($t in $trayFiles) {
        $dest = Join-Path $InstallDir $t.Name
        if (Test-Path $dest) { continue }
        try {
            Invoke-WebRequest -Uri $t.Url -OutFile $dest -TimeoutSec 15 -ErrorAction Stop
            if (Test-Path $dest) { Write-Log "[OK] $($t.Name) scaricato (Ensure-TrayFiles)" "INFO" }
        }
        catch {
            Write-Log "[WARN] Ensure-TrayFiles: download $($t.Name) fallito: $_" "WARN"
        }
    }
}

function Check-AgentUpdate {
    param(
        [string]$ServerUrl,
        [string]$CurrentVersion
    )
    
    try {
        # Forza TLS 1.2 (in alcuni contesti servizio puo non ereditare Enable-Tls12)
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Write-Log "[INFO] Controllo aggiornamenti agent... (versione corrente: $CurrentVersion)" "INFO"
        
        # Normalizza base URL (evita doppio /api se server_url contiene gia /api)
        $serverBase = $ServerUrl -replace '/api.*', '' -replace '/$', ''
        $versionUrl = "$serverBase/api/network-monitoring/agent-version"
        Write-Log "[INFO] URL check versione: $versionUrl" "DEBUG"
        
        # Richiedi informazioni versione
        $response = Invoke-RestMethod -Uri $versionUrl -Method Get -TimeoutSec 10 -ErrorAction Stop
        
        $serverVersion = ($response.version -as [string])
        if (-not $serverVersion) {
            Write-Log "[WARN] Risposta agent-version senza campo version, skip aggiornamento" "WARN"
            return
        }
        $serverVersion = $serverVersion.Trim()
        $CurrentVersion = if ($CurrentVersion) { ($CurrentVersion -as [string]).Trim() } else { "" }
        Write-Log "[INFO] Versione server: $serverVersion, agent: $CurrentVersion" "INFO"
        
        # Confronta versioni (confronto stringa)
        if ($serverVersion -ne $CurrentVersion) {
            Write-Log "[INFO] Nuova versione disponibile! Avvio aggiornamento..." "INFO"
            
            # Directory installazione (stessa del servizio)
            $installDir = $script:scriptDir
            
            # File da aggiornare
            $serviceFile = Join-Path $installDir "NetworkMonitorService.ps1"
            $monitorFile = Join-Path $installDir "NetworkMonitor.ps1"
            
            # URL download
            $baseUrl = $ServerUrl -replace '/api.*', ''
            $serviceDownloadUrl = "$baseUrl/api/network-monitoring/download/agent/NetworkMonitorService.ps1"
            $monitorDownloadUrl = "$baseUrl/api/network-monitoring/download/agent/NetworkMonitor.ps1"
            
            # Backup
            $serviceBackup = "$serviceFile.backup"
            $monitorBackup = "$monitorFile.backup"
            
            # Download NetworkMonitorService.ps1
            Write-Log "[DOWNLOAD] Download NetworkMonitorService.ps1..." "INFO"
            $tempService = "$serviceFile.new"
            Invoke-WebRequest -Uri $serviceDownloadUrl -OutFile $tempService -TimeoutSec 30 -ErrorAction Stop
            
            if (Test-Path $tempService) {
                $serviceSize = (Get-Item $tempService).Length
                Write-Log ('[OK] NetworkMonitorService.ps1 scaricato (' + $serviceSize + ' bytes)') 'INFO'
                # Validazione: evita di sostituire con HTML di errore o file corrotto (crash loop)
                $content = Get-Content $tempService -Raw -ErrorAction SilentlyContinue
                if (-not $content -or $content.Length -lt 5000 -or $content -notmatch 'NetworkMonitorService') {
                    Write-Log "[WARN] NetworkMonitorService.ps1 scaricato non valido (size o contenuto), skip sostituzione" "WARN"
                    Remove-Item $tempService -Force -ErrorAction SilentlyContinue
                    return
                }
                # Backup versione corrente
                if (Test-Path $serviceFile) {
                    Copy-Item $serviceFile $serviceBackup -Force
                    Write-Log "[BACKUP] Backup NetworkMonitorService.ps1 creato" "INFO"
                }
                
                # Sostituisci file (prova fino a 3 volte)
                $replaced = $false
                for ($i = 1; $i -le 3; $i++) {
                    try {
                        Move-Item $tempService $serviceFile -Force -ErrorAction Stop
                        $replaced = $true
                        Write-Log "[OK] NetworkMonitorService.ps1 aggiornato!" "INFO"
                        break
                    }
                    catch {
                        if ($i -lt 3) {
                            Write-Log "[WARN] Tentativo $i fallito, riprovo..." "WARN"
                            Start-Sleep -Seconds 2
                        }
                        else {
                            throw $_
                        }
                    }
                }
                
                if (-not $replaced) {
                    throw "Impossibile sostituire NetworkMonitorService.ps1 dopo 3 tentativi"
                }
            }
            
            # Download NetworkMonitor.ps1 (se esiste)
            if (Test-Path $monitorFile) {
                try {
                    Write-Log "[DOWNLOAD] Download NetworkMonitor.ps1..." "INFO"
                    $tempMonitor = "$monitorFile.new"
                    Invoke-WebRequest -Uri $monitorDownloadUrl -OutFile $tempMonitor -TimeoutSec 30 -ErrorAction Stop
                    
                    if (Test-Path $tempMonitor) {
                        $monitorSize = (Get-Item $tempMonitor).Length
                        Write-Log ('[OK] NetworkMonitor.ps1 scaricato (' + $monitorSize + ' bytes)') 'INFO'
                        $mContent = Get-Content $tempMonitor -Raw -ErrorAction SilentlyContinue
                        if (-not $mContent -or $mContent.Length -lt 3000 -or $mContent -notmatch 'NetworkMonitor') {
                            Write-Log "[WARN] NetworkMonitor.ps1 scaricato non valido, skip sostituzione" "WARN"
                            Remove-Item $tempMonitor -Force -ErrorAction SilentlyContinue
                        }
                        else {
                            if (Test-Path $monitorFile) { Copy-Item $monitorFile $monitorBackup -Force }
                            Move-Item $tempMonitor $monitorFile -Force
                            Write-Log "[OK] NetworkMonitor.ps1 aggiornato!" "INFO"
                        }
                    }
                }
                catch {
                    Write-Log "[WARN] Errore aggiornamento NetworkMonitor.ps1: $_" "WARN"
                    Write-Log "[WARN] Continuo con NetworkMonitorService.ps1 aggiornato" "WARN"
                }
            }
            
            # Download file tray (best-effort: 404 o errore di rete -> log e continua)
            $trayFiles = @(
                @{ Name = "NetworkMonitorTrayIcon.ps1"; Url = "$baseUrl/api/network-monitoring/download/agent/NetworkMonitorTrayIcon.ps1" },
                @{ Name = "Start-TrayIcon-Hidden.vbs"; Url = "$baseUrl/api/network-monitoring/download/agent/Start-TrayIcon-Hidden.vbs" },
                @{ Name = "Avvia-TrayIcon.bat"; Url = "$baseUrl/api/network-monitoring/download/agent/Avvia-TrayIcon.bat" }
            )
            foreach ($t in $trayFiles) {
                try {
                    $dest = Join-Path $installDir $t.Name
                    Invoke-WebRequest -Uri $t.Url -OutFile $dest -TimeoutSec 15 -ErrorAction Stop
                    if (Test-Path $dest) { Write-Log "[OK] $($t.Name) scaricato" "INFO" }
                }
                catch {
                    Write-Log "[WARN] Download $($t.Name) fallito (continua): $_" "WARN"
                }
            }
            
            # Aggiorna config.json con nuova versione
            $configPath = Join-Path $installDir "config.json"
            if (Test-Path $configPath) {
                try {
                    $config = Get-Content $configPath -Raw | ConvertFrom-Json
                    $config.version = $serverVersion
                    $config | ConvertTo-Json -Depth 10 | Out-File -FilePath $configPath -Encoding UTF8 -Force
                    Write-Log "[OK] config.json aggiornato con versione $serverVersion" "INFO"
                }
                catch {
                    Write-Log "[WARN] Errore aggiornamento config.json: $_" "WARN"
                }
            }
            
            # Termina tray esistente (vecchia versione) cosi la nuova partira con file aggiornati
            try {
                $old = Get-WmiObject Win32_Process | Where-Object {
                    $_.CommandLine -like "*NetworkMonitorTrayIcon.ps1*" -or $_.CommandLine -like "*Start-TrayIcon-Hidden.vbs*"
                }
                foreach ($p in $old) {
                    try { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue; Write-Log "[OK] Tray vecchia terminata (PID $($p.ProcessId))" "INFO" } catch {}
                }
                if ($old) { Start-Sleep -Seconds 1 }
            }
            catch {}
            # Avvio nuova tray (file gia scaricati sopra; servizio in session 0, icona puo non apparire
            # subito in session utente; Run o Avvia-TrayIcon al logon la avviera se serve)
            $vbsPath = Join-Path $installDir "Start-TrayIcon-Hidden.vbs"
            if (Test-Path $vbsPath) {
                try {
                    Start-Process wscript.exe -ArgumentList "`"$vbsPath`"" -WindowStyle Hidden -ErrorAction Stop
                    Write-Log "[OK] Avvio tray (Start-TrayIcon-Hidden.vbs) eseguito" "INFO"
                }
                catch {
                    Write-Log "[WARN] Avvio tray non riuscito: $_" "WARN"
                }
            }
            else {
                Write-Log "[WARN] Start-TrayIcon-Hidden.vbs non trovato, tray non avviata" "WARN"
            }
            
            # Riavvio: usciamo e lasciamo a NSSM il restart (AppExit Default Restart + AppRestartDelay).
            # NON usare Stop-Service da dentro il servizio: il SCM terminerebbe il processo prima di
            # completare sc delete / nssm / Start-Service, lasciando il servizio STOPPED -> agent offline.
            # Con exit 0, NSSM riavvia il comando dopo AppRestartDelay; il nuovo processo caricher├á
            # il NetworkMonitorService.ps1 gia sostituito su disco. Downtime ~60 sec.
            Write-Log "[INFO] File aggiornati. Uscita per riavvio tramite NSSM (AppExit Restart, ~60s)..." "INFO"
            $script:isRunning = $false
            exit 0
            
        }
        else {
            Write-Log ('[OK] Agent gia'' aggiornato: server=' + $serverVersion + ' client=' + $CurrentVersion) 'INFO'
        }
    }
    catch {
        Write-Log "[WARN] Errore controllo aggiornamenti: $($_.Exception.Message)" "WARN"
        if ($versionUrl) { Write-Log "[WARN] URL tentato: $versionUrl" "WARN" }
        if ($_.Exception.InnerException) { Write-Log "[WARN] Dettaglio: $($_.Exception.InnerException.Message)" "WARN" }
        Write-Log "[WARN] Continuo con la versione corrente..." "WARN"
    }
}

# ============================================
# MAIN
# ============================================

Write-Log "=== Network Monitor Service Avviato ==="
Write-Log "Modalita: Servizio Windows (senza GUI)"

# CLEANUP: Termina eventuali processi vecchi/duplicati all'avvio
# NOTA: non terminiamo piu' la tray (NetworkMonitorTrayIcon.ps1 / Start-TrayIcon-Hidden.vbs)
# per evitare che sparisca dopo ogni auto-update; la tray resta in vita.
Write-Log "Cleanup processi vecchi/duplicati..."
try {
    $cleanupCount = 0
    
    # Termina eventuali processi NetworkMonitor.ps1 standalone residui
    $monitorProcesses = Get-WmiObject Win32_Process | Where-Object { 
        $_.CommandLine -like "*NetworkMonitor.ps1*" -and 
        $_.ProcessId -ne $PID
    } | Select-Object ProcessId, CommandLine
    
    if ($monitorProcesses) {
        foreach ($proc in $monitorProcesses) {
            try {
                Write-Log "  Terminazione vecchio processo monitor PID $($proc.ProcessId)"
                Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop
                $cleanupCount++
            }
            catch {
                Write-Log "  Warning: impossibile terminare PID $($proc.ProcessId): $_" "WARN"
            }
        }
    }
    
    if ($cleanupCount -gt 0) {
        Write-Log "Cleanup completato: $cleanupCount processi terminati"
        Start-Sleep -Seconds 1
    }
    else {
        Write-Log "Nessun processo vecchio da terminare"
    }
}
catch {
    Write-Log "Errore durante cleanup processi: $_" "WARN"
}

# Carica configurazione
if (-not (Test-Path $ConfigPath)) {
    $errorMsg = "File config.json non trovato! Crea un file config.json con le impostazioni."
    Write-Log $errorMsg "ERROR"
    Update-StatusFile -Status "error" -Message $errorMsg
    exit 1
}

try {
    $config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
}
catch {
    $errorMsg = "Errore lettura config.json: $_"
    Write-Log $errorMsg "ERROR"
    Update-StatusFile -Status "error" -Message $errorMsg
    exit 1
}

# Se network_ranges e' vuoto, prova a derivarlo da network_ranges_config (formato nuovo)
$nr = $config.network_ranges
$nrEmpty = (-not $nr) -or (($nr -is [Array]) -and $nr.Count -eq 0)
if ($nrEmpty -and $config.network_ranges_config -and ($config.network_ranges_config -is [Array])) {
    $config.network_ranges = @($config.network_ranges_config | ForEach-Object { if ($_.range) { $_.range } else { $_ } })
    Write-Log "network_ranges derivato da network_ranges_config: $($config.network_ranges -join ', ')" "INFO"
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

# Controlla aggiornamenti agent (all'avvio)
$version = if ($config.version) { $config.version } else { $SCRIPT_VERSION }
$forcePath = Join-Path $script:scriptDir ".force_update.trigger"
if (Test-Path $forcePath) { Remove-Item $forcePath -Force -ErrorAction SilentlyContinue; $version = "0.0.0"; Write-Log "[INFO] Forzatura update (.force_update.trigger)" "INFO" }
Check-AgentUpdate -ServerUrl $config.server_url -CurrentVersion $version

# Assicura file tray (se mancanti: download da server). Poi tenta avvio tray.
# In try/catch: un errore qui non deve bloccare il servizio (loop e invio dati devono partire).
try {
    Ensure-TrayFiles -ServerUrl $config.server_url -InstallDir $script:scriptDir
    $vbsTray = Join-Path $script:scriptDir "Start-TrayIcon-Hidden.vbs"
    if (Test-Path $vbsTray) {
        $trayAlready = Get-WmiObject Win32_Process -ErrorAction SilentlyContinue | Where-Object {
            $_.CommandLine -like "*NetworkMonitorTrayIcon.ps1*" -or $_.CommandLine -like "*Start-TrayIcon-Hidden.vbs*"
        }
        if (-not $trayAlready) {
            try {
                Start-Process wscript.exe -ArgumentList "`"$vbsTray`"" -WindowStyle Hidden -ErrorAction Stop
                Write-Log "[OK] Avvio tray all'avvio servizio (Start-TrayIcon-Hidden.vbs)" "INFO"
            }
            catch { Write-Log "[WARN] Avvio tray all'avvio non riuscito: $_" "WARN" }
        }
        else { Write-Log "[INFO] Tray gia in esecuzione, skip avvio" "INFO" }
    }
}
catch {
    Write-Log "[WARN] Ensure-TrayFiles o avvio tray: $_" "WARN"
}

# Loop principale
Write-Log "Avvio loop principale..."
$nextScanTime = (Get-Date).AddSeconds(-5)
$nextHeartbeatTime = Get-Date  # Heartbeat ogni 5 minuti
$script:nextUpdateCheckTime = (Get-Date).AddMinutes(2)  # Check aggiornamenti ogni 2 min (oltre a heartbeat e post-scan)
Write-Log "Prima scansione programmata immediatamente (nextScanTime: $($nextScanTime.ToString('HH:mm:ss')))"

while ($script:isRunning) {
    try {
        $now = Get-Date
        
        # Heartbeat periodico (ogni 5 minuti) per verificare configurazione server
        if ($now -ge $nextHeartbeatTime) {
            Write-Log "Invio heartbeat..."
            try {
                $version = if ($config.version) { $config.version } else { $SCRIPT_VERSION }
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
                if ($heartbeatResult.success) {
                    Write-Log "Heartbeat completato"
                    
                    # Unifi: credenziali solo da server (GET /agent/config), mai in config.json n├® su disco
                    if ($heartbeatResult.config -and $heartbeatResult.config.unifi_config) {
                        $script:unifiConfig = $heartbeatResult.config.unifi_config
                    }
                    # Prova connessione Unifi richiesta da interfaccia: esegui test sulla LAN e invia esito
                    if ($heartbeatResult.pending_unifi_test) {
                        $pu = $heartbeatResult.pending_unifi_test
                        try {
                            Invoke-UnifiConnectionTestAndReport -TestId $pu.test_id -Url $pu.url -Username $pu.username -Password $pu.password -ServerUrl $config.server_url -ApiKey $config.api_key
                        }
                        catch {
                            Write-Log "Errore test Unifi (Prova connessione): $_" "WARN"
                        }
                    }
                }
                else {
                    Write-Log "Heartbeat fallito: $($heartbeatResult.error)" "WARN"
                }
            }
            catch {
                Write-Log "Errore heartbeat: $_" "WARN"
                # Traccia tentativo fallito
                $script:failedHeartbeatCount++
                if (-not $script:networkIssueStartTime) {
                    $script:networkIssueStartTime = Get-Date
                }
            }
            
            # Prossimo heartbeat tra 5 minuti
            $nextHeartbeatTime = $now.AddMinutes(5)
            
            # Controlla aggiornamenti agent (ogni heartbeat)
            try {
                $version = if ($config.version) { $config.version } else { $SCRIPT_VERSION }
                $fp = Join-Path $script:scriptDir ".force_update.trigger"
                if (Test-Path $fp) { Remove-Item $fp -Force -ErrorAction SilentlyContinue; $version = "0.0.0"; Write-Log "[INFO] Forzatura update (.force_update.trigger)" "INFO" }
                Check-AgentUpdate -ServerUrl $config.server_url -CurrentVersion $version
            }
            catch {
                Write-Log "Errore controllo aggiornamenti: $_" "WARN"
            }
        }
        elseif ($now -ge $script:nextUpdateCheckTime) {
            # Controlla aggiornamenti ogni 2 min (oltre a heartbeat e post-scan)
            $script:nextUpdateCheckTime = $now.AddMinutes(2)
            try {
                $version = if ($config.version) { $config.version } else { $SCRIPT_VERSION }
                $fp = Join-Path $script:scriptDir ".force_update.trigger"
                if (Test-Path $fp) { Remove-Item $fp -Force -ErrorAction SilentlyContinue; $version = "0.0.0"; Write-Log "[INFO] Forzatura update (.force_update.trigger)" "INFO" }
                Check-AgentUpdate -ServerUrl $config.server_url -CurrentVersion $version
            }
            catch { Write-Log "Errore controllo aggiornamenti (2min): $_" "WARN" }
        }
        
        # Controlla se c'├¿ una richiesta di scansione forzata
        $forceScan = $false
        if (Test-Path $script:forceScanTriggerFile) {
            Write-Log "Richiesta scansione forzata rilevata..."
            $forceScan = $true
            # Elimina il file trigger dopo averlo letto
            try {
                Remove-Item $script:forceScanTriggerFile -Force -ErrorAction SilentlyContinue
            }
            catch {
                # Ignora errori eliminazione file
            }
        }
        
        # Controlla se ├¿ il momento di eseguire una scansione (programmata o forzata)
        if ($now -ge $nextScanTime -or $forceScan) {
            if ($forceScan) {
                Write-Log "Esecuzione scansione FORZATA..."
            }
            else {
                Write-Log "Esecuzione scansione programmata..."
            }
            Update-StatusFile -Status "scanning" -Message "Scansione in corso..."
            
            # Reset lista IP trovati per la tray icon
            try {
                @() | ConvertTo-Json -Compress | Out-File -FilePath $script:currentScanIPsFile -Encoding UTF8 -Force
            }
            catch {
                # Ignora errori reset file IP
            }
            
            try {
                # 1. Scan rete
                Write-Log "Avvio scansione rete..." "INFO"
                try {
                    $devices = Get-NetworkDevices -NetworkRanges $config.network_ranges -UnifiConfig $script:unifiConfig
                    Write-Log "Trovati $($devices.Count) dispositivi" "INFO"
                    $script:lastScanDevices = $devices.Count
                }
                catch {
                    Write-Log "ERRORE CRITICO durante Get-NetworkDevices: $_" "ERROR"
                    Write-Log "Stack trace: $($_.Exception.StackTrace)" "ERROR"
                    # Continua con array vuoto invece di bloccare tutto
                    $devices = @()
                    $script:lastScanDevices = 0
                }
                
                # 2. Invio dati se ci sono dispositivi
                if ($devices.Count -gt 0) {
                    Write-Log "Invio dati al server..."
                    $result = Send-ScanResults -Devices $devices -ServerUrl $config.server_url -ApiKey $config.api_key
                    Write-Log "Dati inviati con successo!"
                    
                    # IMPORTANTE: Salva IP trovati nel file per la tray icon (dopo invio dati)
                    # Questo assicura che gli IP siano sempre visibili anche se Get-NetworkDevices non li ha salvati
                    try {
                        $ipDataArray = @()
                        foreach ($device in $devices) {
                            $ipDataArray += @{
                                ip  = $device.ip_address
                                mac = if ($device.mac_address) { $device.mac_address } else { $null }
                            }
                        }
                        $ipDataArray | ConvertTo-Json -Compress | Out-File -FilePath $script:currentScanIPsFile -Encoding UTF8 -Force
                        Write-Log "IP salvati per tray icon: $($ipDataArray.Count) dispositivi" "INFO"
                    }
                    catch {
                        Write-Log "Errore salvataggio IP finali per tray icon: $_" "WARN"
                    }
                }
                else {
                    Write-Log "Nessun dispositivo trovato, skip invio"
                    # Salva array vuoto per indicare che non ci sono IP
                    try {
                        @() | ConvertTo-Json -Compress | Out-File -FilePath $script:currentScanIPsFile -Encoding UTF8 -Force
                    }
                    catch {
                        # Ignora errori
                    }
                }

                # Sync switch gestiti (SNMP in locale: agent sulla stessa LAN dello switch)
                try {
                    Sync-ManagedSwitchesSnmp -ServerUrl $config.server_url -ApiKey $config.api_key
                }
                catch {
                    Write-Log "Errore sync switch SNMP: $_" "WARN"
                }
                
                # 3. Aggiorna stato
                $script:lastScanTime = Get-Date
                Update-StatusFile -Status "running" -Message "Ultima scansione completata" -LastScan $script:lastScanTime -DevicesFound $script:lastScanDevices
                Write-Log "Scansione completata con successo"
                
                # 4. Ricalcola prossima scansione basandosi sul nuovo last_scan
                # Questo ├¿ importante anche per scansioni forzate, cos├¼ il conto alla rovescia riparte correttamente
                $nextScanTime = $script:lastScanTime.AddMinutes($script:scanIntervalMinutes)
                if ($forceScan) {
                    Write-Log "Scansione forzata completata. Prossima scansione programmata: $($nextScanTime.ToString('HH:mm:ss')) (intervallo: $script:scanIntervalMinutes minuti)"
                }
                else {
                    Write-Log "Prossima scansione: $($nextScanTime.ToString('HH:mm:ss')) (intervallo: $script:scanIntervalMinutes minuti)"
                }
                
                # Controlla aggiornamenti anche dopo scansione (oltre che a ogni heartbeat)
                try {
                    $v = if ($config.version) { $config.version.ToString().Trim() } else { $SCRIPT_VERSION }
                    $fp = Join-Path $script:scriptDir ".force_update.trigger"
                    if (Test-Path $fp) { Remove-Item $fp -Force -ErrorAction SilentlyContinue; $v = "0.0.0"; Write-Log "[INFO] Forzatura update (.force_update.trigger)" "INFO" }
                    Check-AgentUpdate -ServerUrl $config.server_url -CurrentVersion $v
                }
                catch { Write-Log "Errore controllo aggiornamenti (post-scan): $_" "WARN" }
            }
            catch {
                Write-Log "Errore durante scansione: $_" "ERROR"
                Write-Log "Stack trace: $($_.Exception.StackTrace)" "ERROR"
                Update-StatusFile -Status "error" -Message "Errore: $_"
                
                # Anche in caso di errore, ricalcola nextScanTime per evitare loop infiniti
                if ($forceScan) {
                    # Per scansione forzata fallita, ricalcola comunque basandosi su ora
                    $nextScanTime = (Get-Date).AddMinutes($script:scanIntervalMinutes)
                }
                else {
                    # Per scansione programmata fallita, ricalcola normalmente
                    $nextScanTime = (Get-Date).AddMinutes($script:scanIntervalMinutes)
                }
            }
        }
        
        # Dormi per 5 secondi prima di controllare di nuovo (ridotto da 30 per reattivit├á migliore)
        # Questo permette di rilevare scansioni forzate pi├╣ rapidamente
        Start-Sleep -Seconds 5
        
    }
    catch {
        Write-Log "Errore nel loop principale: $_" "ERROR"
        Start-Sleep -Seconds 60
    }
}

Write-Log "=== Network Monitor Service Arrestato ==="
Update-StatusFile -Status "stopping" -Message "Servizio in arresto"

