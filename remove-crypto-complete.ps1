# Script per rimuovere completamente tutto ciò che riguarda crypto dal progetto TicketApp
# Questo script separa completamente ticketapp da crypto, che ora è su http://49.13.122.12/

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "RIMOZIONE COMPLETA CRYPTO DA TICKETAPP" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

$confirm = Read-Host "Sei sicuro di voler rimuovere TUTTO ciò che riguarda crypto? (SI/no)"
if ($confirm -ne "SI") {
    Write-Host "Operazione annullata." -ForegroundColor Yellow
    exit
}

Write-Host "`n[1/9] Rimozione route crypto da backend/index.js..." -ForegroundColor Yellow

# Leggi index.js
$indexJsPath = "backend/index.js"
$indexJs = Get-Content $indexJsPath -Raw

# Rimuovi endpoint pubblico crypto
$indexJs = $indexJs -replace "(?s)// ✅ ENDPOINT PUBBLICO: Check system health.*?app\.get\('/api/crypto/public-balance-check'.*?\n\s*\} catch.*?\n\s*\}\n\s*\}\);", ""

# Rimuovi import cryptoRoutes
$indexJs = $indexJs -replace "(?s)// Route per Crypto Dashboard.*?const cryptoRoutes = require\('\./routes/cryptoRoutes'\);.*?cryptoRoutes\.setSocketIO\(io\);", ""

# Rimuovi app.use('/api/crypto')
$indexJs = $indexJs -replace "(?s)// ✅ Routes are now handled inside cryptoRoutes\.js.*?// Access via /api/crypto/general-settings.*?// ✅ IMPORTANTE: Monta /api/crypto.*?app\.use\('/api/crypto', cryptoRoutes\);", ""

# Rimuovi endpoint pubblico total balance
$indexJs = $indexJs -replace "(?s)// ✅ Endpoint pubblico per Total Balance.*?app\.get\('/public-total-balance'.*?\n\s*\} catch.*?\n\s*\}\);", ""

# Rimuovi cryptoPublicRoutes
$indexJs = $indexJs -replace "(?s)const cryptoPublicRoutes = \[.*?\];", ""

# Rimuovi bypassAuthForCrypto
$indexJs = $indexJs -replace "(?s)const bypassAuthForCrypto = .*?;", ""

# Rimuovi riferimenti crypto nel middleware
$indexJs = $indexJs -replace "(?s)// ✅ FIX: Middleware di autenticazione per route /api/\* \(escluso /api/crypto.*?// Se la richiesta è per /api/crypto/\*, è già stata gestita dal router crypto sopra.*?// quindi questo middleware non dovrebbe essere chiamato per quelle route", "// Middleware di autenticazione per route /api/*"
$indexJs = $indexJs -replace "(?s)// Ma per sicurezza, bypassiamo l'autenticazione per route crypto pubbliche.*?if \(req\.path\.startsWith\('/crypto/'\)\) \{.*?// In questo caso, passiamo al prossimo middleware senza autenticazione.*?return next\(\);.*?\}", ""

# Rimuovi fix per bot-analysis
$indexJs = $indexJs -replace "(?s)// ✅ FIX: Se è un errore da /api/crypto/bot-analysis.*?if \(req\.path && \(req\.path\.includes\('/bot-analysis'\).*?\n\s*\}\)", ""

# Rimuovi riferimenti a cryptoDb
$indexJs = $indexJs -replace "(?s)const cryptoDb = require\('\./crypto_db'\);", ""
$indexJs = $indexJs -replace "(?s)const \{ dbGet, dbAll \} = require\('\./crypto_db_postgresql'\);", ""
$indexJs = $indexJs -replace "(?s)const \{ dbGet \} = require\('\./crypto_db_postgresql'\);", ""
$indexJs = $indexJs -replace "(?s)const \{ dbGet, dbRun \} = require\('\./crypto_db_postgresql'\);", ""
$indexJs = $indexJs -replace "(?s)const portfolio = await cryptoDb\.dbGet.*?;", ""

Set-Content $indexJsPath -Value $indexJs -NoNewline
Write-Host "  ✓ Route crypto rimosse da index.js" -ForegroundColor Green

Write-Host "`n[2/9] Rimozione file backend crypto..." -ForegroundColor Yellow

