# Script per rimuovere crypto SOLO dal server remoto (mantiene tutto in locale)
# Questo script separa crypto dal server ticketapp, ma mantiene tutto in locale per sviluppo

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "RIMOZIONE CRYPTO DAL SERVER REMOTO" -ForegroundColor Cyan
Write-Host "(Mantiene tutto in locale)" -ForegroundColor Yellow
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Configurazione server
$ServerIP = "159.69.121.162"  # IP del server ticketapp (vecchio)
$ServerUser = "root"  # Modifica se necessario
$ServerPath = "/var/www/ticketapp"  # Path sul server

Write-Host "Server: $ServerUser@$ServerIP" -ForegroundColor Yellow
Write-Host "Path: $ServerPath" -ForegroundColor Yellow
Write-Host ""

$confirm = Read-Host "Vuoi rimuovere crypto SOLO dal server remoto? (SI/no)"
if ($confirm -ne "SI") {
    Write-Host "Operazione annullata." -ForegroundColor Yellow
    exit
}

Write-Host "`n[1/8] Connessione al server..." -ForegroundColor Yellow

# Verifica connessione SSH
try {
    $testConnection = ssh -o ConnectTimeout=5 "$ServerUser@$ServerIP" "echo 'OK'" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ Errore: Impossibile connettersi al server" -ForegroundColor Red
        Write-Host "  Verifica che SSH sia configurato correttamente" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "  ✓ Connessione OK" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Errore connessione: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n[2/8] Rimozione route crypto da backend/index.js sul server..." -ForegroundColor Yellow

# Crea script temporaneo per modificare index.js sul server
$modifyIndexJs = @"
cd $ServerPath
# Backup index.js
cp backend/index.js backend/index.js.backup-crypto-removal

# Rimuovi import cryptoRoutes
sed -i '/const cryptoRoutes = require/d' backend/index.js
sed -i '/cryptoRoutes.setSocketIO/d' backend/index.js

# Rimuovi app.use('/api/crypto')
sed -i '/app.use.*\/api\/crypto.*cryptoRoutes/d' backend/index.js

# Rimuovi endpoint pubblico crypto
sed -i '/\/api\/crypto\/public-balance-check/,/^});$/d' backend/index.js

# Rimuovi cryptoPublicRoutes
sed -i '/const cryptoPublicRoutes/d' backend/index.js
sed -i '/bypassAuthForCrypto/d' backend/index.js

# Rimuovi riferimenti crypto nel middleware
sed -i '/\/api\/crypto/d' backend/index.js
sed -i '/cryptoDb/d' backend/index.js

echo "✓ Route crypto rimosse da index.js"
"@

ssh "$ServerUser@$ServerIP" $modifyIndexJs
Write-Host "  ✓ Route crypto rimosse" -ForegroundColor Green

Write-Host "`n[3/8] Rimozione file backend crypto sul server..." -ForegroundColor Yellow

$removeBackendFiles = @"
cd $ServerPath
rm -f backend/routes/cryptoRoutes.js
rm -f backend/crypto_db.js
rm -f backend/crypto_db_postgresql.js
rm -f backend/services/TradingBot.js
rm -f backend/services/BinanceWebSocket.js
rm -f backend/services/KlinesAggregatorService.js
rm -f backend/services/DataIntegrityService.js
rm -f backend/services/SmartExit.js
rm -f backend/services/CryptoEmailNotifications.js
rm -f backend/klines_monitor_daemon.js
rm -f backend/klines_recovery_daemon.js
rm -f backend/update_stale_klines.js
echo "✓ File backend crypto rimossi"
"@

ssh "$ServerUser@$ServerIP" $removeBackendFiles
Write-Host "  ✓ File backend rimossi" -ForegroundColor Green

Write-Host "`n[4/8] Rimozione directory frontend crypto sul server..." -ForegroundColor Yellow

$removeFrontendDirs = @"
cd $ServerPath
rm -rf frontend/src/components/CryptoDashboard
rm -f frontend/src/hooks/useCryptoWebSocket.js
echo "✓ Directory frontend crypto rimosse"
"@

ssh "$ServerUser@$ServerIP" $removeFrontendDirs
Write-Host "  ✓ Directory frontend rimosse" -ForegroundColor Green

Write-Host "`n[5/8] Rimozione script crypto sul server..." -ForegroundColor Yellow

$removeScripts = @"
cd $ServerPath/backend/scripts
find . -type f -name '*crypto*' -delete
find . -type f -name '*klines*' -delete
find . -type f -name '*symbol*' -delete
find . -type f -name '*trading*' -delete
find . -type f -name '*bot*' -delete
find . -type f -name '*binance*' -delete
find . -type f -name '*balance*' -delete
find . -type f -name '*position*' -delete
find . -type f -name '*backtest*' -delete
find . -type f -name '*volume*' -delete
find . -type f -name '*rsi*' -delete
find . -type f -name '*signal*' -delete
find . -type f -name '*strategy*' -delete
echo "✓ Script crypto rimossi"
"@

ssh "$ServerUser@$ServerIP" $removeScripts
Write-Host "  ✓ Script rimossi" -ForegroundColor Green

Write-Host "`n[6/8] Rimozione riferimenti crypto da App.jsx sul server..." -ForegroundColor Yellow

$modifyAppJsx = @"
cd $ServerPath
# Backup App.jsx
cp frontend/src/App.jsx frontend/src/App.jsx.backup-crypto-removal

# Rimuovi import crypto
sed -i '/import.*CryptoDashboard/d' frontend/src/App.jsx
sed -i '/import.*BotAnalysisPageNew/d' frontend/src/App.jsx

# Rimuovi isCryptoHostname
sed -i '/isCryptoHostname/d' frontend/src/App.jsx

# Rimuovi showCryptoDashboard
sed -i '/showCryptoDashboard/d' frontend/src/App.jsx

# Rimuovi rendering CryptoDashboard
sed -i '/<CryptoDashboard/d' frontend/src/App.jsx
sed -i '/<BotAnalysisPageNew/d' frontend/src/App.jsx

echo "✓ Riferimenti crypto rimossi da App.jsx"
"@

ssh "$ServerUser@$ServerIP" $modifyAppJsx
Write-Host "  ✓ Riferimenti rimossi" -ForegroundColor Green

Write-Host "`n[7/8] Rimozione database crypto_db sul server..." -ForegroundColor Yellow

$removeDatabase = @"
# Rimuovi database crypto_db
sudo -u postgres psql -c 'DROP DATABASE IF EXISTS crypto_db;' 2>/dev/null || echo "Database crypto_db non trovato o già rimosso"
echo "✓ Database crypto_db rimosso (se esisteva)"
"@

ssh "$ServerUser@$ServerIP" $removeDatabase
Write-Host "  ✓ Database rimosso" -ForegroundColor Green

Write-Host "`n[8/8] Riavvio backend sul server..." -ForegroundColor Yellow

$restartBackend = @"
cd $ServerPath
pm2 restart ticketapp-backend || pm2 restart all || echo "PM2 non disponibile, riavvia manualmente"
echo "✓ Backend riavviato"
"@

ssh "$ServerUser@$ServerIP" $restartBackend
Write-Host "  ✓ Backend riavviato" -ForegroundColor Green

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "RIMOZIONE COMPLETA DAL SERVER!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "✓ Tutti i file crypto sono stati rimossi dal server" -ForegroundColor Green
Write-Host "✓ Le route crypto sono state rimosse" -ForegroundColor Green
Write-Host "✓ Il database crypto_db è stato rimosso" -ForegroundColor Green
Write-Host "✓ Il backend è stato riavviato" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  NOTA: I file in locale sono stati MANTENUTI per sviluppo" -ForegroundColor Yellow
Write-Host "   Se vuoi rimuovere anche in locale, esegui: .\remove-crypto-complete.ps1" -ForegroundColor Cyan
Write-Host ""

