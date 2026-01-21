# Verifica-Errore-Avvio.ps1
# Script per verificare gli errori di avvio del servizio

$InstallDir = "C:\ProgramData\NetworkMonitorAgent"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "VERIFICA ERRORI AVVIO SERVIZIO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Stato servizio
Write-Host "[1] STATO SERVIZIO" -ForegroundColor Yellow
try {
    $service = Get-Service -Name "NetworkMonitorService" -ErrorAction Stop
    Write-Host "  Status: $($service.Status)" -ForegroundColor $(if ($service.Status -eq 'Running') { 'Green' } else { 'Red' })
    
    # Prova a vedere se ci sono eventi di errore
    try {
        $events = Get-WinEvent -LogName System -FilterXPath "*[System[Provider[@Name='Service Control Manager'] and (EventID=7023 or EventID=7024) and TimeCreated[timediff(@SystemTime) <= 3600000]]]" -ErrorAction SilentlyContinue | Select-Object -First 5
        if ($events) {
            Write-Host "  Ultimi eventi di errore servizio:" -ForegroundColor Yellow
            $events | ForEach-Object {
                Write-Host "    $($_.TimeCreated): $($_.Message)" -ForegroundColor Red
            }
        }
    } catch {
        # Ignora errori eventi
    }
} catch {
    Write-Host "  ERRORE: Servizio non trovato!" -ForegroundColor Red
}
Write-Host ""

# 2. Log Bootstrap (primi errori)
Write-Host "[2] LOG BOOTSTRAP (Ultime 30 righe)" -ForegroundColor Yellow
$bootstrapLog = Join-Path $InstallDir "NetworkMonitorService_bootstrap.log"
if (Test-Path $bootstrapLog) {
    try {
        $bootstrapContent = Get-Content $bootstrapLog -Tail 30 -ErrorAction Stop
        Write-Host $bootstrapContent
    } catch {
        Write-Host "  ERRORE: Impossibile leggere bootstrap log: $_" -ForegroundColor Red
    }
} else {
    Write-Host "  File bootstrap log non trovato." -ForegroundColor Yellow
}
Write-Host ""

# 3. Log Principale (ultime 50 righe)
Write-Host "[3] LOG PRINCIPALE (Ultime 50 righe)" -ForegroundColor Yellow
$mainLog = Join-Path $InstallDir "NetworkMonitorService.log"
if (Test-Path $mainLog) {
    try {
        $mainContent = Get-Content $mainLog -Tail 50 -ErrorAction Stop
        Write-Host $mainContent
    } catch {
        Write-Host "  ERRORE: Impossibile leggere log principale: $_" -ForegroundColor Red
    }
} else {
    Write-Host "  File log principale non trovato." -ForegroundColor Yellow
}
Write-Host ""

# 4. Verifica sintassi file
Write-Host "[4] VERIFICA SINTASSI FILE" -ForegroundColor Yellow
$serviceFile = Join-Path $InstallDir "NetworkMonitorService.ps1"
if (Test-Path $serviceFile) {
    try {
        $content = Get-Content $serviceFile -Raw -Encoding UTF8
        
        # Verifica parentesi graffe
        $openBraces = ($content -split '{').Count - 1
        $closeBraces = ($content -split '}').Count - 1
        Write-Host "  Parentesi graffe: $openBraces aperte, $closeBraces chiuse" -ForegroundColor $(if ($openBraces -eq $closeBraces) { 'Green' } else { 'Red' })
        
        # Verifica versione
        if ($content -match '\$SCRIPT_VERSION\s*=\s*["'']([\d\.]+)["'']') {
            Write-Host "  Versione: $($matches[1])" -ForegroundColor Green
        } else {
            Write-Host "  Versione: NON TROVATA!" -ForegroundColor Red
        }
        
        # Prova a verificare sintassi PowerShell
        Write-Host "  Verifica sintassi PowerShell..." -ForegroundColor Yellow
        $errors = $null
        $null = [System.Management.Automation.PSParser]::Tokenize($content, [ref]$errors)
        if ($errors.Count -eq 0) {
            Write-Host "  Sintassi PowerShell: OK" -ForegroundColor Green
        } else {
            Write-Host "  ERRORE SINTASSI POWERSHELL:" -ForegroundColor Red
            $errors | Select-Object -First 10 | ForEach-Object {
                Write-Host "    Linea $($_.Token.StartLine): $($_.Message)" -ForegroundColor Red
            }
        }
    } catch {
        Write-Host "  ERRORE verifica file: $_" -ForegroundColor Red
    }
} else {
    Write-Host "  File NetworkMonitorService.ps1 non trovato!" -ForegroundColor Red
}
Write-Host ""

# 5. Prova esecuzione manuale (dry-run)
Write-Host "[5] PROVA ESECUZIONE MANUALE (dry-run)" -ForegroundColor Yellow
if (Test-Path $serviceFile) {
    try {
        Write-Host "  Eseguendo test sintassi..." -ForegroundColor Yellow
        $testResult = powershell.exe -NoProfile -Command "& { $ErrorActionPreference='Stop'; . '$serviceFile' -WhatIf 2>&1 }" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  Test esecuzione: OK" -ForegroundColor Green
        } else {
            Write-Host "  ERRORE TEST ESECUZIONE:" -ForegroundColor Red
            Write-Host $testResult
        }
    } catch {
        Write-Host "  ERRORE test: $_" -ForegroundColor Red
    }
} else {
    Write-Host "  File non trovato per test" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "Premi un tasto per continuare..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
