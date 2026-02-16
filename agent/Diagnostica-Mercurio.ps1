# Diagnostica-Mercurio.ps1
# Esegui questo script SUL SERVER di Conad Mercurio per capire perché l'agent si ferma alle ~19:45
# Esecuzione: PowerShell come Amministratore -> .\Diagnostica-Mercurio.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " DIAGNOSTICA AGENT MERCURIO" -ForegroundColor Cyan
Write-Host " $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$installDir = "C:\ProgramData\NetworkMonitorAgent"

# 1. STATO SERVIZIO NSSM
Write-Host "=== 1. STATO SERVIZIO ===" -ForegroundColor Yellow
try {
    $svc = Get-Service -Name "NetworkMonitorService" -ErrorAction SilentlyContinue
    if ($svc) {
        Write-Host "  Servizio: $($svc.Name)" -ForegroundColor White
        Write-Host "  Status: $($svc.Status)" -ForegroundColor $(if ($svc.Status -eq 'Running') { 'Green' } else { 'Red' })
        Write-Host "  StartType: $($svc.StartType)" -ForegroundColor White
    }
    else {
        Write-Host "  !! Servizio NetworkMonitorService NON trovato !!" -ForegroundColor Red
    }
}
catch {
    Write-Host "  Errore: $_" -ForegroundColor Red
}
Write-Host ""

# 2. PROCESSI POWERSHELL ATTIVI (agent)
Write-Host "=== 2. PROCESSI AGENT ATTIVI ===" -ForegroundColor Yellow
try {
    $procs = Get-WmiObject Win32_Process | Where-Object { 
        $_.CommandLine -like "*NetworkMonitorService*" -or 
        $_.CommandLine -like "*NetworkMonitorTrayIcon*" -or
        $_.CommandLine -like "*CommAgentService*"
    } | Select-Object ProcessId, Name, @{N = 'CmdLine'; E = { $_.CommandLine.Substring(0, [Math]::Min(120, $_.CommandLine.Length)) } }
    
    if ($procs) {
        foreach ($p in $procs) {
            Write-Host "  PID $($p.ProcessId) | $($p.Name) | $($p.CmdLine)" -ForegroundColor White
        }
    }
    else {
        Write-Host "  !! Nessun processo agent trovato !!" -ForegroundColor Red
    }
}
catch {
    Write-Host "  Errore: $_" -ForegroundColor Red
}
Write-Host ""

# 3. LOG AGENT - ULTIME 50 RIGHE
Write-Host "=== 3. ULTIME 50 RIGHE LOG AGENT ===" -ForegroundColor Yellow
$logFile = Join-Path $installDir "NetworkMonitorService.log"
if (Test-Path $logFile) {
    $lines = Get-Content $logFile -Tail 50
    foreach ($line in $lines) {
        if ($line -match "ERROR|ERRORE|WARN|fallito|impossibile") {
            Write-Host "  $line" -ForegroundColor Red
        }
        elseif ($line -match "Heartbeat|heartbeat") {
            Write-Host "  $line" -ForegroundColor Cyan
        }
        else {
            Write-Host "  $line" -ForegroundColor Gray
        }
    }
}
else {
    Write-Host "  Log non trovato: $logFile" -ForegroundColor Red
}
Write-Host ""

# 4. EVENTI WINDOWS - Servizio fermato/riavviato (ultimi 3 giorni)
Write-Host "=== 4. EVENTI WINDOWS - ARRESTO SERVIZIO (ultimi 3 giorni) ===" -ForegroundColor Yellow
try {
    $events = Get-WinEvent -FilterHashtable @{
        LogName      = 'System'
        ProviderName = 'Service Control Manager'
        StartTime    = (Get-Date).AddDays(-3)
    } -ErrorAction SilentlyContinue | Where-Object {
        $_.Message -like "*NetworkMonitor*" -or 
        $_.Message -like "*nssm*" -or
        $_.Message -like "*powershell*"
    } | Select-Object -First 30

    if ($events) {
        foreach ($ev in $events) {
            $time = $ev.TimeCreated.ToString("yyyy-MM-dd HH:mm:ss")
            $msg = $ev.Message.Substring(0, [Math]::Min(150, $ev.Message.Length))
            Write-Host "  [$time] $msg" -ForegroundColor White
        }
    }
    else {
        Write-Host "  Nessun evento trovato relativo al servizio" -ForegroundColor Gray
    }
}
catch {
    Write-Host "  Errore lettura eventi: $_" -ForegroundColor Red
}
Write-Host ""

# 5. SCHEDULED TASKS - Cerca task che girano alle ~19:45
Write-Host "=== 5. TASK PIANIFICATI VICINO ALLE 19:45 ===" -ForegroundColor Yellow
try {
    $tasks = Get-ScheduledTask | Where-Object { $_.State -ne 'Disabled' } | ForEach-Object {
        $task = $_
        $triggers = $task.Triggers | ForEach-Object {
            $trigStr = ""
            if ($_.StartBoundary) { $trigStr = $_.StartBoundary }
            elseif ($_.CimClass.CimClassName -eq 'MSFT_TaskDailyTrigger') { $trigStr = "Daily" }
            $trigStr
        }
        [PSCustomObject]@{
            Nome     = $task.TaskName
            Path     = $task.TaskPath
            Triggers = ($triggers -join ', ')
            Action   = ($task.Actions | ForEach-Object { $_.Execute }) -join ', '
        }
    } | Where-Object {
        # Filtra task che hanno trigger con orario 19:xx o 20:xx
        $_.Triggers -match "19:|20:" -or
        $_.Nome -match "restart|reboot|shutdown|stop|backup|update|aggiorna" -or
        $_.Action -match "shutdown|restart|stop|reboot|powershell|cmd"
    }

    if ($tasks) {
        foreach ($t in $tasks) {
            Write-Host "  Nome: $($t.Nome)" -ForegroundColor White
            Write-Host "  Path: $($t.Path)" -ForegroundColor Gray
            Write-Host "  Trigger: $($t.Triggers)" -ForegroundColor Cyan
            Write-Host "  Azione: $($t.Action)" -ForegroundColor Yellow
            Write-Host "  ---" -ForegroundColor DarkGray
        }
    }
    else {
        Write-Host "  Nessun task sospetto trovato vicino alle 19:45" -ForegroundColor Gray
    }
}
catch {
    Write-Host "  Errore lettura task: $_" -ForegroundColor Red
}
Write-Host ""

