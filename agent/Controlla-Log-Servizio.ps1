# Controlla-Log-Servizio.ps1
# Script per vedere gli ultimi errori del servizio

$InstallDir = "C:\ProgramData\NetworkMonitorAgent"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CONTROLLO LOG SERVIZIO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Stato servizio
Write-Host "[1] STATO SERVIZIO" -ForegroundColor Yellow
try {
    $service = Get-Service -Name "NetworkMonitorService" -ErrorAction Stop
    Write-Host "  Status: $($service.Status)" -ForegroundColor $(if ($service.Status -eq 'Running') { 'Green' } else { 'Red' })
} catch {
    Write-Host "  ERRORE: Servizio non trovato!" -ForegroundColor Red
}
Write-Host ""

# 2. Log Bootstrap (primi errori)
Write-Host "[2] LOG BOOTSTRAP (Ultime 20 righe)" -ForegroundColor Yellow
$bootstrapLog = Join-Path $InstallDir "NetworkMonitorService_bootstrap.log"
if (Test-Path $bootstrapLog) {
    try {
        $bootstrapContent = Get-Content $bootstrapLog -Tail 20 -ErrorAction Stop
        Write-Host $bootstrapContent
    } catch {
        Write-Host "  ERRORE: Impossibile leggere bootstrap log: $_" -ForegroundColor Red
    }
} else {
    Write-Host "  File bootstrap log non trovato." -ForegroundColor Yellow
}
Write-Host ""

# 3. Log Principale (ultime 30 righe)
Write-Host "[3] LOG PRINCIPALE (Ultime 30 righe)" -ForegroundColor Yellow
$mainLog = Join-Path $InstallDir "NetworkMonitorService.log"
if (Test-Path $mainLog) {
    try {
        $mainContent = Get-Content $mainLog -Tail 30 -ErrorAction Stop
        Write-Host $mainContent
    } catch {
        Write-Host "  ERRORE: Impossibile leggere log principale: $_" -ForegroundColor Red
    }
} else {
    Write-Host "  File log principale non trovato." -ForegroundColor Yellow
}
Write-Host ""

# 4. Cerca errori specifici
Write-Host "[4] ERRORI TROVATI NEL LOG" -ForegroundColor Yellow
if (Test-Path $mainLog) {
    try {
        $allLogs = Get-Content $mainLog -ErrorAction Stop
        $errors = $allLogs | Select-String -Pattern "ERROR|Exception|ParserError|UnexpectedToken|Trust ARP" -CaseSensitive:$false | Select-Object -Last 10
        if ($errors) {
            Write-Host $errors
        } else {
            Write-Host "  Nessun errore trovato negli ultimi log" -ForegroundColor Green
        }
    } catch {
        Write-Host "  ERRORE: Impossibile cercare errori: $_" -ForegroundColor Red
    }
} else {
    Write-Host "  Log non disponibile per ricerca errori" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "Premi un tasto per continuare..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
