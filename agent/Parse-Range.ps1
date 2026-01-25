# Parse solo le prime N righe: crea file temp e usa ParseFile
param([int]$NumLines = 500)
$path = Join-Path $PSScriptRoot "NetworkMonitorService.ps1"
$tmp = Join-Path $env:TEMP "parse_range_ps1.ps1"
$all = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
$lines = $all -split "`r?`n"
$trimmed = ($lines[0..($NumLines-1)] -join "`n")
[System.IO.File]::WriteAllText($tmp, $trimmed, (New-Object System.Text.UTF8Encoding $false))
$parseErrors = $null
$null = [System.Management.Automation.Language.Parser]::ParseFile($tmp, [ref]$null, [ref]$parseErrors)
Remove-Item $tmp -Force -ErrorAction SilentlyContinue
if ($parseErrors -and $parseErrors.Count -gt 0) {
    $parseErrors | ForEach-Object { Write-Host $_.ToString() }
    exit 1
}
Write-Host "OK: prime $NumLines righe"
exit 0
