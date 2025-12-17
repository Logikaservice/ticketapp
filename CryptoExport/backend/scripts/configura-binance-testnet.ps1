# Script PowerShell per configurare Binance Testnet
# Esegui questo script dalla cartella backend/

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CONFIGURAZIONE BINANCE TESTNET" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verifica che siamo nella cartella backend
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Errore: Esegui questo script dalla cartella backend/" -ForegroundColor Red
    Write-Host "   Esempio: cd C:\TicketApp\backend" -ForegroundColor Yellow
    Write-Host "           .\scripts\configura-binance-testnet.ps1" -ForegroundColor Yellow
    exit 1
}

$envFile = ".env"

# Verifica se il file .env esiste
if (-not (Test-Path $envFile)) {
    Write-Host "⚠️  File .env non trovato. Creazione..." -ForegroundColor Yellow
    New-Item -ItemType File -Path $envFile -Force | Out-Null
    Write-Host "✅ File .env creato" -ForegroundColor Green
} else {
    Write-Host "✅ File .env trovato" -ForegroundColor Green
}

Write-Host ""
Write-Host "Per configurare Binance Testnet ti servono:" -ForegroundColor Yellow
Write-Host "1. API Key da https://testnet.binance.vision/" -ForegroundColor White
Write-Host "2. Secret Key (mostrata solo una volta!)" -ForegroundColor White
Write-Host ""
Write-Host "Se non le hai ancora, apri:" -ForegroundColor Yellow
Write-Host "   https://testnet.binance.vision/" -ForegroundColor Cyan
Write-Host ""
$continua = Read-Host "Hai già le API keys? (s/n)"

if ($continua -ne "s" -and $continua -ne "S" -and $continua -ne "si" -and $continua -ne "SI") {
    Write-Host ""
    Write-Host "🔗 Apri questa pagina nel browser:" -ForegroundColor Yellow
    Write-Host "   https://testnet.binance.vision/" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Genera le API keys e poi esegui di nuovo questo script." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  INSERIMENTO CREDENZIALI" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Leggi API Key
Write-Host "Inserisci la BINANCE_API_KEY:" -ForegroundColor Yellow
$apiKey = Read-Host "API Key" 

if ([string]::IsNullOrWhiteSpace($apiKey)) {
    Write-Host "❌ API Key non può essere vuota" -ForegroundColor Red
    exit 1
}

# Leggi Secret Key
Write-Host ""
Write-Host "Inserisci la BINANCE_API_SECRET:" -ForegroundColor Yellow
Write-Host "(ATTENZIONE: Il secret è mostrato solo una volta!)" -ForegroundColor Yellow
$apiSecret = Read-Host "Secret Key"

if ([string]::IsNullOrWhiteSpace($apiSecret)) {
    Write-Host "❌ Secret Key non può essere vuota" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  AGGIORNAMENTO FILE .env" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Leggi il contenuto attuale del file .env
$content = Get-Content $envFile -ErrorAction SilentlyContinue

# Rimuovi le configurazioni Binance esistenti
$newContent = $content | Where-Object {
    $_ -notmatch "^BINANCE_MODE=" -and
    $_ -notmatch "^BINANCE_API_KEY=" -and
    $_ -notmatch "^BINANCE_API_SECRET=" -and
    $_ -notmatch "^#.*BINANCE"
}

# Rimuovi righe vuote multiple alla fine
while ($newContent.Count -gt 0 -and [string]::IsNullOrWhiteSpace($newContent[-1])) {
    $newContent = $newContent[0..($newContent.Count - 2)]
}

# Aggiungi nuova linea se il file non finisce con una riga vuota
if ($newContent.Count -gt 0 -and -not [string]::IsNullOrWhiteSpace($newContent[-1])) {
    $newContent += ""
}

# Aggiungi configurazione Binance
$newContent += "# ========================================="
$newContent += "# BINANCE TESTNET CONFIGURATION"
$newContent += "# ========================================="
$newContent += "BINANCE_MODE=testnet"
$newContent += "BINANCE_API_KEY=$apiKey"
$newContent += "BINANCE_API_SECRET=$apiSecret"

# Salva il file
$newContent | Set-Content $envFile -Encoding UTF8

Write-Host "✅ Configurazione aggiunta al file .env" -ForegroundColor Green
Write-Host ""

# Mostra anteprima (senza mostrare i valori completi per sicurezza)
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  CONFIGURAZIONE AGGIUNTA:" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "BINANCE_MODE=testnet" -ForegroundColor Green
Write-Host "BINANCE_API_KEY=$($apiKey.Substring(0, [Math]::Min(10, $apiKey.Length)))..." -ForegroundColor Green
Write-Host "BINANCE_API_SECRET=$($apiSecret.Substring(0, [Math]::Min(10, $apiSecret.Length)))..." -ForegroundColor Green
Write-Host ""

Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  PROSSIMI PASSI" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Riavvia il backend per applicare le modifiche:" -ForegroundColor Yellow
Write-Host "   - Se in locale: ferma e riavvia npm start" -ForegroundColor White
Write-Host "   - Se su server: pm2 restart ticketapp-backend" -ForegroundColor White
Write-Host ""
Write-Host "2. Verifica la configurazione:" -ForegroundColor Yellow
Write-Host "   http://localhost:3001/api/crypto/binance/mode" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Dovresti vedere:" -ForegroundColor Yellow
Write-Host "   {""mode"": ""testnet"", ""available"": true}" -ForegroundColor Green
Write-Host ""

Write-Host "✅ Configurazione completata!" -ForegroundColor Green
Write-Host ""

