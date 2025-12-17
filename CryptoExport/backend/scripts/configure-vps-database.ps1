# Script per configurare il progetto locale per usare il database VPS

param(
    [Parameter(Mandatory=$true)]
    [string]$VpsHost
)

Write-Host "🔧 Configurazione database VPS" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Credenziali database
$dbUser = "postgres"
$dbPassword = "TicketApp2025!Secure"
$dbPort = "5432"

Write-Host "📊 Parametri:" -ForegroundColor Yellow
Write-Host "   Host: $VpsHost" -ForegroundColor Gray
Write-Host "   User: $dbUser" -ForegroundColor Gray
Write-Host "   Port: $dbPort" -ForegroundColor Gray
Write-Host ""

# Costruisci gli URL
$mainDbUrl = "postgresql://${dbUser}:${dbPassword}@${VpsHost}:${dbPort}/ticketapp"
$cryptoDbUrl = "postgresql://${dbUser}:${dbPassword}@${VpsHost}:${dbPort}/crypto_db"
$vivaldiDbUrl = "postgresql://${dbUser}:${dbPassword}@${VpsHost}:${dbPort}/vivaldi_db"

Write-Host "📝 Aggiorno file .env..." -ForegroundColor Yellow

$envFile = ".env"
$envPath = Join-Path (Split-Path -Parent $PSScriptRoot) $envFile

# Leggi .env esistente o crea nuovo
$envContent = @()
if (Test-Path $envPath) {
    $envContent = Get-Content $envPath
}

# Funzione per aggiornare o aggiungere variabile
function Update-EnvVar {
    param($content, $key, $value)
    
    $found = $false
    $newContent = @()
    
    foreach ($line in $content) {
        if ($line -match "^$key=") {
            $newContent += "$key=$value"
            $found = $true
        } else {
            $newContent += $line
        }
    }
    
    if (-not $found) {
        $newContent += "$key=$value"
    }
    
    return $newContent
}

# Aggiorna variabili
$envContent = Update-EnvVar $envContent "DATABASE_URL" $mainDbUrl
$envContent = Update-EnvVar $envContent "DATABASE_URL_CRYPTO" $cryptoDbUrl
$envContent = Update-EnvVar $envContent "DATABASE_URL_VIVALDI" $vivaldiDbUrl

# Salva .env
$envContent | Out-File -FilePath $envPath -Encoding UTF8 -Force

Write-Host "   ✅ File .env aggiornato" -ForegroundColor Green
Write-Host ""
Write-Host "✅ Configurazione completata!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Database configurati:" -ForegroundColor Cyan
Write-Host "   DATABASE_URL: $mainDbUrl" -ForegroundColor Gray
Write-Host "   DATABASE_URL_CRYPTO: $cryptoDbUrl" -ForegroundColor Gray
Write-Host "   DATABASE_URL_VIVALDI: $vivaldiDbUrl" -ForegroundColor Gray
Write-Host ""
Write-Host "🔄 Riavvia il backend per applicare le modifiche" -ForegroundColor Yellow
