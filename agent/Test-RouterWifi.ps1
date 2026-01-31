# Test-RouterWifi.ps1
# Script di test locale per estrarre dispositivi WiFi da router AGCOMBO/TIM.
# Esegui sul PC dove gira l'agent (stessa rete del router) per verificare login e scraping.
# Non invia nulla alla VPS - output solo in console.
#
# Uso:
#   .\Test-RouterWifi.ps1 -RouterIp 192.168.1.1 -Username Administrator -Password "tua_password"
#   .\Test-RouterWifi.ps1 -RouterIp 192.168.1.1 -Username Administrator -Password "xxx" -SaveHtml
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

Write-Test "=== Test Router WiFi (AGCOMBO/TIM) ===" "Yellow"
Write-Test "Router: $RouterIp | Utente: $Username" "Gray"
Write-Test ""

try {
    $base = "http://$RouterIp"
    $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    $session.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    
    # --- LOGIN ---
    Write-TestInfo "Tentativo login..."
    $loginPaths = @("/", "/login", "/cgi-bin/login", "/authenticate")
    $loggedIn = $false
    $loginResp = $null
    
    foreach ($path in $loginPaths) {
        try {
            $loginUrl = "$base$path"
            $body = if ($path -eq "/") { 
                "user=$([uri]::EscapeDataString($Username))&pwd=$([uri]::EscapeDataString($Password))" 
            } else { 
                "username=$([uri]::EscapeDataString($Username))&password=$([uri]::EscapeDataString($Password))" 
            }
            $loginResp = Invoke-WebRequest -Uri $loginUrl -Method Post -Body $body -ContentType "application/x-www-form-urlencoded" -WebSession $session -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop
            if ($loginResp.StatusCode -eq 200 -and $loginResp.Content -notmatch "login|Login|accesso|Accesso") { 
                $loggedIn = $true
                Write-TestOk "Login riuscito su $path"
                break 
            }
        }
        catch { Write-TestInfo "  $path -> $_" }
    }
    
    # Basic Auth fallback
    if (-not $loggedIn) {
        try {
            $cred = [System.Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${Username}:${Password}"))
            $h = @{ Authorization = "Basic $cred" }
            $r = Invoke-WebRequest -Uri $base -Headers $h -WebSession $session -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
            $loggedIn = $true
            Write-TestOk "Login riuscito (Basic Auth)"
        }
        catch { Write-TestInfo "  Basic Auth -> $_" }
    }
    
    if (-not $loggedIn) {
        $errMsg = "Login fallito: credenziali errate o interfaccia non supportata"
        throw $errMsg
    }
    
    # --- PAGINA DISPOSITIVI ---
    Write-TestInfo "Recupero pagina dispositivi..."
    $deviceUrls = @("$base/", "$base/index.html", "$base/device-modal.lp", "$base/modals/device-modal.lp")
    $html = ""
    
    foreach ($url in $deviceUrls) {
        try {
            $resp = Invoke-WebRequest -Uri $url -WebSession $session -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop
            $html = $resp.Content
            if ($html -match "Host-|192\.168\.|dispositiv|device") { 
                Write-TestOk "Contenuto da $url (lunghezza: $($html.Length) caratteri)"
                break 
            }
        }
        catch { }
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
    
    # --- ESTRAZIONE MAC e IP ---
    Write-TestInfo "Estrazione MAC e IP dall'HTML..."
    $macPattern = '([0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2})'
    $ipPattern = '\b(192\.168\.\d{1,3}\.\d{1,3})\b'
    
    $lines = $html -split "`n|>"
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
        Write-TestInfo "Nessuna coppia MAC+IP sulla stessa riga, fallback su tutto l'HTML..."
        $allMacs = [regex]::Matches($html, $macPattern) | ForEach-Object { $_.Value -replace '-', ':' }
        $allIps = [regex]::Matches($html, $ipPattern) | ForEach-Object { $_.Value } | Where-Object { $_ -ne $RouterIp -and $_ -notmatch "255$" }
        $idx = 0
        foreach ($mac in $allMacs) {
            if ($mac -match "00:00:00:00:00|FF:FF:FF:FF:FF") { continue }
            $ip = if ($idx -lt $allIps.Count) { $allIps[$idx] } else { "" }
            $idx++
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