# 6. TUTTI I TASK PIANIFICATI (lista completa per analisi manuale)
Write-Host "=== 6. TUTTI I TASK PIANIFICATI ATTIVI (con orario) ===" -ForegroundColor Yellow
try {
    $allTasks = Get-ScheduledTask | Where-Object { $_.State -ne 'Disabled' -and $_.TaskPath -notlike '\Microsoft\*' } | ForEach-Object {
        $task = $_
        $trigInfo = $task.Triggers | ForEach-Object {
            if ($_.StartBoundary) { $_.StartBoundary }
            elseif ($_.CimClass) { $_.CimClass.CimClassName -replace 'MSFT_Task', '' -replace 'Trigger', '' }
        }
        [PSCustomObject]@{
            Nome    = $task.TaskName
            Path    = $task.TaskPath
            Trigger = ($trigInfo -join ', ')
        }
    }

    if ($allTasks) {
        foreach ($t in $allTasks) {
            Write-Host "  $($t.Nome.PadRight(40)) | $($t.Trigger)" -ForegroundColor White
        }
    }
    else {
        Write-Host "  Nessun task pianificato personalizzato trovato" -ForegroundColor Gray
    }
}
catch {
    Write-Host "  Errore: $_" -ForegroundColor Red
}
Write-Host ""

# 7. CONFIGURAZIONE NSSM (AppExit, AppRestartDelay)
Write-Host "=== 7. CONFIGURAZIONE NSSM ===" -ForegroundColor Yellow
$nssmPath = Join-Path $installDir "nssm.exe"
if (Test-Path $nssmPath) {
    $params = @("Application", "AppParameters", "AppDirectory", "AppExit", "AppRestartDelay", "AppStopMethodSkip", "AppRotateFiles", "AppRotateSeconds")
    foreach ($p in $params) {
        try {
            $val = & $nssmPath get NetworkMonitorService $p 2>&1
            Write-Host "  $($p.PadRight(25)): $val" -ForegroundColor White
        }
        catch {
            Write-Host "  $($p.PadRight(25)): (errore)" -ForegroundColor Red
        }
    }
}
else {
    Write-Host "  nssm.exe non trovato in $installDir" -ForegroundColor Red
}
Write-Host ""

# 8. POWER PLAN / RISPARMIO ENERGIA
Write-Host "=== 8. PIANO ENERGETICO ===" -ForegroundColor Yellow
try {
    $powerPlan = powercfg /getactivescheme 2>&1
    Write-Host "  Piano attivo: $powerPlan" -ForegroundColor White
    
    # Controlla impostazioni sospensione
    $sleepAC = powercfg /query SCHEME_CURRENT SUB_SLEEP STANDBYIDLE 2>&1
    $sleepLines = ($sleepAC | Select-String "Current AC|Current DC|Impostazione corrente|Current.*Power")
    if ($sleepLines) {
        foreach ($sl in $sleepLines) {
            Write-Host "  $($sl.Line.Trim())" -ForegroundColor White
        }
    }
}
catch {
    Write-Host "  Errore: $_" -ForegroundColor Red
}
Write-Host ""

# 9. UPTIME SISTEMA
Write-Host "=== 9. UPTIME SISTEMA ===" -ForegroundColor Yellow
try {
    $os = Get-WmiObject Win32_OperatingSystem
    $boot = $os.ConvertToDateTime($os.LastBootUpTime)
    $uptime = (Get-Date) - $boot
    Write-Host "  Ultimo avvio: $($boot.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor White
    Write-Host "  Uptime: $($uptime.Days) giorni, $($uptime.Hours) ore, $($uptime.Minutes) minuti" -ForegroundColor White
}
catch {
    Write-Host "  Errore: $_" -ForegroundColor Red
}
Write-Host ""

# 10. EVENTI SHUTDOWN/REBOOT RECENTI
Write-Host "=== 10. EVENTI SHUTDOWN/REBOOT (ultimi 7 giorni) ===" -ForegroundColor Yellow
try {
    $shutdownEvents = Get-WinEvent -FilterHashtable @{
        LogName   = 'System'
        ID        = @(1074, 6006, 6008, 6009, 41)
        StartTime = (Get-Date).AddDays(-7)
    } -ErrorAction SilentlyContinue | Select-Object -First 20
    
    if ($shutdownEvents) {
        foreach ($ev in $shutdownEvents) {
            $time = $ev.TimeCreated.ToString("yyyy-MM-dd HH:mm:ss")
            $msg = $ev.Message
            if ($msg.Length -gt 120) { $msg = $msg.Substring(0, 120) + "..." }
            Write-Host "  [$time] ID=$($ev.Id) $msg" -ForegroundColor White
        }
    }
    else {
        Write-Host "  Nessun evento shutdown/reboot recente" -ForegroundColor Green
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
Write-Host ""
pause
