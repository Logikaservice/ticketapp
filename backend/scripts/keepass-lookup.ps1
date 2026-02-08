# Chiama l'endpoint keepass-lookup sulla VPS per verificare un MAC in KeePass.
# Uso: .\keepass-lookup.ps1 -BaseUrl "https://ticket.logikaservice.it" -Email "tua@email.it" -Password "tuaPassword" -Mac "44:8A:5B:4B:68:8D"
# Oppure (ti chiederà email/password): .\keepass-lookup.ps1 -Mac "44:8A:5B:4B:68:8D"

param(
    [string]$BaseUrl = "https://ticket.logikaservice.it",
    [string]$Email,
    [string]$Password,
    [Parameter(Mandatory=$true)]
    [string]$Mac
)

if (-not $Email) { $Email = Read-Host "Email (utente tecnico o admin)" }
if (-not $Password) { $Secure = Read-Host "Password" -AsSecureString; $Password = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)) }

$loginBody = @{ email = $Email; password = $Password } | ConvertTo-Json
$loginUri = "$BaseUrl/api/login"

Write-Host "Login su $loginUri ..."
try {
    $loginResp = Invoke-RestMethod -Uri $loginUri -Method Post -Body $loginBody -ContentType "application/json; charset=utf-8"
} catch {
    Write-Host "Errore login: $_" -ForegroundColor Red
    exit 1
}

$token = $loginResp.token
if (-not $token) {
    Write-Host "Risposta login senza token. Controlla che l'utente sia tecnico o admin." -ForegroundColor Red
    exit 1
}

$lookupUri = "$BaseUrl/api/network-monitoring/debug/keepass-lookup?mac=" + [uri]::EscapeDataString($Mac)
$headers = @{ Authorization = "Bearer $token" }

Write-Host "Lookup KeePass per MAC: $Mac" -ForegroundColor Cyan
try {
    $result = Invoke-RestMethod -Uri $lookupUri -Method Get -Headers $headers
} catch {
    Write-Host "Errore chiamata keepass-lookup: $_" -ForegroundColor Red
    exit 1
}

if ($result.found) {
    Write-Host "`nMAC TROVATO in KeePass:" -ForegroundColor Green
    Write-Host "  Titolo:   $($result.titolo)"
    Write-Host "  Utente:   $($result.utente)"
    Write-Host "  Percorso: $($result.percorso)"
    Write-Host "  (ultimo)  $($result.percorsoUltimo)"
} else {
    Write-Host "`nMAC NON TROVATO in KeePass." -ForegroundColor Yellow
    Write-Host "  MAC normalizzato: $($result.macNormalized)"
    Write-Host "  $($result.message)"
    if ($result.sampleMacs -and $result.sampleMacs.Count -gt 0) {
        Write-Host "`nEsempi MAC nella mappa:"
        $result.sampleMacs | ForEach-Object { Write-Host "    $($_.mac) -> $($_.titolo)" }
    }
}

$result | ConvertTo-Json -Depth 5
