# Test-RouterWifi.ps1
# Script di test locale per estrarre dispositivi WiFi da router AGCOMBO/TIM.
# Esegui sul PC dove gira l'agent (stessa rete del router) per verificare login e scraping.
# Non invia nulla alla VPS - output solo in console.
#
# Uso:
#   .\Test-RouterWifi.ps1 -RouterIp 192.168.1.1 -Username Administrator -Password "tua_password"
#   (Su molti TIM/AGCOMBO l'utente è fissato a "Administrator" e non è modificabile dal router.)
#
param(
    [Parameter(Mandatory=$true)][string]$RouterIp,
    [Parameter(Mandatory=$true)][string]$Username,
    [Parameter(Mandatory=$true)][string]$Password,
    [switch]$SaveHtml = $false
)

$ErrorActionPreference = "Stop"
$devices = @()
$errMsg = ""

function Write-Test { param([string]$msg, [string]$color = "White") Write-Host $msg -ForegroundColor $color }
function Write-TestOk { param([string]$msg) Write-Host "  OK: $msg" -ForegroundColor Green }
function Write-TestErr { param([string]$msg) Write-Host "  ERRORE: $msg" -ForegroundColor Red }
function Write-TestInfo { param([string]$msg) Write-Host "  $msg" -ForegroundColor Cyan }

# Invoke-WebRequest che non blocca su violazione protocollo (alcuni router rispondono male)
function Invoke-SafeWebRequest {
    param([string]$Uri, [string]$Method = "Get", [string]$Body = $null, [hashtable]$Headers = @{}, $WebSession = $null)
    try {
        $params = @{ Uri = $Uri; Method = $Method; UseBasicParsing = $true; TimeoutSec = 12; ErrorAction = "Stop" }
        if ($WebSession) { $params.WebSession = $WebSession }
        if ($Body) { $params.Body = $Body; $params.ContentType = "application/x-www-form-urlencoded" }
        if ($Headers.Count -gt 0) { $params.Headers = $Headers }
        return Invoke-WebRequest @params
    } catch {
        $ex = $_.Exception
        if ($ex.Response) {
            try {
                $reader = New-Object System.IO.StreamReader($ex.Response.GetResponseStream())
                $reader.BaseStream.Position = 0
                $content = $reader.ReadToEnd()
                $reader.Close()
                return @{ StatusCode = [int]$ex.Response.StatusCode; Content = $content }
            } catch {}
        }
        throw
    }
}

Write-Test "=== Test Router WiFi (AGCOMBO/TIM) ===" "Yellow"
Write-Test "Router: $RouterIp | Utente: $Username" "Gray"
Write-Test ""

