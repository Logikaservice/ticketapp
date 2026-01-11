# Script per avviare la tray icon in modo completamente nascosto
# Questo script avvia la tray icon senza aprire finestre visibili

param(
    [string]$ConfigPath = "C:\ProgramData\NetworkMonitorAgent\config.json"
)

# Determina directory script
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $scriptDir) {
    $scriptDir = $PSScriptRoot
}
if (-not $scriptDir) {
    $scriptDir = Split-Path -Parent (Get-Location).Path
}

# Trova script tray icon (usa la stessa directory di questo script)
$trayIconScript = Join-Path $scriptDir "NetworkMonitorTrayIcon.ps1"

if (-not (Test-Path $trayIconScript)) {
    Write-Host "Errore: NetworkMonitorTrayIcon.ps1 non trovato in: $scriptDir" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $ConfigPath)) {
    Write-Host "Errore: config.json non trovato in: $ConfigPath" -ForegroundColor Red
    exit 1
}

# Verifica se già in esecuzione
$existingProcesses = Get-Process powershell -ErrorAction SilentlyContinue | Where-Object {
    try {
        $cmdLine = (Get-WmiObject Win32_Process -Filter "ProcessId = $($_.Id)").CommandLine
        if ($cmdLine) {
            $cmdLine -like "*NetworkMonitorTrayIcon*"
        } else {
            $false
        }
    } catch {
        $false
    }
}

if ($existingProcesses) {
    Write-Host "Tray icon già in esecuzione (PID: $($existingProcesses.Id -join ', '))" -ForegroundColor Yellow
    exit 0
}

# Avvia la tray icon usando Start-Process con WindowStyle Hidden
# e NoNewWindow per evitare che apra una nuova finestra
try {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "powershell.exe"
    $psi.Arguments = "-WindowStyle Hidden -ExecutionPolicy Bypass -NoProfile -File `"$trayIconScript`" -ConfigPath `"$ConfigPath`""
    $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
    $psi.CreateNoWindow = $true
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    
    $process = [System.Diagnostics.Process]::Start($psi)
    
    Start-Sleep -Seconds 2
    
    # Verifica che il processo sia ancora in esecuzione
    if ($process -and -not $process.HasExited) {
        Write-Host "Tray icon avviata con successo (PID: $($process.Id))" -ForegroundColor Green
        Write-Host "L'icona dovrebbe apparire nella system tray vicino all'orologio" -ForegroundColor Cyan
        $process.Dispose()
    } else {
        Write-Host "Errore: Il processo si è chiuso immediatamente" -ForegroundColor Red
        if (Test-Path (Join-Path $scriptDir "NetworkMonitorTrayIcon.log")) {
            Write-Host "Controlla i log in: $(Join-Path $scriptDir "NetworkMonitorTrayIcon.log")" -ForegroundColor Yellow
        }
        exit 1
    }
} catch {
    Write-Host "Errore durante avvio: $_" -ForegroundColor Red
    exit 1
}
