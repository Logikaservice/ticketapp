# Script PowerShell per deploy fix crypto sulla VPS
# Esegui questo script dalla tua macchina Windows

Write-Host "🚀 DEPLOY FIX CRYPTO SU VPS" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan
Write-Host ""

$VPS_HOST = "159.69.121.162"
$VPS_USER = "root"

Write-Host "📋 Configurazione:" -ForegroundColor Yellow
Write-Host "   VPS: ${VPS_USER}@${VPS_HOST}" -ForegroundColor White
Write-Host ""

$confirm = Read-Host "Vuoi procedere con il deploy? (s/n)"
if ($confirm -ne "s" -and $confirm -ne "S") {
    Write-Host "Deploy annullato." -ForegroundColor Yellow
    exit
}

Write-Host ""
Write-Host "1️⃣ Backup index.js..." -ForegroundColor Yellow
ssh "${VPS_USER}@${VPS_HOST}" "cd /var/www/ticketapp/backend; cp index.js index.js.backup.`$(date +%Y%m%d_%H%M%S); echo 'Backup creato'"

Write-Host ""
Write-Host "2️⃣ Rimozione riferimenti cryptoRoutes..." -ForegroundColor Yellow
ssh "${VPS_USER}@${VPS_HOST}" "cd /var/www/ticketapp/backend; sed -i '/CryptoExport\/backend\/routes\/cryptoRoutes/d' index.js; sed -i '/\/\/ Crypto routes - Import from CryptoExport backend/d' index.js; sed -i '/\/\/ Configure Socket.IO for crypto routes if needed/d' index.js; sed -i '/if (cryptoRoutes\.setSocketIO && io) {/,/}/d' index.js; sed -i '/\/\/ Crypto routes - Mount before other/d' index.js; sed -i '/app\.use.*\/api\/crypto.*cryptoRoutes/d' index.js; echo 'Riferimenti rimossi'"

Write-Host ""
Write-Host "3️⃣ Rimozione cartella CryptoExport..." -ForegroundColor Yellow
ssh "${VPS_USER}@${VPS_HOST}" "if [ -d '/var/www/ticketapp/CryptoExport' ]; then rm -rf /var/www/ticketapp/CryptoExport; echo 'Cartella rimossa'; else echo 'Cartella non esiste'; fi"

Write-Host ""
Write-Host "4️⃣ Verifica sintassi..." -ForegroundColor Yellow
ssh "${VPS_USER}@${VPS_HOST}" "cd /var/www/ticketapp/backend; node -c index.js && echo 'Sintassi corretta' || echo 'Errore sintassi!'"

Write-Host ""
Write-Host "5️⃣ Riavvio backend..." -ForegroundColor Yellow
ssh "${VPS_USER}@${VPS_HOST}" "pm2 restart ticketapp-backend; sleep 3; pm2 status"

Write-Host ""
Write-Host "6️⃣ Test endpoint..." -ForegroundColor Yellow
$result = ssh "${VPS_USER}@${VPS_HOST}" "curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/api/health"
Write-Host "   HTTP Code: $result" -ForegroundColor White

Write-Host ""
Write-Host "✅ Deploy completato!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Verifica:" -ForegroundColor Yellow
Write-Host "   - Apri: https://ticket.logikaservice.it" -ForegroundColor White
Write-Host "   - Controlla log: ssh ${VPS_USER}@${VPS_HOST} 'pm2 logs ticketapp-backend --lines 30'" -ForegroundColor White
