# SNMP sugli switch gestiti: flusso completo e come verificare

## Cosa fa il sistema

1. **L’agent** (sul PC in LAN) legge dalla VPS la lista degli **switch gestiti** (es. Netgear) e per ciascuno:
   - esegue **snmpwalk** in locale verso l’IP dello switch per ottenere la tabella **MAC → porta** (OID `dot1dTpFdbPort`, BRIDGE-MIB);
   - invia la tabella alla VPS con **POST /api/network-monitoring/agent/switch-address-table**.

2. **La VPS** (backend):
   - trova o crea il `network_device` con l’IP dello switch;
   - per ogni MAC ricevuto cerca un `network_device` (stessa azienda) con lo stesso `mac_address`;
   - se c’è match: imposta `parent_device_id` = id del device dello switch e `port` = numero di porta.

3. **La mappa topologica** usa `parent_device_id` e `port` per collegare i pallini allo switch (nodo viola) e mostrare la porta (es. `192.168.1.50 #7`).

---

## Dove e come viene letta la tabella MAC→porta

- **Dove**: sul **PC dove gira l’agent** (stessa LAN dello switch). La VPS non fa SNMP: non raggiunge gli IP privati (es. 192.168.x).
- **Come**: tramite **snmpwalk** (Net-SNMP) sull’OID `1.3.6.1.2.1.17.4.3.1.2` (dot1dTpFdbPort).  
  Ogni riga è tipo: `.1.3.6.1.2.1.17.4.3.1.2.0.1.2.3.4.5.6 = INTEGER: 7` → MAC `010203040506` sulla porta 7.
- **Quando**:
  - dopo ogni **scansione** di rete (l’agent chiama `Sync-ManagedSwitchesSnmp` in automatico);
  - il pulsante **Sincronizza** in “Dispositivi gestiti” **non** fa SNMP: dice all’utente che l’agent farà la sync al **prossimo ciclo** (di solito entro 1–2 intervalli di scansione, es. 15–30 min se intervallo 15 min).

---

## Requisiti perché SNMP funzioni

| Requisito | Dove | Come verificare |
|-----------|------|-----------------|
| **Net-SNMP** con `snmpwalk` | PC con l’agent | `snmpwalk -V` in PowerShell, o presenza di `C:\Program Files\Net-SNMP\bin\snmpwalk.exe` |
| **SNMP abilitato** sullo switch | Switch (es. Netgear) | Da gestionale / interfaccia web: SNMP v2c, community (es. `public`) |
| **Reachability** agent → switch | Rete | Dal PC: `ping <IP_switch>` e, se serve, verifica firewall (UDP 161) |
| **Community e IP** corretti | Dashboard | In “Dispositivi gestiti (SNMP)”: IP, community e (se usato) snmp_version devono coincidere con lo switch |
| **Dispositivi con MAC in DB** | VPS / agent | I `network_devices` devono avere `mac_address` valorizzato (la scansione dell’agent li riempie) |

---

## Flusso tecnico

```
[Agent su PC]
     │
     │  1) GET /api/network-monitoring/agent/managed-switches  (X-API-Key)
     │     → lista switch: id, ip, snmp_community, snmp_version, name
     │
     │  2) Per ogni switch:
     │     snmpwalk -v 2c -c <community> <ip> 1.3.6.1.2.1.17.4.3.1.2 -On
     │     → parsing righe "OID = INTEGER: port" per ricavare MAC (6 ottetti dall’OID) e porta
     │     → oggetto mac_to_port: { "A1B2C3D4E5F6": 7, ... }
     │
     │  3) POST /api/network-monitoring/agent/switch-address-table
     │     Body: { managed_switch_id, switch_ip, mac_to_port }
     │     Headers: X-API-Key
     │
     ▼
[VPS – Backend]
     │
     │  4) Trova/crea network_device con ip = switch_ip (device_type=switch)
     │  5) Per ogni network_device dell’azienda con mac_address:
     │       mac_norm = normalizza(mac_address)   // niente spazi, : . -
     │       port = mac_to_port[mac_norm]
     │       se port presente → UPDATE network_devices SET parent_device_id=switchDeviceId, port=port
     │  6) Risposta: { macs_found, macs_matched, switch_device_id }
     │
     ▼
[DB: network_devices]
     parent_device_id, port impostati per i dispositivi il cui MAC è stato trovato nella tabella dello switch.
```

---

## Come verificare se SNMP legge e aggiorna la VPS

### 1. Log **sull’agent** (PC)

File: `C:\ProgramData\NetworkMonitorAgent\NetworkMonitorService.log`

Cerca:

- **`snmpwalk non trovato (Net-SNMP); sync switch SNMP saltata`**  
  → snmpwalk assente: installare Net-SNMP e mettere `snmpwalk` in PATH o in `C:\Program Files\Net-SNMP\bin\`.

- **`Sync switch SNMP 192.168.1.x fallito: ...`**  
  → snmpwalk ha dato errore: community sbagliata, switch irraggiungibile, firewall, o OID non supportato su quel modello.

- **`Sync switch SNMP 192.168.1.x : N dispositivi associati (M MAC letti)`**  
  → SNMP ha letto M MAC dallo switch e N sono stati collegati (match con `network_devices`).  
  - Se **M > 0** e **N = 0**: lo switch restituisce MAC, ma nessun `network_device` ha quel `mac_address` (dispositivi non ancora scoperti, o formato MAC diverso dopo normalizzazione).

### 2. Log **sulla VPS** (backend)

Dopo le modifiche, quando arriva una `switch-address-table`:

- **`switch-address-table: switch_ip=..., managed_switch_id=..., macs_found=..., macs_matched=...`**  
  → Conferma che la VPS ha ricevuto i dati e quanti MAC sono stati abbinati.

- **`SNMP: X MAC letti dallo switch ma 0 match con network_devices...`**  
  → La lettura SNMP funziona (X > 0) ma in DB non ci sono (o non combaciano) i `mac_address`. Controllare che l’agent abbia scoperto i dispositivi e che abbiano `mac_address` valorizzato.

Per vedere i log: `pm2 logs backend` (o dove gira il backend).

### 3. **Database** (opzionale)

Verifica che i dispositivi abbiano `parent_device_id` e `port` dopo una sync:

```sql
SELECT id, ip_address, mac_address, parent_device_id, port, hostname
FROM network_devices nd
JOIN network_agents na ON nd.agent_id = na.id
WHERE na.azienda_id = <id_azienda>
  AND (parent_device_id IS NOT NULL OR port IS NOT NULL)
ORDER BY parent_device_id, port;
```

E che esista il “device” dello switch (stesso IP dello switch gestito):

```sql
SELECT id, ip_address, device_type
FROM network_devices nd
JOIN network_agents na ON nd.agent_id = na.id
WHERE na.azienda_id = <id_azienda>
  AND TRIM(nd.ip_address) = '<IP_switch>';
```

### 4. **Test snmpwalk a mano** (sul PC con l’agent)

Per capire se lo switch risponde e che formato ha:

```powershell
# Sostituisci IP e community con quelli dello switch (es. "public")
snmpwalk -v 2c -c public 192.168.1.50 1.3.6.1.2.1.17.4.3.1.2 -On
```

- **Nessun output / timeout**: SNMP non raggiungibile o community errata.
- **Righe tipo** `.1.3.6.1.2.1.17.4.3.1.2.X.Y.Z... = INTEGER: N`： formato atteso; l’agent è in grado di interpretarlo.

Alcuni switch usano MIB o OID diversi; in quel caso snmpwalk potrebbe non restituire nulla su quest’OID. Per i Netgear che seguono BRIDGE-MIB standard, `dot1dTpFdbPort` è il riferimento.

---

## Perché `macs_matched` può essere 0 anche con `macs_found` > 0

1. **Dispositivi non ancora in `network_devices`**  
   L’agent deve aver fatto almeno una scansione che li ha scoperti e ha salvato `mac_address`. Se i PC sono spenti o fuori rete al momento della scansione, non entrano in DB.

2. **Formato MAC**  
   Backend e agent normalizzano (niente `:`, `-`, `.`, spazi; stesso ordine di grandezza). Se lo switch o un altro sistema usa un formato strano o non standard, in rari casi il match può fallire. Di solito la normalizzazione è sufficiente.

3. **MAC nello switch ma non visti dalla scansione**  
   Es. dispositivi su altra VLAN, solo WiFi, o fuori dai range di scan: l’agent non li mette in `network_devices`, quindi nessun match.

4. **OID / MIB non supportato**  
   Se lo switch non espone `dot1dTpFdbPort` o lo fa con un OID diverso, snmpwalk non restituisce niente (o niente di parsabile) → `macs_found` = 0 e nessun POST, oppure `mac_to_port` vuoto.

---

## Riepilogo: “Mi riesci a collegare questi sulla VPS?”

Sì, **a patto che**:

1. Sul PC con l’agent sia installato **Net-SNMP** e `snmpwalk` sia usabile.
2. Lo **switch** abbia SNMP v2c attivo, con **community** e **IP** uguali a quelli in “Dispositivi gestiti”.
3. L’**agent** sia in esecuzione e sulla **stessa LAN** dello switch (o comunque in grado di raggiungerlo su UDP 161).
4. I **dispositivi** da collegare siano stati **scoperti** dall’agent e abbiano `mac_address` in `network_devices`.
5. Lo switch esponga la tabella **dot1dTpFdbPort** (BRIDGE-MIB) in modo compatibile con l’OID usato.

Per **controllare**:

- **Agent**: log `NetworkMonitorService.log` (sync SNMP, errori snmpwalk, `N dispositivi associati (M MAC letti)`).
- **VPS**: log del backend (`switch-address-table: ...`, `macs_found`, `macs_matched` e, se presenti, gli avvisi su 0 match).
- **DB**: `parent_device_id` e `port` su `network_devices` e presenza del device con l’IP dello switch.
- **Test** snmpwalk a mano sull’IP dello switch dal PC dell’agent per confermare che la lettura SNMP funziona.