try {
    $base = "http://$RouterIp"
    $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    $session.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    [Net.ServicePointManager]::Expect100Continue = $false
    
    # --- LOGIN: prima GET per ottenere la pagina e (opzionale) il form ---
    Write-TestInfo "Tentativo login..."
    $loggedIn = $false
    $loginHtml = $null
    $formAction = $null
    $formUserField = $null
    $formPassField = $null
    
    foreach ($getUrl in @("$base/", "$base/login.lp", "$base/index.html")) {
        try {
            $r = Invoke-SafeWebRequest -Uri $getUrl -Method Get -WebSession $session
            $loginHtml = $r.Content
            if ($loginHtml -match '<form[^>]*action\s*=\s*["'']([^"'']+)["'']') { $formAction = $matches[1].Trim() }
            if ($loginHtml -match 'name\s*=\s*["''](user|username|loginUsername|login_user)["'']') { $formUserField = $matches[1] }
            if ($loginHtml -match 'name\s*=\s*["''](pwd|password|loginPassword|login_pass)["'']') { $formPassField = $matches[1] }
            if (-not $formUserField) { $formUserField = "username"; $formPassField = "password" }
            if (-not $formPassField) { $formPassField = "password" }
            Write-TestInfo "  GET $getUrl -> $($r.StatusCode) (form: $formAction)"
            break
        } catch { Write-TestInfo "  GET $getUrl -> $_" }
    }
    
    # Coppie (URL POST, body) da provare: form parsato + varianti TIM/Technicolor
    $userEnc = [uri]::EscapeDataString($Username)
    $pwdEnc = [uri]::EscapeDataString($Password)
    $postTargets = @()
    if ($formAction) {
        $postUrl = if ($formAction -match '^/') { "$base$formAction" } elseif ($formAction -match '^http') { $formAction } else { "$base/$formAction" }
        $postTargets += @{ Url = $postUrl; Body = "${formUserField}=$userEnc&${formPassField}=$pwdEnc" }
    }
    $postTargets += @{ Url = "$base/"; Body = "user=$userEnc&pwd=$pwdEnc" }
    $postTargets += @{ Url = "$base/"; Body = "username=$userEnc&password=$pwdEnc" }
    $postTargets += @{ Url = "$base/login.lp"; Body = "username=$userEnc&password=$pwdEnc" }
    $postTargets += @{ Url = "$base/login.lp"; Body = "user=$userEnc&pwd=$pwdEnc" }
    $postTargets += @{ Url = "$base/login"; Body = "username=$userEnc&password=$pwdEnc" }
    
    foreach ($t in $postTargets) {
        try {
            $loginResp = Invoke-SafeWebRequest -Uri $t.Url -Method Post -Body $t.Body -WebSession $session
            $code = if ($loginResp.StatusCode) { $loginResp.StatusCode } else { 200 }
            $content = $loginResp.Content
            if ($code -eq 200 -and $content -and $content -notmatch "login|Login|accesso|Accesso|Invalid|invalid|Errore|error") {
                $loggedIn = $true
                Write-TestOk "Login riuscito (POST $($t.Url))"
                break
            }
            if ($code -eq 302 -or $code -eq 301) { $loggedIn = $true; Write-TestOk "Login riuscito (redirect da $($t.Url))"; break }
        } catch { Write-TestInfo "  POST $($t.Url) -> $_" }
        if ($loggedIn) { break }
    }
    
    # Fallback: login con HTTP/1.0 (alcuni AGCOMBO danno "violazione protocollo" con HTTP/1.1)
    $script:http10CookieContainer = $null
    if (-not $loggedIn -and $formAction -eq "login.lp") {
        Write-TestInfo "Tentativo login con HTTP/1.0 (fallback per violazione protocollo)..."
        try {
            $cookieContainer = New-Object System.Net.CookieContainer
            $postUrl = "$base/login.lp"
            $bodyStr = "username=$userEnc&password=$pwdEnc"
            $bodyBytes = [System.Text.Encoding]::ASCII.GetBytes($bodyStr)
            $req = [System.Net.HttpWebRequest]::Create($postUrl)
            $req.Method = "POST"
            $req.ProtocolVersion = [System.Net.HttpVersion]::Version10
            $req.KeepAlive = $false
            $req.CookieContainer = $cookieContainer
            $req.ContentType = "application/x-www-form-urlencoded"
            $req.ContentLength = $bodyBytes.Length
            $req.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            $req.Host = $RouterIp
            $req.Timeout = 15000
            $req.ReadWriteTimeout = 15000
            $reqStream = $req.GetRequestStream()
            $reqStream.Write($bodyBytes, 0, $bodyBytes.Length)
            $reqStream.Close()
            $resp = $req.GetResponse()
            $statusCode = [int]([System.Net.HttpWebResponse]$resp).StatusCode
            $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
            $content = $reader.ReadToEnd()
            $reader.Close()
            $resp.Close()
            if ($statusCode -eq 200 -and $content -and $content -notmatch "login|Login|accesso|Accesso|Invalid|invalid|Errore|error") {
                $loggedIn = $true
                $script:http10CookieContainer = $cookieContainer
                Write-TestOk "Login riuscito (HTTP/1.0 POST login.lp)"
            }
            if ($statusCode -eq 302 -or $statusCode -eq 301) {
                $loggedIn = $true
                $script:http10CookieContainer = $cookieContainer
                Write-TestOk "Login riuscito (HTTP/1.0 redirect)"
            }
        } catch { Write-TestInfo "  HTTP/1.0 login.lp -> $_" }
    }
    
    # Basic Auth fallback (salva header per richieste successive)
    $script:basicAuthHeader = $null
    if (-not $loggedIn) {
        try {
            $cred = [System.Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${Username}:${Password}"))
            $script:basicAuthHeader = @{ Authorization = "Basic $cred" }
            $r = Invoke-SafeWebRequest -Uri $base -Method Get -Headers $script:basicAuthHeader -WebSession $session
            $loggedIn = $true
            Write-TestOk "Login riuscito (Basic Auth)"
        } catch { Write-TestInfo "  Basic Auth -> $_"; $script:basicAuthHeader = $null }
    }
    
    if (-not $loggedIn) {
        $errMsg = "Login fallito: credenziali errate o interfaccia non supportata. Su molti AGCOMBO l'utente è fissato a Administrator; verifica la password."
        throw $errMsg
    }
    
    # --- PAGINA DISPOSITIVI ---
    Write-TestInfo "Recupero pagina dispositivi..."
    $deviceUrls = @(
        "$base/", "$base/index.html",
        "$base/device-modal.lp", "$base/modals/device-modal.lp",
        "$base/dhcp.lp", "$base/lan.lp", "$base/devices.lp", "$base/wifi-clients.lp",
        "$base/connected-devices.lp", "$base/status.lp", "$base/home.lp",
        "$base/cgi-bin/status", "$base/cgi-bin/dhcp"
    )
    $html = ""
    
    if ($script:http10CookieContainer) {
        foreach ($url in $deviceUrls) {
            try {
                $req = [System.Net.HttpWebRequest]::Create($url)
                $req.Method = "GET"
                $req.ProtocolVersion = [System.Net.HttpVersion]::Version10
                $req.KeepAlive = $false
                $req.CookieContainer = $script:http10CookieContainer
                $req.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                $req.Host = $RouterIp
                $req.Timeout = 15000
                $req.ReadWriteTimeout = 15000
                $resp = $req.GetResponse()
                $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
                $html = $reader.ReadToEnd()
                $reader.Close()
                $resp.Close()
                if ($html -match "Host-|192\.168\.|dispositiv|device") { Write-TestOk "Contenuto da $url (HTTP/1.0, $($html.Length) caratteri)"; break }
            } catch { }
        }
    }
    
    if (-not $html) {
        foreach ($url in $deviceUrls) {
            try {
                $params = @{ Uri = $url; WebSession = $session; UseBasicParsing = $true; TimeoutSec = 15; ErrorAction = "Stop" }
                if ($script:basicAuthHeader) { $params.Headers = $script:basicAuthHeader }
                $resp = Invoke-WebRequest @params
                $html = $resp.Content
                if ($html -match "Host-|192\.168\.|dispositiv|device|DHCP|client") { 
                    Write-TestOk "Contenuto da $url (lunghezza: $($html.Length) caratteri)"
                    break 
                }
            }
            catch { }
        }
    }
    
    if (-not $html) {
        $errMsg = "Impossibile recuperare la pagina dispositivi"
        throw $errMsg
    }
    
    if ($SaveHtml) {
        $outPath = "C:\ProgramData\NetworkMonitorAgent\router-wifi-debug.html"
        $dir = Split-Path $outPath
        if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
        $html | Out-File -FilePath $outPath -Encoding UTF8
        Write-TestOk "HTML salvato in $outPath (per analisi)"
    }
    
    # --- SOLO DISPOSITIVI WIFI: estrai solo la sezione Wi-Fi (es. AGCOMBO/TIM: Wi-Fi vs Ethernet) ---
    $extractHtml = $html
    if ($html -match '(?si)(Wi-?Fi|WiFi|2\.4\s*GHz|5\s*GHz).*?(?=Ethernet|USB|Telefono|Controllo\s*Accesso|$)') {
        $extractHtml = $matches[0]
        Write-TestInfo "Usata solo sezione Wi-Fi dell'HTML (esclusi Ethernet/USB)."
    }
    
    # --- ESTRAZIONE MAC e IP (solo dalla sezione Wi-Fi) ---
    Write-TestInfo "Estrazione MAC e IP dall'HTML (solo WiFi)..."
    $macPattern = '([0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2})'
    $ipPattern = '\b(192\.168\.\d{1,3}\.\d{1,3})\b'
    
    $lines = $extractHtml -split "`n|>"
    $seen = @{}
    foreach ($line in $lines) {
        if ($line -match $macPattern -and $line -match $ipPattern) {
            $mac = $matches[1] -replace '-', ':'
            $ip = [regex]::Match($line, $ipPattern).Value
            $key = "$mac|$ip"
            if (-not $seen[$key]) {
                $seen[$key] = $true
                $devices += @{ mac = $mac; ip = $ip }
            }
        }
    }
    
    if ($devices.Count -eq 0) {
        Write-TestInfo "Nessuna coppia MAC+IP sulla stessa riga, fallback su sezione Wi-Fi..."
        $allMacs = [regex]::Matches($extractHtml, $macPattern) | ForEach-Object { $_.Value -replace '-', ':' }
        $allIps = [regex]::Matches($extractHtml, $ipPattern) | ForEach-Object { $_.Value } | Where-Object { $_ -ne $RouterIp -and $_ -notmatch "255$" }
        $idx = 0
        foreach ($mac in $allMacs) {
            if ($mac -match "00:00:00:00:00|FF:FF:FF:FF:FF") { continue }
            $ip = if ($idx -lt $allIps.Count) { $allIps[$idx] } else { "" }
            $idx++
            $devices += @{ mac = $mac; ip = $ip }
        }
    }
    
    # Fallback: cerca JSON/JS nella sezione Wi-Fi (es. "mac":"xx:xx:xx" o "ip":"192.168.")
    if ($devices.Count -eq 0 -and $extractHtml -match '"(?:mac|MAC|macAddress)"\s*:\s*"([^"]+)"') {
        Write-TestInfo "Tentativo estrazione da JSON/script nella sezione Wi-Fi..."
        $jsonMacs = [regex]::Matches($extractHtml, '"(?:mac|MAC|macAddress)"\s*:\s*"([^"]+)"') | ForEach-Object { $_.Groups[1].Value -replace '-', ':' }
        $jsonIps = [regex]::Matches($extractHtml, '"(?:ip|IP|ipAddress)"\s*:\s*"(\d+\.\d+\.\d+\.\d+)"') | ForEach-Object { $_.Groups[1].Value }
        $ji = 0
        foreach ($mac in $jsonMacs) {
            if ($mac -match "00:00:00:00:00|FF:FF:FF:FF:FF" -or $mac.Length -lt 12) { continue }
            $ip = if ($ji -lt $jsonIps.Count) { $jsonIps[$ji] } else { "" }
            $ji++
            $devices += @{ mac = $mac; ip = $ip }
        }
    }
}
catch {
    $errMsg = if ($_.Exception.Message) { $_.Exception.Message } else { "Errore sconosciuto" }
    Write-TestErr $errMsg
}

# --- OUTPUT FINALE ---
Write-Test ""
Write-Test "=== RISULTATO ===" "Yellow"
if ($errMsg) {
    Write-TestErr $errMsg
}
else {
    Write-TestOk "Trovati $($devices.Count) dispositivi"
    Write-Test ""
    if ($devices.Count -gt 0) {
        Write-Test "MAC                  | IP" "Gray"
        Write-Host ("-" * 40) -ForegroundColor Gray
        foreach ($d in $devices) {
            Write-Host ("{0,-20} | {1}" -f $d.mac, $d.ip)
        }
        Write-Test ""
        Write-Test "Se vedi i dispositivi corretti, lo script funziona. Puoi usare 'Carica dispositivi WiFi' nella mappa." "Green"
    }
    else {
        Write-Test "Nessun dispositivo estratto. Prova -SaveHtml per analizzare l'HTML del router." "Yellow"
    }
}
