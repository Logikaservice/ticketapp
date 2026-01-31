# Verifica-Aggiorna-Versione.ps1
# Script per verificare la versione installata dell'agent e forzare aggiornamento se necessario
# Richiede privilegi amministratore

param(
    [switch]$ForceUpdate,
    [string]$SourceDir = $PSScriptRoot
)

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERRORE: Questo script richiede privilegi amministratore!" -ForegroundColor Red
    Write-Host "Esegui PowerShell come amministratore e riprova." -ForegroundColor Yellow
    pause
    exit 1
}

$serviceName = "NetworkMonitorService"
$installDir = "C:\ProgramData\NetworkMonitorAgent"
$serviceFile = Join-Path $installDir "NetworkMonitorService.ps1"
$configFile = Join-Path $installDir "config.json"
$sourceServiceFile = Join-Path $SourceDir "NetworkMonitorService.ps1"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Verifica Versione Agent" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verifica versione installata
Write-Host "1. VERIFICA VERSIONE INSTALLATA" -ForegroundColor Yellow
$installedVersion = $null
$installedVersionFromConfig = $null

if (Test-Path $serviceFile) {
    try {
        $content = Get-Content $serviceFile -Raw
        if ($content -match '\$SCRIPT_VERSION\s*=\s*"([\d\.]+)"') {
            $installedVersion = $matches[1]
            Write-Host "   Versione da NetworkMonitorService.ps1: $installedVersion" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  Versione non trovata in NetworkMonitorService.ps1" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "   ❌ Errore lettura NetworkMonitorService.ps1: $_" -ForegroundColor Red
    }
} else {
    Write-Host "   ❌ NetworkMonitorService.ps1 non trovato in $installDir" -ForegroundColor Red
}

if (Test-Path $configFile) {
    try {
        $config = Get-Content $configFile -Raw | ConvertFrom-Json
        if ($config.version) {
            $installedVersionFromConfig = $config.version.ToString()
            Write-Host "   Versione da config.json: $installedVersionFromConfig" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  Versione non trovata in config.json" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "   ⚠️  Errore lettura config.json: $_" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⚠️  config.json non trovato in $installDir" -ForegroundColor Yellow
}

Write-Host ""

# 2. Verifica versione nella directory sorgente
Write-Host "2. VERIFICA VERSIONE NELLA DIRECTORY SORGENTE" -ForegroundColor Yellow
$sourceVersion = $null

if (Test-Path $sourceServiceFile) {
    try {
        $content = Get-Content $sourceServiceFile -Raw
        if ($content -match '\$SCRIPT_VERSION\s*=\s*"([\d\.]+)"') {
            $sourceVersion = $matches[1]
            Write-Host "   Versione in $SourceDir: $sourceVersion" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  Versione non trovata nel file sorgente" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "   ❌ Errore lettura file sorgente: $_" -ForegroundColor Red
    }
} else {
    Write-Host "   ❌ NetworkMonitorService.ps1 non trovato in $SourceDir" -ForegroundColor Red
    Write-Host "   Assicurati di eseguire lo script dalla directory dell'agent" -ForegroundColor Yellow
}

Write-Host ""

# 3. Confronta versioni
Write-Host "3. CONFRONTO VERSIONI" -ForegroundColor Yellow
if ($installedVersion -and $sourceVersion) {
    if ($installedVersion -eq $sourceVersion) {
        Write-Host "   ✅ Versione installata corrisponde alla versione sorgente: $installedVersion" -ForegroundColor Green
        if (-not $ForceUpdate) {
            Write-Host ""
            Write-Host "   L'agent è già aggiornato alla versione $installedVersion" -ForegroundColor Gray
            Write-Host "   Usa -ForceUpdate per forzare la ricopia dei file" -ForegroundColor Gray
            pause
            exit 0
        } else {
            Write-Host "   ⚠️  Forzatura aggiornamento richiesta (-ForceUpdate)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   ⚠️  VERSIONE DIVERSA!" -ForegroundColor Red
        Write-Host "   Installata: $installedVersion" -ForegroundColor Yellow
        Write-Host "   Sorgente:   $sourceVersion" -ForegroundColor Yellow
        Write-Host "   Aggiornamento necessario!" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⚠️  Impossibile confrontare versioni (dati mancanti)" -ForegroundColor Yellow
    if (-not $ForceUpdate) {
        Write-Host "   Usa -ForceUpdate per forzare la ricopia dei file" -ForegroundColor Gray
        pause
        exit 1
    }
}

Write-Host ""

# 4. Aggiornamento
if ($ForceUpdate -or ($installedVersion -ne $sourceVersion)) {
    Write-Host "4. AGGIORNAMENTO AGENT" -ForegroundColor Yellow
    
    # 4.1 Ferma servizio
    Write-Host "   4.1 Arresto servizio..." -ForegroundColor Cyan
    try {
        $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
        if ($service -and $service.Status -eq "Running") {
            Stop-Service -Name $serviceName -Force -ErrorAction Stop
            Write-Host "      ✅ Servizio arrestato" -ForegroundColor Green
            Start-Sleep -Seconds 3
        } else {
            Write-Host "      ℹ️  Servizio già fermo o non trovato" -ForegroundColor Gray
        }
    } catch {
        Write-Host "      ⚠️  Errore arresto servizio: $_" -ForegroundColor Yellow
    }
    
    # 4.2 Copia file
    Write-Host "   4.2 Copia file aggiornati..." -ForegroundColor Cyan
    $filesToCopy = @(
        "NetworkMonitorService.ps1",
        "NetworkMonitorTrayIcon.ps1",
        "Start-TrayIcon-Hidden.vbs",
        "Avvia-TrayIcon.bat",
        "Verifica-TrayIcon.ps1",
        "Test-RouterWifi.ps1"
    )
    
    $filesCopied = 0
    foreach ($file in $filesToCopy) {
        $src = Join-Path $SourceDir $file
        $dst = Join-Path $installDir $file
        
        if (Test-Path $src) {
            try {
                # Forza la copia anche se il file è in uso
                Copy-Item $src $dst -Force -ErrorAction Stop
                Write-Host "      ✅ Copiato: $file" -ForegroundColor Green
                $filesCopied++
            } catch {
                Write-Host "      ❌ Errore copia $file : $_" -ForegroundColor Red
                Write-Host "      Prova a chiudere eventuali processi che usano il file" -ForegroundColor Yellow
            }
        } else {
            Write-Host "      ⚠️  $file non trovato nella directory sorgente" -ForegroundColor Yellow
        }
    }
    
    if ($filesCopied -eq 0) {
        Write-Host ""
        Write-Host "   ❌ ERRORE: Nessun file copiato!" -ForegroundColor Red
        pause
        exit 1
    }
    
    Write-Host "      ✅ $filesCopied file copiati con successo" -ForegroundColor Green
    
    # 4.3 Aggiorna versione nel config.json
    Write-Host "   4.3 Aggiornamento versione in config.json..." -ForegroundColor Cyan
    if (Test-Path $configFile -and $sourceVersion) {
        try {
            $config = Get-Content $configFile -Raw | ConvertFrom-Json
            $config.version = $sourceVersion
            $config | ConvertTo-Json -Depth 10 | Set-Content -Path $configFile -Encoding UTF8
            Write-Host "      ✅ Versione aggiornata in config.json: $sourceVersion" -ForegroundColor Green
        } catch {
            Write-Host "      ⚠️  Errore aggiornamento config.json: $_" -ForegroundColor Yellow
        }
    } else {
        Write-Host "      ⚠️  config.json non trovato o versione sorgente non disponibile" -ForegroundColor Yellow
    }
    
    # 4.4 Riavvia servizio
    Write-Host "   4.4 Avvio servizio..." -ForegroundColor Cyan
    try {
        Start-Service -Name $serviceName -ErrorAction Stop
        Start-Sleep -Seconds 3
        
        $service = Get-Service -Name $serviceName -ErrorAction Stop
        if ($service.Status -eq "Running") {
            Write-Host "      ✅ Servizio avviato correttamente" -ForegroundColor Green
        } else {
            Write-Host "      ⚠️  Servizio avviato ma stato: $($service.Status)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "      ❌ Errore avvio servizio: $_" -ForegroundColor Red
        Write-Host "      Controlla i log in $installDir" -ForegroundColor Yellow
    }
    
    Write-Host ""
    
    # 5. Verifica versione aggiornata
    Write-Host "5. VERIFICA VERSIONE AGGIORNATA" -ForegroundColor Yellow
    Start-Sleep -Seconds 2
    
    if (Test-Path $serviceFile) {
        try {
            $content = Get-Content $serviceFile -Raw
            if ($content -match '\$SCRIPT_VERSION\s*=\s*"([\d\.]+)"') {
                $newInstalledVersion = $matches[1]
                Write-Host "   Versione installata: $newInstalledVersion" -ForegroundColor Green
                
                if ($newInstalledVersion -eq $sourceVersion) {
                    Write-Host "   ✅ Aggiornamento completato con successo!" -ForegroundColor Green
                } else {
                    Write-Host "   ⚠️  Versione installata ($newInstalledVersion) diversa da sorgente ($sourceVersion)" -ForegroundColor Yellow
                }
            }
        } catch {
            Write-Host "   ⚠️  Errore verifica versione: $_" -ForegroundColor Yellow
        }
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Aggiornamento completato!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Versione installata: $installedVersion -> $sourceVersion" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Per verificare lo stato dell'agent:" -ForegroundColor Yellow
    Write-Host "  .\Verifica-Servizio.ps1" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "4. Nessun aggiornamento necessario" -ForegroundColor Green
}

Write-Host ""
pause
