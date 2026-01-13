# Script per fermare l'agent e verificare lo stato
# Esegui questo script come AMMINISTRATORE

param(
    [switch]$CheckStatus
)

$serviceName = "NetworkMonitorService"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Fermata Network Monitor Agent" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Ferma il servizio
Write-Host "1. Arresto servizio $serviceName..." -ForegroundColor Yellow
try {
    $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if ($service) {
        if ($service.Status -eq "Running") {
            Stop-Service -Name $serviceName -Force
            Start-Sleep -Seconds 2
            $service.Refresh()
            if ($service.Status -eq "Stopped") {
                Write-Host "   OK Servizio fermato" -ForegroundColor Green
            } else {
                Write-Host "   ATTENZIONE: Servizio potrebbe essere ancora in esecuzione" -ForegroundColor Yellow
            }
        } else {
            Write-Host "   Info Servizio già fermo" -ForegroundColor Gray
        }
    } else {
        Write-Host "   ERRORE: Servizio non trovato" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   ERRORE: $_" -ForegroundColor Red
    exit 1
}

# 2. Ferma anche la tray icon (opzionale)
Write-Host ""
Write-Host "2. Arresto tray icon (opzionale)..." -ForegroundColor Yellow
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
    } else {
        Write-Host "   Info Nessuna tray icon in esecuzione" -ForegroundColor Gray
    }
} catch {
    Write-Host "   Info Errore fermata tray icon (non critico): $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Agent fermato!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANTE:" -ForegroundColor Yellow
Write-Host "  L'agent risulterà OFFLINE nel sistema dopo:" -ForegroundColor White
Write-Host "  - Massimo 10 minuti (quando il backend rileva che" -ForegroundColor White
Write-Host "    l'ultimo heartbeat è più vecchio di 10 minuti)" -ForegroundColor White
Write-Host "  - Oppure immediatamente se controlli il database" -ForegroundColor White
Write-Host ""
Write-Host "Per verificare lo stato:" -ForegroundColor Cyan
Write-Host "  1. Vai sul frontend VPS -> Network Monitoring" -ForegroundColor White
Write-Host "  2. Controlla la sezione 'Agents' - dovrebbe mostrare 'offline'" -ForegroundColor White
Write-Host "  3. Oppure controlla il database: last_heartbeat non verrà più aggiornato" -ForegroundColor White
Write-Host ""
Write-Host "Per riavviare l'agent:" -ForegroundColor Cyan
Write-Host "  Start-Service -Name $serviceName" -ForegroundColor White
Write-Host ""

if ($CheckStatus) {
    Write-Host "Verifica stato servizio..." -ForegroundColor Yellow
    $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if ($service) {
        Write-Host "  Stato: $($service.Status)" -ForegroundColor $(if ($service.Status -eq "Stopped") { "Green" } else { "Yellow" })
    }
}

Write-Host ""
Write-Host "Premere INVIO per continuare..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
