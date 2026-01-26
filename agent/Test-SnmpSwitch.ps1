# Test-SnmpSwitch.ps1
# Emula l'accesso SNMP allo switch: esegue snmpwalk su dot1dTpFdbPort e mostra
# la tabella MAC -> Porta (stessa logica di Sync-ManagedSwitchesSnmp nell'agent).
# Uso: .\Test-SnmpSwitch.ps1 -Ip 192.168.1.50 -Community public
#      .\Test-SnmpSwitch.ps1 -Ip 192.168.1.33 -Community public
# Con switch che usano Q-BRIDGE-MIB (es. Netgear): -Oid 1.3.6.1.2.1.17.7.1.2.2.1.2 -Community monitor

param(
    [Parameter(Mandatory=$true)]
    [string]$Ip,
    [string]$Community = "public",
    [string]$Oid = "1.3.6.1.2.1.17.4.3.1.2"   # dot1dTpFdbPort; per dot1q usare 1.3.6.1.2.1.17.7.1.2.2.1.2
)

$ErrorActionPreference = 'Stop'

# Trova snmpwalk (stesso criterio dell'agent): PATH, C:\Program Files\Net-SNMP\bin, C:\usr\bin
$snmpwalkExe = $null
try { $snmpwalkExe = (Get-Command snmpwalk -ErrorAction Stop).Source } catch { }
if (-not $snmpwalkExe -and (Test-Path "C:\Program Files\Net-SNMP\bin\snmpwalk.exe")) {
    $snmpwalkExe = "C:\Program Files\Net-SNMP\bin\snmpwalk.exe"
}
if (-not $snmpwalkExe -and (Test-Path "C:\usr\bin\snmpwalk.exe")) {
    $snmpwalkExe = "C:\usr\bin\snmpwalk.exe"
}
if (-not $snmpwalkExe -and (Test-Path "C:\usr\bin\snmpwalk")) {
    $snmpwalkExe = "C:\usr\bin\snmpwalk"
}
if (-not $snmpwalkExe) {
    Write-Host "ERRORE: snmpwalk non trovato. Cerca in PATH, C:\Program Files\Net-SNMP\bin\snmpwalk.exe o C:\usr\bin\snmpwalk(.exe)." -ForegroundColor Red
    exit 1
}

Write-Host "snmpwalk: $snmpwalkExe" -ForegroundColor Gray
$oidName = if ($Oid -match '17\.7\.1\.2\.2\.1\.2') { "dot1qTpFdbPort" } else { "dot1dTpFdbPort" }
Write-Host "Switch: $Ip, Community: $Community, OID: $Oid ($oidName)" -ForegroundColor Gray
Write-Host ""

# 1) Esegui snmpwalk (stesso comando dell'agent)
# Su Windows Net-SNMP cerca MIB in c:/usr/share/snmp/mibs (inesistente) e esce con 1 per
# "Cannot find module (IP-MIB)" ecc. Proviamo: (a) MIBDIRS verso share\snmp\mibs se esiste;
# (b) altrimenti MIBS="" e, in caso di fallimento, messaggio con soluzione.
Write-Host "=== Output snmpwalk (raw) ===" -ForegroundColor Cyan
$prevErr = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$prevMibs = $env:MIBS
$prevMibDirs = $env:MIBDIRS

# MIB: C:\Program Files\Net-SNMP\share\snmp\mibs oppure C:\usr\share\snmp\mibs
$mibDir = $null
if (Test-Path "C:\Program Files\Net-SNMP\share\snmp\mibs") { $mibDir = "C:\Program Files\Net-SNMP\share\snmp\mibs" }
elseif (Test-Path "C:\usr\share\snmp\mibs") { $mibDir = "C:\usr\share\snmp\mibs" }
if ($mibDir) {
    $env:MIBDIRS = $mibDir
    Write-Host "(uso MIBDIRS=$mibDir)" -ForegroundColor DarkGray
} else {
    $env:MIBS = ""
}
try {
    $out = & $snmpwalkExe -v 2c -c $Community $Ip $Oid -On 2>&1
} finally {
    if ($null -ne $prevMibs) { $env:MIBS = $prevMibs } else { Remove-Item -Path env:MIBS -ErrorAction SilentlyContinue }
    if ($null -ne $prevMibDirs) { $env:MIBDIRS = $prevMibDirs } else { Remove-Item -Path env:MIBDIRS -ErrorAction SilentlyContinue }
}
$exitCode = $LASTEXITCODE
$ErrorActionPreference = $prevErr

