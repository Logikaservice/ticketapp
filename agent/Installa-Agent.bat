@echo off
REM Installa-Agent.bat
REM Installer completo Network Monitor Agent - SOLO COMANDI NATIVI WINDOWS
REM Non richiede PowerShell

setlocal enabledelayedexpansion

REM Verifica privilegi amministratore
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo ERRORE: Questo script richiede privilegi amministratore!
    echo Esegui come amministratore e riprova.
    echo.
    pause
    exit /b 1
)

REM Directory corrente (dove si trova lo script)
set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

REM Directory di installazione
set "INSTALL_DIR=C:\ProgramData\NetworkMonitorAgent"
set "SERVICE_NAME=NetworkMonitorService"

REM Leggi versione da NetworkMonitorService.ps1 (se possibile)
set "AGENT_VERSION=1.0.0"
if exist "%SCRIPT_DIR%\NetworkMonitorService.ps1" (
    findstr /R /C:"\$SCRIPT_VERSION\s*=\s*\"[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\"" "%SCRIPT_DIR%\NetworkMonitorService.ps1" >nul 2>&1
    if !errorLevel! equ 0 (
        for /f "tokens=2 delims==" %%a in ('findstr /R /C:"\$SCRIPT_VERSION\s*=\s*\"[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\"" "%SCRIPT_DIR%\NetworkMonitorService.ps1"') do (
            set "VERSION_LINE=%%a"
            set "VERSION_LINE=!VERSION_LINE:"=!"
            set "VERSION_LINE=!VERSION_LINE: =!"
            set "AGENT_VERSION=!VERSION_LINE!"
        )
    )
)

echo.
echo ========================================
echo   Network Monitor Agent v%AGENT_VERSION%
echo   Installer Completo
echo ========================================
echo.

REM 1. VERIFICA FILE NECESSARI
echo 1. VERIFICA FILE NECESSARI
set "FILES_OK=1"
if not exist "%SCRIPT_DIR%\NetworkMonitorService.ps1" (
    echo    [X] NetworkMonitorService.ps1 NON TROVATO!
    set "FILES_OK=0"
) else (
    echo    [OK] NetworkMonitorService.ps1
)
if not exist "%SCRIPT_DIR%\config.json" (
    echo    [X] config.json NON TROVATO!
    set "FILES_OK=0"
) else (
    echo    [OK] config.json
)
if not exist "%SCRIPT_DIR%\nssm.exe" (
    echo    [X] nssm.exe NON TROVATO!
    set "FILES_OK=0"
) else (
    echo    [OK] nssm.exe
)

if %FILES_OK% equ 0 (
    echo.
    echo ERRORE: File mancanti!
    echo Assicurati di eseguire lo script dalla directory dell'agent.
    pause
    exit /b 1
)
echo.

REM 2. PREPARAZIONE DIRECTORY
echo 2. PREPARAZIONE DIRECTORY
if not exist "%INSTALL_DIR%" (
    mkdir "%INSTALL_DIR%" >nul 2>&1
    if !errorLevel! neq 0 (
        echo    [X] Impossibile creare directory: %INSTALL_DIR%
        pause
        exit /b 1
    )
    echo    [OK] Directory creata: %INSTALL_DIR%
) else (
    echo    [OK] Directory esistente: %INSTALL_DIR%
)
echo.

REM 3. GESTIONE SERVIZIO ESISTENTE
echo 3. GESTIONE SERVIZIO ESISTENTE
sc query "%SERVICE_NAME%" >nul 2>&1
if !errorLevel! equ 0 (
    sc query "%SERVICE_NAME%" | findstr /C:"RUNNING" >nul 2>&1
    if !errorLevel! equ 0 (
        echo    Arresto servizio esistente...
        sc stop "%SERVICE_NAME%" >nul 2>&1
        timeout /t 3 /nobreak >nul
        echo    [OK] Servizio arrestato
    ) else (
        echo    [INFO] Servizio gia' fermo
    )
) else (
    echo    [INFO] Nessun servizio esistente
)
echo.

REM 4. COPIA FILE
echo 4. COPIA FILE
set "FILES_COPIED=0"
set "FILES_FAILED=0"

