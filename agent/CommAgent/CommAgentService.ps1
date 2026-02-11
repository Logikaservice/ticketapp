# CommAgentService.ps1
# Agent di Comunicazione Logika - Riceve notifiche push dal server
# Gira nella sessione utente (non come servizio Windows)
# Versione: 1.0.0

param(
    [string]$ConfigPath = "config.json",
    [switch]$Register
)

$SCRIPT_VERSION = "1.0.0"
$HEARTBEAT_INTERVAL_SECONDS = 15

# Forza TLS 1.2
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
}
catch {
    try { [Net.ServicePointManager]::SecurityProtocol = 3072 } catch { }
}

# Directory script
$script:scriptDir = $null
if ($PSScriptRoot) {
    $script:scriptDir = $PSScriptRoot
}
elseif ($MyInvocation.MyCommand.Path) {
    $script:scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}
else {
    $script:scriptDir = "C:\ProgramData\LogikaCommAgent"
}

$script:configFile = Join-Path $script:scriptDir "config.json"
$script:logFile = Join-Path $script:scriptDir "CommAgent.log"
$script:isRunning = $true

# ============================================
# LOGGING
# ============================================
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMsg = "[$ts] [$Level] $Message"
    try {
        $logMsg | Out-File -FilePath $script:logFile -Append -Encoding UTF8
        # Ruota log se > 5MB
        if ((Test-Path $script:logFile) -and (Get-Item $script:logFile).Length -gt 5MB) {
            $backupLog = Join-Path $script:scriptDir "CommAgent_old.log"
            Move-Item -Path $script:logFile -Destination $backupLog -Force
            Write-Output "" | Out-File -FilePath $script:logFile -Encoding UTF8
        }
    }
    catch { }
}

# ============================================
# CONFIGURAZIONE
# ============================================
function Load-Config {
    if (Test-Path $script:configFile) {
        try {
            $config = Get-Content $script:configFile -Raw | ConvertFrom-Json
            return $config
        }
        catch {
            Write-Log "Errore lettura config: $_" "ERROR"
        }
    }
    return $null
}

function Save-Config {
    param($Config)
    try {
        $Config | ConvertTo-Json -Depth 4 | Out-File -FilePath $script:configFile -Encoding UTF8 -Force
        Write-Log "Config salvata" "DEBUG"
    }
    catch {
        Write-Log "Errore salvataggio config: $_" "ERROR"
    }
}

# ============================================
# REGISTRAZIONE AGENT
# ============================================
function Register-Agent {
    param(
        [string]$ServerUrl,
        [string]$Email,
        [string]$Password
    )

    Write-Log "Registrazione agent per $Email su $ServerUrl..." "INFO"

    $machineName = $env:COMPUTERNAME
    $machineId = ""
    try {
        $os = Get-WmiObject Win32_OperatingSystem -ErrorAction SilentlyContinue
        $bios = Get-WmiObject Win32_BIOS -ErrorAction SilentlyContinue
        $machineId = "$($bios.SerialNumber)-$machineName"
        $osInfo = "$($os.Caption) $($os.Version)"
    }
    catch {
        $machineId = "$machineName-$(Get-Random)"
        $osInfo = "Windows"
    }

    $payload = @{
        email        = $Email
        password     = $Password
        machine_name = $machineName
        machine_id   = $machineId
        os_info      = $osInfo
    } | ConvertTo-Json

    $headers = @{
        "Content-Type" = "application/json"
    }

    try {
        $response = Invoke-RestMethod -Uri "$ServerUrl/api/comm-agent/agent/register" -Method POST -Headers $headers -Body $payload -TimeoutSec 30 -ErrorAction Stop

        if ($response.success) {
            $config = @{
                server_url   = $ServerUrl
                api_key      = $response.api_key
                agent_id     = $response.agent_id
                user_email   = $Email
                user_nome    = $response.user.nome
                user_azienda = $response.user.azienda
                machine_name = $machineName
                machine_id   = $machineId
                version      = $SCRIPT_VERSION
            }
            Save-Config -Config $config
            Write-Log "Registrazione OK! Agent ID: $($response.agent_id)" "INFO"
            return $config
        }
        else {
            Write-Log "Registrazione fallita: $($response.error)" "ERROR"
            return $null
        }
    }
    catch {
        Write-Log "Errore registrazione: $($_.Exception.Message)" "ERROR"
        return $null
    }
}

