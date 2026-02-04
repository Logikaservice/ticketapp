# Test connessione e pagine web Snom M700 (DECT base)
# Esegui su un PC nella stessa rete di una cella M700.
# Uso: .\Test-SnomM700.ps1 -BaseIp "192.168.1.xxx" [-Username "admin"] [-Password "admin"]
# Se la M700 usa HTTPS con certificato auto-firmato, lo script accetta il certificato.

param(
    [Parameter(Mandatory=$false)]
    [string]$BaseIp,
    [string]$Username = "admin",
    [string]$Password = "admin",
    [switch]$UseHttps,
    [string]$HtmlFile = ""  # Se specificato, legge da file HTML invece di fare login
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# Bypass certificato SSL auto-firmato (come per Yeastar/UniFi)
if (-not ("TrustAllCertsPolicy" -as [type])) {
    add-type @"
        using System.Net; using System.Security.Cryptography.X509Certificates;
        public class TrustAllCertsPolicy : ICertificatePolicy { public bool CheckValidationResult(ServicePoint s, X509Certificate c, WebRequest r, int p) { return true; } }
"@
}
[System.Net.ServicePointManager]::CertificatePolicy = New-Object TrustAllCertsPolicy
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }

$scheme = if ($UseHttps) { "https" } else { "http" }
$baseUrl = "${scheme}://${BaseIp}/"

# Crea PSCredential per Basic Auth (Invoke-WebRequest richiede PSCredential, non NetworkCredential)
$securePassword = ConvertTo-SecureString $Password -AsPlainText -Force
$credential = [System.Management.Automation.PSCredential]::new($Username, $securePassword)

Write-Host "Test Snom M700 - Base: $baseUrl" -ForegroundColor Cyan
Write-Host ""

# 1) Prova login: prima Basic Auth, poi Digest, poi form (solo se BaseIp fornito)
$sv = $null
$loginOk = $false

# Tentativo 1: Basic Auth (solo se abbiamo BaseIp)
if ($BaseIp) {
try {
    Write-Host "[1] Tentativo login Basic Auth..." -ForegroundColor Cyan
    $resp = Invoke-WebRequest -Uri $baseUrl -Method Get -Credential $credential -UseBasicParsing -TimeoutSec 15 -SessionVariable sv -ErrorAction Stop
    if ($resp.StatusCode -eq 200 -and $resp.Content -notmatch "(?i)login|password|authentication") {
        Write-Host "[OK] Login Basic Auth riuscito!" -ForegroundColor Green
        $loginOk = $true
    }
} catch {
    Write-Host "[--] Basic Auth fallito: $($_.Exception.Message)" -ForegroundColor Yellow
}
}

