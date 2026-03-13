$errors = $null
$tokens = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile('c:\TicketApp\agent\NetworkMonitorService.ps1', [ref]$tokens, [ref]$errors)
Write-Host "Errori trovati: $($errors.Count)"
foreach ($e in $errors | Select-Object -First 10) {
    Write-Host "Riga $($e.Extent.StartLineNumber): $($e.Message)"
}