# ============================================
# HEARTBEAT + FETCH MESSAGES
# ============================================
function Send-Heartbeat {
    param($Config)

    $headers = @{
        "Content-Type"   = "application/json"
        "X-Comm-API-Key" = $Config.api_key
    }

    $payload = @{
        version = $SCRIPT_VERSION
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri "$($Config.server_url)/api/comm-agent/agent/heartbeat" -Method POST -Headers $headers -Body $payload -TimeoutSec 15 -ErrorAction Stop

        if ($response.success -and $response.messages -and $response.messages.Count -gt 0) {
            Write-Log "Ricevuti $($response.messages.Count) nuovi messaggi" "INFO"
            return $response.messages
        }

        return @()
    }
    catch {
        Write-Log "Errore heartbeat: $($_.Exception.Message)" "WARN"
        return @()
    }
}

# ============================================
# NOTIFICA MESSAGGIO COME LETTO
# ============================================
function Send-MessageRead {
    param($Config, [int]$MessageId)

    $headers = @{
        "Content-Type"   = "application/json"
        "X-Comm-API-Key" = $Config.api_key
    }

    $payload = @{ message_id = $MessageId } | ConvertTo-Json

    try {
        Invoke-RestMethod -Uri "$($Config.server_url)/api/comm-agent/agent/message-read" -Method POST -Headers $headers -Body $payload -TimeoutSec 10 -ErrorAction Stop | Out-Null
    }
    catch {
        Write-Log "Errore mark read: $($_.Exception.Message)" "WARN"
    }
}

