@echo off
echo ========================================
echo Fermo Backend TicketApp
echo ========================================

echo.
echo Cerco processi Node sulla porta 3001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001') do (
    echo Fermo processo PID %%a
    taskkill /F /PID %%a
)

echo.
echo Fermo tutti i processi Node (se necessario)...
taskkill /F /IM node.exe 2>nul

timeout /t 2 >nul

echo.
echo Verifico...
netstat -ano | findstr :3001 > nul
if %errorlevel% neq 0 (
    echo ✅ Backend fermato
) else (
    echo ⚠️  Porta 3001 ancora in uso
)

echo.
pause


