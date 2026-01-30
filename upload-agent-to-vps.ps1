# Script per caricare il pacchetto agent sulla VPS

$zipPath = "C:\TicketApp\agent-releases\agent-update-1.1.4.zip"
$vpsHost = "root@159.69.121.162"
$vpsPath = "/var/www/ticketapp/agent-updates/"

Write-Host "Caricamento pacchetto agent v1.1.4 sulla VPS..." -ForegroundColor Cyan

if (-not (Test-Path $zipPath)) {
    Write-Host "Errore: File non trovato: $zipPath" -ForegroundColor Red
    exit 1
}

Write-Host "File locale: $zipPath" -ForegroundColor Gray
Write-Host "Destinazione: ${vpsHost}:${vpsPath}" -ForegroundColor Gray
Write-Host ""

# Usa SCP per caricare il file
try {
    $scpCommand = "scp `"$zipPath`" ${vpsHost}:${vpsPath}"
    Write-Host "Esecuzione: $scpCommand" -ForegroundColor Yellow
    
    & scp $zipPath "${vpsHost}:${vpsPath}"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "File caricato con successo!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Prossimo passo: Aggiorna version.json sulla VPS" -ForegroundColor Yellow
        Write-Host "Connettiti via SSH e esegui:" -ForegroundColor White
        Write-Host "  cd /var/www/ticketapp/agent-updates" -ForegroundColor Gray
        Write-Host '  echo ''{"version": "1.1.4", "download_url": "/agent-updates/agent-update-1.1.4.zip"}'' > version.json' -ForegroundColor Gray
    }
    else {
        Write-Host "Errore durante il caricamento (exit code: $LASTEXITCODE)" -ForegroundColor Red
    }
}
catch {
    Write-Host "Errore: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Premi INVIO per chiudere..."
Read-Host
