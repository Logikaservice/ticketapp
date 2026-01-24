@echo off
REM Avvia-TrayIcon.bat
REM Script per avviare manualmente la tray icon

setlocal

set "INSTALL_DIR=C:\ProgramData\NetworkMonitorAgent"
set "VBS_LAUNCHER=%INSTALL_DIR%\Start-TrayIcon-Hidden.vbs"
set "PS_SCRIPT=%INSTALL_DIR%\NetworkMonitorTrayIcon.ps1"

echo.
echo ========================================
echo   Avvio Tray Icon Network Monitor Agent
echo ========================================
echo.

REM Verifica che i file esistano
if not exist "%PS_SCRIPT%" (
    echo ERRORE: NetworkMonitorTrayIcon.ps1 non trovato in %INSTALL_DIR%
    pause
    exit /b 1
)

REM Prova prima con VBS (piu' pulito)
if exist "%VBS_LAUNCHER%" (
    echo Tentativo avvio tramite Start-TrayIcon-Hidden.vbs...
    wscript.exe "%VBS_LAUNCHER%"
    if %errorLevel% equ 0 (
        echo Tray icon avviata con successo!
        timeout /t 2 /nobreak >nul
        
        REM Verifica che il processo sia in esecuzione
        tasklist | findstr /i "wscript.exe" >nul
        if %errorLevel% equ 0 (
            echo Processo wscript.exe trovato in esecuzione
            echo L'icona dovrebbe essere visibile nella system tray
        ) else (
            echo ATTENZIONE: wscript.exe non trovato in esecuzione
            echo Il processo potrebbe essere terminato prematuramente
        )
    ) else (
        echo ERRORE: Impossibile avviare tramite VBS
        echo Provo con PowerShell diretto...
        echo.
        goto :powerShellDirect
    )
) else (
    echo Start-TrayIcon-Hidden.vbs non trovato, uso PowerShell diretto...
    goto :powerShellDirect
)

goto :end

:powerShellDirect
echo Avvio tramite PowerShell diretto...
set "CONFIG_PATH=%INSTALL_DIR%\config.json"
set "STATUS_FILE=%INSTALL_DIR%\.agent_status.json"
set "SCAN_IPS_FILE=%INSTALL_DIR%\.current_scan_ips.json"

powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -NoProfile -File "%PS_SCRIPT%" -ConfigPath "%CONFIG_PATH%" -StatusFilePath "%STATUS_FILE%" -CurrentScanIPsPath "%SCAN_IPS_FILE%"

if %errorLevel% equ 0 (
    echo Tray icon avviata con successo!
    timeout /t 2 /nobreak >nul
    
    REM Verifica che il processo sia in esecuzione
    tasklist | findstr /i "powershell.exe" >nul
    if %errorLevel% equ 0 (
        echo Processo PowerShell trovato in esecuzione
        echo L'icona dovrebbe essere visibile nella system tray
    ) else (
        echo ATTENZIONE: PowerShell non trovato in esecuzione
    )
) else (
    echo ERRORE: Impossibile avviare tray icon
)

:end
echo.
echo ========================================
echo.
echo Se l'icona non compare, controlla:
echo   1. La system tray potrebbe essere nascosta (clicca sulla freccia ^^)
echo   2. Verifica che il processo sia in esecuzione:
echo      tasklist | findstr /i "wscript powershell"
echo   3. Verifica eventuali errori nei log:
echo      type %INSTALL_DIR%\NetworkMonitorTrayIcon.log
echo.
exit /b 0
