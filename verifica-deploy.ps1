# Script per verificare stato deploy
cd c:\TicketApp

Write-Host "=== VERIFICA STATO REPOSITORY ===" -ForegroundColor Cyan
Write-Host "`n📊 STATUS:" -ForegroundColor Yellow
git status

Write-Host "`n📝 ULTIMO COMMIT LOCALE:" -ForegroundColor Yellow
git log --oneline -1

Write-Host "`n🚀 COMMIT DA PUSHARE:" -ForegroundColor Yellow
$commitsToPush = git log origin/main..HEAD --oneline
if ($commitsToPush) {
    Write-Host $commitsToPush -ForegroundColor Green
} else {
    Write-Host "✅ Nessun commit da pushare - tutto sincronizzato!" -ForegroundColor Green
}

Write-Host "`n🌐 REMOTE:" -ForegroundColor Yellow
git remote -v

Write-Host "`n🌿 BRANCH:" -ForegroundColor Yellow
git branch -vv

Write-Host "`n=== TENTATIVO PUSH ===" -ForegroundColor Cyan
Write-Host "Forzo il push..." -ForegroundColor Yellow
git push origin main --verbose

Write-Host "`n✅ Controlla su GitHub Actions:" -ForegroundColor Green
Write-Host "https://github.com/Logikaservice/ticketapp/actions" -ForegroundColor Cyan

