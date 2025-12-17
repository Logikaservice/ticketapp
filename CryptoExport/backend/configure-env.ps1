# Script per configurare backend/.env
Write-Host "=== CONFIGURAZIONE backend/.env ===" -ForegroundColor Green
Write-Host ""
Write-Host "Inserisci il DATABASE_URL dal server VPS:" -ForegroundColor Yellow
Write-Host "(Esempio: postgresql://user:password@host:5432/ticketapp)" -ForegroundColor Gray
 = Read-Host "DATABASE_URL"
Write-Host ""
Write-Host "Inserisci il JWT_SECRET (usa lo stesso del server o genera uno nuovo):" -ForegroundColor Yellow
 = Read-Host "JWT_SECRET"
Write-Host ""
Write-Host "Configurazione completata!" -ForegroundColor Green
