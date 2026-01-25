# Esegui in PowerShell ESTERNO a Cursor (o chiudi Source Control in Cursor)
# Add, commit e push delle modifiche agent/NetworkMonitorService e script correlati

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

# Rimuovi lock se esiste (può essere bloccato da Cursor/altro)
if (Test-Path .git\index.lock) {
    Remove-Item -Force .git\index.lock -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
}

git add agent/NetworkMonitorService.ps1 agent/Find-BadChars.ps1 agent/Fix-Quotes.ps1 agent/Fix-WriteLog-Expand.ps1 agent/Parse-Range.ps1 agent/Test-Parse.ps1 agent/push-agent-changes.ps1 backend/routes/networkMonitoring.js .cursorrules
git status
git commit -m "fix(agent): correzioni parse NetworkMonitorService, Fix-Quotes, script test/utilita"
git push

Write-Host "Push completato."
