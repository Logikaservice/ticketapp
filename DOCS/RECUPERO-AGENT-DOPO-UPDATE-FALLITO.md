# Recupero agent dopo update fallito

Se l’agent **non invia più dati** dopo un auto-update (servizio in crash, bloccato o fermo):

## 1. Ripristinare lo script da backup

Sul PC dell’agent, nella cartella di installazione (es. `C:\ProgramData\NetworkMonitorAgent`):

```powershell
cd C:\ProgramData\NetworkMonitorAgent
copy /Y NetworkMonitorService.ps1.backup NetworkMonitorService.ps1
```

Poi riavviare il servizio (servizi Windows o da PowerShell come Amministratore):

```powershell
Restart-Service NetworkMonitorAgent
```

## 2. Se il backup non c’è o non funziona

- Reinstallare l’agent tramite ZIP dall’interfaccia (Network Monitoring → agent → Download).
- Oppure copiare a mano una versione corretta di `NetworkMonitorService.ps1` dalla repo/server.

## 3. Dalla 2.5.2

- **Validazione download**: prima di sostituire `NetworkMonitorService.ps1` e `NetworkMonitor.ps1` si controlla size e contenuto; in caso di file non valido (es. HTML di errore) **non** si sovrascrive e **non** si fa `exit` → niente crash loop.
- **Ensure-TrayFiles e avvio tray** sono in un `try/catch`: un errore lì non blocca il servizio e l’invio dati.
- **`$installDir`** in `Check-AgentUpdate` usa `$script:scriptDir` per essere coerente con la directory di installazione.
