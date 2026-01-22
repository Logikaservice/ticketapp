# 🐛 Issue: Dispositivi "No Ping" che dovrebbero essere "Offline"

## Problema
Dispositivi che mostrano "⚠ No Ping" anche quando sono effettivamente offline.

**Esempio**: `192.168.1.214` mostra "No Ping" ma dovrebbe mostrare "Offline"

## Causa Probabile
Il campo `status` nel database non viene aggiornato correttamente da `'online'` a `'offline'` quando un dispositivo va offline.

Il dispositivo rimane con:
- `status = 'online'`
- `ping_responsive = false`

Invece dovrebbe avere:
- `status = 'offline'`
- `ping_responsive = false` (o true, non importa)

## Logica Frontend (CORRETTA)
```javascript
// File: NetworkMonitoringDashboard.jsx, riga 900-929
const StatusBadge = ({ status, pingResponsive }) => {
  // 1. PRIORITÀ MASSIMA: Offline
  if (status === 'offline') {
    return <span>Offline</span>;
  }

  // 2. Online ma non risponde al ping
  if (status === 'online' && pingResponsive === false) {
    return <span>No Ping</span>;
  }

  // 3. Online con ping
  return <span>Online</span>;
};
```

La logica frontend è corretta. Il problema è nei dati.

## Dove Viene Aggiornato lo Status Backend

### 1. Endpoint `/scan` (ricezione dati agent)
File: `backend/routes/networkMonitoring.js`

#### Quando viene marcato OFFLINE:
Riga ~1620-1650: Dispositivi che non sono più nella scansione vengono marcati offline

```javascript
// Marca come offline i dispositivi che non sono più nella scansione
const offlineDevices = await pool.query(
  `UPDATE network_devices 
   SET status = 'offline', last_seen = last_seen 
   WHERE agent_id = $1 
     AND status = 'online' 
     AND id NOT IN (${deviceIds.join(',')})
   RETURNING id, ip_address`,
  [agentId]
);
```

#### Quando viene marcato ONLINE:
Riga ~1490-1550: Dispositivi nella scansione vengono marcati online

```javascript
// Inserisci nuovo dispositivo
await pool.query(
  `INSERT INTO network_devices (..., status, ...)
   VALUES (..., $8, ...)`,
  [..., status || 'online', ...]
);

// Oppure aggiorna dispositivo esistente
await pool.query(
  `UPDATE network_devices 
   SET ..., status = $X, ...
   WHERE id = $Y`,
  [..., status || 'online', ...]
);
```

### 2. Gestione Cambiamenti
Riga ~1690-1780: Quando arriva un evento `device_offline` o `device_online`

```javascript
if (change_type === 'device_offline') {
  await pool.query(
    'UPDATE network_devices SET status = $1 WHERE id = $2',
    ['offline', deviceId]
  );
} else if (change_type === 'device_online') {
  await pool.query(
    'UPDATE network_devices SET status = $1, last_seen = NOW() WHERE id = $2',
    ['online', deviceId]
  );
}
```

## Possibili Cause

### Causa 1: Agent PowerShell non invia evento `device_offline`
Se l'agent PowerShell non rileva che un dispositivo è andato offline e non invia l'evento `device_offline`, il backend non aggiorna lo status.

**Verifica**: Controllare i log dell'agent PowerShell per vedere se invia eventi `device_offline`

### Causa 2: Dispositivo rimane nella scansione ARP ma non risponde al ping
Se un dispositivo è ancora visibile nella tabella ARP ma non risponde al ping:
- Viene incluso nella scansione
- `status` rimane `'online'`
- `ping_responsive` viene impostato a `false`
- Risultato: "No Ping" invece di "Offline"

**Questo è il comportamento CORRETTO** se il dispositivo è effettivamente presente nella rete (ARP) ma non risponde al ping.

### Causa 3: Timeout scansione
Se la scansione impiega troppo tempo, alcuni dispositivi potrebbero non essere processati correttamente.

## Soluzione

### Opzione A: Verificare Agent PowerShell
Assicurarsi che l'agent invii correttamente gli eventi `device_offline` quando un dispositivo scompare dalla rete.

### Opzione B: Timeout Automatico
Aggiungere una logica che marca automaticamente come offline i dispositivi che non rispondono al ping da X minuti:

```javascript
// Job periodico (ogni 5 minuti)
async function markStaleDevicesOffline() {
  await pool.query(`
    UPDATE network_devices
    SET status = 'offline'
    WHERE status = 'online'
      AND ping_responsive = false
      AND last_seen < NOW() - INTERVAL '10 minutes'
  `);
}
```

### Opzione C: Modificare Logica Badge (NON CONSIGLIATO)
Mostrare "Offline" anche per dispositivi con `ping_responsive = false` da più di X minuti:

```javascript
const StatusBadge = ({ status, pingResponsive, lastSeen }) => {
  const minutesSinceLastSeen = (Date.now() - new Date(lastSeen)) / 60000;
  
  // Se non risponde al ping da più di 10 minuti, consideralo offline
  if (pingResponsive === false && minutesSinceLastSeen > 10) {
    return <span>Offline</span>;
  }
  
  // ... resto della logica
};
```

## Raccomandazione
**Opzione B** è la migliore: aggiungere un job periodico che marca come offline i dispositivi che non rispondono al ping da più di 10 minuti.

Questo risolve il problema senza modificare la logica dell'agent PowerShell e mantiene la distinzione tra:
- **No Ping**: Dispositivo presente in rete (ARP) ma non risponde al ping (temporaneo)
- **Offline**: Dispositivo non visto da più di 10 minuti (effettivamente offline)
