# Script per aggiornare il codice sulla VPS (git pull + restart)
# Esegui dalla tua macchina Windows

Write-Host "🚀 DEPLOY UPDATE SU VPS" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan

$VPS_HOST = "159.69.121.162"
$VPS_USER = "root"

Write-Host "Connessione a ${VPS_USER}@${VPS_HOST}..."

ssh "${VPS_USER}@${VPS_HOST}" "cd /var/www/ticketapp && echo '📥 Git Pull...' && git pull && echo '🔄 Restart Backend...' && pm2 restart backend && echo '✅ Completato!'"

Write-Host ""
Write-Host "Premi INVIO per chiudere..."
Read-Host
