# Cerca-Log-Disconnessione.ps1
# Esegui sul server Mercurio per trovare le ultime righe PRIMA della disconnessione
# PowerShell come Amministratore

$logFile = "C:\ProgramData\NetworkMonitorAgent\NetworkMonitorService.log"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " ANALISI LOG DISCONNESSIONE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Cerca nel log principale le righe intorno alle 19:30-19:50
Write-Host "=== RIGHE LOG TRA 19:30 E 20:00 (OGGI E IERI) ===" -ForegroundColor Yellow
if (Test-Path $logFile) {
    $fileSize = (Get-Item $logFile).Length
    Write-Host "  Dimensione log: $([Math]::Round($fileSize/1024, 1)) KB" -ForegroundColor Gray
    Write-Host ""
    
    $content = Get-Content $logFile
    Write-Host "  Totale righe nel log: $($content.Count)" -ForegroundColor Gray
    Write-Host ""
    
    # Cerca righe con orario 19:3x, 19:4x, 19:5x, 20:0x
    $relevantLines = $content | Where-Object { 
        $_ -match "19:3[0-9]|19:4[0-9]|19:5[0-9]|20:0[0-9]" 
    }
    
    if ($relevantLines) {
        Write-Host "  Trovate $($relevantLines.Count) righe rilevanti:" -ForegroundColor Green
        Write-Host ""
        foreach ($line in $relevantLines) {
            if ($line -match "ERROR|ERRORE|WARN|fallito") {
                Write-Host "  $line" -ForegroundColor Red
            }
            else {
                Write-Host "  $line" -ForegroundColor White
            }
        }
    }
    else {
        Write-Host "  !! Nessuna riga trovata tra 19:30-20:00 !!" -ForegroundColor Red
        Write-Host "  Il log potrebbe essere stato sovrascritto al riavvio" -ForegroundColor Yellow
    }
}
else {
    Write-Host "  Log non trovato!" -ForegroundColor Red
}
Write-Host ""

# 2. Cerca nei log NSSM (stdout/stderr) 
Write-Host "=== LOG NSSM STDOUT/STDERR ===" -ForegroundColor Yellow
$stdoutLog = "C:\ProgramData\NetworkMonitorAgent\NetworkMonitorService_stdout.log"
$stderrLog = "C:\ProgramData\NetworkMonitorAgent\NetworkMonitorService_stderr.log"

foreach ($logPath in @($stdoutLog, $stderrLog)) {
    if (Test-Path $logPath) {
        $size = (Get-Item $logPath).Length
        $name = Split-Path $logPath -Leaf
        Write-Host "  $name (${size} bytes):" -ForegroundColor Cyan
        
        if ($size -gt 0) {
            # Cerca righe 19:3x/19:4x/19:5x
            $lines = Get-Content $logPath -ErrorAction SilentlyContinue
            $relevant = $lines | Where-Object { $_ -match "19:3|19:4|19:5|20:0|error|exception|terminat" }
            if ($relevant) {
                foreach ($l in $relevant | Select-Object -Last 20) {
                    Write-Host "    $l" -ForegroundColor White
                }
            }
            else {
                # Mostra le ultime 10 righe
                Write-Host "    (ultime 10 righe):" -ForegroundColor Gray
                Get-Content $logPath -Tail 10 | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
            }
        }
        else {
            Write-Host "    (vuoto)" -ForegroundColor Gray
        }
    }
    else {
        Write-Host "  $(Split-Path $logPath -Leaf): NON TROVATO" -ForegroundColor Gray
    }
}
Write-Host ""

# 3. Cerca file di log ruotati (NSSM crea copie con timestamp)
Write-Host "=== FILE LOG RUOTATI (backup) ===" -ForegroundColor Yellow
$logDir = "C:\ProgramData\NetworkMonitorAgent"
$rotatedLogs = Get-ChildItem $logDir -Filter "*.log*" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
if ($rotatedLogs) {
    foreach ($f in $rotatedLogs) {
        Write-Host "  $($f.Name.PadRight(55)) | $([Math]::Round($f.Length/1024, 1)) KB | Modificato: $($f.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor White
    }
}
else {
    Write-Host "  Nessun file log trovato" -ForegroundColor Gray
}
Write-Host ""

# 4. Controlla SYNOLOGY ACTIVE BACKUP
Write-Host "=== SYNOLOGY ACTIVE BACKUP ===" -ForegroundColor Yellow
$synoService = Get-Service -Name "*Synology*" -ErrorAction SilentlyContinue
$synoService2 = Get-Service -Name "*ActiveBackup*" -ErrorAction SilentlyContinue
$allSyno = @()
if ($synoService) { $allSyno += $synoService }
if ($synoService2) { $allSyno += $synoService2 }