REM File obbligatori
for %%F in (
    "NetworkMonitorService.ps1"
    "NetworkMonitorTrayIcon.ps1"
    "Start-TrayIcon-Hidden.vbs"
    "config.json"
    "nssm.exe"
) do (
    if exist "%SCRIPT_DIR%\%%~F" (
        copy /Y "%SCRIPT_DIR%\%%~F" "%INSTALL_DIR%\%%~F" >nul 2>&1
        if !errorLevel! equ 0 (
            echo    [OK] %%~F
            set /a FILES_COPIED+=1
        ) else (
            echo    [X] %%~F (fallito)
            set /a FILES_FAILED+=1
        )
    ) else (
        if "%%~F"=="NetworkMonitorTrayIcon.ps1" (
            echo    [INFO] %%~F non trovato (opzionale)
        ) else (
            if "%%~F"=="Start-TrayIcon-Hidden.vbs" (
                echo    [INFO] %%~F non trovato (opzionale)
            ) else (
                echo    [X] %%~F non trovato
                set /a FILES_FAILED+=1
            )
        )
    )
)

REM File opzionali
for %%F in (
    "Avvia-TrayIcon.bat"
    "Verifica-TrayIcon.ps1"
    "Verifica-Servizio.ps1"
    "Ripara-Servizio.ps1"
    "Diagnostica-Servizio.ps1"
) do (
    if exist "%SCRIPT_DIR%\%%~F" (
        copy /Y "%SCRIPT_DIR%\%%~F" "%INSTALL_DIR%\%%~F" >nul 2>&1
        if !errorLevel! equ 0 (
            echo    [OK] %%~F (opzionale)
        )
    )
)

if %FILES_FAILED% gtr 0 (
    echo.
    echo ATTENZIONE: %FILES_FAILED% file non copiati!
    echo Prova a chiudere eventuali processi in esecuzione.
)
echo.
echo    [OK] %FILES_COPIED% file copiati con successo
echo.

REM 5. AGGIORNAMENTO CONFIGURAZIONE
echo 5. AGGIORNAMENTO CONFIGURAZIONE
if exist "%INSTALL_DIR%\config.json" (
    REM Aggiorna versione nel config.json usando PowerShell solo per questo
    powershell -NoProfile -Command "$config = Get-Content '%INSTALL_DIR%\config.json' -Raw | ConvertFrom-Json; $config.version = '%AGENT_VERSION%'; $config | ConvertTo-Json -Depth 10 | Set-Content -Path '%INSTALL_DIR%\config.json' -Encoding UTF8" >nul 2>&1
    if !errorLevel! equ 0 (
        echo    [OK] Versione aggiornata in config.json: %AGENT_VERSION%
    ) else (
        echo    [INFO] Impossibile aggiornare versione in config.json (non critico)
    )
)
echo.

REM 6. INSTALLAZIONE SERVIZIO WINDOWS
echo 6. INSTALLAZIONE SERVIZIO WINDOWS
set "NSSM_PATH=%INSTALL_DIR%\nssm.exe"
set "SERVICE_SCRIPT=%INSTALL_DIR%\NetworkMonitorService.ps1"
set "CONFIG_PATH=%INSTALL_DIR%\config.json"

REM Trova PowerShell
set "PS_PATH=C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS_PATH%" (
    set "PS_PATH=C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe"
)

if not exist "%PS_PATH%" (
    echo    [X] PowerShell non trovato!
    pause
    exit /b 1
)

REM Rimuovi servizio esistente se presente
sc query "%SERVICE_NAME%" >nul 2>&1
if !errorLevel! equ 0 (
    "%NSSM_PATH%" remove "%SERVICE_NAME%" confirm >nul 2>&1
    timeout /t 2 /nobreak >nul
)

