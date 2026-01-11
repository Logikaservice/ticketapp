# Disinstalla-Tutto.ps1
# Disinstalla completamente Network Monitor Agent
# Rimuove servizio, Scheduled Task, file e directory

param(
    [switch]$Force = $false  # Non chiede conferma
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Disinstallazione Network Monitor Agent" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verifica privilegi amministratore
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERRORE: Questo script richiede privilegi di Amministratore!" -ForegroundColor Red
    Write-Host "Esegui PowerShell come Amministratore e riprova." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Premi un tasto per uscire..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Chiedi conferma se non forzato
if (-not $Force) {
    Write-Host "Questo script disinstallera completamente Network Monitor Agent:" -ForegroundColor Yellow
    Write-Host "  - Ferma e rimuove il servizio Windows" -ForegroundColor White
    Write-Host "  - Rimuove tutti i file e la directory di installazione" -ForegroundColor White
    Write-Host ""
    Write-Host "Vuoi continuare? (S/N)" -ForegroundColor Cyan
    $confirm = Read-Host
    
    if ($confirm -ne "S" -and $confirm -ne "s" -and $confirm -ne "Y" -and $confirm -ne "y") {
        Write-Host "Disinstallazione annullata." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Premi un tasto per uscire..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 0
    }
    Write-Host ""
}

$ServiceName = "NetworkMonitorService"
$InstallDir = "C:\ProgramData\NetworkMonitorAgent"
$NssmPath = Join-Path $InstallDir "nssm.exe"

Write-Host "1. Fermo e rimuovo servizio Windows..." -ForegroundColor Yellow

try {
    $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($service) {
        # Ferma il servizio se e' in esecuzione
        if ($service.Status -eq "Running" -or $service.Status -eq "Paused") {
            Write-Host "   Fermo servizio..." -ForegroundColor Gray
            Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
        }
        
        # Rimuovi servizio usando nssm (se disponibile)
        if (Test-Path $NssmPath) {
            Write-Host "   Rimozione servizio con NSSM..." -ForegroundColor Gray
            & $NssmPath remove $ServiceName confirm 2>$null
        } else {
            # Fallback: usa sc.exe
            Write-Host "   Rimozione servizio con sc.exe..." -ForegroundColor Gray
            sc.exe delete $ServiceName 2>$null | Out-Null
        }
        
        Start-Sleep -Seconds 2
        
        # Verifica rimozione
        $serviceAfter = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
        if (-not $serviceAfter) {
            Write-Host "   Servizio rimosso con successo!" -ForegroundColor Green
        } else {
            Write-Host "   ATTENZIONE: Servizio ancora presente, provo con sc.exe..." -ForegroundColor Yellow
            sc.exe delete $ServiceName 2>$null | Out-Null
            Start-Sleep -Seconds 1
        }
    } else {
        Write-Host "   Servizio non trovato (gia' rimosso)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ERRORE rimozione servizio: $_" -ForegroundColor Red
}
Write-Host ""

Write-Host "2. Termino processi in esecuzione..." -ForegroundColor Yellow

try {
    # Cerca processi PowerShell che eseguono NetworkMonitorService.ps1
    $processes = Get-Process -Name "powershell*" -ErrorAction SilentlyContinue | Where-Object {
        $_.CommandLine -like "*NetworkMonitorService.ps1*" -or
        $_.Path -like "*NetworkMonitorAgent*"
    }
    
    if ($processes) {
        Write-Host "   Trovati processi in esecuzione, termino..." -ForegroundColor Gray
        foreach ($proc in $processes) {
            try {
                Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
                Write-Host "   Terminato processo PID $($proc.Id)" -ForegroundColor Gray
            } catch {
                # Ignora errori
            }
        }
        Start-Sleep -Seconds 2
    } else {
        Write-Host "   Nessun processo trovato" -ForegroundColor Gray
    }
} catch {
    # Ignora errori
}
Write-Host ""

Write-Host "3. Rimuovo directory di installazione..." -ForegroundColor Yellow

if (Test-Path $InstallDir) {
    Write-Host "   Directory trovata: $InstallDir" -ForegroundColor Gray
    
    # Prova a rimuovere file per file (piu' sicuro)
    try {
        Write-Host "   Rimozione file individuali..." -ForegroundColor Gray
        
        # Rimuovi tutti i file nella directory
        $files = Get-ChildItem -Path $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
        foreach ($file in $files) {
            try {
                if (-not $file.PSIsContainer) {
                    Remove-Item -Path $file.FullName -Force -ErrorAction SilentlyContinue
                }
            } catch {
                # Ignora file bloccati
            }
        }
        
        Start-Sleep -Seconds 1
        
        # Prova a rimuovere le directory vuote
        $dirs = Get-ChildItem -Path $InstallDir -Recurse -Directory -Force -ErrorAction SilentlyContinue | Sort-Object -Property FullName -Descending
        foreach ($dir in $dirs) {
            try {
                Remove-Item -Path $dir.FullName -Force -ErrorAction SilentlyContinue
            } catch {
                # Ignora directory non vuote
            }
        }
        
        Start-Sleep -Seconds 1
        
        # Prova a rimuovere la directory principale
        try {
            Remove-Item -Path $InstallDir -Recurse -Force -ErrorAction Stop
            Write-Host "   Directory rimossa con successo!" -ForegroundColor Green
        } catch {
            # Se ancora bloccata, prova con sc.exe (Windows)
            Write-Host "   Tentativo rimozione directory principale..." -ForegroundColor Gray
            Start-Sleep -Seconds 2
            
            # Verifica se e' ancora presente
            if (Test-Path $InstallDir) {
                Write-Host "   ATTENZIONE: Directory ancora presente" -ForegroundColor Yellow
                Write-Host "   Prova a chiudere tutte le finestre PowerShell e riprova" -ForegroundColor Yellow
                Write-Host "   Oppure riavvia il PC per completare la rimozione" -ForegroundColor Yellow
            } else {
                Write-Host "   Directory rimossa con successo!" -ForegroundColor Green
            }
        }
    } catch {
        Write-Host "   ERRORE rimozione directory: $_" -ForegroundColor Red
        Write-Host "   Alcuni file potrebbero essere in uso." -ForegroundColor Yellow
        Write-Host "   Chiudi tutte le finestre PowerShell e riprova, oppure riavvia il PC." -ForegroundColor Yellow
    }
} else {
    Write-Host "   Directory non trovata (gia' rimossa)" -ForegroundColor Gray
}
Write-Host ""

Write-Host "4. Verifica rimozione completa..." -ForegroundColor Yellow

$allRemoved = $true

# Verifica servizio
$serviceCheck = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($serviceCheck) {
    Write-Host "   ATTENZIONE: Servizio ancora presente!" -ForegroundColor Yellow
    $allRemoved = $false
} else {
    Write-Host "   Servizio: rimosso" -ForegroundColor Green
}

# Verifica directory
if (Test-Path $InstallDir) {
    Write-Host "   ATTENZIONE: Directory ancora presente!" -ForegroundColor Yellow
    $allRemoved = $false
} else {
    Write-Host "   Directory: rimossa" -ForegroundColor Green
}
Write-Host ""

if ($allRemoved) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  DISINSTALLAZIONE COMPLETATA!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Network Monitor Agent e' stato completamente rimosso." -ForegroundColor White
    Write-Host ""
    Write-Host "Per reinstallare:" -ForegroundColor Cyan
    Write-Host "  1. Scarica il pacchetto dalla dashboard TicketApp" -ForegroundColor White
    Write-Host "  2. Estrai il ZIP" -ForegroundColor White
    Write-Host "  3. Esegui Installa.bat (doppio click)" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "  DISINSTALLAZIONE PARZIALE" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Alcuni componenti non sono stati rimossi completamente." -ForegroundColor White
    Write-Host "Riesegui questo script dopo aver chiuso tutte le finestre PowerShell." -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Premi un tasto per uscire..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
