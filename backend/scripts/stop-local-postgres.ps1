# Script per fermare PostgreSQL locale su Windows

Write-Host "🛑 Fermo PostgreSQL locale..." -ForegroundColor Yellow
Write-Host ""

# Trova il servizio PostgreSQL
$postgresServices = Get-Service | Where-Object { $_.Name -like "*postgres*" -or $_.DisplayName -like "*PostgreSQL*" }

if ($postgresServices.Count -eq 0) {
    Write-Host "❌ Nessun servizio PostgreSQL trovato" -ForegroundColor Red
    exit 1
}

Write-Host "📋 Servizi PostgreSQL trovati:" -ForegroundColor Cyan
foreach ($service in $postgresServices) {
    Write-Host "   - $($service.Name) ($($service.DisplayName)) - Status: $($service.Status)" -ForegroundColor Gray
}
Write-Host ""

# Ferma tutti i servizi PostgreSQL
foreach ($service in $postgresServices) {
    if ($service.Status -eq "Running") {
        Write-Host "Fermo $($service.Name)..." -ForegroundColor Yellow
        try {
            Stop-Service -Name $service.Name -Force
            Write-Host "   Servizio $($service.Name) fermato" -ForegroundColor Green
        } catch {
            Write-Host "   Errore: $_" -ForegroundColor Red
        }
    } else {
        Write-Host "   $($service.Name) gia fermo" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "Operazione completata" -ForegroundColor Green
Write-Host ""
Write-Host "Per riavviare PostgreSQL locale:" -ForegroundColor Cyan
foreach ($service in $postgresServices) {
    Write-Host "   Start-Service -Name $($service.Name)" -ForegroundColor Gray
}
