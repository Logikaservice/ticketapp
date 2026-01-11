@echo off
REM Installa.bat
REM Installer batch per Network Monitor Service
REM Questo file richiede automaticamente privilegi admin e avvia l'installer PowerShell

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
echo   Network Monitor Service - Installer
echo ========================================
echo.

REM Determina directory corrente (dove si trova il batch)
set "SCRIPT_DIR=%~dp0"
set "INSTALL_DIR=C:\ProgramData\NetworkMonitorAgent"

REM Cambia alla directory dello script
cd /d "%SCRIPT_DIR%"

REM Verifica che i file necessari siano presenti
if not exist "config.json" (
    echo ERRORE: config.json non trovato nella directory corrente!
    echo.
    echo Assicurati di eseguire questo file dalla directory contenente tutti i file dell'agent.
    echo.
    pause
    exit /b 1
)

if not exist "NetworkMonitorService.ps1" (
    echo ERRORE: NetworkMonitorService.ps1 non trovato nella directory corrente!
    echo.
    pause
    exit /b 1
)

if not exist "Installa-Automatico.ps1" (
    echo ERRORE: Installa-Automatico.ps1 non trovato nella directory corrente!
    echo.
    pause
    exit /b 1
)

REM Se la directory corrente è diversa da quella di installazione, copia i file
if not "%SCRIPT_DIR%"=="%INSTALL_DIR%\" (
    echo Copia file in directory installazione...
    echo.
    
    REM Crea directory installazione se non esiste
    if not exist "%INSTALL_DIR%" (
        mkdir "%INSTALL_DIR%"
    )
    
    REM Copia tutti i file necessari
    copy /Y "config.json" "%INSTALL_DIR%\"
    copy /Y "NetworkMonitorService.ps1" "%INSTALL_DIR%\"
    copy /Y "Installa-Servizio.ps1" "%INSTALL_DIR%\"
    copy /Y "Installa-Automatico.ps1" "%INSTALL_DIR%\"
    if exist "Rimuovi-Servizio.ps1" copy /Y "Rimuovi-Servizio.ps1" "%INSTALL_DIR%\"
    if exist "NetworkMonitor.ps1" copy /Y "NetworkMonitor.ps1" "%INSTALL_DIR%\"
    if exist "InstallerCompleto.ps1" copy /Y "InstallerCompleto.ps1" "%INSTALL_DIR%\"
    if exist "Diagnostica-Agent.ps1" copy /Y "Diagnostica-Agent.ps1" "%INSTALL_DIR%\"
    if exist "README_SERVICE.md" copy /Y "README_SERVICE.md" "%INSTALL_DIR%\"
    if exist "GUIDA_INSTALLAZIONE_SERVIZIO.md" copy /Y "GUIDA_INSTALLAZIONE_SERVIZIO.md" "%INSTALL_DIR%\"
    if exist "nssm.exe" copy /Y "nssm.exe" "%INSTALL_DIR%\"
    
    echo File copiati con successo!
    echo.
)

REM Esegui installer PowerShell con privilegi admin
echo Esecuzione installer PowerShell...
echo.

cd /d "%INSTALL_DIR%"
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "Installa-Automatico.ps1"

if %errorLevel% equ 0 (
    echo.
    echo ========================================
    echo   INSTALLAZIONE COMPLETATA!
    echo ========================================
    echo.
) else (
    echo.
    echo ERRORE durante l'installazione!
    echo.
)

pause
