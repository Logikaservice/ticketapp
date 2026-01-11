# Installa-Automatico.ps1
# Installer automatico per Network Monitor Service
# Eseguire questo file con doppio click (richiede privilegi admin)

param(
    [switch]$Force = $false
)

# Codice per richiedere privilegi admin se necessario
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "Richiesta autorizzazioni amministratore..." -ForegroundColor Yellow
    
    # Riavvia lo script con privilegi admin
    $scriptPath = $MyInvocation.MyCommand.Path
    $scriptArgs = ""
    if ($Force) { $scriptArgs = "-Force" }
    
    try {
        Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" $scriptArgs" -Wait
        exit $LASTEXITCODE
    } catch {
        Write-Host "❌ ERRORE: Impossibile ottenere privilegi amministratore!" -ForegroundColor Red
        Write-Host "L'installazione è stata annullata." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Premi un tasto per uscire..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
}

# Se arriviamo qui, abbiamo privilegi admin
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Network Monitor Service - Installer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Determina directory di installazione
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$installDir = "C:\ProgramData\NetworkMonitorAgent"

Write-Host "📁 Directory corrente: $scriptDir" -ForegroundColor Gray
Write-Host "📁 Directory installazione: $installDir" -ForegroundColor Gray
Write-Host ""

# Verifica se la directory corrente contiene i file necessari
$requiredFiles = @(
    "config.json",
    "NetworkMonitorService.ps1",
    "Installa-Servizio.ps1"
)

$filesMissing = @()
foreach ($file in $requiredFiles) {
    $filePath = Join-Path $scriptDir $file
    if (-not (Test-Path $filePath)) {
        $filesMissing += $file
    }
}

