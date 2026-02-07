# Watchdog-Servizio.ps1
# Controlla se il servizio NetworkMonitorService e' in esecuzione; se e' fermo, lo avvia.
# Da usare con un'attivita pianificata ogni 5 minuti (es. "Esegui anche senza utente connesso", privilegi elevati).
# Cosi', se il processo dell'agent termina e NSSM non riavvia in tempo (o il servizio va in Stopped),
# il watchdog riavvia il servizio e l'agent torna online senza intervento manuale.
#
# Esempio attivita pianificata:
#   Programma: powershell.exe
#   Argomenti: -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File "C:\ProgramData\NetworkMonitorAgent\Watchdog-Servizio.ps1"
#   Trigger: ogni 5 minuti
#   Esegui con privilegi piu' alti

$ServiceName = "NetworkMonitorService"
$LogDir = "C:\ProgramData\NetworkMonitorAgent"
$LogFile = Join-Path $LogDir "Watchdog-Servizio.log"

function Write-WatchdogLog {
    param([string]$Message)
    try {
        if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
        $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        "[$ts] $Message" | Out-File -FilePath $LogFile -Append -Encoding UTF8
    } catch { }
}

try {
    $svc = Get-Service -Name $ServiceName -ErrorAction Stop
    if ($svc.Status -eq "Running") {
        # Nessuna azione
        exit 0
    }
    # Servizio fermo (Stopped) o in altro stato: avvialo
    Start-Service -Name $ServiceName -ErrorAction Stop
    Start-Sleep -Seconds 2
    $svc.Refresh()
    if ($svc.Status -eq "Running") {
        Write-WatchdogLog "Servizio $ServiceName era fermo; avviato con successo."
        exit 0
    }
    Write-WatchdogLog "Servizio $ServiceName avviato ma stato attuale: $($svc.Status)"
    exit 1
} catch {
    Write-WatchdogLog "Errore: $_"
    exit 1
}
