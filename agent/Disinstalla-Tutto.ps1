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
    Write-Host "  - Rimuove il Scheduled Task (se presente)" -ForegroundColor White
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
$TaskName = "NetworkMonitorAgent"
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

Write-Host "2. Rimuovo Scheduled Task..." -ForegroundColor Yellow

try {
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($task) {
        Write-Host "   Fermo Scheduled Task..." -ForegroundColor Gray
        Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        
        Write-Host "   Rimozione Scheduled Task..." -ForegroundColor Gray
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
        
        Start-Sleep -Seconds 1
        
        $taskAfter = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        if (-not $taskAfter) {
            Write-Host "   Scheduled Task rimosso con successo!" -ForegroundColor Green
        } else {
            Write-Host "   ATTENZIONE: Scheduled Task ancora presente" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   Scheduled Task non trovato (gia' rimosso)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ERRORE rimozione Scheduled Task: $_" -ForegroundColor Red
}
Write-Host ""

Write-Host "3. Rimuovo directory di installazione..." -ForegroundColor Yellow

if (Test-Path $InstallDir) {
    Write-Host "   Directory trovata: $InstallDir" -ForegroundColor Gray
    Write-Host "   Rimozione file e directory..." -ForegroundColor Gray
    
    try {
        # Rimuovi tutti i file e directory
        Remove-Item -Path $InstallDir -Recurse -Force -ErrorAction Stop
        Start-Sleep -Seconds 1
        
        # Verifica rimozione
        if (-not (Test-Path $InstallDir)) {
            Write-Host "   Directory rimossa con successo!" -ForegroundColor Green
        } else {
            Write-Host "   ATTENZIONE: Directory ancora presente (alcuni file potrebbero essere bloccati)" -ForegroundColor Yellow
            Write-Host "   Prova a chiudere tutte le finestre PowerShell e riesegui questo script" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "   ERRORE rimozione directory: $_" -ForegroundColor Red
        Write-Host "   Alcuni file potrebbero essere in uso. Chiudi tutte le finestre PowerShell e riprova." -ForegroundColor Yellow
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

# Verifica Scheduled Task
$taskCheck = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($taskCheck) {
    Write-Host "   ATTENZIONE: Scheduled Task ancora presente!" -ForegroundColor Yellow
    $allRemoved = $false
} else {
    Write-Host "   Scheduled Task: rimosso" -ForegroundColor Green
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
