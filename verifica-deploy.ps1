# Script per verificare e fare deploy
Write-Host "🔍 === VERIFICA DEPLOY ===" -ForegroundColor Cyan
Write-Host ""

Set-Location "c:\TicketApp"

# 1. Verifica se ci sono modifiche non committate
Write-Host "1️⃣ Verifica modifiche..." -ForegroundColor Yellow
$statusOutput = git status --short
if ($statusOutput) {
    Write-Host "⚠️ Ci sono modifiche non committate:" -ForegroundColor Yellow
    Write-Host $statusOutput
    Write-Host ""
    Write-Host "Vuoi committarle? (S/n)" -ForegroundColor Cyan
    $risposta = Read-Host
    if ($risposta -ne "n") {
        git add .
        git commit -m "Deploy: Modifiche automatiche"
        Write-Host "✅ Modifiche committate" -ForegroundColor Green
    }
} else {
    Write-Host "✅ Nessuna modifica da committare" -ForegroundColor Green
}
Write-Host ""

# 2. Verifica branch corrente
Write-Host "2️⃣ Verifica branch..." -ForegroundColor Yellow
$branch = git branch --show-current
Write-Host "Branch corrente: $branch" -ForegroundColor White
if ($branch -ne "main") {
    Write-Host "⚠️ Non sei sul branch main! Esegui: git checkout main" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 3. Verifica remote
Write-Host "3️⃣ Verifica remote..." -ForegroundColor Yellow
$remote = git remote get-url origin
Write-Host "Remote origin: $remote" -ForegroundColor White
Write-Host ""

# 4. Push
Write-Host "4️⃣ Push su GitHub..." -ForegroundColor Yellow
git push origin main
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Push completato!" -ForegroundColor Green
} else {
    Write-Host "❌ Errore nel push!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Problemi comuni:" -ForegroundColor Yellow
    Write-Host "- Verifica credenziali Git (git config user.name/user.email)" -ForegroundColor White
    Write-Host "- Verifica autenticazione GitHub (token o SSH key)" -ForegroundColor White
    exit 1
}
Write-Host ""

# 5. Verifica ultimo commit
Write-Host "5️⃣ Ultimo commit..." -ForegroundColor Yellow
git log --oneline -1
Write-Host ""

Write-Host "✅ === PUSH COMPLETATO ===" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Prossimi passi:" -ForegroundColor Cyan
Write-Host ""
Write-Host "OPZIONE 1: Deploy automatico con GitHub Actions" -ForegroundColor Yellow
Write-Host "1. Vai su: https://github.com/Logikaservice/ticketapp/actions" -ForegroundColor White
Write-Host "2. Verifica che la workflow 'Deploy to VPS' sia partita" -ForegroundColor White
Write-Host "3. Controlla eventuali errori" -ForegroundColor White
Write-Host ""
Write-Host "OPZIONE 2: Deploy manuale sulla VPS" -ForegroundColor Yellow
Write-Host "Esegui questi comandi sulla VPS:" -ForegroundColor White
Write-Host "  cd /var/www/ticketapp" -ForegroundColor Gray
Write-Host "  git pull origin main" -ForegroundColor Gray
Write-Host "  cd frontend && npm run build" -ForegroundColor Gray
Write-Host "  cd .. && pm2 restart all" -ForegroundColor Gray
Write-Host "  sudo systemctl restart nginx" -ForegroundColor Gray
