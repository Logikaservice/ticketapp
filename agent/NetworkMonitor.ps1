# NetworkMonitor.ps1
# Agent PowerShell per monitoraggio rete - Invio dati al server TicketApp
# Versione: 2.3.0 - Trust ARP + Auto-update completo + Cleanup automatico

param(
    [string]$ConfigPath = "config.json",
    [switch]$TestMode = $false
)

$AGENT_VERSION = "2.6.12"

# Forza TLS 1.2 per Invoke-RestMethod (compatibilità hardening TLS su Windows/Server)
function Enable-Tls12 {
    try {
        [Net.ServicePointManager]::SecurityProtocol = `
        ([Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls)
    }
    catch {
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
        [string]$ApiKey,
        [string]$CurrentVersion
    )

    try {
        $updateUrl = "$ServerUrl/api/network-monitoring/agent/update-check?version=$CurrentVersion"
        $response = Invoke-RestMethod -Uri $updateUrl -Headers @{ "X-API-Key" = $ApiKey } -Method Get -ErrorAction Stop

        if ($response.update_available) {
            Write-Log "Aggiornamento disponibile: $($response.new_version). Scaricamento in corso..." "INFO"
            
            $tempFile = "$env:TEMP\NetworkMonitor_Update.ps1"
            Invoke-WebRequest -Uri $response.download_url -OutFile $tempFile -ErrorAction Stop

            # Validazione base del file scaricato
            if ((Get-Item $tempFile).Length -gt 1000) {
                Write-Log "Aggiornamento scaricato. Riavvio agente per applicare..." "INFO"
                
                # Script di aggiornamento che sostituisce il file e riavvia il servizio/processo
                $updateScript = @"
Start-Sleep -Seconds 5
Copy-Item -Path '$tempFile' -Destination '$PSCommandPath' -Force
Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File `"$PSCommandPath`"" -WindowStyle Hidden
"@
                $updateBat = "$env:TEMP\update_agent.ps1"
                Set-Content -Path $updateBat -Value $updateScript
                
                Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File `"$updateBat`"" -WindowStyle Hidden
                exit
            }
            else {
                Write-Log "File aggiornamento troppo piccolo, probabile errore download." "WARN"
            }
        }
    }
    catch {
        Write-Log "Errore controllo aggiornamenti: $_" "WARN"
    }
}

function Get-ArpTable {
    param([string]$NetworkPrefix)
    
    $arpDevices = @{}
    
    try {
        # Metodo 1: Get-NetNeighbor (Windows 8+, più affidabile)
        # Filtra solo stati validi. Escludiamo "Unreachable", "Incomplete" e "Probe" per evitare falsi positivi (dispositivi offline ma in cache)
        $validStates = "Reachable", "Permanent", "Stale", "Delay"
        $neighbors = Get-NetNeighbor -AddressFamily IPv4 -ErrorAction SilentlyContinue | 
        Where-Object { $_.IPAddress -like "$NetworkPrefix*" -and $_.State -in $validStates }
        
        foreach ($neighbor in $neighbors) {
            $ip = $neighbor.IPAddress
            $mac = $neighbor.LinkLayerAddress
            
            if ($mac -and $mac -ne "00-00-00-00-00-00" -and $mac -ne "FF-FF-FF-FF-FF-FF") {
                # Normalizza MAC per log (usa :)
                $macDisplay = $mac -replace '-', ':'
                
                # Stores original mac (often with dashes from Windows) for compatibility, will be normalized later
                $arpDevices[$ip] = $mac
                Write-Log "ARP: $ip → $macDisplay" "DEBUG"
            }
        }
    }
    catch {
        Write-Log "Get-NetNeighbor fallito, provo arp.exe: $_" "WARN"
    }
    
    # Metodo 2: arp.exe (fallback per sistemi più vecchi)
    if ($arpDevices.Count -eq 0) {
        try {
            $arpOutput = arp -a | Select-String -Pattern '^\s+(\d+\.\d+\.\d+\.\d+)\s+([0-9a-f]{2}[-:][0-9a-f]{2}[-:][0-9a-f]{2}[-:][0-9a-f]{2}[-:][0-9a-f]{2}[-:][0-9a-f]{2})' -AllMatches
            
            foreach ($match in $arpOutput.Matches) {
                $ip = $match.Groups[1].Value
                $mac = $match.Groups[2].Value.ToUpper() -replace ':', '-'
                
                if ($ip -like "$NetworkPrefix*" -and $mac -ne "00-00-00-00-00-00" -and $mac -ne "FF-FF-FF-FF-FF-FF") {
                    $arpDevices[$ip] = $mac
                    Write-Log "ARP (arp.exe): $ip → $mac" "DEBUG"
                }
            }
        }
        catch {
            Write-Log "arp.exe fallito: $_" "ERROR"
        }
    }
    
    return $arpDevices
}

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
        <#
        add-type @"
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
        [System.Net.ServicePointManager]::CertificatePolicy = New-Object TrustAllCertsPolicy
        #>

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

        # 2. Recupera devices (site default). Controller: /api/... | UDM/UCG: /proxy/network/api/...
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
        Write-Log "[OK] Unifi: trovati $($upgrades.Count) dispositivi aggiornabili" "INFO"

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

        return @{ Upgrades = $upgrades; Names = $clientNames }
    }
    catch {
        Write-Log "[WARN] Errore integrazione Unifi: $_" "WARN"
        return @{ Upgrades = @{}; Names = @{} }
    }
}

