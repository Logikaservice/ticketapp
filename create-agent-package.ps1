# Script per creare il pacchetto di aggiornamento dell'agent
# Versione: 1.1.4

$ErrorActionPreference = "Stop"

Write-Host "Creazione pacchetto agent v1.1.4..." -ForegroundColor Cyan

# Directory di lavoro
$agentDir = "C:\TicketApp\agent"
$outputDir = "C:\TicketApp\agent-releases"
$version = "1.1.4"
$zipName = "agent-update-$version.zip"
$zipPath = Join-Path $outputDir $zipName

# Crea directory output se non esiste
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
    Write-Host "Creata directory: $outputDir" -ForegroundColor Green
}

# File da includere nel pacchetto
$filesToInclude = @(
    "NetworkMonitor.ps1",
    "NetworkMonitorService.ps1",
    "NetworkMonitorTrayIcon.ps1",
    "Install-Agent.ps1",
    "Uninstall-Agent.ps1",
    "config.example.json"
)

Write-Host "File da includere:" -ForegroundColor Yellow
$filePaths = @()
foreach ($file in $filesToInclude) {
    $fullPath = Join-Path $agentDir $file
    if (Test-Path $fullPath) {
        $filePaths += $fullPath
        Write-Host "  OK: $file" -ForegroundColor Gray
    }
    else {
        Write-Host "  MANCANTE: $file" -ForegroundColor Red
    }
}

# Rimuovi ZIP esistente se presente
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
    Write-Host "Rimosso ZIP precedente" -ForegroundColor Yellow
}

# Crea il ZIP
try {
    Compress-Archive -Path $filePaths -DestinationPath $zipPath -CompressionLevel Optimal -Force
    
    $sizeKB = [math]::Round((Get-Item $zipPath).Length / 1024, 2)
    
    Write-Host ""
    Write-Host "Pacchetto creato con successo!" -ForegroundColor Green
    Write-Host "Percorso: $zipPath" -ForegroundColor Cyan
    Write-Host "Dimensione: $sizeKB KB" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Prossimi passi:" -ForegroundColor Yellow
    Write-Host "1. Carica il file sulla VPS in: /var/www/ticketapp/agent-updates/" -ForegroundColor White
    Write-Host "2. Aggiorna version.json sulla VPS" -ForegroundColor White
    Write-Host ""
    
}
catch {
    Write-Host "Errore durante la creazione del pacchetto: $_" -ForegroundColor Red
    exit 1
}

Write-Host "Premi INVIO per chiudere..."
Read-Host
