# Diagnostica-TrayIcon.ps1
# Script di diagnostica per capire perché la tray icon non si avvia

param(
    [string]$InstallDir = "C:\ProgramData\NetworkMonitorAgent"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Diagnostica Network Monitor Tray Icon" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verifica directory installazione
Write-Host "1. Verifica directory installazione..." -ForegroundColor Yellow
if (Test-Path $InstallDir) {
    Write-Host "   ✓ Directory trovata: $InstallDir" -ForegroundColor Green
} else {
    Write-Host "   ✗ Directory NON trovata: $InstallDir" -ForegroundColor Red
    Write-Host "   Cerca in altre posizioni..." -ForegroundColor Yellow
    
    $possibleDirs = @(
        "C:\ProgramData\NetworkMonitorAgent",
        "$env:ProgramData\NetworkMonitorAgent",
        "$PSScriptRoot",
        (Get-Location).Path
    )
    
    foreach ($dir in $possibleDirs) {
        if (Test-Path $dir) {
            Write-Host "   Trovata directory alternativa: $dir" -ForegroundColor Gray
            $InstallDir = $dir
            break
        }
    }
}
Write-Host ""

# 2. Verifica file necessari
Write-Host "2. Verifica file necessari..." -ForegroundColor Yellow
$files = @(
    "NetworkMonitorTrayIcon.ps1",
    "config.json",
    ".agent_status.json"
)

$allFilesExist = $true
foreach ($file in $files) {
    $filePath = Join-Path $InstallDir $file
    if (Test-Path $filePath) {
        Write-Host "   ✓ $file trovato" -ForegroundColor Green
    } else {
        Write-Host "   ✗ $file NON trovato in: $filePath" -ForegroundColor Red
        $allFilesExist = $false
    }
}
Write-Host ""

# 3. Verifica config.json
Write-Host "3. Verifica config.json..." -ForegroundColor Yellow
$configPath = Join-Path $InstallDir "config.json"
if (Test-Path $configPath) {
    try {
        $config = Get-Content $configPath -Raw | ConvertFrom-Json
        Write-Host "   ✓ config.json valido" -ForegroundColor Green
        Write-Host "   Server URL: $($config.server_url)" -ForegroundColor Gray
        Write-Host "   Network ranges: $($config.network_ranges -join ', ')" -ForegroundColor Gray
    } catch {
        Write-Host "   ✗ config.json non valido: $_" -ForegroundColor Red
    }
} else {
    Write-Host "   ✗ config.json non trovato" -ForegroundColor Red
}
Write-Host ""

# 4. Verifica processi esistenti
Write-Host "4. Verifica processi esistenti..." -ForegroundColor Yellow
$processes = Get-Process powershell* -ErrorAction SilentlyContinue | Where-Object {
    $_.Path -and (Test-Path $_.Path)
}
if ($processes) {
    Write-Host "   Processi PowerShell trovati: $($processes.Count)" -ForegroundColor Gray
    foreach ($proc in $processes) {
        Write-Host "   - PID: $($proc.Id), StartTime: $($proc.StartTime)" -ForegroundColor Gray
    }
} else {
    Write-Host "   Nessun processo PowerShell trovato" -ForegroundColor Gray
}
Write-Host ""

# 5. Verifica registro avvio automatico
Write-Host "5. Verifica registro avvio automatico..." -ForegroundColor Yellow
$regPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$regName = "NetworkMonitorTrayIcon"
try {
    $regValue = Get-ItemProperty -Path $regPath -Name $regName -ErrorAction SilentlyContinue
    if ($regValue) {
        Write-Host "   ✓ Voce registro trovata" -ForegroundColor Green
        Write-Host "   Comando: $($regValue.$regName)" -ForegroundColor Gray
    } else {
        Write-Host "   ✗ Voce registro NON trovata" -ForegroundColor Red
    }
} catch {
    Write-Host "   ✗ Errore lettura registro: $_" -ForegroundColor Red
}
Write-Host ""

# 6. Test esecuzione script (senza avviarlo realmente)
Write-Host "6. Test sintassi script..." -ForegroundColor Yellow
$trayIconScript = Join-Path $InstallDir "NetworkMonitorTrayIcon.ps1"
if (Test-Path $trayIconScript) {
    try {
        # Test parsing sintassi
        $null = [System.Management.Automation.PSParser]::Tokenize((Get-Content $trayIconScript -Raw), [ref]$null)
        Write-Host "   ✓ Sintassi script valida" -ForegroundColor Green
    } catch {
        Write-Host "   ✗ Errore sintassi: $_" -ForegroundColor Red
    }
} else {
    Write-Host "   ✗ Script non trovato" -ForegroundColor Red
}
Write-Host ""

# 7. Prova esecuzione diretta (con output visibile)
Write-Host "7. Test esecuzione diretta (con output)..." -ForegroundColor Yellow
Write-Host "   Eseguendo script in modalità visibile per vedere eventuali errori..." -ForegroundColor Gray
Write-Host ""

if (Test-Path $trayIconScript) {
    Write-Host "   Comando:" -ForegroundColor Cyan
    Write-Host "   powershell.exe -ExecutionPolicy Bypass -NoProfile -File `"$trayIconScript`" -ConfigPath `"$configPath`"" -ForegroundColor White
    Write-Host ""
    
    $response = Read-Host "   Vuoi eseguire lo script ora per vedere eventuali errori? (S/N)"
    if ($response -eq "S" -or $response -eq "s") {
        Write-Host ""
        Write-Host "   Esecuzione in corso..." -ForegroundColor Yellow
        Write-Host "   (Se ci sono errori, li vedrai qui sotto)" -ForegroundColor Gray
        Write-Host ""
        
        # Esegui senza -WindowStyle Hidden per vedere errori
        & powershell.exe -ExecutionPolicy Bypass -NoProfile -File $trayIconScript -ConfigPath $configPath
        
        Write-Host ""
        Write-Host "   Esecuzione completata." -ForegroundColor Green
        Write-Host "   Controlla se l'icona è apparsa nella system tray." -ForegroundColor Gray
    } else {
        Write-Host "   Test saltato." -ForegroundColor Gray
    }
} else {
    Write-Host "   ✗ Script non trovato, impossibile testare" -ForegroundColor Red
}
Write-Host ""

# 8. Riepilogo e suggerimenti
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Riepilogo" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (-not $allFilesExist) {
    Write-Host "ATTENZIONE: Alcuni file mancanti!" -ForegroundColor Red
    Write-Host "Assicurati di aver estratto tutti i file dal pacchetto ZIP." -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Suggerimenti:" -ForegroundColor Yellow
Write-Host "1. Se lo script ha errori, eseguilo manualmente senza -WindowStyle Hidden" -ForegroundColor White
Write-Host "2. Verifica che config.json sia valido" -ForegroundColor White
Write-Host "3. Controlla i permessi sulla directory $InstallDir" -ForegroundColor White
Write-Host "4. Prova a eseguire PowerShell come Amministratore" -ForegroundColor White
Write-Host ""
Write-Host "Premi un tasto per uscire..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
