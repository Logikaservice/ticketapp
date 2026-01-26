# Helper PowerShell per comandi VPS comuni
# Uso: . .\scripts\VpsHelper.ps1; Get-VpsStatus

$VPS_HOST = "159.69.121.162"
$VPS_USER = "root"
$VPS_PATH = "/var/www/ticketapp"
$SSH_KEY = "$env:USERPROFILE\.ssh\vps_key"

# Importa funzione base
. "$PSScriptRoot\Invoke-VpsCommand.ps1"

# Funzione helper per eseguire comandi VPS
function Invoke-Vps {
    param([string]$Command)
    $result = Invoke-VpsCommand -Command $Command -VpsHost $VPS_HOST -SshUser $VPS_USER -SshKey $SSH_KEY
    if ($result) {
        return $result.Output
    }
    return $null
}

# Stato PM2
function Get-VpsStatus {
    Write-Host "📊 Stato PM2 sulla VPS..." -ForegroundColor Cyan
    Invoke-Vps "pm2 status"
}

# Riavvia backend
function Restart-VpsBackend {
    Write-Host "🔄 Riavvio backend sulla VPS..." -ForegroundColor Yellow
    Invoke-Vps "cd $VPS_PATH && pm2 restart ticketapp-backend"
    Start-Sleep -Seconds 2
    Get-VpsStatus
}

# Riavvia tutto PM2
function Restart-VpsAll {
    Write-Host "🔄 Riavvio tutti i processi PM2..." -ForegroundColor Yellow
    Invoke-Vps "pm2 restart all"
    Start-Sleep -Seconds 2
    Get-VpsStatus
}

# Log backend
function Get-VpsBackendLogs {
    param([int]$Lines = 50)
    Write-Host "📋 Ultimi $Lines righe dei log backend..." -ForegroundColor Cyan
    Invoke-Vps "cd $VPS_PATH && pm2 logs ticketapp-backend --lines $Lines --nostream"
}

# Log backend in tempo reale
function Watch-VpsBackendLogs {
    Write-Host "👀 Log backend in tempo reale (Ctrl+C per uscire)..." -ForegroundColor Cyan
    ssh -i $SSH_KEY -o StrictHostKeyChecking=no $VPS_USER@$VPS_HOST "cd $VPS_PATH && pm2 logs ticketapp-backend"
}

# Git pull
function Update-VpsCode {
    Write-Host "📥 Aggiornamento codice dalla VPS (git pull)..." -ForegroundColor Yellow
    Invoke-Vps "cd $VPS_PATH && git pull"
}

# Build frontend
function Build-VpsFrontend {
    Write-Host "🏗️  Build frontend sulla VPS..." -ForegroundColor Yellow
    Invoke-Vps "cd $VPS_PATH/frontend && npm run build"
}

# Deploy completo (pull + build + restart)
function Deploy-Vps {
    Write-Host "🚀 Deploy completo sulla VPS..." -ForegroundColor Cyan
    Update-VpsCode
    Build-VpsFrontend
    Restart-VpsBackend
    Write-Host "✅ Deploy completato!" -ForegroundColor Green
}

# Verifica porta backend
function Test-VpsBackendPort {
    Write-Host "🔍 Verifica porta backend (3001)..." -ForegroundColor Cyan
    Invoke-Vps "netstat -tlnp | grep 3001"
}

# Verifica spazio disco
function Get-VpsDiskSpace {
    Write-Host "💾 Spazio disco VPS..." -ForegroundColor Cyan
    Invoke-Vps "df -h"
}

# Verifica memoria
function Get-VpsMemory {
    Write-Host "🧠 Memoria VPS..." -ForegroundColor Cyan
    Invoke-Vps "free -h"
}

# Verifica processi Node
function Get-VpsNodeProcesses {
    Write-Host "📦 Processi Node.js..." -ForegroundColor Cyan
    Invoke-Vps "ps aux | grep node"
}

# Verifica connessione database
function Test-VpsDatabase {
    Write-Host "🗄️  Test connessione database..." -ForegroundColor Cyan
    Invoke-Vps "cd $VPS_PATH/backend && node -e `"const { Pool } = require('pg'); require('dotenv').config(); const pool = new Pool({ connectionString: process.env.DATABASE_URL }); pool.query('SELECT NOW()').then(r => { console.log('✅ DB OK:', r.rows[0]); pool.end(); }).catch(e => { console.error('❌ DB Error:', e.message); process.exit(1); });`""
}

# Esegui comando personalizzato
function Invoke-VpsCustom {
    param([Parameter(Mandatory=$true)][string]$Command)
    Write-Host "🔧 Esecuzione comando personalizzato..." -ForegroundColor Cyan
    Write-Host "   Comando: $Command" -ForegroundColor Gray
    Invoke-Vps $Command
}

# Lista tutte le funzioni disponibili
function Show-VpsHelp {
    Write-Host "`n📚 Funzioni VPS disponibili:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Get-VpsStatus              - Stato PM2" -ForegroundColor Yellow
    Write-Host "  Restart-VpsBackend         - Riavvia backend" -ForegroundColor Yellow
    Write-Host "  Restart-VpsAll             - Riavvia tutti i processi PM2" -ForegroundColor Yellow
    Write-Host "  Get-VpsBackendLogs         - Log backend (ultimi 50)" -ForegroundColor Yellow
    Write-Host "  Watch-VpsBackendLogs       - Log backend in tempo reale" -ForegroundColor Yellow
    Write-Host "  Update-VpsCode             - Git pull" -ForegroundColor Yellow
    Write-Host "  Build-VpsFrontend          - Build frontend" -ForegroundColor Yellow
    Write-Host "  Deploy-Vps                 - Deploy completo (pull + build + restart)" -ForegroundColor Yellow
    Write-Host "  Test-VpsBackendPort        - Verifica porta 3001" -ForegroundColor Yellow
    Write-Host "  Get-VpsDiskSpace           - Spazio disco" -ForegroundColor Yellow
    Write-Host "  Get-VpsMemory              - Memoria" -ForegroundColor Yellow
    Write-Host "  Get-VpsNodeProcesses       - Processi Node.js" -ForegroundColor Yellow
    Write-Host "  Test-VpsDatabase           - Test database" -ForegroundColor Yellow
    Write-Host "  Invoke-VpsCustom -Command  - Comando personalizzato" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Esempio:" -ForegroundColor Cyan
    Write-Host "  . .\scripts\VpsHelper.ps1" -ForegroundColor Gray
    Write-Host "  Get-VpsStatus" -ForegroundColor Gray
    Write-Host ""
}

# Mostra help se importato
if ($MyInvocation.InvocationName -eq '.') {
    Write-Host "✅ VpsHelper caricato! Usa Show-VpsHelp per vedere tutte le funzioni." -ForegroundColor Green
}
