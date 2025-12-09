@echo off
echo ========================================
echo   DEPLOY BOT PROFESSIONALE SU VPS
echo ========================================
echo.

REM Chiedi conferma
set /p confirm="Vuoi deployare le modifiche sul VPS? (s/n): "
if /i not "%confirm%"=="s" (
    echo Deploy annullato.
    pause
    exit /b
)

echo.
echo [1/4] Connessione al VPS...
echo.

REM Sostituisci questi valori con i tuoi
set VPS_USER=your-username
set VPS_HOST=your-vps-ip
set VPS_PATH=/path/to/ticketapp

echo Connessione a %VPS_USER%@%VPS_HOST%...
echo.

REM Esegui comandi sul VPS
ssh %VPS_USER%@%VPS_HOST% "cd %VPS_PATH% && echo '[2/4] Git pull...' && git pull && echo '[3/4] PM2 restart...' && pm2 restart backend && echo '[4/4] Verifica logs...' && pm2 logs backend --lines 20 --nostream"

echo.
echo ========================================
echo   DEPLOY COMPLETATO!
echo ========================================
echo.
echo Apri il browser e vai a:
echo http://%VPS_HOST%/api/crypto/debug-positions
echo.
echo per verificare che i filtri professionali siano attivi.
echo.
pause
