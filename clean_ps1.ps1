$f = 'c:\TicketApp\backend\public\agent-updates\NetworkMonitorService.ps1'
$c = Get-Content $f -Raw -Encoding UTF8

# Rileva e rimuove blocchi Add-Type -TypeDefinition
$c = $c -replace '(?s)Add-Type\s+-TypeDefinition\s+@".*?"@', '# Removed Add-Type for AV safety'
$c = $c -replace '(?s)add-type\s+-ErrorAction\s+Stop\s+@".*?"@', '# Removed Add-Type for AV safety'

# Sostituisce la policy dei certificati obsoleta con il callback moderno
$c = $c -replace '\[System\.Net\.ServicePointManager\]::CertificatePolicy\s+=\s+New-Object\s+TrustAllCertsPolicy', '[System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }'

# Sostituisce le chiamate a ArpHelper con $null (i fallback nativi prenderanno il sopravvento)
$c = $c -replace '\[ArpHelper\]::GetMacAddress\(\$targetIP\)', '$null'
$c = $c -replace '\[ArpHelper\]::GetMacAddress', '$null'

# Salva il file pulito
$c | Set-Content $f -Encoding UTF8
Write-Output "File $f pulito con successo."