if ($allSyno.Count -gt 0) {
    foreach ($s in $allSyno) {
        Write-Host "  Servizio: $($s.Name) - Status: $($s.Status)" -ForegroundColor Cyan
    }
}
else {
    # Cerca in Programmi
    $synoPath = @(
        "C:\Program Files\Synology",
        "C:\Program Files (x86)\Synology",
        "C:\Program Files\Synology Active Backup for Business Agent",
        "C:\Program Files (x86)\Synology Active Backup for Business Agent"
    )
    $found = $false
    foreach ($p in $synoPath) {
        if (Test-Path $p) {
            Write-Host "  Trovato: $p" -ForegroundColor Cyan
            $found = $true
        }
    }
    if (-not $found) {
        Write-Host "  Synology Active Backup non trovato come servizio" -ForegroundColor Gray
    }
}

# Cerca processi Synology attivi
$synoProcs = Get-Process -Name "*synology*", "*ActiveBackup*" -ErrorAction SilentlyContinue
if ($synoProcs) {
    Write-Host "  Processi Synology attivi:" -ForegroundColor Cyan
    foreach ($sp in $synoProcs) {
        Write-Host "    PID $($sp.Id) | $($sp.ProcessName) | CPU: $($sp.CPU)" -ForegroundColor White
    }
}
Write-Host ""

# 5. Controlla AVG - orario scansione pianificata
Write-Host "=== AVG ANTIVIRUS ===" -ForegroundColor Yellow
$avgService = Get-Service -Name "*avg*", "*avast*" -ErrorAction SilentlyContinue
if ($avgService) {
    foreach ($s in $avgService) {
        Write-Host "  Servizio: $($s.Name) - Status: $($s.Status)" -ForegroundColor Cyan
    }
}

# Controlla task AVG
$avgTasks = Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object { $_.TaskName -like "*AVG*" -or $_.TaskName -like "*Avast*" -or $_.TaskPath -like "*AVG*" }
if ($avgTasks) {
    Write-Host "  Task pianificati AVG:" -ForegroundColor Cyan
    foreach ($t in $avgTasks) {
        $trigStr = ($t.Triggers | ForEach-Object { if ($_.StartBoundary) { $_.StartBoundary } else { $_.CimClass.CimClassName -replace 'MSFT_Task', '' -replace 'Trigger', '' } }) -join ', '
        Write-Host "    $($t.TaskName) | Trigger: $trigStr" -ForegroundColor White
    }
}
Write-Host ""

# 6. Controlla IDrive Backup
Write-Host "=== IDRIVE BACKUP ===" -ForegroundColor Yellow
$idriveService = Get-Service -Name "*idrive*" -ErrorAction SilentlyContinue
if ($idriveService) {
    foreach ($s in $idriveService) {
        Write-Host "  Servizio: $($s.Name) - Status: $($s.Status) - StartType: $($s.StartType)" -ForegroundColor Cyan
    }
}
# Cerca config IDrive per orario backup
$idrivePath = "C:\Program Files (x86)\IDriveWindows"
if (Test-Path $idrivePath) {
    Write-Host "  Installato in: $idrivePath" -ForegroundColor White
    # Cerca file di configurazione con orari
    $configFiles = Get-ChildItem $idrivePath -Filter "*.xml" -ErrorAction SilentlyContinue
    $configFiles += Get-ChildItem $idrivePath -Filter "*.ini" -ErrorAction SilentlyContinue  
    $configFiles += Get-ChildItem $idrivePath -Filter "*.conf" -ErrorAction SilentlyContinue  
    if ($configFiles) {
        foreach ($cf in $configFiles) {
            Write-Host "  Config: $($cf.Name)" -ForegroundColor Gray
            # Cerca orari nel file
            $content = Get-Content $cf.FullName -ErrorAction SilentlyContinue
            $timeLines = $content | Where-Object { $_ -match "19:|20:|schedule|time|backup|ora" }
            if ($timeLines) {
                foreach ($tl in $timeLines | Select-Object -First 5) {
                    Write-Host "    $tl" -ForegroundColor Yellow
                }
            }
        }
    }
}
Write-Host ""

# 7. Power management scheda di rete
Write-Host "=== POWER MANAGEMENT SCHEDA DI RETE ===" -ForegroundColor Yellow
try {
    $nics = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' }
    foreach ($nic in $nics) {
        Write-Host "  NIC: $($nic.Name) ($($nic.InterfaceDescription))" -ForegroundColor Cyan
        # Controlla se il risparmio energetico è attivo
        $powerMgmt = Get-NetAdapterPowerManagement -Name $nic.Name -ErrorAction SilentlyContinue
        if ($powerMgmt) {
            Write-Host "    WakeOnMagicPacket: $($powerMgmt.WakeOnMagicPacket)" -ForegroundColor White
            Write-Host "    AllowComputerToTurnOff: $($powerMgmt.AllowComputerToTurnOffDevice)" -ForegroundColor $(if ($powerMgmt.AllowComputerToTurnOffDevice -eq 'Enabled') { 'Red' } else { 'Green' })
        }
    }
}
catch {
    Write-Host "  Errore: $_" -ForegroundColor Red
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " DIAGNOSTICA COMPLETATA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "COPIA TUTTO L'OUTPUT E INVIACELO!" -ForegroundColor Yellow
pause
