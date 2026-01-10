# Network Monitor Agent - Installer Automatico

## Installer Completo (Consigliato)

L'installer `InstallerCompleto.ps1` fa tutto automaticamente: chiede solo l'API Key e configura tutto.

### Come convertire in .exe

1. **Installa PS2EXE** (converte PowerShell in .exe):
   ```powershell
   Install-Module -Name ps2exe -Force
   ```

2. **Converti in .exe**:
   ```powershell
   Invoke-ps2exe -inputFile "InstallerCompleto.ps1" -outputFile "InstallaAgent.exe" -iconFile "icon.ico" -requireAdmin
   ```

### Come usare l'installer

1. **Ottieni l'API Key dalla dashboard TicketApp:**
   - Vai su "Monitoraggio Rete"
   - Clicca "Registra Nuovo Agent"
   - Completa la procedura guidata
   - Copia l'API Key mostrata

2. **Esegui l'installer:**
   - Doppio click su `InstallaAgent.exe` (o `InstallerCompleto.ps1`)
   - Inserisci l'API Key quando richiesto
   - L'installer:
     - Scarica automaticamente la configurazione dal server
     - Crea `config.json`
     - Configura il Scheduled Task Windows
     - Testa la connessione

3. **Verifica:**
   - L'agent inizia a scansionare automaticamente ogni X minuti
   - Controlla nella dashboard TicketApp che l'agent risulti "online"

### File necessari

L'installer richiede che `NetworkMonitor.ps1` sia nella stessa cartella:
- `InstallerCompleto.ps1` (o `InstallaAgent.exe`)
- `NetworkMonitor.ps1`

### Note

- L'installer deve essere eseguito come **Amministratore** per creare il Scheduled Task con privilegi SYSTEM
- Se non ha privilegi amministratore, creerà il task con privilegi limitati (potrebbe richiedere password all'avvio)
- L'API Key può essere passata come parametro: `.\InstallerCompleto.ps1 -ApiKey "tua-api-key"`
