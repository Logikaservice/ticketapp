# Script rapido per aggiungere le Binance Keys al file .env
# Esegui dalla cartella backend/

$envFile = ".env"

if (-not (Test-Path $envFile)) {
    Write-Host "❌ File .env non trovato in questa cartella!" -ForegroundColor Red
    Write-Host "Assicurati di essere in: C:\TicketApp\backend\" -ForegroundColor Yellow
    exit 1
}

# Le API keys (già generate)
$apiKey = "PzOk2ocCeofy4S3BMeSwoh6SuTHGIhKk9xJPFQ6Z1WD96UScAfksQ9jyImziCYug"
$apiSecret = "cLAoKBP5EdvhOMqKh2vdic4MAxIUuC3KVFhLov9c4zCxHxxXC0JxBEtEhlkEWTmF"

Write-Host "🔧 Aggiunta configurazione Binance al file .env..." -ForegroundColor Cyan

# Leggi il contenuto attuale
$content = Get-Content $envFile -ErrorAction SilentlyContinue

# Rimuovi configurazioni Binance esistenti
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

# Aggiungi nuova linea se necessario
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

Write-Host ""
Write-Host "✅ Configurazione Binance aggiunta con successo!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Configurazione aggiunta:" -ForegroundColor Cyan
Write-Host "   BINANCE_MODE=testnet" -ForegroundColor White
Write-Host "   BINANCE_API_KEY=$($apiKey.Substring(0, 15))..." -ForegroundColor White
Write-Host "   BINANCE_API_SECRET=$($apiSecret.Substring(0, 15))..." -ForegroundColor White
Write-Host ""
Write-Host "🔄 PROSSIMO PASSO: Riavvia il backend!" -ForegroundColor Yellow
Write-Host "   - Se locale: ferma e riavvia npm start" -ForegroundColor White
Write-Host "   - Se server: pm2 restart ticketapp-backend" -ForegroundColor White
Write-Host ""

