@echo off
REM Installa-Agent.bat
REM Batch file per installazione rapida Network Monitor Agent
REM Può essere convertito in .exe con strumenti come Bat To Exe Converter

echo ========================================
echo Network Monitor Agent - Installer
echo ========================================
echo.

REM Verifica PowerShell
powershell -Command "if ($PSVersionTable.PSVersion.Major -lt 5) { Write-Host 'PowerShell 5.1+ richiesto!' -ForegroundColor Red; exit 1 }"

REM Esegui lo script PowerShell installer
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0NetworkMonitorInstaller.ps1"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Installazione completata con successo!
    echo ========================================
    pause
) else (
    echo.
    echo ========================================
    echo Errore durante l'installazione!
    echo ========================================
    pause
    exit /b 1
)
