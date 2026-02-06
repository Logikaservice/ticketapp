@echo off
:: Verifica privilegi di amministratore
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"
if '%errorlevel%' NEQ '0' (
    echo Richiesta privilegi di amministratore...
    goto UACPrompt
) else ( goto gotAdmin )

:UACPrompt
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
    echo UAC.ShellExecute "%~s0", "", "", "runas", 1 >> "%temp%\getadmin.vbs"
    "%temp%\getadmin.vbs"
    exit /B

:gotAdmin
    if exist "%temp%\getadmin.vbs" ( del "%temp%\getadmin.vbs" )
    pushd "%CD%"
    CD /D "%~dp0"

    echo ==========================================
    echo Riavvio Servizio Network Monitor Agent
    echo ==========================================
    echo.
    
    echo 1. Arresto del servizio...
    net stop NetworkMonitorService
    
    echo.
    echo 2. Avvio del servizio...
    net start NetworkMonitorService
    
    echo.
    echo ==========================================
    echo Operazione completata. 
    echo Verificare che il servizio sia "Avviato".
    echo ==========================================
    echo.
    pause
