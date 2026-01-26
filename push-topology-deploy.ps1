# Push modifiche topologia (switch SNMP in mappa) su GitHub
# Esegui in PowerShell ESTERNO a Cursor (chiudi Source Control se aperto)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

# Rimuovi lock se bloccato da Cursor/altro
if (Test-Path .git\index.lock) {
    Remove-Item -Force .git\index.lock -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
}

git add frontend/src/pages/NetworkTopologyPage.jsx backend/routes/networkMonitoring.js DOCS/SNMP_SWITCH_FLUSSO_E_VERIFICA.md
git status
git commit -m "feat(snmp): log switch-address-table in backend, guida flusso SNMP e verifica; topologia collega al nodo viola"
git push origin main

Write-Host "`nPush completato. Sulla VPS: cd /var/www/ticketapp && git pull origin main && cd frontend && npm run build" -ForegroundColor Green
