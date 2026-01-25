$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile("$PSScriptRoot\NetworkMonitorService.ps1", [ref]$null, [ref]$parseErrors)
if ($parseErrors -and $parseErrors.Count -gt 0) {
    $parseErrors | ForEach-Object { $_.ToString() }
    exit 1
}
Write-Host "Parse OK"
exit 0
