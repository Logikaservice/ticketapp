# Riduci-Ritardo-Riavvio.ps1
# Imposta il ritardo di riavvio NSSM da 60 secondi a 30 secondi.
# Quando il processo PowerShell dell'agent termina, NSSM riavvia il processo dopo questo ritardo.
# Su server dove l'agent si disconnette spesso (processo che termina), 30 secondi riduce il tempo offline.
#
# Eseguire come Amministratore. Richiede NSSM e servizio NetworkMonitorService gia' installati.

$ServiceName = "NetworkMonitorService"
$NssmPath = Join-Path $PSScriptRoot "nssm.exe"
if (-not (Test-Path $NssmPath)) {
    Write-Host "nssm.exe non trovato in $PSScriptRoot" -ForegroundColor Red
    exit 1
}

$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $svc) {
    Write-Host "Servizio $ServiceName non trovato." -ForegroundColor Red
    exit 1
}

# 30000 ms = 30 secondi (default NSSM e' 60000 = 60 secondi)
& $NssmPath set $ServiceName AppRestartDelay 30000
if ($LASTEXITCODE -eq 0) {
    Write-Host "Ritardo riavvio impostato a 30 secondi. Il servizio riavviera' il processo dopo 30 secondi se termina." -ForegroundColor Green
} else {
    Write-Host "Errore nell'impostare AppRestartDelay." -ForegroundColor Red
    exit 1
}