# Rimuovi file backend crypto
$backendFiles = @(
    "backend/routes/cryptoRoutes.js",
    "backend/crypto_db.js",
    "backend/crypto_db_postgresql.js",
    "backend/services/TradingBot.js",
    "backend/services/BinanceWebSocket.js",
    "backend/services/KlinesAggregatorService.js",
    "backend/services/DataIntegrityService.js",
    "backend/services/SmartExit.js",
    "backend/services/CryptoEmailNotifications.js",
    "backend/klines_monitor_daemon.js",
    "backend/klines_recovery_daemon.js",
    "backend/update_stale_klines.js"
)

foreach ($file in $backendFiles) {
    if (Test-Path $file) {
        Remove-Item $file -Force
        Write-Host "  ✓ Rimosso: $file" -ForegroundColor Green
    }
}

Write-Host "`n[3/9] Rimozione directory frontend crypto..." -ForegroundColor Yellow

# Rimuovi directory frontend crypto
$frontendDirs = @(
    "frontend/src/components/CryptoDashboard",
    "frontend/src/hooks/useCryptoWebSocket.js"
)

foreach ($dir in $frontendDirs) {
    if (Test-Path $dir) {
        Remove-Item $dir -Recurse -Force
        Write-Host "  ✓ Rimossa directory: $dir" -ForegroundColor Green
    }
}

Write-Host "`n[4/9] Rimozione script crypto da backend/scripts/..." -ForegroundColor Yellow

# Rimuovi tutti gli script crypto
$scriptsDir = "backend/scripts"
if (Test-Path $scriptsDir) {
    $cryptoScripts = Get-ChildItem $scriptsDir -File | Where-Object {
        $name = $_.Name.ToLower()
        ($name -match "crypto|klines|symbol|trading|bot|binance|balance|position|backtest|volume|rsi|signal|strategy|aggregator|gap|recovery|monitor|system-status|min-volume|setup-completo|verifica|check-|diagnose|fix-|remove-|clean|normalize|migrate|repopulate|set-total|fetch-total|get-total|read-total|read-tb|ai-check|auto-fix|test-total|quick-db|check-database|check-balance|cleanup|reset-trading|verify-reset|verifica-klines|trova-chi|pulisci|analizza|elimina|force-remove|remove-all|count-klines|clean-price|remove-invalid|remove-remaining|remove-final") -and
        ($name -notmatch "check_historical_trades") # Mantieni questo se non è crypto
    }
    
    foreach ($script in $cryptoScripts) {
        Remove-Item $script.FullName -Force
        Write-Host "  ✓ Rimosso: $($script.Name)" -ForegroundColor Green
    }
}

Write-Host "`n[5/9] Rimozione file root crypto..." -ForegroundColor Yellow

# Rimuovi file root che riguardano crypto
$rootFiles = @(
    "create-and-read-tb.sh",
    "get-tb-via-node.sh",
    "read-tb.sh",
    "ecosystem-klines-monitor.config.js",
    "CryptoExport"
)

foreach ($file in $rootFiles) {
    if (Test-Path $file) {
        Remove-Item $file -Recurse -Force
        Write-Host "  ✓ Rimosso: $file" -ForegroundColor Green
    }
}

Write-Host "`n[6/9] Rimozione riferimenti crypto da frontend/App.jsx..." -ForegroundColor Yellow

# Rimuovi import e riferimenti crypto da App.jsx
if (Test-Path "frontend/src/App.jsx") {
    $appJsx = Get-Content "frontend/src/App.jsx" -Raw
    
    # Rimuovi import
    $appJsx = $appJsx -replace "(?s)import CryptoDashboard from '\./components/CryptoDashboard/CryptoDashboard';", ""
    $appJsx = $appJsx -replace "(?s)import BotAnalysisPageNew from '\./components/CryptoDashboard/BotAnalysisPageNew';", ""
    
    # Rimuovi isCryptoHostname
    $appJsx = $appJsx -replace "(?s)const isCryptoHostname = hostname === 'crypto\.logikaservice\.it'.*?;", ""
    $appJsx = $appJsx -replace "(?s)hostname\.includes\('crypto'\)", "false"
    
    # Rimuovi crypto da testDomain
    $appJsx = $appJsx -replace "(?s)testDomain === 'crypto'", "false"
    $appJsx = $appJsx -replace "(?s)\|\| testDomain === 'crypto'", ""
    $appJsx = $appJsx -replace "(?s)savedDomain === 'crypto'", "false"
    $appJsx = $appJsx -replace "(?s)\|\| isCryptoHostname", ""
    
    # Rimuovi showCryptoDashboard
    $appJsx = $appJsx -replace "(?s)const \[showCryptoDashboard, setShowCryptoDashboard\] = useState\(.*?\);", ""
    $appJsx = $appJsx -replace "(?s)setShowCryptoDashboard\(true\)", ""
    $appJsx = $appJsx -replace "(?s)setShowCryptoDashboard\(false\)", ""
    
    # Rimuovi requestedDomain crypto
    $appJsx = $appJsx -replace "(?s)\(isCryptoHostname \? 'crypto' :", ""
    $appJsx = $appJsx -replace "(?s)requestedDomain === 'crypto'", "false"
    $appJsx = $appJsx -replace "(?s)\|\| isCryptoHostname", ""
    
    # Rimuovi rendering CryptoDashboard
    $appJsx = $appJsx -replace "(?s)\? \(.*?showCryptoDashboard.*?\) :", "? ("
    $appJsx = $appJsx -replace "(?s)showCryptoDashboard \? \(.*?<CryptoDashboard.*?</>", ""
    $appJsx = $appJsx -replace "(?s)<CryptoDashboard.*?/>", ""
    $appJsx = $appJsx -replace "(?s)<BotAnalysisPageNew.*?/>", ""
    
    Set-Content "frontend/src/App.jsx" -Value $appJsx -NoNewline
    Write-Host "  ✓ Riferimenti crypto rimossi da App.jsx" -ForegroundColor Green
}

