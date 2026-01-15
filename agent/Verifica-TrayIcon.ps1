# Verifica-TrayIcon.ps1
# Verifica se la tray icon è in esecuzione e perché non compare

$InstallDir = "C:\ProgramData\NetworkMonitorAgent"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "VERIFICA TRAY ICON" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verifica file necessari
Write-Host "[1] FILE NECESSARI" -ForegroundColor Yellow
$vbsPath = Join-Path $InstallDir "Start-TrayIcon-Hidden.vbs"
$trayIconPath = Join-Path $InstallDir "NetworkMonitorTrayIcon.ps1"
$configPath = Join-Path $InstallDir "config.json"

if (Test-Path $vbsPath) {
    Write-Host "  ✅ Start-TrayIcon-Hidden.vbs trovato" -ForegroundColor Green
} else {
    Write-Host "  ❌ Start-TrayIcon-Hidden.vbs NON trovato!" -ForegroundColor Red
}

if (Test-Path $trayIconPath) {
    Write-Host "  ✅ NetworkMonitorTrayIcon.ps1 trovato" -ForegroundColor Green
} else {
    Write-Host "  ❌ NetworkMonitorTrayIcon.ps1 NON trovato!" -ForegroundColor Red
}

if (Test-Path $configPath) {
    Write-Host "  ✅ config.json trovato" -ForegroundColor Green
} else {
    Write-Host "  ❌ config.json NON trovato!" -ForegroundColor Red
}
Write-Host ""

# 2. Verifica processo
Write-Host "[2] PROCESSI IN ESECUZIONE" -ForegroundColor Yellow
$wscriptProcesses = Get-Process -Name "wscript" -ErrorAction SilentlyContinue
$powershellProcesses = Get-Process -Name "powershell" -ErrorAction SilentlyContinue | Where-Object {
    $_.Path -like "*NetworkMonitorAgent*" -or
    (Get-WmiObject Win32_Process -Filter "ProcessId = $($_.Id)").CommandLine -like "*NetworkMonitorTrayIcon*"
}

if ($wscriptProcesses) {
    Write-Host "  ✅ wscript.exe trovato: $($wscriptProcesses.Count) processo(i)" -ForegroundColor Green
    foreach ($proc in $wscriptProcesses) {
        Write-Host "     PID: $($proc.Id) - Path: $($proc.Path)" -ForegroundColor Gray
    }
} else {
    Write-Host "  ❌ wscript.exe NON trovato in esecuzione" -ForegroundColor Red
}

if ($powershellProcesses) {
    Write-Host "  ✅ PowerShell (tray icon) trovato: $($powershellProcesses.Count) processo(i)" -ForegroundColor Green
    foreach ($proc in $powershellProcesses) {
        Write-Host "     PID: $($proc.Id) - Path: $($proc.Path)" -ForegroundColor Gray
        try {
            $cmdLine = (Get-WmiObject Win32_Process -Filter "ProcessId = $($proc.Id)").CommandLine
            Write-Host "     Command: $cmdLine" -ForegroundColor Gray
        } catch { }
    }
} else {
    Write-Host "  ❌ PowerShell (tray icon) NON trovato in esecuzione" -ForegroundColor Red
}
Write-Host ""

# 3. Verifica registro
Write-Host "[3] AVVIO AUTOMATICO (REGISTRO)" -ForegroundColor Yellow
$regPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$regName = "NetworkMonitorTrayIcon"
try {
    $regValue = Get-ItemProperty -Path $regPath -Name $regName -ErrorAction Stop | Select-Object -ExpandProperty $regName
    if ($regValue) {
        Write-Host "  ✅ Voce registro trovata:" -ForegroundColor Green
        Write-Host "     $regValue" -ForegroundColor Gray
    } else {
        Write-Host "  ❌ Voce registro non trovata o vuota" -ForegroundColor Red
    }
} catch {
    Write-Host "  ❌ Voce registro non trovata nel registro" -ForegroundColor Red
    Write-Host "     La tray icon NON si avviera' automaticamente all'accesso" -ForegroundColor Yellow
}
Write-Host ""

# 4. Test avvio manuale
Write-Host "[4] TEST AVVIO MANUALE" -ForegroundColor Yellow
Write-Host "  Tentativo avvio tray icon..."
try {
    if (Test-Path $vbsPath) {
        Start-Process wscript.exe -ArgumentList "`"$vbsPath`"" -WindowStyle Hidden -ErrorAction Stop
        Start-Sleep -Seconds 3
        
        $newWscript = Get-Process -Name "wscript" -ErrorAction SilentlyContinue | Where-Object {
            $_.StartTime -gt (Get-Date).AddSeconds(-5)
        }
        
        if ($newWscript) {
            Write-Host "  ✅ Tray icon avviata con successo! (PID: $($newWscript.Id))" -ForegroundColor Green
            Write-Host "     L'icona dovrebbe apparire nella system tray vicino all'orologio" -ForegroundColor Cyan
            Write-Host "     Se non la vedi, controlla l'area nascosta della system tray (freccia ^^)" -ForegroundColor Yellow
        } else {
            Write-Host "  ⚠️  Processo avviato ma non trovato dopo 3 secondi" -ForegroundColor Yellow
            Write-Host "     Potrebbe essersi chiuso immediatamente per un errore" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ❌ File VBS non trovato, impossibile testare" -ForegroundColor Red
    }
} catch {
    Write-Host "  ❌ ERRORE durante avvio: $_" -ForegroundColor Red
}
Write-Host ""

# 5. Verifica log
Write-Host "[5] LOG TRAY ICON" -ForegroundColor Yellow
$logPath = Join-Path $InstallDir "NetworkMonitorTrayIcon.log"
if (Test-Path $logPath) {
    Write-Host "  Log trovato (ultime 10 righe):" -ForegroundColor Gray
    Get-Content $logPath -Tail 10 | ForEach-Object {
        Write-Host "     $_" -ForegroundColor Gray
    }
} else {
    Write-Host "  Nessun log trovato (normale se la tray icon non e' mai stata avviata)" -ForegroundColor Gray
}
Write-Host ""

# 6. Suggerimenti
Write-Host "[6] SUGGERIMENTI" -ForegroundColor Yellow
Write-Host "  1. Se l'icona non compare, controlla l'area nascosta della system tray:" -ForegroundColor White
Write-Host "     - Clicca sulla freccia ^^ vicino all'orologio" -ForegroundColor Gray
Write-Host "     - Cerca l'icona 'Logika Service Agent Monitor'" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Per configurare avvio automatico manualmente:" -ForegroundColor White
Write-Host "     reg add ""HKCU\Software\Microsoft\Windows\CurrentVersion\Run"" /v ""NetworkMonitorTrayIcon"" /t REG_SZ /d ""wscript.exe \""$vbsPath\"""" /f" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Per avviare manualmente:" -ForegroundColor White
Write-Host "     wscript.exe `"$vbsPath`"" -ForegroundColor Gray
Write-Host "     oppure: .\Avvia-TrayIcon.bat" -ForegroundColor Gray
Write-Host ""

pause
