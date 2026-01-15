@echo off
REM Disinstalla-Tutto.bat
REM Disinstalla completamente Network Monitor Agent
REM Rimuove servizio, file e directory

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
echo   Disinstallazione Network Monitor Agent
echo ========================================
echo.
echo Questo script disinstallera completamente Network Monitor Agent:
echo   - Ferma e rimuove il servizio Windows
echo   - Termina processi in esecuzione
echo   - Rimuove tutti i file e la directory di installazione
echo.
set /p CONFIRM="Vuoi continuare? (S/N): "
if /i not "%CONFIRM%"=="S" if /i not "%CONFIRM%"=="Y" (
    echo.
    echo Disinstallazione annullata.
    pause
    exit /b 0
)
echo.

set "SERVICE_NAME=NetworkMonitorService"
set "INSTALL_DIR=C:\ProgramData\NetworkMonitorAgent"
set "NSSM_PATH=%INSTALL_DIR%\nssm.exe"

REM 1. Ferma e rimuovi servizio
echo [1/4] Fermo e rimuovo servizio Windows...
sc query %SERVICE_NAME% >nul 2>&1
if %errorLevel% equ 0 (
    echo Servizio trovato. Arresto...
    sc stop %SERVICE_NAME% >nul 2>&1
    timeout /t 2 /nobreak >nul
    
    echo Rimozione servizio...
    if exist "%NSSM_PATH%" (
        "%NSSM_PATH%" remove %SERVICE_NAME% confirm >nul 2>&1
    ) else (
        sc.exe delete %SERVICE_NAME% >nul 2>&1
    )
    timeout /t 2 /nobreak >nul
    
    REM Verifica rimozione
    sc query %SERVICE_NAME% >nul 2>&1
    if %errorLevel% equ 0 (
        echo ATTENZIONE: Servizio ancora presente, provo con sc.exe...
        sc.exe delete %SERVICE_NAME% >nul 2>&1
        timeout /t 1 /nobreak >nul
    ) else (
        echo Servizio rimosso con successo!
    )
) else (
    echo Servizio non trovato (gia' rimosso)
)
echo.

REM 2. Termina processi in esecuzione
echo [2/4] Termino processi in esecuzione...
REM Cerca processi PowerShell che potrebbero eseguire l'agent
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq powershell.exe" /FO CSV ^| find /C "powershell.exe"') do set PS_COUNT=%%a
if %PS_COUNT% gtr 0 (
    echo Trovati processi PowerShell, verifico se eseguono l'agent...
    REM Nota: Non possiamo facilmente verificare la command line in batch,
    REM quindi terminiamo solo se sono nella directory di installazione
    REM In alternativa, usiamo PowerShell per questo
    powershell -Command "Get-Process powershell* -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*NetworkMonitorAgent*' } | Stop-Process -Force -ErrorAction SilentlyContinue" >nul 2>&1
    timeout /t 1 /nobreak >nul
    echo Processi terminati
) else (
    echo Nessun processo trovato
)
echo.

REM 3. Rimuovi avvio automatico tray icon dal registro
echo [3/4] Rimuovo avvio automatico tray icon...
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "NetworkMonitorTrayIcon" /f >nul 2>&1
if %errorLevel% equ 0 (
    echo Avvio automatico rimosso
) else (
    echo Avvio automatico non trovato (gia' rimosso)
)
echo.

REM 4. Rimuovi directory di installazione
echo [4/4] Rimuovo directory di installazione...
if exist "%INSTALL_DIR%" (
    echo Directory trovata: %INSTALL_DIR%
    echo Rimozione file...
    
    REM Prova a rimuovere la directory
    rd /s /q "%INSTALL_DIR%" >nul 2>&1
    timeout /t 1 /nobreak >nul
    
    REM Verifica se e' ancora presente
    if exist "%INSTALL_DIR%" (
        echo ATTENZIONE: Directory ancora presente
        echo Alcuni file potrebbero essere in uso.
        echo.
        echo Prova a:
        echo   1. Chiudere tutte le finestre PowerShell
        echo   2. Riavviare il PC
        echo   3. Rieseguire questo script
        echo.
    ) else (
        echo Directory rimossa con successo!
    )
) else (
    echo Directory non trovata (gia' rimossa)
)
echo.

REM 5. Verifica rimozione completa
echo [5/5] Verifica rimozione completa...
set "ALL_REMOVED=1"

sc query %SERVICE_NAME% >nul 2>&1
if %errorLevel% equ 0 (
    echo   ATTENZIONE: Servizio ancora presente!
    set "ALL_REMOVED=0"
) else (
    echo   Servizio: rimosso
)

if exist "%INSTALL_DIR%" (
    echo   ATTENZIONE: Directory ancora presente!
    set "ALL_REMOVED=0"
) else (
    echo   Directory: rimossa
)
echo.

if %ALL_REMOVED% equ 1 (
    echo ========================================
    echo   DISINSTALLAZIONE COMPLETATA!
    echo ========================================
    echo.
    echo Network Monitor Agent e' stato completamente rimosso.
    echo.
    echo Per reinstallare:
    echo   1. Scarica il pacchetto dalla dashboard TicketApp
    echo   2. Estrai il ZIP
    echo   3. Esegui Installa-Servizio-Batch.bat (doppio click)
    echo.
) else (
    echo ========================================
    echo   DISINSTALLAZIONE PARZIALE
    echo ========================================
    echo.
    echo Alcuni componenti non sono stati rimossi completamente.
    echo Riesegui questo script dopo aver chiuso tutte le finestre PowerShell.
    echo Oppure riavvia il PC per completare la rimozione.
    echo.
)

pause