# ============================================
# NOTIFICA WPF INNOVATIVA
# ============================================
function Show-Notification {
    param(
        [string]$Title,
        [string]$Body,
        [string]$Sender,
        [string]$Priority = "normal",
        [string]$Category = "info",
        [string]$Timestamp = ""
    )

    # Lancia il notificatore come processo separato
    $notifierScript = Join-Path $script:scriptDir "CommAgentNotifier.ps1"

    if (-not (Test-Path $notifierScript)) {
        Write-Log "Notifier non trovato: $notifierScript" "WARN"
        # Fallback: usa BalloonTip nativo
        Show-FallbackNotification -Title $Title -Body $Body
        return
    }

    try {
        $encodedTitle = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Title))
        $encodedBody = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Body))
        $encodedSender = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Sender))

        Start-Process -FilePath "powershell.exe" -ArgumentList @(
            "-ExecutionPolicy", "Bypass",
            "-WindowStyle", "Hidden",
            "-File", $notifierScript,
            "-Title", "`"$encodedTitle`"",
            "-Body", "`"$encodedBody`"",
            "-Sender", "`"$encodedSender`"",
            "-Priority", $Priority,
            "-Category", $Category
        ) -NoNewWindow -ErrorAction SilentlyContinue

        Write-Log "Notifica mostrata: $Title" "INFO"
    }
    catch {
        Write-Log "Errore lancio notificatore: $($_.Exception.Message)" "WARN"
        Show-FallbackNotification -Title $Title -Body $Body
    }
}

function Show-FallbackNotification {
    param([string]$Title, [string]$Body)
    try {
        Add-Type -AssemblyName System.Windows.Forms
        $notify = New-Object System.Windows.Forms.NotifyIcon
        $notify.Icon = [System.Drawing.SystemIcons]::Information
        $notify.BalloonTipTitle = "Logika: $Title"
        $notify.BalloonTipText = $Body
        $notify.Visible = $true
        $notify.ShowBalloonTip(10000)
        Start-Sleep -Seconds 11
        $notify.Dispose()
    }
    catch {
        Write-Log "Errore fallback notification: $_" "WARN"
    }
}

# ============================================
# LOOP PRINCIPALE
# ============================================
function Start-MainLoop {
    param($Config)

    Write-Log "=== Comm Agent avviato (v$SCRIPT_VERSION) ===" "INFO"
    Write-Log "Server: $($Config.server_url)" "INFO"
    Write-Log "Utente: $($Config.user_email)" "INFO"
    Write-Log "PC: $($Config.machine_name)" "INFO"
    Write-Log "Intervallo heartbeat: ${HEARTBEAT_INTERVAL_SECONDS}s" "INFO"

    $consecutiveErrors = 0

    while ($script:isRunning) {
        try {
            $messages = Send-Heartbeat -Config $Config

            if ($messages -and $messages.Count -gt 0) {
                foreach ($msg in $messages) {
                    $sender = ""
                    if ($msg.sender_nome) {
                        $sender = "$($msg.sender_nome) $($msg.sender_cognome)"
                    }
                    elseif ($msg.sender_email) {
                        $sender = $msg.sender_email
                    }
                    else {
                        $sender = "Logika Service"
                    }

                    Show-Notification `
                        -Title $msg.title `
                        -Body $msg.body `
                        -Sender $sender `
                        -Priority $msg.priority `
                        -Category $msg.category `
                        -Timestamp $msg.created_at

                    # Marca come letto dopo visualizzazione
                    Send-MessageRead -Config $Config -MessageId $msg.id

                    # Piccolo delay tra notifiche multiple
                    Start-Sleep -Milliseconds 500
                }
            }

            $consecutiveErrors = 0
        }
        catch {
            $consecutiveErrors++
            Write-Log "Errore nel loop: $($_.Exception.Message) (errore consecutivo #$consecutiveErrors)" "WARN"

            # Se troppi errori consecutivi, aumenta il delay
            if ($consecutiveErrors -gt 10) {
                Start-Sleep -Seconds 60
                continue
            }
        }

        Start-Sleep -Seconds $HEARTBEAT_INTERVAL_SECONDS
    }
}

# ============================================
# ENTRY POINT
# ============================================

Write-Log "CommAgentService.ps1 avviato (PID=$PID)" "INFO"

# Carica config
$config = Load-Config

if (-not $config -or -not $config.api_key) {
    # Nessuna config: chiedi registrazione interattiva
    Write-Host ""
    Write-Host "  ╔════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "  ║       Logika Communication Agent v$SCRIPT_VERSION       ║" -ForegroundColor Cyan
    Write-Host "  ╠════════════════════════════════════════════════╣" -ForegroundColor Cyan
    Write-Host "  ║  Registra il tuo PC per ricevere notifiche    ║" -ForegroundColor White
    Write-Host "  ╚════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""

    # Leggi da file di config pre-compilato se esiste (dall'installer)
    $preConfig = $null
    $preConfigFile = Join-Path $script:scriptDir "install_config.json"
    if (Test-Path $preConfigFile) {
        $preConfig = Get-Content $preConfigFile -Raw | ConvertFrom-Json
    }

    $serverUrl = if ($preConfig -and $preConfig.server_url) { $preConfig.server_url } else { Read-Host "  URL Server (es: https://ticket.logikaservice.it)" }
    $email = if ($preConfig -and $preConfig.email) { $preConfig.email } else { Read-Host "  Email" }
    $password = if ($preConfig -and $preConfig.password) { $preConfig.password } else { Read-Host "  Password" }

    $config = Register-Agent -ServerUrl $serverUrl -Email $email -Password $password

    if (-not $config) {
        Write-Host ""
        Write-Host "  [ERRORE] Registrazione fallita. Verifica credenziali." -ForegroundColor Red
        Write-Host ""
        pause
        exit 1
    }

    Write-Host ""
    Write-Host "  [OK] Registrazione completata!" -ForegroundColor Green
    Write-Host "  L'agent è ora attivo e riceverà le notifiche." -ForegroundColor Green
    Write-Host ""

    # Rimuovi file di pre-config se presente
    if (Test-Path $preConfigFile) {
        Remove-Item $preConfigFile -Force -ErrorAction SilentlyContinue
    }
}

# Avvia il loop principale
Start-MainLoop -Config $config
