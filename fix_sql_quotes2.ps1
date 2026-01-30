# Fix SQL quotes - simpler approach
$file = "c:\TicketApp\backend\routes\networkMonitoring.js"
$content = Get-Content $file -Raw -Encoding UTF8

# Direct string replacement
$content = $content.Replace('", ""), "-', "'), ':', ''), '-')

Set-Content $file -Value $content -Encoding UTF8 -NoNewline
Write-Host "Fixed SQL quotes"
