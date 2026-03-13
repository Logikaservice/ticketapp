$f = 'c:\TicketApp\backend\public\agent-updates\NetworkMonitorService.ps1'
$c = Get-Content $f -Raw -Encoding UTF8

# Fix broken replacements from previous cleanup
$c = $c -replace '\$null\(\$ip\)', '$null'
$c = $c -replace '\$null\(\$targetIP\)', '$null'

# Salva il file
$c | Set-Content $f -Encoding UTF8
Write-Output "File fixed."
