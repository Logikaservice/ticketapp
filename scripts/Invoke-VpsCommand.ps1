# Script PowerShell per eseguire comandi sulla VPS via SSH
# Uso: .\scripts\Invoke-VpsCommand.ps1 -Command "pm2 status"
# Oppure: Import-Module .\scripts\Invoke-VpsCommand.ps1; Invoke-VpsCommand -Command "pm2 status"

param(
    [Parameter(Mandatory=$true)]
    [string]$Command,
    
    [Parameter(Mandatory=$false)]
    [string]$VpsHost = "159.69.121.162",
    
    [Parameter(Mandatory=$false)]
    [string]$SshUser = "root",
    
    [Parameter(Mandatory=$false)]
    [string]$SshKey = "$env:USERPROFILE\.ssh\vps_key",
    
    [Parameter(Mandatory=$false)]
    [switch]$NoColor,
    
    [Parameter(Mandatory=$false)]
    [int]$Timeout = 30
)

# Funzione per eseguire comando SSH
function Invoke-VpsCommand {
    param(
        [string]$Command,
        [string]$VpsHost = "159.69.121.162",
        [string]$SshUser = "root",
        [string]$SshKey = "$env:USERPROFILE\.ssh\vps_key",
        [int]$Timeout = 30
    )
    
    # Verifica che ssh sia disponibile
    $sshPath = Get-Command ssh -ErrorAction SilentlyContinue
    if (-not $sshPath) {
        Write-Host "❌ ssh non trovato! Installa OpenSSH Client." -ForegroundColor Red
        return $null
    }
    
    # Verifica che la chiave SSH esista
    if (-not (Test-Path $SshKey)) {
        Write-Host "⚠️  Chiave SSH non trovata: $SshKey" -ForegroundColor Yellow
        Write-Host "   Esegui: .\CONFIGURA_CHIAVE_SSH.ps1" -ForegroundColor Cyan
        return $null
    }
    
    # Costruisci comando SSH
    $sshCommand = "ssh -i `"$SshKey`" -o StrictHostKeyChecking=no -o ConnectTimeout=$Timeout $SshUser@$VpsHost `"$Command`""
    
    try {
        # Esegui comando SSH
        $output = Invoke-Expression $sshCommand 2>&1
        $exitCode = $LASTEXITCODE
        
        return @{
            Success = ($exitCode -eq 0)
            Output = $output
            ExitCode = $exitCode
        }
    } catch {
        return @{
            Success = $false
            Output = $_.Exception.Message
            ExitCode = -1
        }
    }
}

# Esegui comando se chiamato direttamente
if ($MyInvocation.InvocationName -ne '.') {
    $result = Invoke-VpsCommand -Command $Command -VpsHost $VpsHost -SshUser $SshUser -SshKey $SshKey -Timeout $Timeout
    
    if ($result) {
        if ($result.Success) {
            if (-not $NoColor) {
                Write-Host "✅ Comando eseguito con successo" -ForegroundColor Green
            }
            $result.Output
        } else {
            if (-not $NoColor) {
                Write-Host "❌ Errore (exit code: $($result.ExitCode))" -ForegroundColor Red
            }
            $result.Output
            exit $result.ExitCode
        }
    } else {
        exit 1
    }
}
