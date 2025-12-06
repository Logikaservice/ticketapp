#!/usr/bin/env pwsh
# Script per push e deploy

Write-Host "🚀 === DEPLOY SCRIPT ===" -ForegroundColor Cyan
Write-Host ""

# 1. Verifica directory
Write-Host "1️⃣ Verifica directory..." -ForegroundColor Yellow
Set-Location "c:\TicketApp"
Write-Host "Directory corrente: $(Get-Location)" -ForegroundColor Green
Write-Host ""

# 2. Git status
Write-Host "2️⃣ Git status..." -ForegroundColor Yellow
$status = git status
Write-Host $status
Write-Host ""

# 3. Git add
Write-Host "3️⃣ Git add..." -ForegroundColor Yellow
git add .
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ File aggiunti" -ForegroundColor Green
} else {
    Write-Host "❌ Errore git add" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 4. Git commit
Write-Host "4️⃣ Git commit..." -ForegroundColor Yellow
$commitMsg = "Deploy: Aggiunto pulsante Nuova Analisi con badge versione aggiornata"
git commit -m $commitMsg
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Commit completato" -ForegroundColor Green
} else {
    Write-Host "⚠️ Commit potrebbe essere vuoto o già fatto" -ForegroundColor Yellow
}
Write-Host ""

# 5. Git push
Write-Host "5️⃣ Git push..." -ForegroundColor Yellow
$pushOutput = git push origin main 2>&1
Write-Host $pushOutput
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Push completato!" -ForegroundColor Green
} else {
    Write-Host "❌ Errore push!" -ForegroundColor Red
    Write-Host $pushOutput
    exit 1
}
Write-Host ""

# 6. Verifica ultimo commit
Write-Host "6️⃣ Ultimo commit..." -ForegroundColor Yellow
git log --oneline -1
Write-Host ""

Write-Host "✅ === PUSH COMPLETATO ===" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Prossimi passi per VPS:" -ForegroundColor Cyan
Write-Host "cd /var/www/ticketapp" -ForegroundColor White
Write-Host "git pull origin main" -ForegroundColor White
Write-Host "cd frontend && npm run build" -ForegroundColor White
Write-Host "cd .. && pm2 restart all" -ForegroundColor White
