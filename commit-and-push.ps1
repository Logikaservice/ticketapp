# Script PowerShell per commit e push automatico
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   COMMIT E PUSH AUTOMATICO" -ForegroundColor Cyan  
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

cd c:\TicketApp

Write-Host "1. Verifica stato repository..." -ForegroundColor Yellow
$status = git status --short
if ($status) {
    Write-Host "Trovate modifiche:" -ForegroundColor Green
    Write-Host $status
} else {
    Write-Host "Nessuna modifica da committare" -ForegroundColor Yellow
    exit
}

Write-Host "`n2. Aggiunta modifiche..." -ForegroundColor Yellow
git add -A

Write-Host "`n3. Commit modifiche..." -ForegroundColor Yellow
git commit -m "PackVision: aggiunto debug log per diagnosticare problema messaggi non urgenti nella parte inferiore"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Errore durante il commit!" -ForegroundColor Red
    exit
}

Write-Host "`n4. Push su GitHub..." -ForegroundColor Yellow
git push origin main
if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Push completato con successo!" -ForegroundColor Green
    Write-Host "`nIl workflow GitHub Actions dovrebbe partire automaticamente." -ForegroundColor Cyan
    Write-Host "Verifica su: https://github.com/Logikaservice/ticketapp/actions" -ForegroundColor Cyan
} else {
    Write-Host "`n❌ Errore durante il push!" -ForegroundColor Red
}

Write-Host ""

