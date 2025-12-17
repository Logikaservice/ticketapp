# Script PowerShell per creare database crypto_db manualmente
# Esegui questo script in PowerShell

Write-Host "=== Creazione Database Separato crypto_db ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Questo comando creerà SOLO il database crypto_db" -ForegroundColor Yellow
Write-Host "Il database principale NON verrà toccato" -ForegroundColor Green
Write-Host ""

# Comando da eseguire (sostituisci PASSWORD con la password corretta)
$password = "TicketApp2025!Secure"
$env:PGPASSWORD = $password

Write-Host "Eseguendo: psql -U postgres -d postgres -c 'CREATE DATABASE crypto_db;'" -ForegroundColor Cyan
Write-Host ""

try {
    $result = & psql -U postgres -d postgres -c "CREATE DATABASE crypto_db;" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Database crypto_db creato con successo!" -ForegroundColor Green
    } elseif ($result -match "already exists") {
        Write-Host "✅ Database crypto_db già esiste (OK)" -ForegroundColor Yellow
    } else {
        Write-Host "❌ Errore:" -ForegroundColor Red
        Write-Host $result
        exit 1
    }
    
    # Verifica che esista
    Write-Host ""
    Write-Host "Verifica database creato..." -ForegroundColor Cyan
    $verify = & psql -U postgres -d postgres -c "SELECT datname FROM pg_database WHERE datname = 'crypto_db';" 2>&1
    
    if ($verify -match "crypto_db") {
        Write-Host "✅ Verificato: crypto_db esiste nel sistema" -ForegroundColor Green
    }
    
} catch {
    Write-Host "❌ Errore durante creazione database:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    exit 1
} finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "🎯 Database principale NON toccato - solo crypto_db creato" -ForegroundColor Green

