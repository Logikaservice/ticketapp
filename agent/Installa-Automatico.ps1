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
        Write-Host "ERRORE: Impossibile ottenere privilegi amministratore!" -ForegroundColor Red
        Write-Host "L'installazione e' stata annullata." -ForegroundColor Yellow
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

Write-Host "Directory corrente: $scriptDir" -ForegroundColor Gray
Write-Host "Directory installazione: $installDir" -ForegroundColor Gray
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
    Write-Host "ERRORE: File mancanti nella directory corrente:" -ForegroundColor Red
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

# Verifica e completa config.json se necessario
$configPath = Join-Path $scriptDir "config.json"
if (Test-Path $configPath) {
    try {
        $config = Get-Content $configPath -Raw | ConvertFrom-Json
        
        # Verifica se mancano server_url o api_key
        $needUpdate = $false
        
        if (-not $config.server_url -or $config.server_url -eq "") {
            Write-Host "ATTENZIONE: server_url mancante in config.json!" -ForegroundColor Yellow
            Write-Host ""
            $serverUrl = Read-Host "Inserisci il Server URL (es: https://ticketapp.tuoserver.it)"
            if ($serverUrl) {
                $config.server_url = $serverUrl.Trim()
                $needUpdate = $true
            } else {
                Write-Host "ERRORE: Server URL obbligatorio!" -ForegroundColor Red
                Write-Host ""
                Write-Host "Premi un tasto per uscire..."
                $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
                exit 1
            }
        }
        
        if (-not $config.api_key -or $config.api_key -eq "") {
            Write-Host "ATTENZIONE: api_key mancante in config.json!" -ForegroundColor Yellow
            Write-Host ""
            $apiKey = Read-Host "Inserisci l'API Key dell'agent"
            if ($apiKey) {
                $config.api_key = $apiKey.Trim()
                $needUpdate = $true
            } else {
                Write-Host "ERRORE: API Key obbligatoria!" -ForegroundColor Red
                Write-Host ""
                Write-Host "Premi un tasto per uscire..."
                $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
                exit 1
            }
        }
        
        # Aggiorna config.json se necessario
        if ($needUpdate) {
            Write-Host ""
            Write-Host "Aggiornamento config.json..." -ForegroundColor Yellow
            $config | ConvertTo-Json -Depth 10 | Out-File -FilePath $configPath -Encoding UTF8 -Force
            Write-Host "config.json aggiornato!" -ForegroundColor Green
            Write-Host ""
        } else {
            # Mostra informazioni di configurazione
            Write-Host "Configurazione trovata:" -ForegroundColor Green
            Write-Host "   Server URL: $($config.server_url)" -ForegroundColor Gray
            $apiKeyPreview = $config.api_key.Substring(0, [Math]::Min(8, $config.api_key.Length))
            Write-Host "   API Key: $apiKeyPreview..." -ForegroundColor Gray
            if ($config.agent_name) {
                Write-Host "   Agent Name: $($config.agent_name)" -ForegroundColor Gray
            }
            if ($config.scan_interval_minutes) {
                Write-Host "   Scan Interval: $($config.scan_interval_minutes) minuti" -ForegroundColor Gray
            }
            Write-Host ""
        }
    } catch {
        Write-Host "ERRORE: Impossibile leggere config.json: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "Premi un tasto per uscire..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
} else {
    Write-Host "ERRORE: config.json non trovato!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Premi un tasto per uscire..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Lista file necessari da copiare
$filesToCopy = @(
    "config.json",
    "NetworkMonitorService.ps1",
    "Installa-Servizio.ps1",
    "Rimuovi-Servizio.ps1",
    "NetworkMonitor.ps1",
    "InstallerCompleto.ps1",
    "Diagnostica-Agent.ps1",
    "README_SERVICE.md",
    "GUIDA_INSTALLAZIONE_SERVIZIO.md",
    "nssm.exe"
)

# Se la directory corrente e' diversa da quella di installazione, copia i file
if ($scriptDir -ne $installDir) {
    Write-Host "Copia file in directory installazione..." -ForegroundColor Yellow
    
    # Crea directory installazione se non esiste
    if (-not (Test-Path $installDir)) {
        New-Item -ItemType Directory -Path $installDir -Force | Out-Null
        Write-Host "Directory creata: $installDir" -ForegroundColor Green
    }
    
    # Copia tutti i file necessari
    foreach ($file in $filesToCopy) {
        $sourcePath = Join-Path $scriptDir $file
        $destPath = Join-Path $installDir $file
        
        if (Test-Path $sourcePath) {
            Copy-Item -Path $sourcePath -Destination $destPath -Force
            Write-Host "   $file" -ForegroundColor Gray
        }
    }
    
    Write-Host "File copiati con successo!" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "File gia' nella directory di installazione..." -ForegroundColor Gray
    
    # Verifica che tutti i file necessari siano presenti, in particolare nssm.exe
    $missingFiles = @()
    foreach ($file in $filesToCopy) {
        $filePath = Join-Path $installDir $file
        if (-not (Test-Path $filePath)) {
            $missingFiles += $file
        }
    }
    
    if ($missingFiles.Count -gt 0) {
        Write-Host "ATTENZIONE: File mancanti nella directory di installazione:" -ForegroundColor Yellow
        foreach ($file in $missingFiles) {
            Write-Host "   - $file" -ForegroundColor Yellow
        }
        Write-Host ""
        Write-Host "Assicurati che il pacchetto ZIP includa tutti i file necessari." -ForegroundColor Yellow
        Write-Host "Riscarica il pacchetto dalla dashboard TicketApp se necessario." -ForegroundColor Yellow
        Write-Host ""
    } else {
        Write-Host "Tutti i file necessari sono presenti." -ForegroundColor Green
        Write-Host ""
    }
}

# Cambia directory a quella di installazione
Set-Location $installDir

# Verifica se il servizio e' gia' installato
$serviceName = "NetworkMonitorService"
$existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue

if ($existingService) {
    Write-Host "Servizio '$serviceName' gia' installato." -ForegroundColor Yellow
    
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
                
                Write-Host "Servizio disinstallato!" -ForegroundColor Green
                Write-Host ""
            } catch {
                Write-Host "Errore disinstallazione (continui comunque): $_" -ForegroundColor Yellow
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
Write-Host "Installazione servizio Windows..." -ForegroundColor Cyan
Write-Host ""

$installerPath = Join-Path $installDir "Installa-Servizio.ps1"
if (Test-Path $installerPath) {
    try {
        # Esegui installer
        & powershell.exe -ExecutionPolicy Bypass -NoProfile -File $installerPath
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "========================================" -ForegroundColor Green
            Write-Host "  INSTALLAZIONE COMPLETATA!" -ForegroundColor Green
            Write-Host "========================================" -ForegroundColor Green
            Write-Host ""
            Write-Host "Il servizio 'NetworkMonitorService' e' stato installato e avviato." -ForegroundColor White
            Write-Host ""
            Write-Host "Directory installazione: $installDir" -ForegroundColor Gray
            Write-Host "Log servizio: $installDir\NetworkMonitorService.log" -ForegroundColor Gray
            Write-Host ""
            
            # Chiedi se vuoi avviare la tray icon
            Write-Host ""
            Write-Host "Vuoi avviare l'icona nella system tray (vicino all'orologio)?" -ForegroundColor Cyan
            Write-Host "L'icona permette di vedere lo stato del servizio e aprire i log facilmente." -ForegroundColor Gray
            Write-Host ""
            Write-Host "1) Si, avvia l'icona nella system tray (consigliato)" -ForegroundColor White
            Write-Host "2) No, il servizio e' sufficiente" -ForegroundColor White
            Write-Host ""
            
            $trayChoice = Read-Host "Scegli (1/2)"
            
            if ($trayChoice -eq "1") {
                Write-Host ""
                Write-Host "Avvio icona system tray..." -ForegroundColor Yellow
                
                $serviceScriptPath = Join-Path $installDir "NetworkMonitorService.ps1"
                if (Test-Path $serviceScriptPath) {
                    try {
                        # Avvia la tray icon in background
                        Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$serviceScriptPath`" -ConfigPath `"$configPath`"" -WindowStyle Hidden
                        Write-Host "Icona system tray avviata!" -ForegroundColor Green
                        Write-Host "Cerca l'icona nella system tray (vicino all'orologio) per monitorare il servizio." -ForegroundColor Gray
                        Write-Host ""
                    } catch {
                        Write-Host "ATTENZIONE: Impossibile avviare l'icona system tray automaticamente." -ForegroundColor Yellow
                        Write-Host "Puoi avviarla manualmente eseguendo:" -ForegroundColor Gray
                        Write-Host "  cd $installDir" -ForegroundColor White
                        Write-Host "  .\NetworkMonitorService.ps1 -ConfigPath config.json" -ForegroundColor White
                        Write-Host ""
                    }
                } else {
                    Write-Host "ATTENZIONE: NetworkMonitorService.ps1 non trovato per avviare la tray icon." -ForegroundColor Yellow
                    Write-Host ""
                }
            } else {
                Write-Host ""
                Write-Host "Per avviare l'icona system tray in futuro, esegui:" -ForegroundColor Cyan
                Write-Host "  cd $installDir" -ForegroundColor White
                Write-Host "  .\NetworkMonitorService.ps1 -ConfigPath config.json" -ForegroundColor White
                Write-Host ""
            }
            
            Write-Host "Verifica stato servizio:" -ForegroundColor Cyan
            Write-Host "  Get-Service -Name NetworkMonitorService" -ForegroundColor White
            Write-Host ""
        } else {
            Write-Host ""
            Write-Host "ERRORE durante l'installazione del servizio!" -ForegroundColor Red
            Write-Host "Controlla i log per maggiori dettagli." -ForegroundColor Yellow
            Write-Host ""
            Write-Host "Premi un tasto per uscire..."
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
            exit 1
        }
    } catch {
        Write-Host ""
        Write-Host "ERRORE durante l'esecuzione dell'installer: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "Premi un tasto per uscire..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
} else {
    Write-Host "ERRORE: Installa-Servizio.ps1 non trovato in $installDir!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Premi un tasto per uscire..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Host "Premi un tasto per uscire..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
