# Network Agent - Guida Installazione

## ⚠️ IMPORTANTE: Directory Installazione

**I file devono rimanere nella directory di installazione dopo l'installazione!**

L'installer installa i file nella stessa directory dove estrai lo ZIP. Se cancelli questi file dopo l'installazione, l'agent smetterà di funzionare.

### Consigli per l'installazione:

1. **Estrai lo ZIP in una directory permanente:**
   - Esempio: `C:\ProgramData\NetworkMonitorAgent\`
   - Oppure: `C:\Tools\NetworkMonitorAgent\`
   - **NON** nella cartella Download (che viene spesso pulita automaticamente)

2. **Dopo l'estrazione:**
   - Esegui `InstallerCompleto.ps1` dalla directory estratta
   - **NON cancellare** i file dopo l'installazione
   - La directory deve rimanere accessibile

3. **Directory consigliata:**
   ```
   C:\ProgramData\NetworkMonitorAgent\
   ├── NetworkMonitor.ps1
   ├── InstallerCompleto.ps1
   ├── config.json
   └── README.txt
   ```

### Cosa succede se cancelli i file?

Se cancelli i file dalla directory di installazione:
- ❌ Il Scheduled Task continuerà a tentare di eseguire `NetworkMonitor.ps1`
- ❌ L'agent non funzionerà più (file non trovato)
- ⚠️ Non riceverai più dati sulla dashboard
- ⚠️ L'agent risulterà "offline" nella dashboard

### Come verificare dove è installato:

1. Apri "Utilità di pianificazione" (Task Scheduler)
2. Cerca "NetworkMonitorAgent"
3. Apri le proprietà del task
4. Vai alla scheda "Azioni"
5. Guarda "Inizia in" (Working Directory) - questa è la directory di installazione

### Come disinstallare correttamente:

Usa la funzione "Elimina" nella dashboard TicketApp, oppure:
1. Apri PowerShell come Amministratore
2. Esegui: `Unregister-ScheduledTask -TaskName "NetworkMonitorAgent" -Confirm:$false`
3. Cancella la directory di installazione
