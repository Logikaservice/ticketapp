# Script di test connessione VPS
# Esegui: .\scripts\Test-VpsConnection.ps1

Write-Host "Test connessione VPS..." -ForegroundColor Cyan
Write-Host ""

# Verifica SSH
$sshCmd = Get-Command ssh -ErrorAction SilentlyContinue
if (-not $sshCmd) {
    Write-Host "SSH non trovato!" -ForegroundColor Red
    Write-Host "   Installa: Settings -> Apps -> Optional Features -> OpenSSH Client" -ForegroundColor Yellow
    exit 1
}
Write-Host "SSH disponibile" -ForegroundColor Green

# Verifica chiave
$sshKey = "$env:USERPROFILE\.ssh\vps_key"
if (-not (Test-Path $sshKey)) {
    Write-Host "Chiave SSH non trovata: $sshKey" -ForegroundColor Red
    Write-Host "   Esegui: .\CONFIGURA_CHIAVE_SSH.ps1" -ForegroundColor Yellow
    exit 1
}
Write-Host "Chiave SSH trovata" -ForegroundColor Green

# Test connessione
Write-Host ""
Write-Host "Test connessione a 159.69.121.162..." -ForegroundColor Yellow
$testCmd = "ssh -i `"$sshKey`" -o StrictHostKeyChecking=no -o ConnectTimeout=5 root@159.69.121.162 `"echo OK`""
try {
    $result = Invoke-Expression $testCmd 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Connessione OK!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Prossimi passi:" -ForegroundColor Cyan
        Write-Host "   . .\scripts\VpsHelper.ps1" -ForegroundColor Yellow
        Write-Host "   Get-VpsStatus" -ForegroundColor Yellow
        exit 0
    } else {
        Write-Host "Errore connessione (exit code: $LASTEXITCODE)" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Errore: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
