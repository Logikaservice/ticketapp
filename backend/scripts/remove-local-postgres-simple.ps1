# Script semplice per rimozione PostgreSQL locale

Write-Host "Rimozione Database PostgreSQL Locale" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Trova servizi PostgreSQL
Write-Host "Ricerca servizi PostgreSQL..." -ForegroundColor Yellow
$postgresServices = Get-Service | Where-Object { $_.Name -like "*postgres*" -or $_.DisplayName -like "*PostgreSQL*" }

if ($postgresServices.Count -eq 0) {
    Write-Host "Nessun servizio PostgreSQL trovato" -ForegroundColor Green
    Write-Host "PostgreSQL locale gia rimosso o non installato" -ForegroundColor Green
    exit 0
}

Write-Host "Servizi PostgreSQL trovati:" -ForegroundColor Green
foreach ($service in $postgresServices) {
    Write-Host "  - $($service.Name) - Status: $($service.Status)" -ForegroundColor Gray
}
Write-Host ""

# Arresta servizi
Write-Host "Arresto servizi PostgreSQL..." -ForegroundColor Yellow
foreach ($service in $postgresServices) {
    if ($service.Status -eq "Running") {
        Write-Host "  Arresto $($service.Name)..." -ForegroundColor Gray
        try {
            Stop-Service -Name $service.Name -Force
            Write-Host "  Servizio arrestato" -ForegroundColor Green
        } catch {
            Write-Host "  Errore: $_" -ForegroundColor Red
        }
    }
}

Write-Host ""

# Disabilita avvio automatico
Write-Host "Disabilito avvio automatico..." -ForegroundColor Yellow
foreach ($service in $postgresServices) {
    try {
        Set-Service -Name $service.Name -StartupType Disabled
        Write-Host "  $($service.Name) - avvio automatico disabilitato" -ForegroundColor Green
    } catch {
        Write-Host "  Errore su $($service.Name): $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Operazione completata!" -ForegroundColor Green
Write-Host ""
Write-Host "PostgreSQL locale arrestato e disabilitato." -ForegroundColor Green
Write-Host "I servizi non partiranno piu automaticamente." -ForegroundColor Green
Write-Host ""
Write-Host "Per disinstallare completamente:" -ForegroundColor Cyan
Write-Host "1. Win + X -> App e funzionalita" -ForegroundColor Gray
Write-Host "2. Cerca PostgreSQL" -ForegroundColor Gray
Write-Host "3. Disinstalla" -ForegroundColor Gray
Write-Host ""

# Verifica finale
$running = Get-Service | Where-Object { ($_.Name -like "*postgres*" -or $_.DisplayName -like "*PostgreSQL*") -and $_.Status -eq "Running" }
if ($running.Count -eq 0) {
    Write-Host "Verifica: Nessun servizio PostgreSQL in esecuzione" -ForegroundColor Green
} else {
    Write-Host "Attenzione: Alcuni servizi sono ancora attivi" -ForegroundColor Yellow
}



