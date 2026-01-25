$path = Join-Path $PSScriptRoot "NetworkMonitorService.ps1"
# 1) Sostituzione a livello byte: sequenze UTF-8 delle virgolette curve (3 byte -> 1 byte ")
$bytes = [System.IO.File]::ReadAllBytes($path)
$out = New-Object System.Collections.Generic.List[byte]
$i = 0
while ($i -lt $bytes.Count) {
    if ($i -le $bytes.Count - 3 -and $bytes[$i] -eq 0xE2 -and $bytes[$i+1] -eq 0x80 -and ($bytes[$i+2] -eq 0x9C -or $bytes[$i+2] -eq 0x9D -or $bytes[$i+2] -eq 0x9E -or $bytes[$i+2] -eq 0x9F)) {
        $out.Add(0x22)
        $i += 3
    } elseif ($i -le $bytes.Count - 3 -and $bytes[$i] -eq 0xE2 -and $bytes[$i+1] -eq 0x80 -and ($bytes[$i+2] -eq 0x98 -or $bytes[$i+2] -eq 0x99)) {
        $out.Add(0x27)
        $i += 3
    } elseif (($bytes[$i] -eq 0x93 -or $bytes[$i] -eq 0x94) -and ($i -eq 0 -or $bytes[$i-1] -ne 0xC2)) {
        # Virgolette curve Windows-1252 (0x93=" 0x94=") quando non parte di C2 9x (UTF-8 raro)
        $out.Add(0x22)
        $i += 1
    } else {
        $out.Add($bytes[$i])
        $i++
    }
}
[System.IO.File]::WriteAllBytes($path, $out)
# 2) Livello carattere (cattura anche se letto in altro encoding)
$content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
$content = $content.Replace([char]0x201C, [char]0x22).Replace([char]0x201D, [char]0x22).Replace([char]0x201E, [char]0x22).Replace([char]0x201F, [char]0x22).Replace([char]0xFF02, [char]0x22).Replace([char]0x2018, [char]0x27).Replace([char]0x2019, [char]0x27)
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
Write-Host "Done"
