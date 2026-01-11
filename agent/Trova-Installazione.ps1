# Trova-Installazione.ps1
# Script per trovare dove sono installati i file dell'agent

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Ricerca installazione Network Monitor Agent" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verifica servizio
Write-Host "1. Verifica servizio Windows..." -ForegroundColor Yellow
try {
    $service = Get-Service -Name "NetworkMonitorService" -ErrorAction SilentlyContinue
    if ($service) {
        Write-Host "   ✓ Servizio trovato: $($service.Name)" -ForegroundColor Green
        Write-Host "   Stato: $($service.Status)" -ForegroundColor Gray
        Write-Host "   DisplayName: $($service.DisplayName)" -ForegroundColor Gray
        
        # Prova a ottenere il percorso esecuzione (se disponibile)
        try {
            $wmi = Get-WmiObject Win32_Service -Filter "Name='NetworkMonitorService'" -ErrorAction SilentlyContinue
            if ($wmi) {
                $servicePath = $wmi.PathName
                Write-Host "   Path: $servicePath" -ForegroundColor Gray
                
                # Estrai directory dal path
                if ($servicePath -match '"(.*?)"') {
                    $scriptPath = $matches[1]
                    $serviceDir = Split-Path (Split-Path $scriptPath -Parent) -Parent
                    Write-Host "   Directory servizio (presunta): $serviceDir" -ForegroundColor Cyan
                }
            }
        } catch {
            Write-Host "   Impossibile ottenere percorso esecuzione" -ForegroundColor Gray
        }
    } else {
        Write-Host "   ✗ Servizio NON trovato" -ForegroundColor Red
        Write-Host "   Il servizio potrebbe non essere installato." -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ✗ Errore verifica servizio: $_" -ForegroundColor Red
}
Write-Host ""

# 2. Cerca file in posizioni comuni
Write-Host "2. Ricerca file in posizioni comuni..." -ForegroundColor Yellow
$searchPaths = @(
    "$env:ProgramData\NetworkMonitorAgent",
    "$env:LOCALAPPDATA\NetworkMonitorAgent",
    "$env:USERPROFILE\Desktop",
    "$env:USERPROFILE\Downloads",
    "$env:USERPROFILE\Documents",
    "C:\NetworkMonitorAgent",
    "C:\Temp",
    (Get-Location).Path
)

$foundFiles = @()
foreach ($path in $searchPaths) {
    if (Test-Path $path) {
        $trayIconPath = Join-Path $path "NetworkMonitorTrayIcon.ps1"
        $servicePath = Join-Path $path "NetworkMonitorService.ps1"
        $configPath = Join-Path $path "config.json"
        
        $fileCount = 0
        if (Test-Path $trayIconPath) { $fileCount++ }
        if (Test-Path $servicePath) { $fileCount++ }
        if (Test-Path $configPath) { $fileCount++ }
        
        if ($fileCount -gt 0) {
            Write-Host "   ✓ Trovati file in: $path" -ForegroundColor Green
            if (Test-Path $trayIconPath) { Write-Host "      - NetworkMonitorTrayIcon.ps1" -ForegroundColor Gray }
            if (Test-Path $servicePath) { Write-Host "      - NetworkMonitorService.ps1" -ForegroundColor Gray }
            if (Test-Path $configPath) { Write-Host "      - config.json" -ForegroundColor Gray }
            $foundFiles += $path
        }
    }
}

if ($foundFiles.Count -eq 0) {
    Write-Host "   ✗ Nessun file trovato nelle posizioni comuni" -ForegroundColor Red
} else {
    Write-Host "   Trovate $($foundFiles.Count) directory con file" -ForegroundColor Green
}
Write-Host ""

# 3. Cerca processi PowerShell in esecuzione
Write-Host "3. Verifica processi PowerShell..." -ForegroundColor Yellow
try {
    $processes = Get-Process powershell* -ErrorAction SilentlyContinue | Where-Object {
        $_.Path -and (Test-Path $_.Path)
    }
    if ($processes) {
        Write-Host "   Processi PowerShell trovati: $($processes.Count)" -ForegroundColor Gray
        foreach ($proc in $processes | Select-Object -First 5) {
            Write-Host "   - PID: $($proc.Id), StartTime: $($proc.StartTime)" -ForegroundColor Gray
        }
    } else {
        Write-Host "   Nessun processo PowerShell trovato" -ForegroundColor Gray
    }
} catch {
    Write-Host "   Errore verifica processi: $_" -ForegroundColor Yellow
}
Write-Host ""

# 4. Verifica registro avvio automatico
Write-Host "4. Verifica registro avvio automatico..." -ForegroundColor Yellow
try {
    $regPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
    $regValue = Get-ItemProperty -Path $regPath -Name "NetworkMonitorTrayIcon" -ErrorAction SilentlyContinue
    if ($regValue) {
        Write-Host "   ✓ Voce registro trovata" -ForegroundColor Green
        $command = $regValue.NetworkMonitorTrayIcon
        Write-Host "   Comando: $command" -ForegroundColor Gray
        
        # Estrai percorso file dal comando
        if ($command -match '"([^"]+NetworkMonitorTrayIcon\.ps1)"') {
            $trayIconPath = $matches[1]
            $trayIconDir = Split-Path $trayIconPath -Parent
            Write-Host "   Directory tray icon: $trayIconDir" -ForegroundColor Cyan
            
            if (Test-Path $trayIconPath) {
                Write-Host "   ✓ File tray icon esiste" -ForegroundColor Green
            } else {
                Write-Host "   ✗ File tray icon NON esiste: $trayIconPath" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "   ✗ Voce registro NON trovata" -ForegroundColor Red
        Write-Host "   La tray icon non è configurata per l'avvio automatico." -ForegroundColor Yellow
    }
} catch {
    Write-Host "   Errore verifica registro: $_" -ForegroundColor Red
}
Write-Host ""

# Riepilogo
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Riepilogo" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($foundFiles.Count -gt 0) {
    Write-Host "Directory con file trovati:" -ForegroundColor Yellow
    foreach ($dir in $foundFiles) {
        Write-Host "  - $dir" -ForegroundColor White
    }
    Write-Host ""
    Write-Host "Suggerimento: Esegui gli script dalla directory con tutti i file." -ForegroundColor Cyan
} else {
    Write-Host "ATTENZIONE: Nessun file trovato!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Possibili cause:" -ForegroundColor Yellow
    Write-Host "1. I file non sono stati estratti dal pacchetto ZIP" -ForegroundColor White
    Write-Host "2. I file sono in una directory non standard" -ForegroundColor White
    Write-Host "3. L'installazione non è stata completata" -ForegroundColor White
    Write-Host ""
    Write-Host "Suggerimenti:" -ForegroundColor Yellow
    Write-Host "1. Estrai il pacchetto ZIP in una directory (es. Desktop o Downloads)" -ForegroundColor White
    Write-Host "2. Apri PowerShell in quella directory" -ForegroundColor White
    Write-Host "3. Esegui .\Installa-Servizio.ps1 da quella directory" -ForegroundColor White
}

Write-Host ""
Write-Host "Premi un tasto per uscire..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
