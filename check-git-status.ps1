# Script per verificare stato Git e salvare output in file
$logFile = "git-status-log.txt"
cd c:\TicketApp

"=== VERIFICA STATO GIT ===" | Out-File -FilePath $logFile -Encoding UTF8
Get-Date | Out-File -FilePath $logFile -Append -Encoding UTF8
"" | Out-File -FilePath $logFile -Append -Encoding UTF8

"`n=== STATUS ===" | Out-File -FilePath $logFile -Append -Encoding UTF8
git status 2>&1 | Out-File -FilePath $logFile -Append -Encoding UTF8

"`n=== ULTIMO COMMIT ===" | Out-File -FilePath $logFile -Append -Encoding UTF8
git log --oneline -1 2>&1 | Out-File -FilePath $logFile -Append -Encoding UTF8

"`n=== COMMIT DA PUSHARE ===" | Out-File -FilePath $logFile -Append -Encoding UTF8
git log origin/main..HEAD --oneline 2>&1 | Out-File -FilePath $logFile -Append -Encoding UTF8

"`n=== REMOTE URL ===" | Out-File -FilePath $logFile -Append -Encoding UTF8
git remote -v 2>&1 | Out-File -FilePath $logFile -Append -Encoding UTF8

"`n=== TENTATIVO PUSH (con output dettagliato) ===" | Out-File -FilePath $logFile -Append -Encoding UTF8
try {
    $pushOutput = git push origin main 2>&1 | Out-String
    $pushOutput | Out-File -FilePath $logFile -Append -Encoding UTF8
    "Exit code: $LASTEXITCODE" | Out-File -FilePath $logFile -Append -Encoding UTF8
} catch {
    "ERRORE durante push: $_" | Out-File -FilePath $logFile -Append -Encoding UTF8
}

Write-Host "Log salvato in: git-status-log.txt"
Write-Host "Controlla il file per vedere l'output completo"

