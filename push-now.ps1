# Script per push su GitHub con output dettagliato
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   PUSH SU GITHUB" -ForegroundColor Cyan  
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

cd c:\TicketApp

Write-Host "1. Verifica stato repository..." -ForegroundColor Yellow
$status = git status --short
Write-Host "Status:" $status

Write-Host "`n2. Aggiunta file modificati..." -ForegroundColor Yellow
git add backend/routes/cryptoRoutes.js
git add frontend/src/components/CryptoDashboard/CryptoDashboard.jsx
$added = git diff --cached --name-only
Write-Host "File aggiunti:" $added

Write-Host "`n3. Commit modifiche..." -ForegroundColor Yellow
$commitMsg = "Fix: Risolto errore 500 su /api/crypto/statistics e migliorata gestione posizioni aperte

- Aggiunti controlli di sicurezza per gestire errori in getSymbolPrice()
- Validazione di openPositions, closedPositions e holdings prima dell'uso
- Migliorata gestione errori per evitare crash quando un simbolo fallisce
- Aggiunto logging per debug delle posizioni
- Rimosso codice duplicato nel frontend"
git commit -m $commitMsg
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ Nessuna modifica da committare o commit già esistente" -ForegroundColor Yellow
} else {
    Write-Host "✅ Commit creato" -ForegroundColor Green
}

Write-Host "`n4. Push su GitHub..." -ForegroundColor Yellow
git push origin main
if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Push completato con successo!" -ForegroundColor Green
    Write-Host "`nIl workflow GitHub Actions dovrebbe partire automaticamente." -ForegroundColor Cyan
    Write-Host "Verifica su: https://github.com/Logikaservice/ticketapp/actions" -ForegroundColor Cyan
} else {
    Write-Host "`n❌ Errore durante il push!" -ForegroundColor Red
    Write-Host "Verifica le credenziali GitHub o la connessione" -ForegroundColor Yellow
}

Write-Host "`n5. Verifica ultimo commit..." -ForegroundColor Yellow
$lastCommit = git log -1 --oneline
Write-Host "Ultimo commit:" $lastCommit

Write-Host ""
