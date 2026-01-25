# Converte Write-Log "testo: $_" 'LEVEL' in Write-Log ('testo: ' + $_) 'LEVEL' per evitare virgolette curve
$path = Join-Path $PSScriptRoot "NetworkMonitorService.ps1"
$content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
$pattern = 'Write-Log "([^"]*)\$_" ''(WARN|ERROR|INFO)'''
$replacement = "Write-Log ('`$1' + `$_) '`$2'"
$newContent = [regex]::Replace($content, $pattern, $replacement)
if ($newContent -eq $content) { Write-Host "Nessuna sostituzione" } else {
    [System.IO.File]::WriteAllText($path, $newContent, (New-Object System.Text.UTF8Encoding $false))
    Write-Host "Sostituzioni effettuate"
}