# Recupera dispositivi WiFi dal router (AGCOMBO/TIM) e invia al server
function Invoke-RouterWifiFetchAndReport {
    param([string]$TaskId, [string]$RouterIp, [string]$ControllerUrl, [string]$Username, [string]$Password, [string]$RouterModel, [string]$DeviceId, [string]$ServerUrl, [string]$ApiKey)
    $devices = @(); $errMsg = ""
    try {
        # Unifi / Ubiquiti Cloud Key: API stat/device (AP e dispositivi gestiti)
        if ($RouterModel -match '^Unifi|^Ubiquiti|^UCK') {
            # Usa URL completo con porta (es. https://192.168.1.156:8443) se fornito dal server, altrimenti prova :8443
            $base = if ($ControllerUrl -and $ControllerUrl.Trim()) { $ControllerUrl.Trim().TrimEnd('/') } else { "https://${RouterIp}:8443" }
            Write-Log "Controller WiFi (Unifi): inizio connessione a $base (modello: $RouterModel, user: $Username)" "INFO"
            # Bypass certificato SSL auto-firmato per UniFi controller
            add-type -ErrorAction SilentlyContinue @"
                using System.Net; using System.Security.Cryptography.X509Certificates;
                public class TrustAllCertsPolicy : ICertificatePolicy { public bool CheckValidationResult(ServicePoint s, X509Certificate c, WebRequest r, int p) { return true; } }
"@
            [System.Net.ServicePointManager]::CertificatePolicy = New-Object TrustAllCertsPolicy
            [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
            
            if (-not $base.StartsWith('http')) { $base = "https://$base" }
            $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
            $loginBody = @{username = $Username; password = $Password } | ConvertTo-Json
            try {
                # Prova diversi endpoint di login (UniFi OS vs vecchio controller)
                $loginOk = $false
                $loginEndpoints = @("/api/auth/login", "/api/login")
                foreach ($loginPath in $loginEndpoints) {
                    try {
                        Write-Log "Controller WiFi: tentativo login su $base$loginPath..." "INFO"
                        $loginResp = Invoke-WebRequest -Uri "$base$loginPath" -Method Post -Body $loginBody -ContentType "application/json" -WebSession $session -UseBasicParsing -TimeoutSec 20 -ErrorAction Stop
                        Write-Log "Controller WiFi: login OK (status $($loginResp.StatusCode)) su $loginPath" "INFO"
                        $loginOk = $true
                        break
                    }
                    catch {
                        $statusCode = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
                        Write-Log "Controller WiFi: login fallito su $loginPath - status=$statusCode, errore: $($_.Exception.Message)" "WARN"
                        if ($statusCode -eq 401 -or $statusCode -eq 403) {
                            # Credenziali errate - non provare altri endpoint
                            $errMsg = "Credenziali errate (401/403). Verifica username e password in KeePass."
                            throw $errMsg
                        }
                    }
                }
                if (-not $loginOk) { throw "Login fallito su tutti gli endpoint" }
                
                # Prova diversi endpoint per i dispositivi
                Write-Log "Controller WiFi: login riuscito, recupero dispositivi..." "INFO"
                $devicesRes = $null
                $deviceEndpoints = @("/proxy/network/api/s/default/stat/device", "/api/s/default/stat/device")
                foreach ($devPath in $deviceEndpoints) {
                    try {
                        Write-Log "Controller WiFi: tentativo GET $base$devPath..." "INFO"
                        $devicesRes = Invoke-RestMethod -Uri "$base$devPath" -Method Get -WebSession $session -TimeoutSec 20 -ErrorAction Stop
                        Write-Log "Controller WiFi: risposta ricevuta da $devPath" "INFO"
                        break
                    }
                    catch {
                        Write-Log "Controller WiFi: GET fallito su $devPath - $($_.Exception.Message)" "WARN"
                    }
                }
                # Mappa MAC AP -> oggetto AP (per associare client agli AP)
                $apMap = @{}
                
                if ($devicesRes -and $devicesRes.data) {
                    Write-Log "Controller WiFi: trovati $($devicesRes.data.Count) dispositivi nella risposta" "INFO"
                    foreach ($d in $devicesRes.data) {
                        if (-not $d.mac -or $d.mac -match '00:00:00|FF:FF:FF') { continue }
                        $mac = $d.mac -replace '-', ':'
                        $ip = if ($d.ip) { $d.ip }elseif ($d.last_ip) { $d.last_ip }else { '' }
                        $name = if ($d.name) { $d.name }else { '' }
                        $devices += @{mac = $mac; ip = $ip; hostname = $name; type = 'ap'}
                        $apMap[$mac] = @{mac = $mac; ip = $ip; name = $name}
                        Write-Log "  - AP: $mac, IP: $ip, Nome: $name" "INFO"
                    }
                }
                elseif ($devicesRes) {
                    Write-Log "Controller WiFi: risposta ricevuta ma nessun campo 'data' trovato" "WARN"
                }
                
                # Recupera anche i client connessi agli AP
                Write-Log "Controller WiFi: recupero client connessi agli AP..." "INFO"
                $clientsRes = $null
                $clientEndpoints = @("/proxy/network/api/s/default/stat/user", "/api/s/default/stat/user", "/proxy/network/api/s/default/stat/sta", "/api/s/default/stat/sta")
                foreach ($clientPath in $clientEndpoints) {
                    try {
                        Write-Log "Controller WiFi: tentativo GET $base$clientPath..." "INFO"
                        $clientsRes = Invoke-RestMethod -Uri "$base$clientPath" -Method Get -WebSession $session -TimeoutSec 20 -ErrorAction Stop
                        Write-Log "Controller WiFi: risposta client ricevuta da $clientPath" "INFO"
                        break
                    }
                    catch {
                        Write-Log "Controller WiFi: GET client fallito su $clientPath - $($_.Exception.Message)" "WARN"
                    }
                }
                
                if ($clientsRes -and $clientsRes.data) {
                    Write-Log "Controller WiFi: trovati $($clientsRes.data.Count) client connessi" "INFO"
                    foreach ($c in $clientsRes.data) {
                        if (-not $c.mac -or $c.mac -match '00:00:00|FF:FF:FF') { continue }
                        $clientMac = $c.mac -replace '-', ':'
                        $clientIp = if ($c.ip) { $c.ip }elseif ($c.fixed_ip) { $c.fixed_ip }else { '' }
                        $clientName = if ($c.hostname) { $c.hostname }elseif ($c.name) { $c.name }else { '' }
                        $apMac = if ($c.ap_mac) { ($c.ap_mac -replace '-', ':') }else { '' }
                        
                        # Se il client è collegato a un AP che abbiamo trovato, aggiungilo con riferimento
                        if ($apMac -and $apMap.ContainsKey($apMac)) {
                            $devices += @{mac = $clientMac; ip = $clientIp; hostname = $clientName; type = 'client'; ap_mac = $apMac}
                            Write-Log "  - Client: $clientMac, IP: $clientIp, Nome: $clientName, AP: $apMac" "INFO"
                        }
                        else {
                            # Client senza AP o AP non trovato: aggiungi comunque ma senza ap_mac
                            $devices += @{mac = $clientMac; ip = $clientIp; hostname = $clientName; type = 'client'}
                            Write-Log "  - Client (senza AP): $clientMac, IP: $clientIp, Nome: $clientName" "INFO"
                        }
                    }
                }
                
                Write-Log "Unifi Controller: trovati $($devices.Count) dispositivi totali (AP + client)" "INFO"
            }
            catch { $errMsg = if ($_.Exception.Message) { $_.Exception.Message }else { "Errore Unifi" }; Write-Log "Controller WiFi (Unifi): ERRORE - $errMsg" "WARN" }
            try { $body = @{task_id = $TaskId; success = ($errMsg -eq ""); devices = $devices; error = $errMsg; device_id = $DeviceId } | ConvertTo-Json -Depth 4; Invoke-RestMethod -Uri "$ServerUrl/api/network-monitoring/agent/router-wifi-result" -Method POST -Headers @{"Content-Type" = "application/json"; "X-API-Key" = $ApiKey } -Body $body -TimeoutSec 15 -ErrorAction Stop | Out-Null; Write-Log "Risultato Controller WiFi inviato (success=$($errMsg -eq ''), devices=$($devices.Count), error=$errMsg)" "INFO" }catch { Write-Log "Invio risultato Controller WiFi fallito: $_" "WARN" }
            return
        }
        $base = "http://$RouterIp"; $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
        $session.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        $loginPaths = @("/", "/login", "/cgi-bin/login")
        $loggedIn = $false
        foreach ($path in $loginPaths) {
            try {
                $body = if ($path -eq "/") { "user=$([uri]::EscapeDataString($Username))&pwd=$([uri]::EscapeDataString($Password))" }else { "username=$([uri]::EscapeDataString($Username))&password=$([uri]::EscapeDataString($Password))" }
                $r = Invoke-WebRequest -Uri "$base$path" -Method Post -Body $body -ContentType "application/x-www-form-urlencoded" -WebSession $session -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
                if ($r.StatusCode -eq 200 -and $r.Content -notmatch "login|Login") { $loggedIn = $true; break }
            }
            catch {}
        }
        if (-not $loggedIn) {
            try { $cred = [System.Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${Username}:${Password}")); $r = Invoke-WebRequest -Uri $base -Headers @{Authorization = "Basic $cred" } -WebSession $session -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop; $loggedIn = $true }catch {}
        }
        if (-not $loggedIn) { $errMsg = "Login fallito"; throw $errMsg }
        $html = ""
        foreach ($url in @("$base/", "$base/index.html", "$base/device-modal.lp")) {
            try { $resp = Invoke-WebRequest -Uri $url -WebSession $session -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop; $html = $resp.Content; if ($html -match "Host-|192\.168\.|dispositiv") { break } }catch {}
        }
        if (-not $html) { $errMsg = "Pagina dispositivi non recuperata"; throw $errMsg }
        # Solo WiFi: estrai solo sezione Wi-Fi (AGCOMBO/TIM: Wi-Fi vs Ethernet)
        $extractHtml = $html; if ($html -match '(?si)(Wi-?Fi|WiFi|2\.4\s*GHz|5\s*GHz).*?(?=Ethernet|USB|Telefono|Controllo\s*Accesso|$)') { $extractHtml = $matches[0] }
        $macPattern = '([0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2})'
        $ipPattern = '\b(192\.168\.\d{1,3}\.\d{1,3})\b'
        $lines = $extractHtml -split "`n|>"; $seen = @{}
        foreach ($line in $lines) { if ($line -match $macPattern -and $line -match $ipPattern) { $mac = $matches[1] -replace '-', ':'; $ip = [regex]::Match($line, $ipPattern).Value; $key = "$mac|$ip"; if (-not $seen[$key]) { $seen[$key] = $true; $devices += @{mac = $mac; ip = $ip; hostname = "" } } } }
        if ($devices.Count -eq 0) { $allMacs = [regex]::Matches($extractHtml, $macPattern) | % { $_.Value -replace '-', ':' }; $allIps = [regex]::Matches($extractHtml, $ipPattern) | % { $_.Value } | ? { $_ -ne $RouterIp -and $_ -notmatch "255$" }; $idx = 0; foreach ($mac in $allMacs) { if ($mac -match "00:00:00|FF:FF:FF") { continue }; $ip = if ($idx -lt $allIps.Count) { $allIps[$idx] }else { "" }; $idx++; $devices += @{mac = $mac; ip = $ip; hostname = "" } } }
        Write-Log "Router WiFi: trovati $($devices.Count) dispositivi" "INFO"
    }
    catch { $errMsg = if ($_.Exception.Message) { $_.Exception.Message }else { "Errore" }; Write-Log "Router WiFi: $errMsg" "WARN" }
    try { $body = @{task_id = $TaskId; success = ($errMsg -eq ""); devices = $devices; error = $errMsg; device_id = $DeviceId } | ConvertTo-Json -Depth 4; Invoke-RestMethod -Uri "$ServerUrl/api/network-monitoring/agent/router-wifi-result" -Method POST -Headers @{"Content-Type" = "application/json"; "X-API-Key" = $ApiKey } -Body $body -TimeoutSec 15 -ErrorAction Stop | Out-Null; Write-Log "Risultato Router WiFi inviato" "INFO" }catch { Write-Log "Invio risultato Router WiFi fallito: $_" "WARN" }
}

# Test connessione Unifi richiesto da interfaccia ("Prova connessione"): esegue login+stat/device e invia esito al server
function Invoke-UnifiConnectionTestAndReport {
    param([string]$TestId, [string]$Url, [string]$Username, [string]$Password, [string]$ServerUrl, [string]$ApiKey)
    $ok = $false
    $msg = ""
    try {
        $base = ($Url -as [string]).Trim().TrimEnd('/')
        if (-not $base) { $msg = "URL non valido"; throw $msg }
        
        # Bypass certificato SSL auto-firmato per UniFi controller
        add-type -ErrorAction SilentlyContinue @"
            using System.Net; using System.Security.Cryptography.X509Certificates;
            public class TrustAllCertsPolicy : ICertificatePolicy { public bool CheckValidationResult(ServicePoint s, X509Certificate c, WebRequest r, int p) { return true; } }
"@
        [System.Net.ServicePointManager]::CertificatePolicy = New-Object TrustAllCertsPolicy
        [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
        
        $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
        $loginBody = @{ username = $Username; password = $Password } | ConvertTo-Json
        
        try { 
            Invoke-WebRequest -Uri "$base/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -WebSession $session -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop | Out-Null 
        }
        catch { 
            if ($_.Exception.Response.StatusCode -eq "NotFound") { 
                Invoke-WebRequest -Uri "$base/api/login" -Method Post -Body $loginBody -ContentType "application/json" -WebSession $session -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop | Out-Null 
            }
            else { 
                throw 
            } 
        }
        
        try { 
            Invoke-RestMethod -Uri "$base/api/s/default/stat/device" -Method Get -WebSession $session -TimeoutSec 15 -ErrorAction Stop | Out-Null 
        }
        catch { 
            Invoke-RestMethod -Uri "$base/proxy/network/api/s/default/stat/device" -Method Get -WebSession $session -TimeoutSec 15 -ErrorAction Stop | Out-Null 
        }
        
        $ok = $true
        $msg = "Connessione OK"
    }
    catch { 
        $ok = $false
        if ($_.Exception.Message) { $msg = $_.Exception.Message } else { $msg = "Errore connessione" }
        Write-Log "Test Unifi (Prova connessione): $msg" "WARN" 
    }
    
    try {
        $body = @{ test_id = $TestId; success = $ok; message = $msg } | ConvertTo-Json
        Invoke-RestMethod -Uri "$ServerUrl/api/network-monitoring/agent/unifi-test-result" -Method POST -Headers @{ "Content-Type" = "application/json"; "X-API-Key" = $ApiKey } -Body $body -TimeoutSec 10 -ErrorAction Stop | Out-Null
        Write-Log "Esito test Unifi inviato: $(if($ok){'OK'}else{'Errore'})" "INFO"
    }
    catch { 
        Write-Log "Invio esito test Unifi fallito: $_" "WARN" 
    }
}

function Get-NetworkDevices {
    param(
        [string[]]$NetworkRanges,
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
    
    # Ottieni IP locale del PC dove gira l'agent
    $localIP = $null
    try {
        $networkAdapters = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" }
        if ($networkAdapters) {
            $localIP = $networkAdapters[0].IPAddress
            Write-Log "IP locale rilevato: $localIP" "DEBUG"
        }
    }
    catch {
        Write-Log "Impossibile ottenere IP locale: $_" "WARN"
    }
    
    foreach ($range in $NetworkRanges) {
        Write-Log "Scansione range: $range (Trust ARP mode)"
        
        # Estrai subnet e calcola range IP
        if ($range -match '^(\d+\.\d+\.\d+)\.(\d+)/(\d+)$') {
            $baseIP = $matches[1]
            $subnetMask = [int]$matches[3]
            Write-Log "DEBUG: Subnet $baseIP/$subnetMask detected"
            
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
                # FASE 4: Processa ogni dispositivo in ARP table
                foreach ($ip in $arpTable.Keys) {
                    $macAddress = $arpTable[$ip]
                    Write-Log "Processando dispositivo ARP: $ip ($macAddress)" "DEBUG"
                    
                    # Test se risponde al ping
                    $pingResponsive = Test-Connection -ComputerName $ip -Count 1 -Quiet -ErrorAction SilentlyContinue
                    
                    $hostname = $null
                    
                    if ($localIP -and $ip -eq $localIP) {
                        $pingResponsive = $true
                        $hostname = $env:COMPUTERNAME
                    }
                    else {
                        try {
                            $dnsResult = Resolve-DnsName -Name $ip -ErrorAction SilentlyContinue -DnsOnly
                            if ($dnsResult -and $dnsResult.NameHost) {
                                $hostname = $dnsResult.NameHost
                            }
                        }
                        catch {
                            # Ignore
                        }
                    }
                    
                    $vendor = $null
                    
                    $upgradeAvailable = $false
                    $unifiName = $null
                    
                    if ($macAddress) {
                        $macNorm = ($macAddress -replace ':', '-').ToUpper()
                        if ($unifiUpgrades -and $unifiUpgrades.ContainsKey($macNorm)) {
                            $upgradeAvailable = $true
                        }
                        if ($unifiNames -and $unifiNames.ContainsKey($macNorm)) {
                            $unifiName = $unifiNames[$macNorm]
                            if (-not $hostname) { $hostname = $unifiName }
                        }
                    }

                    # Normalizzazione MAC: Standard con due punti (AA:BB:CC:DD:EE:FF)
                    $macForPayload = $macAddress
                    if ($macAddress) {
                        # Rimpiazza trattini con due punti
                        $macForPayload = $macAddress -replace '-', ':'
                    }

                    $device = @{
                        ip_address        = $ip
                        mac_address       = $macForPayload
                        hostname          = $hostname
                        vendor            = $vendor
                        status            = "online"
                        ping_responsive   = $pingResponsive
                        upgrade_available = $upgradeAvailable
                        unifi_name        = $unifiName
                    }
                    $devices += $device
                    
                    $statusLabel = "[WARN] No Ping"
                    if ($pingResponsive) {
                        $statusLabel = "[OK] Ping OK"
                    }
                    # Log visivo con MAC normalizzato
                    $logMac = if ($macForPayload) { $macForPayload } else { "NO-MAC" }
                    Write-Log "Dispositivo: $ip [$logMac] → $statusLabel" "INFO"
                }
            }
            else {
                Write-Log "Subnet mask troppo grande per scansione completa: $range" "WARN"
            }
        }
        else {
            Write-Log "Formato range IP non supportato: $range (atteso: x.x.x.x/24)" "WARN"
        }
    }
    
    Write-Log "Scansione completata" "INFO"
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
            }
            catch {
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
                        device_ip   = $device.ip_address
                        change_type = "new_device"
                        old_value   = $null
                        new_value   = $device.ip_address
                    }
                }
            }
            
            # Dispositivi offline (non più nella scansione)
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
        
        $scanData | Out-File -FilePath $LastScanPath -Encoding UTF8
        
        return $response
    }
    catch {
        Write-Log "Errore invio dati: $_" "ERROR"
        
        # Tentativo di leggere il body della risposta per dettagli errore
        try {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $body = $reader.ReadToEnd()
            $reader.Close()
            Write-Log "Dettagli errore server: $body" "ERROR"
        }
        catch {
            # Se fallisce la lettura del body, ignora
        }

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
            config  = $response
        }
    }
    catch {
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
        }
        catch {
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
        }
        catch {
            Write-Log "Errore aggiornamento Scheduled Task: $_" "WARN"
            return $false
        }
    }
    catch {
        Write-Log "Errore generico in Update-ScheduledTaskInterval: $_" "ERROR"
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
            "X-API-Key"    = $ApiKey
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

        $pendingUnifi = $response.pending_unifi_test
        
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
            }
            catch {
                Write-Log "Errore verifica configurazione server: $_" "DEBUG"
                # Non bloccare l'esecuzione se il controllo configurazione fallisce
            }
        }
        
        return @{ success = $true; uninstall = $false; pending_unifi_test = $pendingUnifi }
    }
    catch {
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
        }
        else {
            Write-Log "Scheduled Task non trovato (già rimosso?)" "WARN"
        }
    }
    catch {
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
}
catch {
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
    }
    else {
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

    # Prova connessione Unifi richiesta da interfaccia: esegui test sulla LAN e invia esito
    if ($heartbeatResult.pending_unifi_test) {
        $pu = $heartbeatResult.pending_unifi_test
        try {
            Invoke-UnifiConnectionTestAndReport -TestId $pu.test_id -Url $pu.url -Username $pu.username -Password $pu.password -ServerUrl $config.server_url -ApiKey $config.api_key
        }
        catch { Write-Log "Errore test Unifi (Prova connessione): $_" "WARN" }
    }
    # Recupera dispositivi WiFi dal router (AGCOMBO etc.)
    # Recupera dispositivi WiFi dal router (AGCOMBO et al) - Supporto Multiplo
    if ($heartbeatResult.pending_router_wifi_tasks) {
        foreach ($prw in $heartbeatResult.pending_router_wifi_tasks) {
            try {
                Invoke-RouterWifiFetchAndReport -TaskId $prw.task_id -RouterIp $prw.router_ip -ControllerUrl $prw.controller_url -Username $prw.username -Password $prw.password -RouterModel $prw.router_model -DeviceId $prw.device_id -ServerUrl $config.server_url -ApiKey $config.api_key
            }
            catch { Write-Log "Errore Router WiFi (Task multiplo): $_" "WARN" }
        }
    }
    elseif ($heartbeatResult.pending_router_wifi_task) {
        $prw = $heartbeatResult.pending_router_wifi_task
        try {
            Invoke-RouterWifiFetchAndReport -TaskId $prw.task_id -RouterIp $prw.router_ip -ControllerUrl $prw.controller_url -Username $prw.username -Password $prw.password -RouterModel $prw.router_model -DeviceId $prw.device_id -ServerUrl $config.server_url -ApiKey $config.api_key
        }
        catch { Write-Log "Errore Router WiFi: $_" "WARN" }
    }
    
    # Recupera configurazione Unifi (se presente sul server)
    $serverConfigInfo = Get-ServerConfig -ServerUrl $config.server_url -ApiKey $config.api_key
    $unifiConfig = $null
    if ($serverConfigInfo.success -and $serverConfigInfo.config.unifi_config) {
        $unifiConfig = $serverConfigInfo.config.unifi_config
        # Converti PSObject a Hashtable se necessario
        if ($unifiConfig -is [PSCustomObject]) {
            # Basic conversion needed for properties
        }
    }

    # 2. Scan rete
    Write-Log "Avvio scansione rete..."
    $devices = Get-NetworkDevices -NetworkRanges $config.network_ranges -UnifiConfig $unifiConfig
    Write-Log "Trovati $($devices.Count) dispositivi"
    
    # 3. Invio dati se ci sono dispositivi
    if ($devices.Count -gt 0) {
        Write-Log "Invio dati al server..."
        $result = Send-ScanResults -Devices $devices -ServerUrl $config.server_url -ApiKey $config.api_key
        Write-Log "Dati inviati con successo!"
    }
    else {
        Write-Log "Nessun dispositivo trovato, skip invio"
    }
    
    Write-Log "=== Scansione completata ==="
    exit 0
    
}
catch {
    Write-Log "Errore durante scansione: $_" "ERROR"
    Write-Log "Stack trace: $($_.Exception.StackTrace)" "ERROR"
    exit 1
}
