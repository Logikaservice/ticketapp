# Fix SQL quotes
$file = "c:\TicketApp\backend\routes\networkMonitoring.js"
$content = Get-Content $file -Raw -Encoding UTF8

# Replace the problematic query
$oldPattern = 'REPLACE\(REPLACE\(UPPER\(mac_address\), \\":\", \\"\\"\), \\"-\\", \\"\\"\)'
$newPattern = "REPLACE(REPLACE(UPPER(mac_address), ':', ''), '-', '')"
$content = $content -replace [regex]::Escape($oldPattern), $newPattern

$oldPattern2 = 'REPLACE\(REPLACE\(UPPER\(\$2\), \\":\", \\"\\"\), \\"-\\", \\"\\"\)'
$newPattern2 = "REPLACE(REPLACE(UPPER(`$2), ':', ''), '-', '')"
$content = $content -replace [regex]::Escape($oldPattern2), $newPattern2

Set-Content $file -Value $content -Encoding UTF8 -NoNewline
Write-Host "Fixed SQL quotes in networkMonitoring.js"
