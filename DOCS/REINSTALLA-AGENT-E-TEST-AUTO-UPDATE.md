# Reinstallare l’agent da zero e verificare l’auto-update

## 1. Reinstallare come prima volta (pacchetto dalla VPS)

1. **Disinstalla la vecchia installazione** (sul PC dove gira l’agent):
   - Esegui `Disinstalla-Tutto.bat` dalla cartella attuale dell’agent, **oppure**
   - Da `C:\ProgramData\NetworkMonitorAgent`: `.\Disinstalla-Tutto.bat` se presente; in alternativa servizio + cartella rimossi a mano.

2. **Scarica il pacchetto dalla VPS (dashboard)**:
   - Vai in **Monitoraggio rete → Agent Registrati**.
   - Trova l’agent da reinstallare (es. “La Torre”) e clicca **“Scarica Pacchetto”**.
   - Si scarica uno ZIP tipo `NetworkMonitor-Agent-NomeAgent-v2.4.0.zip` con `config.json`, `NetworkMonitorService.ps1`, `nssm.exe`, `Installa-Agent.bat`, ecc., già configurati per quell’agent.

3. **Estrai lo ZIP** in una cartella (es. Desktop o `C:\Install\Agent`).

4. **Esegui l’installazione**:
   - **`Installa-Agent.bat`** (tasto destro → Esegui come amministratore), **oppure**
   - Lo script/installer indicato nelle istruzioni dentro lo ZIP.
   - Completa la procedura (rete, intervallo, ecc. se richiesti).

5. **Verifica** che il servizio sia attivo e che in **Agent Registrati** l’agent risulti **online**.

---

## 2. Verificare che l’auto-update funzioni

L’agent esegue **Check-AgentUpdate**:
- **All’avvio** del servizio
- **Ogni heartbeat** (circa ogni 5 minuti)

### Controllo che il “check” giri (server e agent entrambi 2.4.0)

Con server e agent sulla **2.4.0**, non parte alcun aggiornamento, ma puoi verificare che il controllo venga eseguito.

**Log:**  
`C:\ProgramData\NetworkMonitorAgent\NetworkMonitorService.log`

Cerca (nell’ordine):

- `[INFO] Controllo aggiornamenti agent... (versione corrente: 2.4.0)`
- `[INFO] Versione disponibile sul server: 2.4.0]`
- `[OK] Agent già aggiornato alla versione corrente`

Se compaiono, il contatto con `/api/network-monitoring/agent-version` e la logica di Check-AgentUpdate **funzionano**. In questo caso non vedrai download/riavvio perché la versione è già uguale.

### Vedere un aggiornamento reale (da 2.4.0 a 2.4.1)

Per vedere download + riavvio in automatico serve che il **server** abbia una versione **maggiore** (es. **2.4.1**), mentre l’agent installato è ancora **2.4.0**.

1. Sul **server** (o in repo) si imposta la versione agent a **2.4.1** (es. in `backend/routes/networkMonitoring.js` e dove si legge la versione per lo ZIP / `agent-version`), si fa deploy.
2. Sul **client** l’agent è ancora **2.4.0** (pacchetto scaricato prima del deploy 2.4.1).
3. All’avvio o al primo heartbeat dopo il deploy, l’agent:
   - chiama `GET .../api/network-monitoring/agent-version` e ottiene `2.4.1`;
   - vede `2.4.1 != 2.4.0`, quindi scarica `NetworkMonitorService.ps1`, aggiorna `config.json`, esce;
   - NSSM riavvia il processo che carica la **2.4.1** da disco.

Nei log dovresti vedere ad es.:

- `[INFO] Nuova versione disponibile! Avvio aggiornamento...`
- `[DOWNLOAD] Download NetworkMonitorService.ps1...`
- `[OK] NetworkMonitorService.ps1 scaricato`
- `[INFO] File aggiornati. Uscita per riavvio tramite NSSM (AppExit Restart, ~60s)...`

Dopo ~60 secondi il servizio riparte con la 2.4.1. In **Agent Registrati** la versione mostrata e il comportamento devono riflettere la nuova release.

Se vuoi fare questo test, va temporaneamente portata la versione sul server a 2.4.1 (o superiore) e poi, a scelta, riportata a 2.4.0 dopo la verifica.
