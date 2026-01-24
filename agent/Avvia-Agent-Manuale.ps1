# Avvia-Agent-Manuale.ps1
# Avvia l'agent Network Monitor in primo piano (senza servizio Windows).
# Utile quando il servizio non parte e non si puo' riavviare il PC.
# Eseguire come Amministratore. Tenere la finestra aperta: se la chiudi, l'agent si ferma.
#
# Uso: tasto destro su PowerShell -> "Esegui come amministratore", poi:
#   & "C:\ProgramData\NetworkMonitorAgent\Avvia-Agent-Manuale.ps1"
# Oppure se lo script e' nella cartella agent: cd there e .\Avvia-Agent-Manuale.ps1

$ErrorActionPreference = 'Stop'

# Cartella di installazione: dove si trova questo script, o la standard
$installDir = $PSScriptRoot
if (-not $installDir -or -not (Test-Path (Join-Path $installDir "NetworkMonitorService.ps1"))) {
    $installDir = "C:\ProgramData\NetworkMonitorAgent"
}

$scriptPath = Join-Path $installDir "NetworkMonitorService.ps1"
$configPath = Join-Path $installDir "config.json"

if (-not (Test-Path $scriptPath)) {
    Write-Host "ERRORE: NetworkMonitorService.ps1 non trovato in: $installDir" -ForegroundColor Red
    Write-Host "Verifica il percorso. Se l'agent e' installato altrove, copia questo script in quella cartella e riesegui." -ForegroundColor Yellow
    pause
    exit 1
}
if (-not (Test-Path $configPath)) {
    Write-Host "ERRORE: config.json non trovato in: $installDir" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "Avvio agent in primo piano (cartella: $installDir)..." -ForegroundColor Cyan
Write-Host "NON CHIUDERE QUESTA FINESTRA: l'agent e' online finche' resta aperta." -ForegroundColor Yellow
Write-Host "Per fermare: premi Ctrl+C oppure chiudi la finestra." -ForegroundColor Gray
Write-Host ""

Set-Location $installDir
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $scriptPath -ConfigPath $configPath
