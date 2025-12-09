# Script per reimpostare la password di PostgreSQL locale
# ATTENZIONE: Questo script modifica la password di PostgreSQL

Write-Host "=== REIMPOSTAZIONE PASSWORD POSTGRESQL ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "⚠️  ATTENZIONE: Questo script cambierà la password di PostgreSQL!" -ForegroundColor Red
Write-Host ""
Write-Host "Opzioni:" -ForegroundColor Cyan
Write-Host "1. Reimposta password a: TicketApp2025!Secure" -ForegroundColor Green
Write-Host "2. Verifica password attuale (tentativo connessione)" -ForegroundColor Yellow
Write-Host "3. Esci senza modificare nulla" -ForegroundColor Red
Write-Host ""

$scelta = Read-Host "Scegli opzione (1/2/3)"

if ($scelta -eq "1") {
    Write-Host ""
    Write-Host "Reimpostazione password PostgreSQL a: TicketApp2025!Secure" -ForegroundColor Cyan
    Write-Host ""
    
    # Crea file temporaneo con comando SQL
    $sqlFile = "$env:TEMP\reset_postgres_password.sql"
    $newPassword = "TicketApp2025!Secure"
    
    # Crea comando SQL per cambiare password
    $sqlCommand = @"
ALTER USER postgres WITH PASSWORD '$newPassword';
"@
    
    $sqlCommand | Out-File -FilePath $sqlFile -Encoding UTF8
    
    Write-Host "Eseguendo comando SQL..." -ForegroundColor Yellow
    Write-Host "NOTA: Potrebbe richiedere la password attuale di postgres" -ForegroundColor Yellow
    Write-Host ""
    
    # Prova a eseguire il comando
    # Se fallisce, l'utente dovrà eseguirlo manualmente
    try {
        $env:PGPASSWORD = $newPassword
        psql -U postgres -d postgres -f $sqlFile 2>&1 | ForEach-Object {
            if ($_ -match "ERROR" -or $_ -match "FATALE") {
                Write-Host $_ -ForegroundColor Red
            } else {
                Write-Host $_
            }
        }
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ Password reimpostata con successo!" -ForegroundColor Green
            Write-Host "Ora aggiorna il file .env con la nuova password" -ForegroundColor Yellow
        } else {
            Write-Host ""
            Write-Host "⚠️  Il comando potrebbe aver richiesto la password attuale" -ForegroundColor Yellow
            Write-Host "Esegui manualmente:" -ForegroundColor Cyan
            Write-Host "  psql -U postgres -d postgres" -ForegroundColor White
            Write-Host "  ALTER USER postgres WITH PASSWORD 'TicketApp2025!Secure';" -ForegroundColor White
        }
    } catch {
        Write-Host "❌ Errore: $_" -ForegroundColor Red
    } finally {
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
        if (Test-Path $sqlFile) {
            Remove-Item $sqlFile -ErrorAction SilentlyContinue
        }
    }
    
} elseif ($scelta -eq "2") {
    Write-Host ""
    Write-Host "Test password attuale..." -ForegroundColor Cyan
    Write-Host ""
    
    $testPassword = Read-Host "Inserisci password da testare" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($testPassword)
    $plainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
    
    $env:PGPASSWORD = $plainPassword
    $result = psql -U postgres -d postgres -c "SELECT current_database();" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Password corretta!" -ForegroundColor Green
    } else {
        Write-Host "❌ Password errata" -ForegroundColor Red
        Write-Host $result
    }
    
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    
} else {
    Write-Host "Operazione annullata" -ForegroundColor Yellow
}

