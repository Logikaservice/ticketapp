# Script diagnostico per VPS TicketApp
Write-Host "`n=== DIAGNOSTICA TICKETAPP VPS ===" -ForegroundColor Cyan

# Test connessione sito
Write-Host "`n1. Test connessione HTTPS..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "https://ticket.logikaservice.it" -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
    Write-Host "   ✓ Status Code: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   ✓ Content Length: $($response.Content.Length) bytes" -ForegroundColor Green
    
    if ($response.Content.Length -lt 500) {
        Write-Host "   ⚠ ATTENZIONE: Contenuto molto piccolo (<500 bytes)" -ForegroundColor Red
        Write-Host "   Possibile pagina bianca o errore!" -ForegroundColor Red
    }
    
    # Controlla se c'è root div di React
    if ($response.Content -match 'id="root"') {
        Write-Host "   ✓ React root div trovato" -ForegroundColor Green
    } else {
        Write-Host "   ✗ React root div NON trovato" -ForegroundColor Red
    }
} catch {
    Write-Host "   ✗ Errore connessione: $($_.Exception.Message)" -ForegroundColor Red
}

# Test API backend
Write-Host "`n2. Test API Backend..." -ForegroundColor Yellow
try {
    $apiResponse = Invoke-WebRequest -Uri "https://ticket.logikaservice.it/api/health" -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
    Write-Host "   ✓ Backend API risponde: $($apiResponse.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Backend API non risponde: $($_.Exception.Message)" -ForegroundColor Red
}

# Verifica GitHub Actions
Write-Host "`n3. Ultimi commit pushati:" -ForegroundColor Yellow
git log --oneline -3

Write-Host "`n=== AZIONI RACCOMANDATE ===" -ForegroundColor Cyan
Write-Host "1. Verifica log deploy: https://github.com/Logikaservice/ticketapp/actions"
Write-Host "2. Se il deploy è fallito, leggi gli errori nel log"
Write-Host "3. Se il deploy è OK ma il sito è bianco, controlla i log del browser (F12 > Console)"
Write-Host "4. Controlla i log del backend sulla VPS: sudo journalctl -u ticketapp-backend -n 100"
