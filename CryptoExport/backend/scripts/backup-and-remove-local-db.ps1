# Script per backup e rimozione database PostgreSQL locale

Write-Host "🗄️  Backup e Rimozione Database PostgreSQL Locale" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Verifica se PostgreSQL è installato
Write-Host "📋 Step 1: Verifica installazione PostgreSQL locale" -ForegroundColor Yellow
$postgresServices = Get-Service | Where-Object { $_.Name -like "*postgres*" -or $_.DisplayName -like "*PostgreSQL*" }

if ($postgresServices.Count -eq 0) {
    Write-Host "   ℹ️  Nessun servizio PostgreSQL trovato" -ForegroundColor Gray
    Write-Host "   PostgreSQL locale già rimosso o non installato" -ForegroundColor Green
    exit 0
}

Write-Host "   ✅ Servizi PostgreSQL trovati:" -ForegroundColor Green
foreach ($service in $postgresServices) {
    Write-Host "      - $($service.Name) ($($service.DisplayName))" -ForegroundColor Gray
}
Write-Host ""

# Step 2: Verifica se pg_dump è disponibile (per backup)
Write-Host "📋 Step 2: Verifica disponibilità strumenti backup" -ForegroundColor Yellow
$pgDumpPath = Get-Command pg_dump -ErrorAction SilentlyContinue

if (-not $pgDumpPath) {
    Write-Host "   ⚠️  pg_dump non trovato - salto backup" -ForegroundColor Yellow
    Write-Host "   I dati locali verranno persi se continui" -ForegroundColor Red
    Write-Host ""
    
    $confirm = Read-Host "   Vuoi continuare senza backup? (y/N)"
    if ($confirm -ne 'y' -and $confirm -ne 'Y') {
        Write-Host "   ❌ Operazione annullata" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "   ✅ pg_dump disponibile - posso fare backup" -ForegroundColor Green
    Write-Host ""
    
    # Step 3: Backup database locale
    Write-Host "📋 Step 3: Backup database locale" -ForegroundColor Yellow
    
    $backupDir = "C:\TicketApp\backend\backups\local-db-final"
    if (-not (Test-Path $backupDir)) {
        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    }
    
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $databases = @("ticketapp", "crypto_db", "vivaldi_db")
    
    foreach ($dbName in $databases) {
        Write-Host "   💾 Backup $dbName..." -ForegroundColor Gray
        
        $backupFile = Join-Path $backupDir "backup_${dbName}_${timestamp}.sql"
        
        try {
            $env:PGPASSWORD = "your_local_password"  # Modifica se hai una password diversa
            & pg_dump -h localhost -U postgres -d $dbName -F p -f $backupFile 2>&1 | Out-Null
            
            if ($LASTEXITCODE -eq 0) {
                $fileSize = (Get-Item $backupFile).Length / 1MB
                Write-Host "      ✅ Backup completato: $([math]::Round($fileSize, 2)) MB" -ForegroundColor Green
            } else {
                Write-Host "      ⚠️  Backup fallito (potrebbe non esistere)" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "      ⚠️  Errore backup: $_" -ForegroundColor Yellow
        }
    }
    
    Write-Host ""
    Write-Host "   ✅ Backup salvati in: $backupDir" -ForegroundColor Green
    Write-Host ""
}

# Step 4: Ferma servizi PostgreSQL
Write-Host "📋 Step 4: Arresto servizi PostgreSQL" -ForegroundColor Yellow

foreach ($service in $postgresServices) {
    if ($service.Status -eq "Running") {
        Write-Host "   ⏸️  Arresto $($service.Name)..." -ForegroundColor Gray
        try {
            Stop-Service -Name $service.Name -Force
            Write-Host "      ✅ Servizio arrestato" -ForegroundColor Green
        } catch {
            Write-Host "      ❌ Errore: $_" -ForegroundColor Red
        }
    } else {
        Write-Host "   ℹ️  $($service.Name) già fermo" -ForegroundColor Gray
    }
}

Write-Host ""

# Step 5: Disabilita avvio automatico
Write-Host "📋 Step 5: Disabilita avvio automatico servizi" -ForegroundColor Yellow

foreach ($service in $postgresServices) {
    Write-Host "   🔧 Disabilito $($service.Name)..." -ForegroundColor Gray
    try {
        Set-Service -Name $service.Name -StartupType Disabled
        Write-Host "      ✅ Avvio automatico disabilitato" -ForegroundColor Green
    } catch {
        Write-Host "      ❌ Errore: $_" -ForegroundColor Red
    }
}

Write-Host ""

# Step 6: Istruzioni rimozione completa
Write-Host "📋 Step 6: Rimozione completa (opzionale)" -ForegroundColor Yellow
Write-Host ""
Write-Host "   PostgreSQL è stato arrestato e disabilitato." -ForegroundColor Green
Write-Host "   I servizi non partiranno più automaticamente." -ForegroundColor Green
Write-Host ""
Write-Host "   Per disinstallare completamente PostgreSQL:" -ForegroundColor Cyan
Write-Host "   1. Apri Installazione applicazioni (Win + X -> App e funzionalita)" -ForegroundColor Gray
Write-Host "   2. Cerca PostgreSQL" -ForegroundColor Gray
Write-Host "   3. Clicca Disinstalla" -ForegroundColor Gray
Write-Host "   4. Elimina manualmente la cartella dati (se richiesto):" -ForegroundColor Gray
Write-Host "      C:\Program Files\PostgreSQL\" -ForegroundColor Gray
Write-Host "      C:\Users\$env:USERNAME\AppData\Local\Temp\postgresql_installer*" -ForegroundColor Gray
Write-Host ""

# Step 7: Verifica finale
Write-Host "📋 Step 7: Verifica finale" -ForegroundColor Yellow
Write-Host ""

$runningServices = Get-Service | Where-Object { ($_.Name -like "*postgres*" -or $_.DisplayName -like "*PostgreSQL*") -and $_.Status -eq "Running" }

if ($runningServices.Count -eq 0) {
    Write-Host "   ✅ Nessun servizio PostgreSQL in esecuzione" -ForegroundColor Green
    Write-Host "   ✅ Database locale sicuro - non interferirà più" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Alcuni servizi sono ancora in esecuzione:" -ForegroundColor Yellow
    foreach ($s in $runningServices) {
        Write-Host "      - $($s.Name)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "✅ Operazione completata!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Riepilogo:" -ForegroundColor Cyan
Write-Host "   - Database locale arrestato" -ForegroundColor Gray
Write-Host "   - Avvio automatico disabilitato" -ForegroundColor Gray
if ($pgDumpPath) {
    Write-Host "   - Backup salvato in: $backupDir" -ForegroundColor Gray
}
Write-Host "   - Da ora lavorerai SOLO sul database VPS" -ForegroundColor Green
Write-Host ""