if ($exitCode -ne 0) {
    Write-Host "snmpwalk FALLITO (exit code $exitCode)." -ForegroundColor Red
    if ($out) {
        $arr = @($out)
        $n = [Math]::Min(8, $arr.Count)
        for ($i = 0; $i -lt $n; $i++) { Write-Host "  $($arr[$i])" }
    }
    Write-Host "Verifica: 1) ping $Ip  2) SNMP v2c abilitato sullo switch  3) community '$Community'" -ForegroundColor Yellow
    $outStr = if ($out) { ($out | Out-String) } else { "" }
    if ($outStr -match "Cannot find module") {
        Write-Host ""
        Write-Host "Errore MIB su Windows: Net-SNMP non trova IP-MIB, IF-MIB, ecc. in c:/usr/share/snmp/mibs." -ForegroundColor Yellow
        Write-Host "Soluzione: creare C:\usr\share\snmp\mibs e copiare i MIB (IP-MIB, IF-MIB, TCP-MIB, UDP-MIB" -ForegroundColor Yellow
        Write-Host "  e dipendenze) da https://github.com/net-snmp/net-snmp/tree/master/mibs" -ForegroundColor Yellow
        Write-Host "  oppure reinstallare Net-SNMP includendo i file MIB." -ForegroundColor Yellow
    }
    exit 1
}

# Exit 0: mostrare output (eventuale avviso MIB su Windows e ignorabile)
$arr = @($out)
if ($arr.Count -eq 0) {
    Write-Host "snmpwalk non ha restituito righe (switch senza voci in dot1dTpFdbPort o OID non supportato)." -ForegroundColor Gray
} else {
    $toShow = [Math]::Min(20, $arr.Count)
    for ($i = 0; $i -lt $toShow; $i++) { Write-Host $arr[$i] }
    if ($arr.Count -gt 20) {
        Write-Host "... ($($arr.Count - 20) righe non mostrate)"
    }
    if ($out -match 'MIB search path:') {
        Write-Host "(avviso 'MIB search path' su Windows: ignorabile se snmpwalk ha exit code 0)" -ForegroundColor DarkGray
    }
}

Write-Host ""

# 2) Parsing: accetta sia OID numerici (.1.3.6...) sia simbolici (SNMPv2-SMI::mib-2.17.7...).
# Per dot1d e dot1q gli ultimi 6 segmenti numerici dell'indice sono i 6 ottetti MAC.
$lines = $out | Where-Object { $_ -match "=\s*INTEGER:\s*(\d+)" }
$macToPort = @{}
foreach ($line in $lines) {
    if ($line -notmatch '=\s*INTEGER:\s*(\d+)') { continue }
    $port = [int]$Matches[1]
    $oidPart = ($line -split '=', 2)[0].Trim()
    # Normalizza :: in . e estrae i segmenti puramente numerici
    $oidPart = $oidPart -replace '::', '.'
    $numeric = @()
    foreach ($s in ($oidPart -split '\.')) {
        $n = 0
        if ([int]::TryParse($s.Trim(), [ref]$n) -and $n -ge 0 -and $n -le 255) { $numeric += $n }
    }
    if ($numeric.Count -lt 6) { continue }
    $last6 = @($numeric)[-6..-1]
    $mac = ($last6 | ForEach-Object { '{0:X2}' -f ($_ -band 0xFF) }) -join ''
    $mac = $mac.ToUpper()
    if ($mac.Length -eq 12) { $macToPort[$mac] = $port }
}

# 3) Tabella MAC -> Porta
Write-Host "=== Tabella MAC -> Porta (parsata, come la usa l'agent) ===" -ForegroundColor Cyan
if ($macToPort.Count -eq 0) {
    Write-Host "Nessuna riga interpretabile. Prova -Oid 1.3.6.1.2.1.17.7.1.2.2.1.2 (dot1qTpFdbPort) se dot1d non e supportato." -ForegroundColor Yellow
    exit 0
}

$macToPort.GetEnumerator() | Sort-Object { $_.Value } | ForEach-Object {
    $macFmt = $_.Key -replace '(.{2})(?!$)', '$1:'
    Write-Host ("  Porta {0,3}  ->  {1}  ({2})" -f $_.Value, $macFmt, $_.Key)
}
Write-Host ""
Write-Host "Totale: $($macToPort.Count) MAC associati a una porta." -ForegroundColor Green

# 4) JSON come lo invierebbe l'agent al backend (senza managed_switch_id/switch_ip, solo mac_to_port)
Write-Host ""
Write-Host "=== Oggetto mac_to_port (come inviato a POST /agent/switch-address-table) ===" -ForegroundColor Cyan
$macToPort | ConvertTo-Json -Compress | Write-Host