REM Installa servizio
set "APP_PARAMS=-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File \"%SERVICE_SCRIPT%\" -ConfigPath \"%CONFIG_PATH%\""
"%NSSM_PATH%" install "%SERVICE_NAME%" "%PS_PATH%" %APP_PARAMS%
if !errorLevel! equ 0 (
    echo    [OK] Servizio installato
    
    REM Configura servizio
    "%NSSM_PATH%" set "%SERVICE_NAME%" AppDirectory "%INSTALL_DIR%" >nul 2>&1
    "%NSSM_PATH%" set "%SERVICE_NAME%" Application "%PS_PATH%" >nul 2>&1
    "%NSSM_PATH%" set "%SERVICE_NAME%" AppParameters %APP_PARAMS% >nul 2>&1
    "%NSSM_PATH%" set "%SERVICE_NAME%" DisplayName "Network Monitor Agent Service" >nul 2>&1
    "%NSSM_PATH%" set "%SERVICE_NAME%" Description "Servizio permanente per il monitoraggio della rete locale e invio dati al sistema TicketApp" >nul 2>&1
    "%NSSM_PATH%" set "%SERVICE_NAME%" Start SERVICE_AUTO_START >nul 2>&1
    "%NSSM_PATH%" set "%SERVICE_NAME%" AppRestartDelay 60000 >nul 2>&1
    "%NSSM_PATH%" set "%SERVICE_NAME%" AppExit Default Restart >nul 2>&1
    
    REM Configura log
    set "STDOUT_LOG=%INSTALL_DIR%\NetworkMonitorService_stdout.log"
    set "STDERR_LOG=%INSTALL_DIR%\NetworkMonitorService_stderr.log"
    "%NSSM_PATH%" set "%SERVICE_NAME%" AppStdout "%STDOUT_LOG%" >nul 2>&1
    "%NSSM_PATH%" set "%SERVICE_NAME%" AppStderr "%STDERR_LOG%" >nul 2>&1
    "%NSSM_PATH%" set "%SERVICE_NAME%" AppRotateFiles 1 >nul 2>&1
    "%NSSM_PATH%" set "%SERVICE_NAME%" AppRotateOnline 1 >nul 2>&1
    "%NSSM_PATH%" set "%SERVICE_NAME%" AppRotateSeconds 86400 >nul 2>&1
    "%NSSM_PATH%" set "%SERVICE_NAME%" AppRotateBytes 10485760 >nul 2>&1
    
    echo    [OK] Configurazione servizio completata
) else (
    echo    [X] Errore installazione servizio!
    pause
    exit /b 1
)
echo.

REM 7. AVVIO SERVIZIO
echo 7. AVVIO SERVIZIO
sc start "%SERVICE_NAME%" >nul 2>&1
if !errorLevel! equ 0 (
    timeout /t 3 /nobreak >nul
    sc query "%SERVICE_NAME%" | findstr /C:"RUNNING" >nul 2>&1
    if !errorLevel! equ 0 (
        echo    [OK] Servizio avviato correttamente
    ) else (
        echo    [INFO] Servizio avviato ma stato sconosciuto
    )
) else (
    echo    [X] Errore avvio servizio
    echo    Controlla i log in %INSTALL_DIR%
)
echo.

REM 8. CONFIGURAZIONE TRAY ICON (opzionale)
echo 8. CONFIGURAZIONE TRAY ICON
set "VBS_LAUNCHER=%INSTALL_DIR%\Start-TrayIcon-Hidden.vbs"
if exist "%VBS_LAUNCHER%" (
    REM Configura avvio automatico
    reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "NetworkMonitorTrayIcon" /t REG_SZ /d "wscript.exe \"%VBS_LAUNCHER%\"" /f >nul 2>&1
    
    REM Avvia tray icon
    start "" wscript.exe "%VBS_LAUNCHER%"
    timeout /t 2 /nobreak >nul
    
    echo    [OK] Tray icon configurata e avviata
    echo    [INFO] Se non vedi l'icona, controlla l'area nascosta della system tray
) else (
    echo    [INFO] Tray icon non disponibile
)
echo.

REM Riepilogo
echo ========================================
echo   Installazione Completata!
echo ========================================
echo.
echo Versione Agent: %AGENT_VERSION%
echo Directory: %INSTALL_DIR%
echo Servizio: %SERVICE_NAME%
echo.
echo Log files:
echo   - %INSTALL_DIR%\NetworkMonitorService.log
echo   - %INSTALL_DIR%\NetworkMonitorService_stdout.log
echo   - %INSTALL_DIR%\NetworkMonitorService_stderr.log
echo.
echo Per verificare lo stato:
echo   sc query %SERVICE_NAME%
echo.
pause
