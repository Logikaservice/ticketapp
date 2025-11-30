# Script per fare push su GitHub con output visibile
cd c:\TicketApp

Write-Host "=== VERIFICA STATO ===" -ForegroundColor Cyan
git status --short

Write-Host "`n=== ULTIMO COMMIT LOCALE ===" -ForegroundColor Cyan
git log --oneline -1

Write-Host "`n=== COMMIT DA PUSHARE ===" -ForegroundColor Cyan
git log origin/main..HEAD --oneline

Write-Host "`n=== AGGIUNGO FILE ===" -ForegroundColor Yellow
git add frontend/src/components/PackVision.jsx
git add fix-schermo-diviso.md

Write-Host "`n=== COMMIT ===" -ForegroundColor Yellow
git commit -m "PackVision: fix calcolo shouldShowSplit e rimossi log debug eccessivi"

Write-Host "`n=== PUSH SU GITHUB ===" -ForegroundColor Green
git push origin main

Write-Host "`n=== VERIFICA FINALE ===" -ForegroundColor Cyan
git log --oneline -1
Write-Host "`n✅ Push completato!" -ForegroundColor Green


