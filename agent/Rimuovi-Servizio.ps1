# Rimuovi-Servizio.ps1
# Rimuove il servizio Network Monitor Agent

$ServiceName = "NetworkMonitorService"
$NssmPath = Join-Path $PSScriptRoot "nssm.exe"

# Verifica privilegi amministratore
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "❌ ERRORE: Questo script richiede privilegi di Amministratore!" -ForegroundColor Red
    Write-Host "Esegui PowerShell come Amministratore e riprova." -ForegroundColor Yellow
    exit 1
}

Write-Host "Rimozione servizio $ServiceName..." -ForegroundColor Yellow

try {
    $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($service) {
        # Ferma il servizio se è in esecuzione
        if ($service.Status -eq "Running") {
            Write-Host "Arresto servizio..." -ForegroundColor Yellow
            Stop-Service -Name $ServiceName -Force
            Start-Sleep -Seconds 2
        }
        
        # Rimuovi servizio usando nssm
        if (Test-Path $NssmPath) {
            & $NssmPath remove $ServiceName confirm
        } else {
            # Fallback: usa sc.exe
            sc.exe delete $ServiceName
        }
        
        Write-Host "✅ Servizio rimosso con successo!" -ForegroundColor Green
    } else {
        Write-Host "ℹ️  Servizio non trovato" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ ERRORE rimozione servizio: $_" -ForegroundColor Red
    exit 1
}
