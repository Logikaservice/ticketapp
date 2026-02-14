@echo off
:: FixAgent.bat - Riparazione manuale e aggiornamento forzato
:: Copia i file aggiornati dalla cartella di sviluppo alla cartella di installazione

:: Elevazione privilegi
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

echo.
echo ==========================================
echo Riparazione Logika Agent (Versione 1.2.10)
echo ==========================================
echo.

echo 1. Chiusura processi agent...
taskkill /F /IM powershell.exe /FI "WINDOWTITLE eq LogikaCommAgent*"
taskkill /F /IM wscript.exe
timeout /t 2 /nobreak >nul

echo.
echo 2. Copia dei nuovi file (1.2.10)...
:: Assumiamo che questo BAT sia nella cartella c:\TicketApp\agent, e i sorgenti in CommAgent
set "SRC_DIR=%~dp0\CommAgent"
set "DEST_DIR=C:\ProgramData\LogikaCommAgent"

if not exist "%SRC_DIR%\CommAgentService.ps1" (
    echo ERRORE: File sorgenti non trovati in %SRC_DIR%
    pause
    exit /b
)

if not exist "%DEST_DIR%" (
    echo Creazione cartella destinazione...
    mkdir "%DEST_DIR%"
)

copy /Y "%SRC_DIR%\CommAgentService.ps1" "%DEST_DIR%\"
copy /Y "%SRC_DIR%\CommAgentNotifier.ps1" "%DEST_DIR%\"
copy /Y "%SRC_DIR%\Install.bat" "%DEST_DIR%\"

echo.
echo 3. Riavvio dell'agent...
if exist "%DEST_DIR%\Start-CommAgent-Hidden.vbs" (
    echo Avvio tramite VBS...
    start "" wscript.exe "%DEST_DIR%\Start-CommAgent-Hidden.vbs"
) else (
    echo VBS mancante, creo nuovo launcher...
    (
    echo Set WshShell = CreateObject^("WScript.Shell"^)
    echo WshShell.Run "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File ""%DEST_DIR%\CommAgentService.ps1""", 0, False
    ) > "%DEST_DIR%\Start-CommAgent-Hidden.vbs"
    start "" wscript.exe "%DEST_DIR%\Start-CommAgent-Hidden.vbs"
)

echo.
echo ==========================================
echo Operazione completata. 
echo L'agent e' stato aggiornato alla versione 1.2.10 e riavviato.
echo ==========================================
echo.
pause
