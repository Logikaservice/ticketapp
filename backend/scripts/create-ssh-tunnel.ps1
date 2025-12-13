# Script per creare tunnel SSH verso database VPS

param(
    [Parameter(Mandatory=$false)]
    [string]$VpsHost = "159.69.121.162",
    
    [Parameter(Mandatory=$false)]
    [string]$SshUser = "root",
    
    [Parameter(Mandatory=$false)]
    [int]$LocalPort = 5433,
    
    [Parameter(Mandatory=$false)]
    [int]$RemotePort = 5432
)

Write-Host "🔐 Creazione tunnel SSH per database VPS" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "📊 Parametri:" -ForegroundColor Yellow
Write-Host "   VPS: $VpsHost" -ForegroundColor Gray
Write-Host "   User SSH: $SshUser" -ForegroundColor Gray
Write-Host "   Porta locale: $LocalPort" -ForegroundColor Gray
Write-Host "   Porta remota: $RemotePort" -ForegroundColor Gray
Write-Host ""

# Verifica che ssh sia disponibile
$sshPath = Get-Command ssh -ErrorAction SilentlyContinue
if (-not $sshPath) {
    Write-Host "❌ ssh non trovato!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Installa OpenSSH:" -ForegroundColor Yellow
    Write-Host "   Settings -> Apps -> Optional Features -> OpenSSH Client" -ForegroundColor Gray
    exit 1
}

Write-Host "🔌 Creazione tunnel SSH..." -ForegroundColor Yellow
Write-Host "   Tunnel: localhost:$LocalPort -> $VpsHost:$RemotePort" -ForegroundColor Gray
Write-Host ""
Write-Host "⚠️  Lascia questa finestra aperta!" -ForegroundColor Yellow
Write-Host "   Premi Ctrl+C per chiudere il tunnel" -ForegroundColor Gray
Write-Host ""
Write-Host "📝 Dopo aver avviato il tunnel, configura .env con:" -ForegroundColor Cyan
Write-Host "   DATABASE_URL_CRYPTO=postgresql://postgres:TicketApp2025!Secure@localhost:$LocalPort/crypto_db" -ForegroundColor Gray
Write-Host ""

# Crea il tunnel (resta in esecuzione)
ssh -N -L "${LocalPort}:localhost:${RemotePort}" "${SshUser}@${VpsHost}"

# Se il tunnel si chiude
Write-Host ""
Write-Host "🔌 Tunnel SSH chiuso" -ForegroundColor Yellow
