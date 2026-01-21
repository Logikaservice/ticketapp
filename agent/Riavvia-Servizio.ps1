# Riavvia-Servizio.ps1
# Script per riavviare il servizio e verificare che rimanga in Running

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "RIAVVIO SERVIZIO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verifica stato attuale
Write-Host "[1] Stato attuale servizio..." -ForegroundColor Yellow
$service = Get-Service -Name "NetworkMonitorService" -ErrorAction SilentlyContinue
if ($service) {
    Write-Host "  Status corrente: $($service.Status)" -ForegroundColor $(if ($service.Status -eq 'Running') { 'Green' } else { 'Yellow' })
} else {
    Write-Host "  ERRORE: Servizio non trovato!" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 2. Se è in Paused, riprendilo prima
if ($service.Status -eq "Paused") {
    Write-Host "[2] Servizio in Paused, riprendo..." -ForegroundColor Yellow
    try {
        Resume-Service -Name "NetworkMonitorService" -ErrorAction Stop
        Start-Sleep -Seconds 2
        $service = Get-Service -Name "NetworkMonitorService"
        if ($service.Status -eq "Running") {
            Write-Host "  Servizio ripreso con successo!" -ForegroundColor Green
            exit 0
        }
    } catch {
        Write-Host "  Errore ripresa: $_" -ForegroundColor Red
    }
    Write-Host ""
}

# 3. Ferma servizio
Write-Host "[3] Fermo servizio..." -ForegroundColor Yellow
try {
    if ($service.Status -eq "Running") {
        Stop-Service -Name "NetworkMonitorService" -Force -ErrorAction Stop
        Write-Host "  Servizio fermato" -ForegroundColor Green
    } else {
        Write-Host "  Servizio già fermato o in altro stato: $($service.Status)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  Errore fermata: $_" -ForegroundColor Red
}
Start-Sleep -Seconds 3
Write-Host ""

# 4. Avvia servizio
Write-Host "[4] Avvio servizio..." -ForegroundColor Yellow
try {
    Start-Service -Name "NetworkMonitorService" -ErrorAction Stop
    Start-Sleep -Seconds 5
    
    $service = Get-Service -Name "NetworkMonitorService"
    Write-Host "  Status dopo avvio: $($service.Status)" -ForegroundColor $(if ($service.Status -eq 'Running') { 'Green' } else { 'Red' })
    
    if ($service.Status -eq "Running") {
        Write-Host "  ✅ Servizio avviato con successo!" -ForegroundColor Green
    } elseif ($service.Status -eq "Paused") {
        Write-Host "  ⚠️ Servizio si è messo in Paused dopo l'avvio" -ForegroundColor Yellow
        Write-Host "  Controlla i log per errori" -ForegroundColor Yellow
    } else {
        Write-Host "  ❌ Servizio in stato: $($service.Status)" -ForegroundColor Red
        Write-Host "  Controlla i log in: C:\ProgramData\NetworkMonitorAgent\NetworkMonitorService.log" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ❌ Errore avvio: $_" -ForegroundColor Red
    Write-Host "  Controlla i log in: C:\ProgramData\NetworkMonitorAgent\NetworkMonitorService.log" -ForegroundColor Yellow
}
Write-Host ""

# 5. Attendi 10 secondi e verifica ancora
Write-Host "[5] Verifica stato dopo 10 secondi..." -ForegroundColor Yellow
Start-Sleep -Seconds 10
$service = Get-Service -Name "NetworkMonitorService"
Write-Host "  Status finale: $($service.Status)" -ForegroundColor $(if ($service.Status -eq 'Running') { 'Green' } else { 'Yellow' })

if ($service.Status -eq "Running") {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "✅ SERVIZIO FUNZIONANTE" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "⚠️ SERVIZIO NON IN RUNNING" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Controlla i log per errori:" -ForegroundColor Yellow
    Write-Host "  - C:\ProgramData\NetworkMonitorAgent\NetworkMonitorService.log" -ForegroundColor Yellow
    Write-Host "  - C:\ProgramData\NetworkMonitorAgent\NetworkMonitorService_bootstrap.log" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Premi un tasto per continuare..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
