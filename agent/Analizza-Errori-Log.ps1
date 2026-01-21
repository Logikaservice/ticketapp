# Analizza-Errori-Log.ps1
# Script per analizzare gli errori nei log del servizio

$InstallDir = "C:\ProgramData\NetworkMonitorAgent"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ANALISI ERRORI LOG" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Log Bootstrap (primi errori all'avvio)
Write-Host "[1] LOG BOOTSTRAP (Ultime 50 righe)" -ForegroundColor Yellow
$bootstrapLog = Join-Path $InstallDir "NetworkMonitorService_bootstrap.log"
if (Test-Path $bootstrapLog) {
    $bootstrapContent = Get-Content $bootstrapLog -Tail 50 -ErrorAction SilentlyContinue
    if ($bootstrapContent) {
        Write-Host $bootstrapContent
    } else {
        Write-Host "  Log vuoto" -ForegroundColor Yellow
    }
} else {
    Write-Host "  File non trovato" -ForegroundColor Yellow
}
Write-Host ""

# 2. Log Principale (ultime 100 righe)
Write-Host "[2] LOG PRINCIPALE (Ultime 100 righe)" -ForegroundColor Yellow
$mainLog = Join-Path $InstallDir "NetworkMonitorService.log"
if (Test-Path $mainLog) {
    $mainContent = Get-Content $mainLog -Tail 100 -ErrorAction SilentlyContinue
    if ($mainContent) {
        Write-Host $mainContent
    } else {
        Write-Host "  Log vuoto" -ForegroundColor Yellow
    }
} else {
    Write-Host "  File non trovato" -ForegroundColor Yellow
}
Write-Host ""

# 3. Cerca errori specifici
Write-Host "[3] ERRORI TROVATI" -ForegroundColor Yellow
if (Test-Path $mainLog) {
    $allLogs = Get-Content $mainLog -ErrorAction SilentlyContinue
    if ($allLogs) {
        # Cerca errori critici
        $errors = $allLogs | Select-String -Pattern "ERROR|Exception|ParserError|UnexpectedToken|Cannot.*start|Failed.*start|Trust ARP|activeIPs|arpTable" -CaseSensitive:$false | Select-Object -Last 20
        if ($errors) {
            Write-Host "  Errori trovati:" -ForegroundColor Red
            $errors | ForEach-Object {
                Write-Host "    $_" -ForegroundColor Red
            }
        } else {
            Write-Host "  Nessun errore trovato negli ultimi log" -ForegroundColor Green
        }
    }
} else {
    Write-Host "  Log non disponibile" -ForegroundColor Yellow
}
Write-Host ""

# 4. Verifica se ci sono errori di sintassi runtime
Write-Host "[4] VERIFICA ERRORI SINTASSI RUNTIME" -ForegroundColor Yellow
$serviceFile = Join-Path $InstallDir "NetworkMonitorService.ps1"
if (Test-Path $serviceFile) {
    Write-Host "  Testando esecuzione con -WhatIf..." -ForegroundColor Yellow
    try {
        $testOutput = powershell.exe -NoProfile -Command "& { `$ErrorActionPreference='Stop'; . '$serviceFile' -WhatIf 2>&1 }" 2>&1
        if ($LASTEXITCODE -ne 0 -or $testOutput -match "error|exception|parsererror") {
            Write-Host "  ERRORE TROVATO:" -ForegroundColor Red
            Write-Host $testOutput
        } else {
            Write-Host "  Test esecuzione: OK" -ForegroundColor Green
        }
    } catch {
        Write-Host "  Errore durante test: $_" -ForegroundColor Red
    }
} else {
    Write-Host "  File non trovato" -ForegroundColor Yellow
}
Write-Host ""

# 5. Verifica configurazione
Write-Host "[5] VERIFICA CONFIGURAZIONE" -ForegroundColor Yellow
$configPath = Join-Path $InstallDir "config.json"
if (Test-Path $configPath) {
    try {
        $config = Get-Content $configPath -Raw | ConvertFrom-Json
        Write-Host "  Server URL: $($config.server_url)" -ForegroundColor Green
        Write-Host "  Agent Name: $($config.agent_name)" -ForegroundColor Green
        if ($config.network_ranges) {
            Write-Host "  Network Ranges: $($config.network_ranges -join ', ')" -ForegroundColor Green
        } else {
            Write-Host "  ATTENZIONE: Network Ranges non configurato!" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  ERRORE lettura config: $_" -ForegroundColor Red
    }
} else {
    Write-Host "  ERRORE: config.json non trovato!" -ForegroundColor Red
}
Write-Host ""

Write-Host "Premi un tasto per continuare..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
