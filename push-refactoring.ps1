# Script per push refactoring con output esplicito
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   PUSH REFACTORING BOT" -ForegroundColor Cyan  
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

cd c:\TicketApp

Write-Host "1. Verifica stato repository..." -ForegroundColor Yellow
$status = git status --short
if ($status) {
    Write-Host "Modifiche trovate:" -ForegroundColor Green
    Write-Host $status
} else {
    Write-Host "Nessuna modifica da committare" -ForegroundColor Yellow
}

Write-Host "`n2. Aggiunta file modificati..." -ForegroundColor Yellow
git add backend/routes/cryptoRoutes.js
$added = git diff --cached --name-only
if ($added) {
    Write-Host "File aggiunti:" -ForegroundColor Green
    Write-Host $added
} else {
    Write-Host "Nessun file da aggiungere" -ForegroundColor Yellow
}

Write-Host "`n3. Commit modifiche..." -ForegroundColor Yellow
$commitResult = git commit -m "Refactoring: Bot usa candele reali 15m per segnali affidabili" 2>&1
Write-Host $commitResult

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ Nessuna modifica da committare o commit già esistente" -ForegroundColor Yellow
} else {
    Write-Host "✅ Commit creato" -ForegroundColor Green
}

Write-Host "`n4. Push su GitHub..." -ForegroundColor Yellow
$pushResult = git push origin main 2>&1
Write-Host $pushResult

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Push completato con successo!" -ForegroundColor Green
    Write-Host "`nIl workflow GitHub Actions dovrebbe partire automaticamente." -ForegroundColor Cyan
    Write-Host "Verifica su: https://github.com/Logikaservice/ticketapp/actions" -ForegroundColor Cyan
} else {
    Write-Host "`n❌ Errore durante il push!" -ForegroundColor Red
    Write-Host "Output completo:" -ForegroundColor Yellow
    Write-Host $pushResult
    Write-Host "`nVerifica le credenziali GitHub o la connessione" -ForegroundColor Yellow
}

Write-Host "`n5. Verifica ultimo commit..." -ForegroundColor Yellow
$lastCommit = git log -1 --oneline
Write-Host "Ultimo commit locale:" -ForegroundColor Cyan
Write-Host $lastCommit

Write-Host "`n6. Verifica commit su remote..." -ForegroundColor Yellow
$remoteCommit = git log origin/main -1 --oneline 2>&1
Write-Host "Ultimo commit remote:" -ForegroundColor Cyan
Write-Host $remoteCommit

Write-Host ""

