# Script PowerShell per configurare la chiave SSH

# Crea la cartella .ssh se non esiste
New-Item -ItemType Directory -Force -Path ~/.ssh | Out-Null

# Crea il file con la chiave
$keyContent = @"
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACB/KKKunHC4tIeCerR4KCsXLBNPyBY2h8bnm95+FnVuNAAAAJgaW/ChGlvw
oQAAAAtzc2gtZWQyNTUxOQAAACB/KKKunHC4tIeCerR4KCsXLBNPyBY2h8bnm95+FnVuNA
AAAECGQ5UkcIvbjW7XtWnsgyMeZgeq0SHrftwB1P9jXiPDK38ooq6ccLi0h4J6tHgoKxcs
E0/IFjaHxueb3n4WdW40AAAAEHRpY2tldGFwcC1yZW1vdGUBAgMEBQ==
-----END OPENSSH PRIVATE KEY-----
"@

$keyPath = "$env:USERPROFILE\.ssh\vps_key"
$keyContent | Out-File -FilePath $keyPath -Encoding ASCII -NoNewline

Write-Host "✅ Chiave salvata in: $keyPath" -ForegroundColor Green

# Imposta permessi corretti
icacls $keyPath /inheritance:r | Out-Null
icacls $keyPath /grant:r "$env:USERNAME:(R)" | Out-Null

Write-Host "✅ Permessi configurati" -ForegroundColor Green
Write-Host ""
Write-Host "Ora puoi connetterti con:" -ForegroundColor Cyan
Write-Host "ssh -i ~/.ssh/vps_key root@159.69.121.162" -ForegroundColor Yellow
