# Uninstall-CommAgent.ps1
# Disinstalla il Logika Communication Agent

$INSTALL_DIR = "C:\ProgramData\LogikaCommAgent"
$STARTUP_NAME = "LogikaCommAgent"

# Richiedi elevation
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process -FilePath "powershell.exe" -ArgumentList "-ExecutionPolicy Bypass -File `"$($MyInvocation.MyCommand.Path)`"" -Verb RunAs
    exit
}

Write-Host ""
Write-Host "  Disinstallazione Logika Communication Agent..." -ForegroundColor Yellow
Write-Host ""

# 1. Termina processi
try {
    Get-Process -Name "powershell" -ErrorAction SilentlyContinue | Where-Object {
        $_.MainWindowTitle -like "*CommAgent*" -or
        ($_.CommandLine -and $_.CommandLine -like "*CommAgentService*")
    } | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host "  ✅ Processi terminati" -ForegroundColor Green
}
catch { }

# 2. Rimuovi Task Scheduler
try {
    schtasks /Delete /TN $STARTUP_NAME /F 2>$null | Out-Null
    Write-Host "  ✅ Task Scheduler rimosso" -ForegroundColor Green
}
catch { }

# 3. Rimuovi shortcut Startup
try {
    $startupFolder = [Environment]::GetFolderPath("Startup")
    $shortcutPath = Join-Path $startupFolder "$STARTUP_NAME.lnk"
    if (Test-Path $shortcutPath) {
        Remove-Item $shortcutPath -Force
    }
    Write-Host "  ✅ Shortcut Startup rimosso" -ForegroundColor Green
}
catch { }

# 4. Rimuovi directory installazione
try {
    if (Test-Path $INSTALL_DIR) {
        Remove-Item $INSTALL_DIR -Recurse -Force
        Write-Host "  ✅ Directory rimossa: $INSTALL_DIR" -ForegroundColor Green
    }
}
catch {
    Write-Host "  ⚠️  Errore rimozione directory: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  ✅ Disinstallazione completata!" -ForegroundColor Green
Write-Host ""
pause
