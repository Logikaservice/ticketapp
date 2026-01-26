# Script per push automatico via API GitHub
param(
    [Parameter(Mandatory=$true)]
    [string]$GitHubToken
)

$ErrorActionPreference = 'Stop'
$repoOwner = "Logikaservice"
$repoName = "ticketapp"
$branch = "main"
$baseUrl = "https://api.github.com"

# Disabilita verifica SSL se necessario (per problemi di certificato)
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}

# Funzione per ottenere SHA del file esistente (se presente)
function Get-FileSha {
    param([string]$Path)
    try {
        $url = "$baseUrl/repos/$repoOwner/$repoName/contents/$Path"
        $headers = @{
            "Authorization" = "Bearer $GitHubToken"
            "Accept" = "application/vnd.github.v3+json"
            "X-GitHub-Api-Version" = "2022-11-28"
        }
        $response = Invoke-RestMethod -Uri $url -Method Get -Headers $headers -TimeoutSec 30 -ErrorAction SilentlyContinue
        return $response.sha
    } catch {
        return $null
    }
}

# Funzione per creare/aggiornare file
function Update-GitHubFile {
    param(
        [string]$Path,
        [string]$Content,
        [string]$Message
    )
    
    $sha = Get-FileSha -Path $Path
    $base64Content = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($Content))
    
    $body = @{
        message = $Message
        content = $base64Content
        branch = $branch
    } | ConvertTo-Json
    
    if ($sha) {
        $body = $body | ConvertFrom-Json
        $body | Add-Member -MemberType NoteProperty -Name "sha" -Value $sha -Force
        $body = $body | ConvertTo-Json
        Write-Host "Aggiornamento: $Path" -ForegroundColor Yellow
    } else {
        Write-Host "Creazione: $Path" -ForegroundColor Green
    }
    
    $url = "$baseUrl/repos/$repoOwner/$repoName/contents/$Path"
    $headers = @{
        "Authorization" = "Bearer $GitHubToken"
        "Accept" = "application/vnd.github.v3+json"
        "X-GitHub-Api-Version" = "2022-11-28"
    }
    
    $maxRetries = 3
    $retryCount = 0
    $lastError = $null
    
    while ($retryCount -lt $maxRetries) {
        try {
            # Usa WebClient per maggiore controllo
            $webClient = New-Object System.Net.WebClient
            $webClient.Headers.Add("Authorization", "Bearer $GitHubToken")
            $webClient.Headers.Add("Accept", "application/vnd.github.v3+json")
            $webClient.Headers.Add("X-GitHub-Api-Version", "2022-11-28")
            $webClient.Headers.Add("Content-Type", "application/json")
            $webClient.Encoding = [System.Text.Encoding]::UTF8
            
            $responseBytes = $webClient.UploadString($url, "PUT", $body)
            $response = $responseBytes | ConvertFrom-Json
            $webClient.Dispose()
            
            Write-Host "✅ $Path - OK" -ForegroundColor Green
            return $true
        } catch {
            $lastError = $_
            $retryCount++
            if ($retryCount -lt $maxRetries) {
                Write-Host "   Tentativo $retryCount/$maxRetries fallito, riprovo tra 2 secondi..." -ForegroundColor Yellow
                Start-Sleep -Seconds 2
            }
        }
    }
    
    # Gestione errore finale
    $errorMsg = $lastError.Exception.Message
    if ($lastError.ErrorDetails.Message) {
        try {
            $errorJson = $lastError.ErrorDetails.Message | ConvertFrom-Json
            $errorMsg = $errorJson.message
        } catch {
            $errorMsg = $lastError.ErrorDetails.Message
        }
    }
    
    # Controlla se è un errore di autenticazione
    if ($lastError.Exception.Response.StatusCode -eq 401 -or $errorMsg -like "*401*" -or $errorMsg -like "*Unauthorized*" -or $errorMsg -like "*Non autorizzato*") {
        Write-Host "❌ $Path - Errore: Token GitHub non valido o scaduto" -ForegroundColor Red
        Write-Host "   Crea un nuovo token qui: https://github.com/settings/tokens" -ForegroundColor Yellow
        Write-Host "   Permessi necessari: repo (tutti i permessi repo)" -ForegroundColor Yellow
    } else {
        Write-Host "❌ $Path - Errore: $errorMsg" -ForegroundColor Red
    }
    return $false
}

# File da pushare
$files = @(
    @{ Path = "DOCS/SETUP_VPS_SSH_AI.md"; Content = (Get-Content "DOCS\SETUP_VPS_SSH_AI.md" -Raw -Encoding UTF8) },
    @{ Path = "scripts/Invoke-VpsCommand.ps1"; Content = (Get-Content "scripts\Invoke-VpsCommand.ps1" -Raw -Encoding UTF8) },
    @{ Path = "scripts/README_VPS_HELPER.md"; Content = (Get-Content "scripts\README_VPS_HELPER.md" -Raw -Encoding UTF8) },
    @{ Path = "scripts/Test-VpsConnection.ps1"; Content = (Get-Content "scripts\Test-VpsConnection.ps1" -Raw -Encoding UTF8) },
    @{ Path = "scripts/VpsHelper.ps1"; Content = (Get-Content "scripts\VpsHelper.ps1" -Raw -Encoding UTF8) }
)

Write-Host "🚀 Push file via API GitHub..." -ForegroundColor Cyan
Write-Host "Repository: $repoOwner/$repoName" -ForegroundColor Gray
Write-Host "Branch: $branch" -ForegroundColor Gray

# Verifica formato token
if ($GitHubToken -eq 'TUO_TOKEN' -or $GitHubToken.Length -lt 20) {
    Write-Host ""
    Write-Host "⚠️  ATTENZIONE: Token non valido!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Per creare un token GitHub:" -ForegroundColor Yellow
    Write-Host "1. Vai su: https://github.com/settings/tokens" -ForegroundColor Cyan
    Write-Host "2. Clicca 'Generate new token' → 'Generate new token (classic)'" -ForegroundColor Cyan
    Write-Host "3. Nome: 'Cursor Push Script'" -ForegroundColor Cyan
    Write-Host "4. Scadenza: '90 days' o 'No expiration'" -ForegroundColor Cyan
    Write-Host "5. Seleziona permesso: 'repo' (tutti i permessi repo)" -ForegroundColor Cyan
    Write-Host "6. Clicca 'Generate token' e COPIA il token" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Poi esegui:" -ForegroundColor Yellow
    Write-Host "  .\push-via-github-api.ps1 -GitHubToken 'TOKEN_COPIATO'" -ForegroundColor Green
    Write-Host ""
    exit 1
}

Write-Host ""

$success = 0
$failed = 0

foreach ($file in $files) {
    if (Test-Path $file.Path.Replace('/', '\')) {
        $result = Update-GitHubFile -Path $file.Path -Content $file.Content -Message "Aggiunti script helper SSH per VPS e documentazione"
        if ($result) {
            $success++
        } else {
            $failed++
        }
        Start-Sleep -Milliseconds 500
    } else {
        Write-Host "⚠️  File non trovato: $($file.Path)" -ForegroundColor Yellow
        $failed++
    }
}

Write-Host ""
if ($failed -eq 0) {
    Write-Host "✅ Push completato con successo! ($success file)" -ForegroundColor Green
} else {
    Write-Host "⚠️  Push completato con errori: $success OK, $failed falliti" -ForegroundColor Yellow
}