if ($filesMissing.Count -gt 0) {
    Write-Host "❌ ERRORE: File mancanti nella directory corrente:" -ForegroundColor Red
    foreach ($file in $filesMissing) {
        Write-Host "   - $file" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Assicurati di eseguire questo script dalla directory contenente tutti i file dell'agent." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Premi un tasto per uscire..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Se la directory corrente è diversa da quella di installazione, copia i file
if ($scriptDir -ne $installDir) {
    Write-Host "📦 Copia file in directory installazione..." -ForegroundColor Yellow
    
    # Crea directory installazione se non esiste
    if (-not (Test-Path $installDir)) {
        New-Item -ItemType Directory -Path $installDir -Force | Out-Null
        Write-Host "✅ Directory creata: $installDir" -ForegroundColor Green
    }
    
    # Copia tutti i file necessari
    $filesToCopy = @(
        "config.json",
        "NetworkMonitorService.ps1",
        "Installa-Servizio.ps1",
        "Rimuovi-Servizio.ps1",
        "NetworkMonitor.ps1",
        "InstallerCompleto.ps1",
        "Diagnostica-Agent.ps1",
        "README_SERVICE.md",
        "GUIDA_INSTALLAZIONE_SERVIZIO.md"
    )
    
    foreach ($file in $filesToCopy) {
        $sourcePath = Join-Path $scriptDir $file
        $destPath = Join-Path $installDir $file
        
        if (Test-Path $sourcePath) {
            Copy-Item -Path $sourcePath -Destination $destPath -Force
            Write-Host "   ✓ $file" -ForegroundColor Gray
        }
    }
    
    Write-Host "✅ File copiati con successo!" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "ℹ️  File già nella directory di installazione, procedo direttamente..." -ForegroundColor Gray
    Write-Host ""
}

# Cambia directory a quella di installazione
Set-Location $installDir

# Rimuovi vecchio Scheduled Task se presente (opzionale)
$oldTaskName = "NetworkMonitorAgent"
$existingTask = Get-ScheduledTask -TaskName $oldTaskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "⚠️  Rilevato vecchio Scheduled Task '$oldTaskName'." -ForegroundColor Yellow
    Write-Host "Rimozione vecchio Scheduled Task..." -ForegroundColor Yellow
    
    try {
        Stop-ScheduledTask -TaskName $oldTaskName -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $oldTaskName -Confirm:$false -ErrorAction Stop
        Write-Host "✅ Vecchio Scheduled Task rimosso con successo!" -ForegroundColor Green
        Write-Host ""
    } catch {
        Write-Host "⚠️  Errore rimozione Scheduled Task (non critico): $_" -ForegroundColor Yellow
        Write-Host ""
    }
}

# Verifica se il servizio è già installato
$serviceName = "NetworkMonitorService"
$existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue

if ($existingService) {
    Write-Host "⚠️  Servizio '$serviceName' già installato." -ForegroundColor Yellow
    
    if (-not $Force) {
        Write-Host ""
        Write-Host "Cosa vuoi fare?" -ForegroundColor Cyan
        Write-Host "1) Riconfigura servizio esistente (consigliato)" -ForegroundColor White
        Write-Host "2) Disinstalla e reinstalla" -ForegroundColor White
        Write-Host "3) Annulla" -ForegroundColor White
        Write-Host ""
        
        $choice = Read-Host "Scegli (1/2/3)"
        
        if ($choice -eq "3") {
            Write-Host "Installazione annullata." -ForegroundColor Yellow
            Write-Host ""
            Write-Host "Premi un tasto per uscire..."
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
            exit 0
        }
        
        if ($choice -eq "2") {
            Write-Host "Disinstallazione servizio esistente..." -ForegroundColor Yellow
            
            try {
                Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
                Start-Sleep -Seconds 2
                
                $nssmPath = Join-Path $installDir "nssm.exe"
                if (Test-Path $nssmPath) {
                    & $nssmPath remove $serviceName confirm
                } else {
                    sc.exe delete $serviceName | Out-Null
                }
                
                Write-Host "✅ Servizio disinstallato!" -ForegroundColor Green
                Write-Host ""
            } catch {
                Write-Host "⚠️  Errore disinstallazione (continuerò comunque): $_" -ForegroundColor Yellow
                Write-Host ""
            }
        }
    } else {
        Write-Host "Forzata riconfigurazione servizio esistente..." -ForegroundColor Yellow
        
        try {
            Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
        } catch {
            # Ignora errori
        }
    }
}

# Esegui installer del servizio
Write-Host "🚀 Installazione servizio Windows..." -ForegroundColor Cyan
Write-Host ""

$installerPath = Join-Path $installDir "Installa-Servizio.ps1"
if (Test-Path $installerPath) {
    try {
        # Esegui installer con rimozione vecchio task
        & powershell.exe -ExecutionPolicy Bypass -NoProfile -File $installerPath -RemoveOldTask
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "========================================" -ForegroundColor Green
            Write-Host "  ✅ INSTALLAZIONE COMPLETATA!" -ForegroundColor Green
            Write-Host "========================================" -ForegroundColor Green
            Write-Host ""
            Write-Host "Il servizio 'NetworkMonitorService' è stato installato e avviato." -ForegroundColor White
            Write-Host ""
            Write-Host "Directory installazione: $installDir" -ForegroundColor Gray
            Write-Host "Log servizio: $installDir\NetworkMonitorService.log" -ForegroundColor Gray
            Write-Host ""
            Write-Host "Verifica stato servizio:" -ForegroundColor Cyan
            Write-Host "  Get-Service -Name NetworkMonitorService" -ForegroundColor White
            Write-Host ""
            Write-Host "(Opzionale) Avvia tray icon per monitoraggio:" -ForegroundColor Cyan
            Write-Host "  cd $installDir" -ForegroundColor White
            Write-Host "  .\NetworkMonitorService.ps1 -ConfigPath config.json" -ForegroundColor White
            Write-Host ""
        } else {
            Write-Host ""
            Write-Host "❌ ERRORE durante l'installazione del servizio!" -ForegroundColor Red
            Write-Host "Controlla i log per maggiori dettagli." -ForegroundColor Yellow
            Write-Host ""
            Write-Host "Premi un tasto per uscire..."
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
            exit 1
        }
    } catch {
        Write-Host ""
        Write-Host "❌ ERRORE durante l'esecuzione dell'installer: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "Premi un tasto per uscire..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
} else {
    Write-Host "❌ ERRORE: Installa-Servizio.ps1 non trovato in $installDir!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Premi un tasto per uscire..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Host "Premi un tasto per uscire..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
