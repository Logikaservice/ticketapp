# Test connessione e pagine web Snom M700 (DECT base)
# Esegui su un PC nella stessa rete di una cella M700.
# Uso: .\Test-SnomM700.ps1 -BaseIp "192.168.1.xxx" [-Username "admin"] [-Password "admin"]
# Se la M700 usa HTTPS con certificato auto-firmato, lo script accetta il certificato.

param(
    [Parameter(Mandatory=$true)]
    [string]$BaseIp,
    [string]$Username = "admin",
    [string]$Password = "admin",
    [switch]$UseHttps
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

# 1) GET pagina principale (con Basic Auth se richiesta)
$sv = $null
try {
    $resp = Invoke-WebRequest -Uri $baseUrl -Method Get -Credential $credential -UseBasicParsing -TimeoutSec 15 -SessionVariable sv
    Write-Host "[OK] GET $baseUrl -> StatusCode: $($resp.StatusCode)" -ForegroundColor Green
    $len = if ($resp.Content) { $resp.Content.Length } else { 0 }
    Write-Host "     Contenuto: $len caratteri"
    if ($len -gt 0 -and $len -lt 5000) {
        Write-Host "     Anteprima:"
        Write-Host $resp.Content.Substring(0, [Math]::Min(800, $len))
    } elseif ($len -ge 5000) {
        Write-Host "     (HTML lungo - salvo in Test-SnomM700-index.html)"
        $resp.Content | Out-File -FilePath "Test-SnomM700-index.html" -Encoding utf8
    }
} catch {
    Write-Host "[ERR] GET $baseUrl : $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $code = [int]$_.Exception.Response.StatusCode
        Write-Host "     StatusCode: $code (401 = serve login; prova con -Username/-Password)"
    }
    exit 1
}

# 2) Prova percorsi comuni dove potrebbero essere gli handset (usa stessa sessione/cookie se disponibile)
$paths = @("/", "/status", "/handsets", "/phones", "/cgi-bin/status", "/api/handsets", "/#/handsets")
foreach ($p in $paths) {
    if ($p -eq "/") { continue }
    $url = "${scheme}://${BaseIp}$p"
    try {
        $r = Invoke-WebRequest -Uri $url -Method Get -WebSession $sv -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
        Write-Host "[OK] GET $p -> $($r.StatusCode)" -ForegroundColor Green
    } catch {
        Write-Host "[--] GET $p -> $($_.Exception.Message)" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "Prossimo passo: apri nel browser $baseUrl e trova la pagina che elenca i cordless DECT (handset)."
Write-Host "Comunicami l'URL completo (es. http://192.168.1.xxx/#/status) per implementare la lettura automatica."
