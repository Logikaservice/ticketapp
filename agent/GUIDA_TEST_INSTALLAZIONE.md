# Guida Test Installazione Completa da Zero

Questa guida ti aiuta a testare l'installazione automatica completa come se fosse la prima volta.

## Passo 1: Disinstalla Servizio Esistente

1. **Apri PowerShell come Amministratore**
   - Cerca "PowerShell" nel menu Start
   - Tasto destro → "Esegui come amministratore"

2. **Disinstalla il servizio esistente:**
   ```powershell
   cd C:\ProgramData\NetworkMonitorAgent
   .\Rimuovi-Servizio.ps1
   ```

   Oppure manualmente:
   ```powershell
   Stop-Service -Name NetworkMonitorService -Force -ErrorAction SilentlyContinue
   sc.exe delete NetworkMonitorService
   ```

3. **Rimuovi la directory (opzionale, per test completamente pulito):**
   ```powershell
   Remove-Item "C:\ProgramData\NetworkMonitorAgent" -Recurse -Force -ErrorAction SilentlyContinue
   ```

## Passo 2: Aggiorna il Pacchetto sul Server

1. **Sul server VPS:**
   ```bash
   cd /var/www/ticketapp
   git pull
   pm2 restart backend
   ```

2. **Verifica che il backend sia attivo:**
   ```bash
   curl http://localhost:3001/api/health
   ```

## Passo 3: Scarica il Nuovo Pacchetto

1. **Vai nella dashboard TicketApp**
   - Accedi come tecnico/admin
   - Vai su "Monitoraggio Rete"
   - Seleziona l'agent (es: "Casa Mia")
   - Clicca su "Scarica Pacchetto"

2. **Salva il file ZIP** (es: `NetworkMonitor-Agent-Casa-Mia.zip`)

## Passo 4: Estrai il Pacchetto

1. **Estrai il ZIP** in una directory temporanea (anche Desktop va bene)
   - Non importa dove, l'installer copierà tutto in `C:\ProgramData\NetworkMonitorAgent\` automaticamente

2. **Verifica che i file siano presenti:**
   Dovresti vedere almeno:
   - `Installa.bat` ⬅️ **Questo è quello che userai**
   - `Installa-Automatico.ps1`
   - `NetworkMonitorService.ps1`
   - `Installa-Servizio.ps1`
   - `config.json`
   - Altri file...

## Passo 5: Esegui Installazione Automatica

1. **Fai doppio click su `Installa.bat`**

2. **Clicca "Sì"** quando Windows chiede privilegi amministratore (UAC)

3. **Segui le istruzioni a schermo:**
   - L'installer copierà automaticamente tutti i file in `C:\ProgramData\NetworkMonitorAgent\`
   - Rimuoverà automaticamente il vecchio Scheduled Task (se presente)
   - Installerà il servizio Windows
   - Avvierà automaticamente il servizio
   - Ti chiederà se vuoi avviare l'icona system tray

4. **Quando richiesto, scegli se avviare la tray icon:**
   - Opzione 1: Sì, avvia l'icona nella system tray (consigliato)
   - Opzione 2: No, il servizio è sufficiente

## Passo 6: Verifica Installazione

1. **Verifica che il servizio sia in esecuzione:**
   ```powershell
   Get-Service -Name NetworkMonitorService
   ```
   
   Dovresti vedere:
   ```
   Status   Name               DisplayName
   ------   ----               -----------
   Running  NetworkMonitorService Network Monitor Agent Service
   ```

2. **Verifica che l'icona system tray sia visibile** (se hai scelto di avviarla)
   - Dovresti vedere un'icona vicino all'orologio di Windows
   - Click destro sull'icona per menu contestuale
   - Doppio click per informazioni dettagliate

3. **Controlla i log (opzionale):**
   ```powershell
   Get-Content C:\ProgramData\NetworkMonitorAgent\NetworkMonitorService.log -Tail 20
   ```

4. **Verifica nella dashboard TicketApp:**
   - Vai su "Monitoraggio Rete"
   - Seleziona l'azienda
   - L'agent dovrebbe risultare "online"
   - L'ultimo heartbeat dovrebbe essere recente (< 10 minuti)

## Risoluzione Problemi

### Servizio non si avvia

1. **Controlla i log di errore:**
   ```powershell
   Get-Content C:\ProgramData\NetworkMonitorAgent\NetworkMonitorService_stderr.log
   ```

2. **Controlla lo stato del servizio:**
   ```powershell
   Get-Service -Name NetworkMonitorService
   ```

3. **Prova ad avviare manualmente:**
   ```powershell
   Stop-Service -Name NetworkMonitorService -Force
   Start-Service -Name NetworkMonitorService
   Get-Service -Name NetworkMonitorService
   ```

### Errore durante installazione

1. **Controlla che tutti i file siano presenti:**
   ```powershell
   cd "C:\ProgramData\NetworkMonitorAgent"
   Get-ChildItem
   ```

2. **Verifica che config.json sia valido:**
   ```powershell
   Get-Content config.json | ConvertFrom-Json
   ```

3. **Riprova l'installazione:**
   - Disinstalla il servizio (Passo 1)
   - Esegui di nuovo `Installa.bat` (Passo 5)

## Checklist Installazione Completa

- [ ] Servizio vecchio disinstallato
- [ ] Pacchetto scaricato dalla dashboard
- [ ] File estratti dal ZIP
- [ ] `Installa.bat` eseguito con successo
- [ ] Privilegi admin concessi (UAC)
- [ ] File copiati in `C:\ProgramData\NetworkMonitorAgent\`
- [ ] Servizio installato
- [ ] Servizio avviato (status: Running)
- [ ] Icona system tray avviata (opzionale)
- [ ] Agent visibile nella dashboard come "online"
- [ ] Ultimo heartbeat recente (< 10 minuti)

## Fine!

Se tutti i passaggi sono completati con successo, l'installazione automatica funziona correttamente! 🎉
