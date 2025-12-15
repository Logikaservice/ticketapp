@echo off
echo ========================================
echo Avvio Backend TicketApp
echo ========================================

cd backend

echo.
echo Verifico porta 3001...
netstat -ano | findstr :3001 > nul
if %errorlevel% equ 0 (
    echo ATTENZIONE: Porta 3001 gia in uso!
    echo Provo a fermare processo esistente...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001') do taskkill /F /PID %%a 2>nul
    timeout /t 2 >nul
)

echo.
echo Avvio backend...
start "TicketApp Backend" /MIN node index.js

timeout /t 3 >nul

echo.
echo Verifico avvio...
netstat -ano | findstr :3001 > nul
if %errorlevel% equ 0 (
    echo ✅ Backend avviato su porta 3001
    echo.
    echo Per vedere log: cd backend ^& Get-Content -Wait backend.log
    echo Per fermare: taskkill /F /IM node.exe
) else (
    echo ❌ Errore avvio backend
    echo Verifica log per dettagli
)

echo.
pause



