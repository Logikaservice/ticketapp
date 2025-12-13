# Script per backup del database VPS da Windows

param(
    [Parameter(Mandatory=$true)]
    [string]$VpsHost,
    
    [Parameter(Mandatory=$false)]
    [string]$OutputDir = "backups"
)

Write-Host "💾 Backup Database VPS" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan
Write-Host ""

# Credenziali database
$dbUser = "postgres"
$dbPassword = "TicketApp2025!Secure"
$dbPort = "5432"

# Timestamp per nome file
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

# Path assoluto per backups
$backupPath = Join-Path (Split-Path -Parent $PSScriptRoot) $OutputDir

# Crea directory backups se non esiste
if (-not (Test-Path $backupPath)) {
    New-Item -ItemType Directory -Path $backupPath | Out-Null
    Write-Host "📁 Creata directory: $backupPath" -ForegroundColor Green
}

# Verifica che pg_dump sia disponibile
$pgDumpPath = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $pgDumpPath) {
    Write-Host "❌ pg_dump non trovato!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Installa PostgreSQL client tools:" -ForegroundColor Yellow
    Write-Host "   https://www.postgresql.org/download/windows/" -ForegroundColor Gray
    exit 1
}

Write-Host "📊 Parametri backup:" -ForegroundColor Yellow
Write-Host "   Host: $VpsHost" -ForegroundColor Gray
Write-Host "   User: $dbUser" -ForegroundColor Gray
Write-Host "   Port: $dbPort" -ForegroundColor Gray
Write-Host "   Output: $backupPath" -ForegroundColor Gray
Write-Host ""

# Database da backuppare
$databases = @(
    @{ Name = "ticketapp"; Desc = "Database principale" },
    @{ Name = "crypto_db"; Desc = "Crypto trading bot" },
    @{ Name = "vivaldi_db"; Desc = "Vivaldi annunci" }
)

$backupSuccess = 0
$backupFailed = 0

foreach ($db in $databases) {
    $dbName = $db.Name
    $dbDesc = $db.Desc
    
    Write-Host "💾 Backup $dbDesc ($dbName)..." -ForegroundColor Yellow
    
    # Nome file backup
    $backupFile = Join-Path $backupPath "backup_${dbName}_${timestamp}.sql"
    
    # Esegui backup
    $env:PGPASSWORD = $dbPassword
    $env:PGCONNECT_TIMEOUT = "10"
    
    try {
        & pg_dump -h $VpsHost -U $dbUser -p $dbPort -d $dbName -F p -f $backupFile 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            $fileSize = (Get-Item $backupFile).Length / 1MB
            Write-Host "   ✅ Backup completato: $backupFile" -ForegroundColor Green
            Write-Host "   📦 Dimensione: $([math]::Round($fileSize, 2)) MB" -ForegroundColor Gray
            $backupSuccess++
        } else {
            Write-Host "   ❌ Backup fallito!" -ForegroundColor Red
            $backupFailed++
        }
    } catch {
        Write-Host "   ❌ Errore: $_" -ForegroundColor Red
        $backupFailed++
    }
    
    Write-Host ""
}

# Riepilogo
Write-Host "================================" -ForegroundColor Cyan
Write-Host "📊 Riepilogo backup:" -ForegroundColor Cyan
Write-Host "   ✅ Successo: $backupSuccess" -ForegroundColor Green
Write-Host "   ❌ Falliti: $backupFailed" -ForegroundColor Red
Write-Host ""

if ($backupSuccess -gt 0) {
    Write-Host "✅ Backup completato!" -ForegroundColor Green
    Write-Host "📁 File salvati in: $backupPath" -ForegroundColor Gray
} else {
    Write-Host "❌ Nessun backup completato con successo" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Operazione completata!" -ForegroundColor Green
