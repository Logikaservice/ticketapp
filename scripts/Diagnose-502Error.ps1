# Script PowerShell per diagnosticare errori 502 Bad Gateway
# Uso: .\scripts\Diagnose-502Error.ps1

$VPS_HOST = "159.69.121.162"
$VPS_USER = "root"
$VPS_PATH = "/var/www/ticketapp"
$SSH_KEY = "$env:USERPROFILE\.ssh\vps_key"

Write-Host "`n[DIAGNOSTICA] Errori 502 Bad Gateway" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Importa VpsHelper se disponibile
$vpsHelperPath = Join-Path $PSScriptRoot "VpsHelper.ps1"
if (Test-Path $vpsHelperPath) {
    . $vpsHelperPath
    Write-Host "[OK] VpsHelper caricato" -ForegroundColor Green
} else {
    Write-Host "[WARN] VpsHelper non trovato, uso comandi SSH diretti" -ForegroundColor Yellow
}

function Test-BackendHealth {
    Write-Host "`n[1] Test connessione backend locale..." -ForegroundColor Yellow
    Write-Host "----------------------------------------" -ForegroundColor Gray
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3001/api/health" -TimeoutSec 5 -ErrorAction Stop
        Write-Host "   [OK] Backend locale risponde!" -ForegroundColor Green
        Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Gray
        Write-Host "   Response: $($response.Content)" -ForegroundColor Gray
        return $true
    } catch {
        Write-Host "   [ERRORE] Backend locale NON risponde" -ForegroundColor Red
        Write-Host "   Errore: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

function Test-BackendRemote {
    Write-Host "`n[2] Test connessione backend remoto (VPS)..." -ForegroundColor Yellow
    Write-Host "-----------------------------------------------" -ForegroundColor Gray
    
    try {
        $response = Invoke-WebRequest -Uri "https://ticket.logikaservice.it/api/health" -TimeoutSec 10 -ErrorAction Stop
        Write-Host "   [OK] Backend remoto risponde!" -ForegroundColor Green
        Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Gray
        return $true
    } catch {
        Write-Host "   [ERRORE] Backend remoto NON risponde (502 Bad Gateway)" -ForegroundColor Red
        Write-Host "   Errore: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

function Get-VpsBackendStatus {
    Write-Host "`n[3] Verifica stato backend sulla VPS..." -ForegroundColor Yellow
    Write-Host "------------------------------------------" -ForegroundColor Gray
    
    if (Test-Path $vpsHelperPath) {
        Write-Host "   [INFO] Stato PM2:" -ForegroundColor Cyan
        Get-VpsStatus
        
        Write-Host "`n   [INFO] Porta 3001:" -ForegroundColor Cyan
        Test-VpsBackendPort
        
        Write-Host "`n   [INFO] Ultimi log backend:" -ForegroundColor Cyan
        Get-VpsBackendLogs -Lines 30
    } else {
        Write-Host "   [WARN] Connettiti manualmente alla VPS:" -ForegroundColor Yellow
        Write-Host "   ssh $VPS_USER@$VPS_HOST" -ForegroundColor Gray
        Write-Host "   pm2 status" -ForegroundColor Gray
        Write-Host "   pm2 logs ticketapp-backend --lines 30" -ForegroundColor Gray
    }
}

function Restart-VpsBackend {
    Write-Host "`n[4] Riavvio backend sulla VPS..." -ForegroundColor Yellow
    Write-Host "-----------------------------------" -ForegroundColor Gray
    
    if (Test-Path $vpsHelperPath) {
        Restart-VpsBackend
        Start-Sleep -Seconds 3
        
        Write-Host "`n   [INFO] Verifica dopo riavvio..." -ForegroundColor Cyan
        Test-BackendRemote
    } else {
        Write-Host "   [WARN] Connettiti manualmente alla VPS:" -ForegroundColor Yellow
        Write-Host "   ssh $VPS_USER@$VPS_HOST" -ForegroundColor Gray
        Write-Host "   cd $VPS_PATH" -ForegroundColor Gray
        Write-Host "   pm2 restart ticketapp-backend" -ForegroundColor Gray
        Write-Host "   pm2 logs ticketapp-backend --lines 30" -ForegroundColor Gray
    }
}

# Esegui diagnostica
Write-Host "`n[INFO] Inizio diagnostica..." -ForegroundColor Cyan
Write-Host ""

# Test locale (se backend locale è in esecuzione)
$localBackend = Test-BackendHealth

# Test remoto
$remoteBackend = Test-BackendRemote

if (-not $remoteBackend) {
    Write-Host "`n[ERRORE] PROBLEMA RILEVATO: Backend remoto non risponde (502)" -ForegroundColor Red
    Write-Host ""
    Write-Host "[AZIONI] Azioni consigliate:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Verifica stato backend sulla VPS:" -ForegroundColor Cyan
    Write-Host "   ssh $VPS_USER@$VPS_HOST" -ForegroundColor Gray
    Write-Host "   pm2 status" -ForegroundColor Gray
    Write-Host "   pm2 logs ticketapp-backend --lines 50" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Riavvia il backend:" -ForegroundColor Cyan
    Write-Host "   pm2 restart ticketapp-backend" -ForegroundColor Gray
    Write-Host "   # oppure" -ForegroundColor Gray
    Write-Host "   pm2 restart all" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. Verifica che la porta 3001 sia in ascolto:" -ForegroundColor Cyan
    Write-Host "   netstat -tlnp | grep 3001" -ForegroundColor Gray
    Write-Host "   # oppure" -ForegroundColor Gray
    Write-Host "   ss -tlnp | grep 3001" -ForegroundColor Gray
    Write-Host ""
    Write-Host "4. Test locale sulla VPS:" -ForegroundColor Cyan
    Write-Host "   curl http://localhost:3001/api/health" -ForegroundColor Gray
    Write-Host ""
    Write-Host "5. Se il backend continua a crashare:" -ForegroundColor Cyan
    Write-Host "   cd $VPS_PATH/backend" -ForegroundColor Gray
    Write-Host "   node index.js" -ForegroundColor Gray
    Write-Host "   # Questo mostrera l'errore esatto" -ForegroundColor Gray
    Write-Host ""
    Write-Host "6. Verifica configurazione nginx:" -ForegroundColor Cyan
    Write-Host "   sudo nginx -t" -ForegroundColor Gray
    Write-Host "   sudo systemctl restart nginx" -ForegroundColor Gray
    Write-Host ""
    
    # Chiedi se vuoi riavviare automaticamente
    $restart = Read-Host "Vuoi provare a riavviare il backend automaticamente? (s/n)"
    if ($restart -eq "s" -or $restart -eq "S") {
        Restart-VpsBackend
    }
} else {
    Write-Host "`n[OK] Backend remoto funziona correttamente!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Se vedi ancora errori 502 nel browser:" -ForegroundColor Yellow
    Write-Host "1. Pulisci la cache del browser (Ctrl+Shift+Delete)" -ForegroundColor Cyan
    Write-Host "2. Prova in modalita incognito" -ForegroundColor Cyan
    Write-Host "3. Verifica la console del browser per errori JavaScript" -ForegroundColor Cyan
}

Write-Host "`n[OK] Diagnostica completata!" -ForegroundColor Green
Write-Host ""
