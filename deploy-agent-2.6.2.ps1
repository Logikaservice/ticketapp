# Script completo per deploy agent v2.6.2

Write-Host "=== DEPLOY AGENT v2.6.2 ===" -ForegroundColor Cyan
Write-Host ""

$zipPath = "C:\TicketApp\agent-releases\agent-update-2.6.2.zip"
$vpsHost = "159.69.121.162"
$vpsUser = "root"

# 1. Verifica file locale
Write-Host "1. Verifica file locale..." -ForegroundColor Yellow
if (-not (Test-Path $zipPath)) {
    Write-Host "   ERRORE: File non trovato: $zipPath" -ForegroundColor Red
    exit 1
}
$sizeKB = [math]::Round((Get-Item $zipPath).Length / 1024, 2)
Write-Host "   OK: $zipPath ($sizeKB KB)" -ForegroundColor Green

# 2. Crea directory sulla VPS se non esiste
Write-Host ""
Write-Host "2. Verifica directory sulla VPS..." -ForegroundColor Yellow
ssh "${vpsUser}@${vpsHost}" "mkdir -p /var/www/ticketapp/agent-updates"
Write-Host "   OK: Directory pronta" -ForegroundColor Green

# 3. Carica file sulla VPS
Write-Host ""
Write-Host "3. Caricamento file sulla VPS..." -ForegroundColor Yellow
$scpDest = "${vpsUser}@${vpsHost}:/var/www/ticketapp/agent-updates/"
Write-Host "   Destinazione: $scpDest" -ForegroundColor Gray

scp $zipPath $scpDest

if ($LASTEXITCODE -ne 0) {
    Write-Host "   ERRORE durante il caricamento" -ForegroundColor Red
    exit 1
}
Write-Host "   OK: File caricato" -ForegroundColor Green

# 4. Aggiorna version.json sulla VPS
Write-Host ""
Write-Host "4. Aggiornamento version.json sulla VPS..." -ForegroundColor Yellow

$sshCommand = @"
cd /var/www/ticketapp/agent-updates && echo '{\"version\": \"2.6.2\", \"download_url\": \"/agent-updates/agent-update-2.6.2.zip\"}' > version.json && cat version.json
"@

ssh "${vpsUser}@${vpsHost}" $sshCommand

if ($LASTEXITCODE -eq 0) {
    Write-Host "   OK: version.json aggiornato" -ForegroundColor Green
}
else {
    Write-Host "   ERRORE durante l'aggiornamento di version.json" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== DEPLOY COMPLETATO ===" -ForegroundColor Green
Write-Host ""
Write-Host "Gli agent si aggiorneranno automaticamente alla versione 2.6.2" -ForegroundColor Cyan
Write-Host "Tempo stimato: 5-15 minuti (al prossimo check aggiornamenti)" -ForegroundColor Gray
Write-Host ""
Write-Host "Changelog v2.6.2:" -ForegroundColor Yellow
Write-Host "  - Normalizzazione MAC address con due punti (:) invece di trattini (-)" -ForegroundColor White
Write-Host ""
