# Script per testare password PostgreSQL

Write-Host "=== TEST PASSWORD POSTGRESQL ===" -ForegroundColor Cyan
Write-Host ""

# Password da testare
$passwordsToTest = @(
    "TicketApp2025!Secure",
    "postgres",
    "admin",
    "password",
    "",
    "TicketApp2025",
    "Logika220679",
    "root"
)

Write-Host "Testando password comuni..." -ForegroundColor Yellow
Write-Host ""

$found = $false
foreach ($pwd in $passwordsToTest) {
    $pwdDisplay = if ($pwd -eq "") { "[vuota]" } else { $pwd }
    Write-Host "Testando: $pwdDisplay" -NoNewline -ForegroundColor Gray
    
    $env:PGPASSWORD = $pwd
    $result = psql -U postgres -d postgres -c "SELECT current_database();" 2>&1 | Out-String
    
    if ($LASTEXITCODE -eq 0 -and $result -notmatch "FATALE" -and $result -notmatch "ERROR") {
        Write-Host " ✅ CORRETTA!" -ForegroundColor Green -BackgroundColor Black
        Write-Host ""
        Write-Host "🎯 PASSWORD TROVATA: $pwdDisplay" -ForegroundColor Green -BackgroundColor Black
        $found = $true
        break
    } else {
        Write-Host " ❌" -ForegroundColor Red
    }
    
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

if (-not $found) {
    Write-Host ""
    Write-Host "❌ Nessuna password comune funziona" -ForegroundColor Red
    Write-Host ""
    Write-Host "Opzioni:" -ForegroundColor Yellow
    Write-Host "1. Reimposta password PostgreSQL a 'TicketApp2025!Secure'" -ForegroundColor Cyan
    Write-Host "2. Chiedi a chi ha configurato il sistema" -ForegroundColor Cyan
    Write-Host "3. Controlla file pg_hba.conf per metodo autenticazione" -ForegroundColor Cyan
}

Write-Host ""

