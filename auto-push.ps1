# Script automatico per push su GitHub
# Uso: .\auto-push.ps1

$ErrorActionPreference = 'Continue'
Set-Location $PSScriptRoot

Write-Host "Push automatico su GitHub..." -ForegroundColor Cyan
Write-Host ""

# Rimuovi lock file se presente
$lockFile = ".git\index.lock"
if (Test-Path $lockFile) {
    Write-Host "Lock file presente, rimozione..." -ForegroundColor Yellow
    $maxAttempts = 10
    $attempt = 0
    while ($attempt -lt $maxAttempts -and (Test-Path $lockFile)) {
        try {
            Remove-Item $lockFile -Force -ErrorAction Stop
            Start-Sleep -Milliseconds 200
        } catch {
            $attempt++
            if ($attempt -lt $maxAttempts) {
                Start-Sleep -Milliseconds 500
            }
        }
    }
    if (Test-Path $lockFile) {
        Write-Host "ERRORE: Impossibile rimuovere lock file. Chiudi Cursor temporaneamente e riprova." -ForegroundColor Red
        exit 1
    }
    Write-Host "Lock file rimosso" -ForegroundColor Green
}

# Aggiungi tutti i file modificati e non tracciati
Write-Host "Aggiunta file..." -ForegroundColor Yellow
git add -A 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Errore durante git add, continuo comunque..." -ForegroundColor Yellow
}

# Verifica se ci sono modifiche
$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "Nessuna modifica da committare" -ForegroundColor Cyan
    exit 0
}

# Commit
Write-Host "Commit modifiche..." -ForegroundColor Yellow
$commitMsg = "Aggiunti script helper SSH per VPS e documentazione"
git commit -m $commitMsg 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Errore durante commit (potrebbe essere gia committato)" -ForegroundColor Yellow
}

# Push
Write-Host "Push su GitHub..." -ForegroundColor Yellow
git push origin main 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Push completato con successo!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Errore durante push. Verifica connessione e credenziali GitHub." -ForegroundColor Red
    exit 1
}
