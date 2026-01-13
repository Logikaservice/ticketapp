# Incrementa-Versione.ps1
# Script per incrementare la versione dell'agent
# Formato versione: MAJOR.MINOR.PATCH (es: 1.1.0)
# 
# Uso:
#   .\Incrementa-Versione.ps1           -> incrementa PATCH (1.1.0 -> 1.1.1)
#   .\Incrementa-Versione.ps1 -Minor     -> incrementa MINOR (1.1.0 -> 1.2.0)
#   .\Incrementa-Versione.ps1 -Major     -> incrementa MAJOR (1.1.0 -> 2.0.0)

param(
    [switch]$Minor = $false,
    [switch]$Major = $false
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $scriptDir) { $scriptDir = $PSScriptRoot }

$serviceFile = Join-Path $scriptDir "NetworkMonitorService.ps1"
$configExampleFile = Join-Path $scriptDir "config.example.json"

# Verifica che i file esistano
if (-not (Test-Path $serviceFile)) {
    Write-Host "ERRORE: NetworkMonitorService.ps1 non trovato!" -ForegroundColor Red
    exit 1
}

# Leggi la versione corrente dal file NetworkMonitorService.ps1
$content = Get-Content $serviceFile -Raw
if ($content -match '^\$SCRIPT_VERSION = "([\d\.]+)"') {
    $currentVersion = $matches[1]
} elseif ($content -match 'Versione: ([\d\.]+)') {
    $currentVersion = $matches[1]
} else {
    Write-Host "ERRORE: Versione non trovata nel file!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Incremento Versione Agent" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Versione corrente: $currentVersion" -ForegroundColor Yellow

# Parse versione
$parts = $currentVersion.Split('.')
$major = [int]$parts[0]
$minor = [int]$parts[1]
$patch = [int]$parts[2]

# Incrementa versione
if ($Major) {
    $major++
    $minor = 0
    $patch = 0
    $incrementType = "MAJOR"
} elseif ($Minor) {
    $minor++
    $patch = 0
    $incrementType = "MINOR"
} else {
    $patch++
    $incrementType = "PATCH"
}

$newVersion = "$major.$minor.$patch"

Write-Host "Nuova versione:   $newVersion ($incrementType)" -ForegroundColor Green
Write-Host ""

# Aggiorna NetworkMonitorService.ps1
Write-Host "Aggiornamento NetworkMonitorService.ps1..." -ForegroundColor Yellow

# Aggiorna $SCRIPT_VERSION
$content = $content -replace '\$SCRIPT_VERSION = "[\d\.]+"', "`$SCRIPT_VERSION = `"$newVersion`""

# Aggiorna commento versione
$dateStr = Get-Date -Format "yyyy-MM-dd"
$content = $content -replace 'Versione: [\d\.]+', "Versione: $newVersion"
$content = $content -replace 'Data ultima modifica: [\d\-]+', "Data ultima modifica: $dateStr"

Set-Content -Path $serviceFile -Value $content -Encoding UTF8
Write-Host "   OK NetworkMonitorService.ps1 aggiornato" -ForegroundColor Green

# Aggiorna config.example.json se esiste
if (Test-Path $configExampleFile) {
    Write-Host "Aggiornamento config.example.json..." -ForegroundColor Yellow
    $configContent = Get-Content $configExampleFile -Raw
    $configContent = $configContent -replace '"version":\s*"[\d\.]+"', "`"version`": `"$newVersion`""
    Set-Content -Path $configExampleFile -Value $configContent -Encoding UTF8
    Write-Host "   OK config.example.json aggiornato" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Versione aggiornata con successo!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Versione: $currentVersion -> $newVersion" -ForegroundColor Gray
Write-Host ""
Write-Host "Ricorda di:" -ForegroundColor Yellow
Write-Host "  1. Eseguire .\Aggiorna-Agent.ps1 per applicare le modifiche" -ForegroundColor Gray
Write-Host "  2. Aggiornare anche config.json nella directory di installazione" -ForegroundColor Gray
Write-Host ""
pause
