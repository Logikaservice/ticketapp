@echo off
echo ========================================
echo   RIAVVIO BACKEND TICKETAPP
echo ========================================
echo.

cd /d "%~dp0backend"

echo [1/3] Fermando eventuali processi Node esistenti sulla porta 3001...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do (
    echo Trovato processo %%a sulla porta 3001
    taskkill /F /PID %%a 2>nul
    if errorlevel 1 (
        echo Nessun processo da terminare
    ) else (
        echo Processo terminato
    )
)

timeout /t 2 /nobreak >nul

echo.
echo [2/3] Avvio del backend...
start "TicketApp Backend" cmd /k "node index.js"

timeout /t 3 /nobreak >nul

echo.
echo [3/3] Verifica stato...
netstat -ano | findstr :3001 | findstr LISTENING >nul
if errorlevel 1 (
    echo ❌ ERRORE: Il backend non sembra essere in ascolto sulla porta 3001
    echo    Controlla la finestra del backend per eventuali errori
) else (
    echo ✅ Backend avviato correttamente sulla porta 3001
)

echo.
echo ========================================
echo   RIAVVIO COMPLETATO
echo ========================================
echo.
pause