Write-Host "`n[7/9] Rimozione file backend root crypto..." -ForegroundColor Yellow

# Rimuovi altri file backend root che riguardano crypto
$backendRootFiles = @(
    "backend/balance_error.html",
    "backend/balance_output.html",
    "backend/check_balance_verification.js",
    "backend/check_db_positions.js",
    "backend/display_balance_in_browser.js",
    "backend/mock_api_response.html",
    "backend/list_symbols_table.js",
    "backend/generate_clean_symbol_map.js",
    "backend/debug_no_new_positions.js"
)

foreach ($file in $backendRootFiles) {
    if (Test-Path $file) {
        Remove-Item $file -Force
        Write-Host "  ✓ Rimosso: $file" -ForegroundColor Green
    }
}

Write-Host "`n[8/9] Rimozione documentazione crypto..." -ForegroundColor Yellow

# Rimuovi documentazione crypto
$docsFiles = Get-ChildItem -Path "." -File -Filter "*.md" | Where-Object {
    $content = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue
    $content -and ($content -match "crypto|klines|trading|bot|binance")
}

foreach ($doc in $docsFiles) {
    Remove-Item $doc.FullName -Force
    Write-Host "  ✓ Rimosso: $($doc.Name)" -ForegroundColor Green
}

Write-Host "`n[9/9] Istruzioni per rimozione database..." -ForegroundColor Yellow

# Istruzioni per rimuovere il database
Write-Host "  ⚠️  Per rimuovere il database crypto_db, esegui manualmente:" -ForegroundColor Yellow
Write-Host "     psql -U postgres -c 'DROP DATABASE IF EXISTS crypto_db;'" -ForegroundColor Cyan
Write-Host "     Oppure se usi DATABASE_URL_CRYPTO, rimuovi la variabile da .env" -ForegroundColor Cyan
Write-Host ""
Write-Host "  ⚠️  Rimuovi manualmente dal file .env:" -ForegroundColor Yellow
Write-Host "     - DATABASE_URL_CRYPTO" -ForegroundColor Cyan
Write-Host "     - BINANCE_API_KEY (se presente)" -ForegroundColor Cyan
Write-Host "     - BINANCE_SECRET_KEY (se presente)" -ForegroundColor Cyan
Write-Host "     - Qualsiasi altra variabile che inizia con CRYPTO_" -ForegroundColor Cyan

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "RIMOZIONE COMPLETA!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "✓ Tutti i file crypto sono stati rimossi" -ForegroundColor Green
Write-Host "✓ Le route crypto sono state rimosse da index.js" -ForegroundColor Green
Write-Host "✓ I riferimenti frontend sono stati rimossi" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  AZIONI MANUALI RICHIESTE:" -ForegroundColor Yellow
Write-Host "   1. Rimuovi il database crypto_db da PostgreSQL" -ForegroundColor Yellow
Write-Host "   2. Rimuovi le variabili crypto dal file .env" -ForegroundColor Yellow
Write-Host "   3. Riavvia il backend per applicare le modifiche" -ForegroundColor Yellow
Write-Host "   4. Verifica che il frontend compili senza errori" -ForegroundColor Yellow
Write-Host ""
