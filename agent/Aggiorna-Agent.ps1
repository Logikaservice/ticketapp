# Aggiorna-Agent.ps1
# Script semplificato per aggiornare l'agent dopo modifiche
# Copia i file dalla directory del progetto alla directory di installazione
# Richiede privilegi amministratore

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERRORE: Questo script richiede privilegi amministratore!" -ForegroundColor Red
    Write-Host "Esegui PowerShell come Amministratore e riprova." -ForegroundColor Yellow
    pause
    exit 1
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $scriptDir) { $scriptDir = $PSScriptRoot }
$targetDir = "C:\ProgramData\NetworkMonitorAgent"
$serviceName = "NetworkMonitorService"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Aggiornamento Network Monitor Agent" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Directory sorgente: $scriptDir" -ForegroundColor Gray
Write-Host "Directory destinazione: $targetDir" -ForegroundColor Gray
Write-Host ""

# Verifica che la directory di destinazione esista
if (-not (Test-Path $targetDir)) {
    Write-Host "ERRORE: Directory di installazione non trovata: $targetDir" -ForegroundColor Red
    Write-Host "L'agent potrebbe non essere installato correttamente." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Esegui prima Installa-Automatico.ps1 per installare l'agent." -ForegroundColor Yellow
    pause
    exit 1
}

# 1. Ferma servizio
Write-Host "1. Arresto servizio..." -ForegroundColor Yellow
try {
    $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if ($service -and $service.Status -eq "Running") {
        Stop-Service -Name $serviceName -Force -ErrorAction Stop
        Start-Sleep -Seconds 3
        Write-Host "   OK Servizio arrestato" -ForegroundColor Green
    } else {
        Write-Host "   Info Servizio gia fermo o non trovato" -ForegroundColor Gray
    }
} catch {
    Write-Host "   Avviso: $_" -ForegroundColor Yellow
}

# 2. Copia file
Write-Host ""
Write-Host "2. Copia file aggiornati..." -ForegroundColor Yellow
$files = @(
    "NetworkMonitorService.ps1",
    "NetworkMonitorTrayIcon.ps1",
    "Avvia-TrayIcon.ps1"
)

$filesCopied = 0
foreach ($file in $files) {
    $src = Join-Path $scriptDir $file
    $dst = Join-Path $targetDir $file
    
    if (Test-Path $src) {
        try {
            Copy-Item $src $dst -Force -ErrorAction Stop
            Write-Host "   OK $file" -ForegroundColor Green
            $filesCopied++
        } catch {
            Write-Host "   Errore copia $file : $_" -ForegroundColor Red
        }
    } else {
        Write-Host "   Avviso $file non trovato nella directory sorgente" -ForegroundColor Yellow
    }
}

if ($filesCopied -eq 0) {
    Write-Host ""
    Write-Host "ERRORE: Nessun file copiato!" -ForegroundColor Red
    pause
    exit 1
}

Write-Host ""
Write-Host "   OK $filesCopied file copiati con successo" -ForegroundColor Green

# 3. Riavvia servizio
Write-Host ""
Write-Host "3. Avvio servizio..." -ForegroundColor Yellow
try {
    Start-Service -Name $serviceName -ErrorAction Stop
    Start-Sleep -Seconds 2
    
    $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if ($service -and $service.Status -eq "Running") {
        Write-Host "   OK Servizio avviato correttamente" -ForegroundColor Green
    } else {
        Write-Host "   Avviso Servizio avviato ma stato non confermato" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   Errore avvio servizio: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Prova ad avviare manualmente il servizio:" -ForegroundColor Yellow
    Write-Host "   Start-Service -Name $serviceName" -ForegroundColor Gray
}

# 4. Ferma tray icon esistente
Write-Host ""
Write-Host "4. Riavvio tray icon..." -ForegroundColor Yellow
Get-Process powershell -ErrorAction SilentlyContinue | Where-Object {
    try {
        $cmd = (Get-WmiObject Win32_Process -Filter "ProcessId = $($_.Id)").CommandLine
        $cmd -like "*NetworkMonitorTrayIcon*"
    } catch { $false }
} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Write-Host "   OK Tray icon esistente arrestata" -ForegroundColor Green

# 5. Avvia tray icon aggiornata
$trayScript = Join-Path $targetDir "Avvia-TrayIcon.ps1"
if (Test-Path $trayScript) {
    try {
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = "powershell.exe"
        $psi.Arguments = "-WindowStyle Hidden -ExecutionPolicy Bypass -NoProfile -File `"$trayScript`""
        $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
        $psi.CreateNoWindow = $true
        $psi.UseShellExecute = $false
        [System.Diagnostics.Process]::Start($psi) | Out-Null
        Start-Sleep -Seconds 2
        Write-Host "   OK Tray icon avviata" -ForegroundColor Green
    } catch {
        Write-Host "   Avviso Errore avvio tray icon: $_" -ForegroundColor Yellow
    }
} else {
    Write-Host "   Avviso Avvia-TrayIcon.ps1 non trovato" -ForegroundColor Yellow
}

# 6. Aggiorna versione nel config.json se presente
Write-Host ""
Write-Host "5. Aggiornamento versione nel config.json..." -ForegroundColor Yellow
$configFile = Join-Path $targetDir "config.json"
if (Test-Path $configFile) {
    try {
        $configContent = Get-Content $configFile -Raw | ConvertFrom-Json
        
        # Leggi versione dal file NetworkMonitorService.ps1 aggiornato
        $serviceFile = Join-Path $scriptDir "NetworkMonitorService.ps1"
        if (Test-Path $serviceFile) {
            $serviceContent = Get-Content $serviceFile -Raw
            if ($serviceContent -match '\$SCRIPT_VERSION = "([\d\.]+)"') {
                $newVersion = $matches[1]
                if ($configContent.version -ne $newVersion) {
                    $configContent.version = $newVersion
                    $configContent | ConvertTo-Json -Depth 10 | Set-Content -Path $configFile -Encoding UTF8
                    Write-Host "   OK Versione aggiornata nel config.json: $newVersion" -ForegroundColor Green
                } else {
                    Write-Host "   Info Versione gia aggiornata: $newVersion" -ForegroundColor Gray
                }
            }
        }
    } catch {
        Write-Host "   Avviso Impossibile aggiornare versione nel config.json: $_" -ForegroundColor Yellow
    }
} else {
    Write-Host "   Avviso config.json non trovato" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Aggiornamento completato!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "L'agent e stato aggiornato e riavviato." -ForegroundColor Gray
Write-Host "Le modifiche sono ora attive." -ForegroundColor Gray
Write-Host ""
pause
