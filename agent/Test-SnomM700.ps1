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

# 1) Prova login: prima Basic Auth, poi se fallisce prova form login
$sv = $null
$loginOk = $false

# Tentativo 1: Basic Auth
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

# Tentativo 2: Form login (se Basic Auth non ha funzionato)
if (-not $loginOk) {
    try {
        Write-Host "[2] Tentativo login form HTML..." -ForegroundColor Cyan
        # GET pagina principale per vedere se c'è un form di login
        $loginPage = Invoke-WebRequest -Uri $baseUrl -Method Get -UseBasicParsing -TimeoutSec 15 -SessionVariable sv -ErrorAction Stop
        
        # Prova diversi URL comuni per il login
        $loginUrls = @("/login.html", "/login", "/", "/cgi-bin/login", "/admin/login")
        $formFound = $false
        $formAction = ""
        $formMethod = "POST"
        
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
                    Write-Host "  Form trovato su $loginPath, action: $formAction" -ForegroundColor Gray
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
                $formAction = $baseUrl  # Default: POST alla stessa pagina
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
        
        # Prova POST con username/password (nomi comuni dei campi)
        $loginBody = @{
            username = $Username
            password = $Password
            user = $Username
            pass = $Password
            login = $Username
        }
        
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
        $extPage = Invoke-WebRequest -Uri "${scheme}://${BaseIp}/Ext.html" -Method Get -WebSession $sv -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop
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
