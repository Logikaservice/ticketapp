@echo off
REM Disinstalla-Tutto.bat
REM Disinstalla completamente Network Monitor Agent
REM Rimuove servizio, Scheduled Task, file e directory

echo.
echo ========================================
echo   Disinstallazione Network Monitor Agent
echo ========================================
echo.

REM Verifica privilegi admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Richiesta autorizzazioni amministratore...
    echo.
    
    REM Riavvia il batch con privilegi admin
    powershell -Command "Start-Process '%~f0' -Verb RunAs -Wait"
    exit /b %errorLevel%
)

REM Esegui script PowerShell
echo Esecuzione script disinstallazione...
echo.

cd /d "%~dp0"
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "Disinstalla-Tutto.ps1"

if %errorLevel% equ 0 (
    echo.
    echo ========================================
    echo   DISINSTALLAZIONE COMPLETATA
    echo ========================================
    echo.
) else (
    echo.
    echo ERRORE durante la disinstallazione!
    echo.
)

pause
