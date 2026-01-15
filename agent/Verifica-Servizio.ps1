# Verifica-Servizio.ps1
# Script rapido per verificare perché il servizio non si avvia

$ServiceName = "NetworkMonitorService"
$InstallDir = "C:\ProgramData\NetworkMonitorAgent"
$NssmPath = Join-Path $InstallDir "nssm.exe"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Verifica NetworkMonitorService" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Stato servizio
Write-Host "1. STATO SERVIZIO" -ForegroundColor Yellow
try {
    $service = Get-Service -Name $ServiceName -ErrorAction Stop
    Write-Host "   Status: $($service.Status)" -ForegroundColor $(if ($service.Status -eq 'Running') { 'Green' } else { 'Red' })
    Write-Host "   StartType: $($service.StartType)" -ForegroundColor White
} catch {
    Write-Host "   ERRORE: Servizio non trovato!" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 2. Configurazione NSSM
Write-Host "2. CONFIGURAZIONE NSSM" -ForegroundColor Yellow
$appExe = & $NssmPath get $ServiceName Application 2>&1
$appParams = & $NssmPath get $ServiceName AppParameters 2>&1
$appDir = & $NssmPath get $ServiceName AppDirectory 2>&1

Write-Host "   Application: $appExe" -ForegroundColor White
Write-Host "   AppDirectory: $appDir" -ForegroundColor White
Write-Host "   AppParameters: $appParams" -ForegroundColor White
Write-Host ""

# Verifica che Application sia powershell.exe
if ($appExe -match '\.ps1$') {
    Write-Host "   ERRORE: Application punta a .ps1 invece che a powershell.exe!" -ForegroundColor Red
} elseif ($appExe -match '^-ExecutionPolicy|^-NoProfile|^-WindowStyle|^-File') {
    Write-Host "   ERRORE CRITICO: Application contiene parametri invece di powershell.exe!" -ForegroundColor Red
    Write-Host "   Valore: $appExe" -ForegroundColor Red
    Write-Host "   Esegui Ripara-Servizio.ps1 per correggere!" -ForegroundColor Yellow
} elseif ($appExe -notmatch 'powershell\.exe') {
    Write-Host "   ERRORE: Application non e powershell.exe!" -ForegroundColor Red
    Write-Host "   Valore: $appExe" -ForegroundColor Red
} else {
    Write-Host "   OK: Application e powershell.exe" -ForegroundColor Green
}

# Verifica che AppDirectory esista
if (Test-Path $appDir) {
    Write-Host "   OK: AppDirectory esiste" -ForegroundColor Green
} else {
    Write-Host "   ERRORE: AppDirectory non esiste: $appDir" -ForegroundColor Red
}
Write-Host ""

# 3. Verifica file necessari
Write-Host "3. FILE NECESSARI" -ForegroundColor Yellow
$scriptPath = Join-Path $InstallDir "NetworkMonitorService.ps1"
$configPath = Join-Path $InstallDir "config.json"

if (Test-Path $scriptPath) {
    Write-Host "   OK: NetworkMonitorService.ps1 trovato" -ForegroundColor Green
} else {
    Write-Host "   ERRORE: NetworkMonitorService.ps1 NON trovato!" -ForegroundColor Red
}

if (Test-Path $configPath) {
    Write-Host "   OK: config.json trovato" -ForegroundColor Green
} else {
    Write-Host "   ERRORE: config.json NON trovato!" -ForegroundColor Red
}
Write-Host ""

# 4. Prova a eseguire il comando NSSM manualmente
Write-Host "4. TEST ESECUZIONE COMANDO NSSM" -ForegroundColor Yellow
Write-Host "   Comando che NSSM eseguirebbe:" -ForegroundColor Gray
Write-Host "   $appExe $appParams" -ForegroundColor White
Write-Host ""

# 5. Controlla Event Viewer per errori
Write-Host "5. EVENT VIEWER (ultimi errori servizio)" -ForegroundColor Yellow
try {
    $events = Get-EventLog -LogName System -Source "Service Control Manager" -Newest 10 -ErrorAction SilentlyContinue | Where-Object { $_.Message -match $ServiceName }
    if ($events) {
        foreach ($event in $events) {
            Write-Host "   [$($event.TimeGenerated)] $($event.EntryType): $($event.Message.Substring(0, [Math]::Min(100, $event.Message.Length)))..." -ForegroundColor $(if ($event.EntryType -eq 'Error') { 'Red' } else { 'Yellow' })
        }
    } else {
        Write-Host "   Nessun evento recente trovato" -ForegroundColor Gray
    }
} catch {
    Write-Host "   Impossibile leggere Event Viewer: $_" -ForegroundColor Yellow
}
Write-Host ""

# 6. Suggerimenti
Write-Host "6. SUGGERIMENTI" -ForegroundColor Yellow
if ($service.Status -ne "Running") {
    Write-Host "   Prova a:" -ForegroundColor White
    Write-Host "   1. Verifica configurazione NSSM:" -ForegroundColor Gray
    Write-Host "      .\nssm.exe get $ServiceName Application" -ForegroundColor White
    Write-Host "      .\nssm.exe get $ServiceName AppParameters" -ForegroundColor White
    Write-Host ""
    Write-Host "   2. Prova a eseguire il comando manualmente:" -ForegroundColor Gray
    Write-Host "      cd $InstallDir" -ForegroundColor White
    Write-Host "      $appExe $appParams" -ForegroundColor White
    Write-Host ""
    Write-Host "   3. Se il comando manuale funziona, riavvia il servizio:" -ForegroundColor Gray
    Write-Host "      Restart-Service -Name $ServiceName" -ForegroundColor White
    Write-Host ""
    Write-Host "   4. Se Application punta a .ps1, esegui Ripara-Servizio.ps1" -ForegroundColor Gray
}

pause