# Tentativo 2: HTTP Digest Authentication (Snom M700 usa Digest, non Basic)
if (-not $loginOk -and $BaseIp) {
    try {
        Write-Host "[2] Tentativo login Digest Auth..." -ForegroundColor Cyan
        $firstReq = [System.Net.HttpWebRequest]::Create($baseUrl)
        $firstReq.Method = "GET"
        $firstReq.Timeout = 15000
        $firstReq.UserAgent = "Mozilla/5.0 (Windows NT; Snom M700 Test)"
        $firstReq.KeepAlive = $true
        [void]$firstReq.GetResponse()
    } catch {
        $we = $_.Exception
        if ($we.InnerException -is [System.Net.WebException]) { $we = $we.InnerException }
        if ($we -is [System.Net.WebException]) {
            $resp = $we.Response
            if ($resp -and [int]$resp.StatusCode -eq 401) {
                $authHeader = $resp.Headers["WWW-Authenticate"]
                if ($authHeader -and $authHeader -match 'Digest') {
                    $realm = if ($authHeader -match 'realm="([^"]+)"') { $matches[1] } else { "" }
                    $nonce = if ($authHeader -match 'nonce="([^"]+)"') { $matches[1] } else { "" }
                    $qop = if ($authHeader -match 'qop="([^"]+)"') { $matches[1] } else { "auth" }
                    $opaque = if ($authHeader -match 'opaque="([^"]+)"') { $matches[1] } else { "" }
                    
                    $uriObj = [System.Uri]$baseUrl
                    $pathAndQuery = $uriObj.PathAndQuery
                    if ([string]::IsNullOrEmpty($pathAndQuery)) { $pathAndQuery = "/" }
                    
                    $md5 = [System.Security.Cryptography.MD5]::Create()
                    $ha1Input = "${Username}:${realm}:${Password}"
                    $ha1Bytes = $md5.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($ha1Input))
                    $ha1 = [BitConverter]::ToString($ha1Bytes).Replace("-","").ToLower()
                    
                    $cnonce = [Guid]::NewGuid().ToString("N").Substring(0, 8)
                    $nc = "00000001"
                    
                    $ha2Input = "GET:${pathAndQuery}"
                    $ha2Bytes = $md5.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($ha2Input))
                    $ha2 = [BitConverter]::ToString($ha2Bytes).Replace("-","").ToLower()
                    
                    $responseInput = "${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}"
                    $responseBytes = $md5.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($responseInput))
                    $responseHash = [BitConverter]::ToString($responseBytes).Replace("-","").ToLower()
                    
                    $authValue = "Digest username=`"$Username`", realm=`"$realm`", nonce=`"$nonce`", uri=`"$pathAndQuery`", response=`"$responseHash`", qop=$qop, nc=$nc, cnonce=`"$cnonce`""
                    if ($opaque) { $authValue += ", opaque=`"$opaque`"" }
                    
                    $secondReq = [System.Net.HttpWebRequest]::Create($baseUrl)
                    $secondReq.Method = "GET"
                    $secondReq.Timeout = 15000
                    $secondReq.Headers.Add("Authorization", $authValue)
                    $secondReq.UserAgent = "Mozilla/5.0 (Windows NT; Snom M700 Test)"
                    $secondReq.CookieContainer = New-Object System.Net.CookieContainer
                    
                    $secondResp = $secondReq.GetResponse()
                    $stream = $secondResp.GetResponseStream()
                    $reader = New-Object System.IO.StreamReader($stream)
                    $content = $reader.ReadToEnd()
                    $reader.Close()
                    $secondResp.Close()
                    
                    if ([int]$secondResp.StatusCode -eq 200 -and $content -notmatch "(?i)accedi|login|password|authentication|401") {
                        Write-Host "[OK] Login Digest Auth riuscito!" -ForegroundColor Green
                        $loginOk = $true
                        $script:digestAuthHeader = $authValue
                        $script:digestUri = $baseUrl
                    }
                }
            }
        }
        if (-not $loginOk) {
            Write-Host "[--] Digest Auth non applicabile o fallito: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
}

# Tentativo 3: Form login (se Basic e Digest non hanno funzionato)
if (-not $loginOk -and $BaseIp) {
    try {
        Write-Host "[3] Tentativo login form HTML..." -ForegroundColor Cyan
        # GET pagina principale per vedere se c'è un form di login
        $loginPage = Invoke-WebRequest -Uri $baseUrl -Method Get -UseBasicParsing -TimeoutSec 15 -SessionVariable sv -ErrorAction Stop
        
        # Prova diversi URL comuni per il login (incluso /main.html che è quello della Snom M700)
        $loginUrls = @("/main.html", "/login.html", "/login", "/", "/cgi-bin/login", "/admin/login")
        $formFound = $false
        $formAction = ""
        $formMethod = "POST"
        $usernameField = "username"
        $passwordField = "password"
        
        foreach ($loginPath in $loginUrls) {
            $testUrl = "${scheme}://${BaseIp}$loginPath"
            try {
                $testPage = Invoke-WebRequest -Uri $testUrl -Method Get -WebSession $sv -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
                $html = $testPage.Content
                
                # Cerca form di login nell'HTML
                if ($html -match '<form[^>]*action=["'']([^"'']+)["'']') {
                    $formAction = $matches[1]
                    if ($html -match '<form[^>]*method=["'']([^"'']+)["'']') {
                        $formMethod = $matches[1].ToUpper()
                    }
                    
                    # Cerca i nomi dei campi username/password nel form
                    if ($html -match '<input[^>]*name=["'']([^"'']+)["''][^>]*(?:type=["'']text["'']|type=["'']email["'']|placeholder=["'']*[Uu]ser|placeholder=["'']*[Nn]ome)') {
                        $usernameField = $matches[1]
                    }
                    if ($html -match '<input[^>]*name=["'']([^"'']+)["''][^>]*type=["'']password["'']') {
                        $passwordField = $matches[1]
                    }
                    
                    Write-Host "  Form trovato su $loginPath, action: $formAction, campi: $usernameField/$passwordField" -ForegroundColor Gray
                    $formFound = $true
                    break
                }
            } catch {
                # Continua con il prossimo URL
            }
        }
        
        # Se non trovato, usa la pagina principale
        if (-not $formFound) {
            $html = $loginPage.Content
            if ($html -match '<form[^>]*action=["'']([^"'']+)["'']') {
                $formAction = $matches[1]
            } else {
                $formAction = "${scheme}://${BaseIp}/main.html"  # Prova /main.html come default per Snom
            }
        }
        
        # Costruisci URL completo per il POST
        if ($formAction.StartsWith("http")) {
            $postUrl = $formAction
        } elseif ($formAction.StartsWith("/")) {
            $postUrl = "${scheme}://${BaseIp}$formAction"
        } else {
            $postUrl = "${scheme}://${BaseIp}/$formAction"
        }
        
        # Se formAction è vuoto o relativo, prova /main.html
        if (-not $formAction -or $formAction -eq $baseUrl) {
            $postUrl = "${scheme}://${BaseIp}/main.html"
        }
        
        # Prova POST con username/password (usa i nomi dei campi trovati o quelli comuni)
        $loginBody = @{
            $usernameField = $Username
            $passwordField = $Password
        }
        # Aggiungi anche varianti comuni per sicurezza
        $loginBody["username"] = $Username
        $loginBody["password"] = $Password
        $loginBody["user"] = $Username
        $loginBody["pass"] = $Password
        
        try {
            $postResp = Invoke-WebRequest -Uri $postUrl -Method Post -Body $loginBody -WebSession $sv -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop
            # Verifica se il login è riuscito (controlla se non c'è più "login" nella risposta)
            if ($postResp.StatusCode -eq 200 -and $postResp.Content -notmatch "(?i)login|password|authentication|unauthorized|401") {
                Write-Host "[OK] Login form riuscito!" -ForegroundColor Green
                $loginOk = $true
            } else {
                Write-Host "[--] POST completato ma login potrebbe non essere riuscito (verifica contenuto)" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "[--] POST login form fallito: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "[ERR] Errore tentativo form login: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Se è stato fornito un file HTML, leggi da lì invece di fare login
if ($HtmlFile -and (Test-Path $HtmlFile)) {
    Write-Host "[INFO] Lettura da file HTML: $HtmlFile" -ForegroundColor Cyan
    $content = Get-Content -Path $HtmlFile -Raw -Encoding UTF8
    $loginOk = $true
} elseif (-not $loginOk) {
    Write-Host "[ERR] Login fallito. Verifica credenziali o usa -HtmlFile per leggere da file HTML salvato dal browser." -ForegroundColor Red
    Write-Host "      Esempio: .\Test-SnomM700.ps1 -HtmlFile 'C:\percorso\Ext.html'" -ForegroundColor Yellow
    exit 1
}

# 2) Leggi pagina Ext.html (Telefoni DECT)
if ($loginOk -and -not $HtmlFile) {
    Write-Host ""
    Write-Host "[3] Lettura pagina Ext.html (Telefoni DECT)..." -ForegroundColor Cyan
    try {
        $extUrl = "${scheme}://${BaseIp}/Ext.html"
        if ($script:digestAuthHeader) {
            $extPage = Invoke-WebRequest -Uri $extUrl -Method Get -Headers @{ Authorization = $script:digestAuthHeader } -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop
        } else {
            $extPage = Invoke-WebRequest -Uri $extUrl -Method Get -WebSession $sv -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop
        }
        Write-Host "[OK] Ext.html letta: $($extPage.Content.Length) caratteri" -ForegroundColor Green
        $content = $extPage.Content
    } catch {
        Write-Host "[ERR] Errore lettura Ext.html: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

# Estrai dati JavaScript
if ($content) {
    
    # Estrai SetExtensions(...)
    if ($content -match 'SetExtensions\("([^"]+)"\)') {
        $extensions = $matches[1].Split(',')
        Write-Host "  Trovati $($extensions.Count) numeri interni: $($extensions[0..15] -join ', ')" -ForegroundColor Cyan
    }
    
    # Estrai SetDisplayNames(...)
    if ($content -match 'SetDisplayNames\("([^"]+)"\)') {
        $names = $matches[1].Split(',')
        Write-Host "  Trovati $($names.Count) nomi: $($names[0..15] -join ', ')" -ForegroundColor Cyan
    }
    
    # Estrai SetIpeis(...)
    if ($content -match 'SetIpeis\("([^"]+)"\)') {
        $ipeis = $matches[1].Split(',')
        Write-Host "  Trovati $($ipeis.Count) IPEI: $($ipeis[0..15] -join ', ')" -ForegroundColor Cyan
    }
    
    # Estrai SetHsRpnDectLockArray(...) - celle DECT
    if ($content -match 'SetHsRpnDectLockArray\("([^"]+)"\)') {
        $rpns = $matches[1].Split(',')
        Write-Host "  Trovati $($rpns.Count) RPN (celle): $($rpns[0..15] -join ', ')" -ForegroundColor Cyan
    }
    
    Write-Host ""
    Write-Host "[OK] Estrazione dati completata!" -ForegroundColor Green
} else {
    Write-Host "[ERR] Nessun contenuto HTML trovato" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[OK] Test completato! Dati estratti con successo." -ForegroundColor Green
