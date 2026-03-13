@echo off
:: ============================================================
::  FIX-Agent-Restart.bat
::  Ripristina e riavvia il servizio NetworkMonitorAgent
::  Esegui come Amministratore (doppio clic -> Si' all'UAC)
:: ============================================================

:: Auto-elevazione amministratore
net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo Richiedendo privilegi amministratore...
    powershell -Command "Start-Process cmd -ArgumentList '/c \"%~f0\"' -Verb RunAs"
    exit /b
)

echo.
echo ============================================================
echo   RIPRISTINO AGENT LOGIKA SERVICE
echo ============================================================
echo.

set AGENT_DIR=C:\ProgramData\NetworkMonitorAgent
set SCRIPT_URL=https://ticket.logikaservice.it/agent-updates/NetworkMonitorService.ps1
set SERVICE_NAME=NetworkMonitorService

echo [1/4] Arresto servizio...
sc stop %SERVICE_NAME% >nul 2>&1
timeout /t 5 /nobreak >nul

echo [2/4] Download script aggiornato dal server...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { Invoke-WebRequest '%SCRIPT_URL%' -OutFile '%AGENT_DIR%\NetworkMonitorService.ps1' -UseBasicParsing; Write-Host 'Download OK' } catch { Write-Host ('ERRORE download: ' + $_.Exception.Message) }"

echo [3/4] Avvio servizio...
sc start %SERVICE_NAME% >nul 2>&1
timeout /t 5 /nobreak >nul

echo [4/4] Verifica stato...
sc query %SERVICE_NAME% | findstr "STATO"

echo.
echo ============================================================
echo  COMPLETATO! Chiudi questa finestra.
echo ============================================================
echo.
pause
