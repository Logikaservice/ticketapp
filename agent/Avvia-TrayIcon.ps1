# Avvia-TrayIcon.ps1
# Script per avviare manualmente la tray icon
# Utile per test o se l'avvio automatico non funziona

param(
    [string]$InstallDir = "C:\ProgramData\NetworkMonitorAgent"
)

$TrayIconScript = Join-Path $InstallDir "NetworkMonitorTrayIcon.ps1"
$ConfigPath = Join-Path $InstallDir "config.json"

if (-not (Test-Path $TrayIconScript)) {
    Write-Host "ERRORE: NetworkMonitorTrayIcon.ps1 non trovato in: $InstallDir" -ForegroundColor Red
    Write-Host "Assicurati che l'installazione sia completata." -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path $ConfigPath)) {
    Write-Host "ERRORE: config.json non trovato in: $InstallDir" -ForegroundColor Red
    Write-Host "Assicurati che l'installazione sia completata." -ForegroundColor Yellow
    exit 1
}

Write-Host "Avvio NetworkMonitorTrayIcon.ps1..." -ForegroundColor Green
Write-Host "Config: $ConfigPath" -ForegroundColor Gray
Write-Host "Script: $TrayIconScript" -ForegroundColor Gray
Write-Host ""

# Verifica se la tray icon è già in esecuzione
$existingProcesses = Get-Process powershell* -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*NetworkMonitorTrayIcon*" -or
    $_.Path -and (Get-Content $_.Path -ErrorAction SilentlyContinue | Select-String "NetworkMonitorTrayIcon")
}
if ($existingProcesses) {
    Write-Host "ATTENZIONE: Tray icon sembra già in esecuzione!" -ForegroundColor Yellow
    Write-Host "Processi trovati:" -ForegroundColor Yellow
    $existingProcesses | ForEach-Object {
        Write-Host "  PID: $($_.Id) - $($_.ProcessName)" -ForegroundColor Gray
    }
    Write-Host ""
    $response = Read-Host "Vuoi chiudere i processi esistenti e riavviare? (S/N)"
    if ($response -eq "S" -or $response -eq "s") {
        $existingProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Write-Host "Processi chiusi." -ForegroundColor Green
    } else {
        Write-Host "Avvio annullato." -ForegroundColor Yellow
        exit 0
    }
}

# Avvia la tray icon in background
try {
    Start-Process powershell.exe -ArgumentList "-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File `"$TrayIconScript`" -ConfigPath `"$ConfigPath`"" -ErrorAction Stop
    Start-Sleep -Seconds 2
    
    # Verifica se è partita
    $newProcesses = Get-Process powershell* -ErrorAction SilentlyContinue | Where-Object {
        $_.StartTime -gt (Get-Date).AddSeconds(-5)
    }
    
    if ($newProcesses) {
        Write-Host "Tray icon avviata!" -ForegroundColor Green
        Write-Host "Controlla l'icona vicino all'orologio nella system tray." -ForegroundColor Gray
    } else {
        Write-Host "ATTENZIONE: Tray icon potrebbe non essere partita correttamente." -ForegroundColor Yellow
        Write-Host "Controlla eventuali errori o prova a eseguire manualmente:" -ForegroundColor Yellow
        Write-Host "  powershell.exe -ExecutionPolicy Bypass -NoProfile -File `"$TrayIconScript`" -ConfigPath `"$ConfigPath`"" -ForegroundColor White
    }
} catch {
    Write-Host "ERRORE avvio tray icon: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Prova a eseguire manualmente:" -ForegroundColor Yellow
    Write-Host "  powershell.exe -ExecutionPolicy Bypass -NoProfile -File `"$TrayIconScript`" -ConfigPath `"$ConfigPath`"" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "Per verificare se e' in esecuzione:" -ForegroundColor Yellow
Write-Host "  Get-Process powershell* | Where-Object {`$_.StartTime -gt (Get-Date).AddMinutes(-1)}" -ForegroundColor White
Write-Host ""
Write-Host "Per chiudere la tray icon:" -ForegroundColor Yellow
Write-Host "  Tasto destro sull'icona -> Esci" -ForegroundColor White
Write-Host "  oppure" -ForegroundColor Gray
Write-Host "  Get-Process powershell* | Where-Object {`$_.StartTime -gt (Get-Date).AddMinutes(-1)} | Stop-Process" -ForegroundColor White
