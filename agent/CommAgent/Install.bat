@echo off
TITLE Installazione Logika Service Agent
COLOR 0A

echo ========================================================
echo   Installazione Logika Service Agent in corso...
echo ========================================================
echo.
echo   Richiesta permessi di amministratore...
echo.

:: Check for admin rights
net session >nul 2>&1
if %errorLevel% == 0 (
    echo   [OK] Permessi amministratore confermati.
) else (
    echo   [INFO] Rilancio come amministratore...
    PowerShell -Command "Start-Process '%~0' -Verb RunAs"
    exit /b
)

:: Run PowerShell script with Bypass policy
echo   [INFO] Avvio script di installazione...
cd /d "%~dp0"
PowerShell -NoProfile -ExecutionPolicy Bypass -File "Install-CommAgent.ps1"

if %errorLevel% neq 0 (
    echo.
    echo   [ERRORE] L'installazione ha riscontrato un problema.
    pause
    exit /b %errorLevel%
)

echo.
echo   [OK] Script completato.
exit /b 0
