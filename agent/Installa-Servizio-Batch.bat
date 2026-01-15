@echo off
REM Installa-Servizio-Batch.bat
REM Installer completo in batch puro (senza dipendere da PowerShell per l'installazione)
REM Usa direttamente NSSM per installare il servizio Windows

setlocal enabledelayedexpansion

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
echo   Network Monitor Service - Installer Batch
echo ========================================
echo.

REM Determina directory corrente (dove si trova il batch)
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

REM Directory di installazione fissa
set "INSTALL_DIR=C:\ProgramData\NetworkMonitorAgent"
set "SERVICE_NAME=NetworkMonitorService"

echo Directory sorgente: %SCRIPT_DIR%
echo Directory installazione: %INSTALL_DIR%
echo.

REM Verifica file necessari
if not exist "NetworkMonitorService.ps1" (
    echo ERRORE: NetworkMonitorService.ps1 non trovato!
    pause
    exit /b 1
)

if not exist "config.json" (
    echo ERRORE: config.json non trovato!
    pause
    exit /b 1
)

if not exist "nssm.exe" (
    echo ERRORE: nssm.exe non trovato!
    pause
    exit /b 1
)

echo [1/6] Creazione directory installazione...
if not exist "%INSTALL_DIR%" (
    mkdir "%INSTALL_DIR%" 2>nul
    if %errorLevel% neq 0 (
        echo ERRORE: Impossibile creare directory %INSTALL_DIR%
        pause
        exit /b 1
    )
)
echo OK
echo.

REM Ferma servizio esistente se presente
echo [2/6] Verifica servizio esistente...
sc query %SERVICE_NAME% >nul 2>&1
if %errorLevel% equ 0 (
    echo Servizio esistente trovato. Arresto...
    sc stop %SERVICE_NAME% >nul 2>&1
    timeout /t 2 /nobreak >nul
    
    REM Rimuovi servizio esistente
    echo Rimozione servizio esistente...
    "%SCRIPT_DIR%nssm.exe" remove %SERVICE_NAME% confirm >nul 2>&1
    timeout /t 2 /nobreak >nul
    echo OK
) else (
    echo Nessun servizio esistente
)
echo.

REM Copia file necessari
echo [3/6] Copia file nella directory di installazione...
set "FILES_TO_COPY=NetworkMonitorService.ps1 NetworkMonitorTrayIcon.ps1 Start-TrayIcon-Hidden.vbs config.json nssm.exe Installa-Servizio.ps1 Installa-Automatico.ps1 Rimuovi-Servizio.ps1 Diagnostica-Servizio.ps1 Verifica-Servizio.ps1 Ripara-Servizio.ps1 Installa-Servizio.bat Installa-Servizio-Batch.bat"

for %%f in (%FILES_TO_COPY%) do (
    if exist "%%f" (
        copy /Y "%%f" "%INSTALL_DIR%\" >nul 2>&1
        if !errorLevel! equ 0 (
            echo   Copiato: %%f
        ) else (
            echo   ATTENZIONE: Impossibile copiare %%f (potrebbe essere in uso)
        )
    )
)
echo OK
echo.

REM Trova percorso PowerShell
echo [4/6] Configurazione servizio...
set "PS_PATH=C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS_PATH%" (
    set "PS_PATH=C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe"
)
if not exist "%PS_PATH%" (
    echo ERRORE: PowerShell non trovato!
    pause
    exit /b 1
)
echo PowerShell trovato: %PS_PATH%
echo.

REM Installa servizio con NSSM
echo [5/6] Installazione servizio Windows...
set "SCRIPT_PATH=%INSTALL_DIR%\NetworkMonitorService.ps1"
set "CONFIG_PATH=%INSTALL_DIR%\config.json"
set "APP_PARAMS=-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File "%SCRIPT_PATH%" -ConfigPath "%CONFIG_PATH%""

REM Installa servizio
"%INSTALL_DIR%\nssm.exe" install %SERVICE_NAME% "%PS_PATH%" %APP_PARAMS%
if %errorLevel% neq 0 (
    echo ERRORE: Impossibile installare servizio!
    pause
    exit /b 1
)

REM Configura directory di lavoro
"%INSTALL_DIR%\nssm.exe" set %SERVICE_NAME% AppDirectory "%INSTALL_DIR%"
if %errorLevel% neq 0 (
    echo ATTENZIONE: Impossibile impostare AppDirectory
)

REM Forza Application a powershell.exe (evita problemi)
"%INSTALL_DIR%\nssm.exe" set %SERVICE_NAME% Application "%PS_PATH%"
if %errorLevel% neq 0 (
    echo ATTENZIONE: Impossibile impostare Application
)

REM Forza AppParameters con percorsi assoluti
"%INSTALL_DIR%\nssm.exe" set %SERVICE_NAME% AppParameters %APP_PARAMS%
if %errorLevel% neq 0 (
    echo ATTENZIONE: Impossibile impostare AppParameters
)

REM Configura display name e descrizione
"%INSTALL_DIR%\nssm.exe" set %SERVICE_NAME% DisplayName "Network Monitor Agent Service"
"%INSTALL_DIR%\nssm.exe" set %SERVICE_NAME% Description "Servizio permanente per il monitoraggio della rete locale e invio dati al sistema TicketApp"

REM Configura start type (Automatico)
"%INSTALL_DIR%\nssm.exe" set %SERVICE_NAME% Start SERVICE_AUTO_START

REM Configura restart automatico
"%INSTALL_DIR%\nssm.exe" set %SERVICE_NAME% AppRestartDelay 60000
"%INSTALL_DIR%\nssm.exe" set %SERVICE_NAME% AppExit Default Restart
"%INSTALL_DIR%\nssm.exe" set %SERVICE_NAME% AppStopMethodSkip 0

REM Configura log
set "STDOUT_LOG=%INSTALL_DIR%\NetworkMonitorService_stdout.log"
set "STDERR_LOG=%INSTALL_DIR%\NetworkMonitorService_stderr.log"
"%INSTALL_DIR%\nssm.exe" set %SERVICE_NAME% AppStdout "%STDOUT_LOG%"
"%INSTALL_DIR%\nssm.exe" set %SERVICE_NAME% AppStderr "%STDERR_LOG%"
"%INSTALL_DIR%\nssm.exe" set %SERVICE_NAME% AppRotateFiles 1
"%INSTALL_DIR%\nssm.exe" set %SERVICE_NAME% AppRotateOnline 1
"%INSTALL_DIR%\nssm.exe" set %SERVICE_NAME% AppRotateSeconds 86400
"%INSTALL_DIR%\nssm.exe" set %SERVICE_NAME% AppRotateBytes 10485760

echo OK
echo.

REM 6. Configurazione avvio automatico tray icon
echo [6/7] Configurazione avvio automatico tray icon...
set "VBS_LAUNCHER=%INSTALL_DIR%\Start-TrayIcon-Hidden.vbs"
if exist "%VBS_LAUNCHER%" (
    REM Configura avvio automatico nel registro
    reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "NetworkMonitorTrayIcon" /t REG_SZ /d "wscript.exe \"%VBS_LAUNCHER%\"" /f >nul 2>&1
    if !errorLevel! equ 0 (
        echo Avvio automatico configurato nel registro
    ) else (
        echo ATTENZIONE: Impossibile configurare avvio automatico
    )
    
    REM Avvia immediatamente la tray icon
    echo Avvio tray icon...
    wscript.exe "%VBS_LAUNCHER%" >nul 2>&1
    timeout /t 2 /nobreak >nul
    echo Tray icon avviata
) else (
    echo ATTENZIONE: Start-TrayIcon-Hidden.vbs non trovato, tray icon non configurata
)
echo.

REM 7. Avvia servizio
echo [7/7] Avvio servizio...
sc start %SERVICE_NAME% >nul 2>&1
timeout /t 3 /nobreak >nul

REM Verifica stato
sc query %SERVICE_NAME% | findstr /C:"RUNNING" >nul
if %errorLevel% equ 0 (
    echo.
    echo ========================================
    echo   Installazione completata con successo!
    echo ========================================
    echo.
    echo Servizio: %SERVICE_NAME%
    echo Stato: RUNNING
    echo Directory: %INSTALL_DIR%
    echo.
    echo Log files:
    echo   - %STDOUT_LOG%
    echo   - %STDERR_LOG%
    echo   - %INSTALL_DIR%\NetworkMonitorService.log
    echo   - %INSTALL_DIR%\NetworkMonitorService_bootstrap.log
    echo.
) else (
    echo.
    echo ========================================
    echo   ATTENZIONE: Servizio installato ma non avviato
    echo ========================================
    echo.
    echo Il servizio e' stato installato ma non e' riuscito ad avviarsi.
    echo.
    echo Controlla i log per dettagli:
    echo   - %STDERR_LOG%
    echo   - %INSTALL_DIR%\NetworkMonitorService_bootstrap.log
    echo.
    echo Comandi utili:
    echo   - Verifica stato: sc query %SERVICE_NAME%
    echo   - Avvia manualmente: sc start %SERVICE_NAME%
    echo   - Verifica configurazione: "%INSTALL_DIR%\nssm.exe" get %SERVICE_NAME% Application
    echo   - Diagnostica: "%INSTALL_DIR%\Verifica-Servizio.ps1"
    echo.
)

pause
