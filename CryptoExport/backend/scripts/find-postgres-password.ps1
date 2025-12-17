# Script per trovare la password di PostgreSQL nel progetto

Write-Host "=== RICERCA PASSWORD POSTGRESQL ===" -ForegroundColor Cyan
Write-Host ""

# Cerca nei file .env
Write-Host "1. Cercando nei file .env..." -ForegroundColor Yellow
$envFiles = Get-ChildItem -Path "C:\TicketApp" -Filter ".env" -Recurse -ErrorAction SilentlyContinue
foreach ($file in $envFiles) {
    Write-Host "   File: $($file.FullName)" -ForegroundColor Gray
    $content = Get-Content $file.FullName -ErrorAction SilentlyContinue
    $dbLines = $content | Select-String "DATABASE_URL"
    foreach ($line in $dbLines) {
        if ($line -match 'postgresql://([^:]+):([^@]+)@') {
            $user = $matches[1]
            $pwd = $matches[2]
            Write-Host "   ✅ Trovata password per utente '$user': $pwd" -ForegroundColor Green
        }
    }
}

# Cerca in file di configurazione
Write-Host ""
Write-Host "2. Cercando in file di configurazione..." -ForegroundColor Yellow
$configFiles = Get-ChildItem -Path "C:\TicketApp\backend" -Include "*.js","*.json","*.sh","*.ps1","*.md" -Recurse -ErrorAction SilentlyContinue | 
    Where-Object { $_.Name -match "config|setup|env|database" -or $_.FullName -match "scripts" }
foreach ($file in $configFiles) {
    $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
    if ($content -match 'postgresql://[^:]+:([^@]+)@') {
        $pwd = $matches[1]
        Write-Host "   File: $($file.Name)" -ForegroundColor Gray
        Write-Host "   Password trovata: $pwd" -ForegroundColor Green
    }
}

# Cerca password comuni
Write-Host ""
Write-Host "3. Password comuni da testare:" -ForegroundColor Yellow
$commonPasswords = @(
    "TicketApp2025!Secure",
    "postgres",
    "admin",
    "password",
    "root",
    "",
    "TicketApp2025",
    "Logika220679"
)

Write-Host "   Testando password comuni..." -ForegroundColor Gray
foreach ($pwd in $commonPasswords) {
    $env:PGPASSWORD = $pwd
    $result = psql -U postgres -d postgres -c "SELECT 1;" 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ PASSWORD CORRETTA: $pwd" -ForegroundColor Green -BackgroundColor Black
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
        break
    }
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "=== RICERCA COMPLETATA ===" -ForegroundColor Cyan

