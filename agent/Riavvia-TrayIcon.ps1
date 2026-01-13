# Script per aggiornare e riavviare la tray icon con la nuova interfaccia
# Esegui questo script come AMMINISTRATORE

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Riavvio Tray Icon con Nuova UI" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Ferma la tray icon esistente
Write-Host "1. Arresto tray icon esistente..." -ForegroundColor Yellow
try {
    $trayProcesses = Get-Process powershell -ErrorAction SilentlyContinue | Where-Object {
        try {
            $cmdLine = (Get-WmiObject Win32_Process -Filter "ProcessId = $($_.Id)" -ErrorAction SilentlyContinue).CommandLine
            if ($cmdLine) {
                $cmdLine -like "*NetworkMonitorTrayIcon*"
            } else {
                $false
            }
        } catch {
            $false
        }
    }
    
    if ($trayProcesses) {
        $trayProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
        Write-Host "   OK Tray icon fermata" -ForegroundColor Green
        Start-Sleep -Seconds 1
    } else {
        Write-Host "   Info Nessuna tray icon in esecuzione" -ForegroundColor Gray
    }
} catch {
    Write-Host "   Errore: $_" -ForegroundColor Red
}

# 2. Copia il file aggiornato
Write-Host ""
Write-Host "2. Copia file NetworkMonitorTrayIcon.ps1 aggiornato..." -ForegroundColor Yellow

$sourceFile = Join-Path $PSScriptRoot "NetworkMonitorTrayIcon.ps1"
$destFile = "C:\ProgramData\NetworkMonitorAgent\NetworkMonitorTrayIcon.ps1"

if (-not (Test-Path $sourceFile)) {
    Write-Host "   ERRORE: File sorgente non trovato: $sourceFile" -ForegroundColor Red
    exit 1
}

try {
    Copy-Item -Path $sourceFile -Destination $destFile -Force
    Write-Host "   OK File copiato con successo" -ForegroundColor Green
} catch {
    Write-Host "   ERRORE: Impossibile copiare il file: $_" -ForegroundColor Red
    Write-Host "   Assicurati di eseguire questo script come AMMINISTRATORE" -ForegroundColor Yellow
    exit 1
}

# 3. Riavvia la tray icon
Write-Host ""
Write-Host "3. Avvio tray icon..." -ForegroundColor Yellow

$trayIconScript = "C:\ProgramData\NetworkMonitorAgent\Avvia-TrayIcon.ps1"

if (-not (Test-Path $trayIconScript)) {
    Write-Host "   ERRORE: Avvia-TrayIcon.ps1 non trovato" -ForegroundColor Red
    exit 1
}

try {
    Start-Process powershell.exe -ArgumentList "-WindowStyle Hidden -ExecutionPolicy Bypass -NoProfile -File `"$trayIconScript`"" -WindowStyle Hidden
    Start-Sleep -Seconds 2
    Write-Host "   OK Tray icon avviata" -ForegroundColor Green
} catch {
    Write-Host "   ERRORE: Impossibile avviare tray icon: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Completato!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Per vedere la nuova interfaccia:" -ForegroundColor Cyan
Write-Host "  1. Cerca l'icona nella system tray (vicino all'orologio)" -ForegroundColor White
Write-Host "  2. Click sinistro sull'icona per aprire la finestra stato" -ForegroundColor White
Write-Host "     Oppure click destro -> Stato" -ForegroundColor White
Write-Host ""
Write-Host "Premere INVIO per continuare..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
