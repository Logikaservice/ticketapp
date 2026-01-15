@echo off
REM Installa-Servizio.bat
REM Wrapper batch per Installa-Servizio.ps1
REM Bypassa automaticamente l'execution policy di PowerShell

REM Verifica privilegi admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo Richiesta autorizzazioni amministratore...
    echo.
    
    REM Riavvia il batch con privilegi admin
    powershell -Command "Start-Process '%~f0' -Verb RunAs -Wait"
    exit /b %errorLevel%
)

REM Se arriviamo qui, abbiamo privilegi admin
echo.
echo ========================================
echo   Network Monitor Service - Installa Servizio
echo ========================================
echo.

REM Determina directory corrente (dove si trova il batch)
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

REM Verifica che i file necessari siano presenti
if not exist "Installa-Servizio.ps1" (
    echo ERRORE: Installa-Servizio.ps1 non trovato nella directory corrente!
    echo.
    echo Percorso cercato: %SCRIPT_DIR%Installa-Servizio.ps1
    echo.
    pause
    exit /b 1
)

REM Esegui lo script PowerShell con ExecutionPolicy Bypass
echo Esecuzione Installa-Servizio.ps1...
echo.

powershell.exe -ExecutionPolicy Bypass -NoProfile -File "Installa-Servizio.ps1" -RemoveOldTask %*

if %errorLevel% equ 0 (
    echo.
    echo ========================================
    echo   Installazione completata!
    echo ========================================
    echo.
) else (
    echo.
    echo ERRORE durante l'installazione!
    echo.
)

pause
