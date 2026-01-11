# Script per applicare la modifica al pulsante Forza Scansione
# Questo script deve essere eseguito come Amministratore

Write-Host "Applicazione modifica per pulsante Forza Scansione..." -ForegroundColor Cyan
Write-Host ""

$installDir = "C:\ProgramData\NetworkMonitorAgent"
$serviceName = "NetworkMonitorService"

# Verifica se eseguito come amministratore
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERRORE: Questo script deve essere eseguito come Amministratore!" -ForegroundColor Red
    Write-Host "Fai clic destro su PowerShell e seleziona 'Esegui come amministratore'" -ForegroundColor Yellow
    exit 1
}

# Trova questo script e il file sorgente
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$sourceFile = Join-Path $scriptDir "NetworkMonitorService.ps1"
$targetFile = Join-Path $installDir "NetworkMonitorService.ps1"

if (-not (Test-Path $sourceFile)) {
    Write-Host "ERRORE: File sorgente non trovato: $sourceFile" -ForegroundColor Red
    exit 1
}

# Ferma il servizio
Write-Host "Fermando servizio $serviceName..." -ForegroundColor Yellow
try {
    Stop-Service -Name $serviceName -Force -ErrorAction Stop
    Start-Sleep -Seconds 3
    $service = Get-Service -Name $serviceName
    if ($service.Status -eq "Stopped") {
        Write-Host "✅ Servizio fermato" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Servizio ancora in esecuzione: $($service.Status)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️ Errore fermando servizio: $_" -ForegroundColor Yellow
    Write-Host "Procedo comunque..." -ForegroundColor Gray
}

# Copia il file
Write-Host "`nCopiando file modificato..." -ForegroundColor Yellow
try {
    Copy-Item $sourceFile $targetFile -Force -ErrorAction Stop
    Write-Host "✅ File copiato con successo" -ForegroundColor Green
} catch {
    Write-Host "❌ Errore copiando file: $_" -ForegroundColor Red
    exit 1
}

# Riavvia il servizio
Write-Host "`nRiavviando servizio..." -ForegroundColor Yellow
try {
    Start-Service -Name $serviceName -ErrorAction Stop
    Start-Sleep -Seconds 3
    $service = Get-Service -Name $serviceName
    if ($service.Status -eq "Running") {
        Write-Host "✅ Servizio riavviato con successo" -ForegroundColor Green
    } else {
        Write-Host "❌ Errore riavvio servizio. Stato: $($service.Status)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Errore riavviando servizio: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ Modifiche applicate con successo!" -ForegroundColor Green
Write-Host "Ora il pulsante 'Forza Scansione' nella tray icon dovrebbe funzionare." -ForegroundColor Cyan
Write-Host "Prova a premere il pulsante e controlla i log per verificare." -ForegroundColor Cyan
