# Agent Mercurio si disconnette spesso – 3 passi semplici

---

## 1. Dalla dashboard (1 minuto)

- **Monitoraggio rete** → **Agenti** → trova **Mercurio** → clicca **Diagnostica** (pulsante viola).
- Guarda **"Ultimo heartbeat"**: se dice **più di 8 minuti fa**, il server non riceve i segnali dal PC Mercurio.

---

## 2. Sul PC Mercurio – Apri il log (2 minuti)

- Apri il file: **`C:\ProgramData\NetworkMonitorAgent\NetworkMonitorService.log`**
- Cerca la parola **"Errore heartbeat"** (Ctrl+F).
  - Se la trovi spesso → problema di **rete** o **connessione** da quel PC (Wi‑Fi, firewall, antivirus).
  - Se non c’è → il problema può essere il servizio che si ferma o la sospensione del PC.

---

## 3. Sul PC Mercurio – Controlla il servizio

- Apri **PowerShell** e scrivi:  
  **`Get-Service -Name "NetworkMonitorService"`**
- Deve dire **Status: Running**.
  - Se dice **Stopped** → riavvia il servizio o reinstalla l’agent con **Installa-Servizio.bat**.

---

## Cause più probabili

| Se vedi questo | Probabile causa |
|----------------|------------------|
| "Errore heartbeat" nel log | Wi‑Fi instabile, firewall o antivirus che blocca |
| Servizio Stopped | PC spento/sospeso o servizio che si chiude |
| Ultimo heartbeat > 8 min ma nessun errore nel log | PC in sospensione o rete che cade spesso |

**In sintesi:** Diagnostica dalla dashboard + cercare "Errore heartbeat" nel log + controllare che il servizio sia Running. Di solito basta questo per capire dove intervenire.
