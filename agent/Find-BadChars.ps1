$path = Join-Path $PSScriptRoot "NetworkMonitorService.ps1"
$content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
$lines = $content -split "`r?`n"
$utf8 = [System.Text.Encoding]::UTF8
# Cerca caratteri non-ASCII in tutto il file
$nr = 0
foreach ($line in $lines) {
    $nr++
    for ($i = 0; $i -lt $line.Length; $i++) {
        $c = [int][char]$line[$i]
        if ($c -gt 127 -or $c -eq 0) {
            $hex = ($utf8.GetBytes($line[$i]) | ForEach-Object { '{0:X2}' -f $_ }) -join ' '
            Write-Host "Riga $nr pos $i : U+$('{0:X4}' -f $c) bytes=$hex"
        }
    }
}
# Cerca anche sequenze UTF-8 delle virgolette curve (E2 80 9C, E2 80 9D) nei byte raw
$bytes = [System.IO.File]::ReadAllBytes($path)
for ($i = 0; $i -lt $bytes.Length - 2; $i++) {
    if ($bytes[$i] -eq 0xE2 -and $bytes[$i+1] -eq 0x80 -and ($bytes[$i+2] -eq 0x9C -or $bytes[$i+2] -eq 0x9D)) {
        $lineNum = ($utf8.GetString($bytes[0..($i-1)]) -split "`r?`n").Count
        Write-Host "Virgoletta curva UTF-8 a byte $i (circa riga $lineNum)"
    }
}
Write-Host "Fine scansione"
