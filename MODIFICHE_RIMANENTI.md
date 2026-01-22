# 🎯 Modifiche Rimanenti - Eventi di Rete

## ✅ Completato
1. ✅ Rimosso filtro Gravità
2. ✅ Rimossa colonna Gravità
3. ✅ Accorciato "Nuovo Dispositivo" → "Nuovo"
4. ✅ Cambiato "Riconnesso" → "Online"

## 🚧 DA IMPLEMENTARE

### 1. Correggere Logica "Nuovo" vs "Online"

**Problema Attuale**:
- Il sistema marca come "Nuovo" ogni volta che viene creato un nuovo record nel database
- Ma se un MAC era già presente in passato (anche se il record è stato cancellato), NON dovrebbe essere "Nuovo"

**Soluzione**:
- "Nuovo" = MAC mai visto prima su quella rete (prima volta assoluta)
- "Online" = MAC già visto in passato che si riconnette

**Implementazione Backend**:

File: `backend/routes/networkMonitoring.js` (riga ~1490-1550)

Quando viene inserito un nuovo dispositivo, verificare se quel MAC è mai esistito prima:

```javascript
// Prima di inserire il nuovo dispositivo (riga ~1490)
// Verifica se questo MAC è mai stato visto prima su questa rete
let isFirstTimeSeen = true;
if (normalizedMac) {
  const macHistoryCheck = await pool.query(
    `SELECT COUNT(*) as count 
     FROM network_changes nc
     INNER JOIN network_devices nd ON nc.device_id = nd.id
     WHERE nd.agent_id = $1 
       AND nd.mac_address = $2
       AND nc.change_type IN ('new_device', 'device_online')`,
    [agentId, normalizedMac]
  );
  
  isFirstTimeSeen = parseInt(macHistoryCheck.rows[0].count) === 0;
}

// Quando viene creato l'evento change (dopo l'INSERT del dispositivo)
// Usa 'new_device' solo se è la prima volta, altrimenti 'device_online'
const changeType = isFirstTimeSeen ? 'new_device' : 'device_online';
```

**Nota**: Attualmente il change_type viene passato dall'agent PowerShell. Potrebbe essere necessario modificare anche l'agent per gestire questa logica, OPPURE sovrascrivere il change_type lato backend.

### 2. Indicatore Disconnessioni Frequenti

**Requisito**:
- Quando un dispositivo ha disconnessioni frequenti, mostrare un tondo rosso con "+" al centro
- Questo indicatore dovrebbe apparire nella colonna IP (come già fatto per il warning IP precedente)

**Logica Esistente**:
- Il campo `has_ping_failures` nel database già traccia se ci sono state disconnessioni
- Questo viene impostato dall'agent PowerShell

**Implementazione Frontend**:

File: `frontend/src/components/NetworkMonitoringDashboard.jsx` (riga ~2125-2135)

Nella cella IP, aggiungere l'indicatore per disconnessioni frequenti:

```jsx
<td className="py-3 px-4">
  <div className="text-sm font-medium text-gray-900">
    <div className="flex items-center gap-2">
      {/* Indicatore disconnessioni frequenti */}
      {change.has_ping_failures && (
        <div className="relative group flex items-center">
          <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
            <span className="text-white text-xs font-bold leading-none">+</span>
          </div>
          <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-10 bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
            Disconnessioni frequenti rilevate
          </div>
        </div>
      )}
      
      {/* Warning IP precedente */}
      {change.previous_ip && (
        <div className="flex items-center gap-1">
          <div className="relative group">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-10 bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
              IP precedente: {change.previous_ip}
            </div>
          </div>
        </div>
      )}
      
      {/* IP Address */}
      {change.ip_address || (isAgent ? '-' : 'N/A')}
      
      {isStatic && (
        <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-blue-200 text-blue-800 font-semibold">
          STATICO
        </span>
      )}
    </div>
  </div>
</td>
```

### 3. Alert per Disconnessioni Frequenti

**Requisito**:
- Sistema di alert che avvisa quando un dispositivo ha disconnessioni frequenti
- Logica da definire: quante disconnessioni in quanto tempo?

**Proposta Logica**:
- Se un dispositivo ha più di X disconnessioni in Y ore, genera un alert
- Esempio: più di 5 disconnessioni in 24 ore

**Implementazione**:

#### Opzione A: Alert in tempo reale (Backend)
Quando viene rilevata una disconnessione, verificare lo storico:

```javascript
// In backend/routes/networkMonitoring.js, quando viene processato un change_type = 'device_offline'
const disconnectionCount = await pool.query(
  `SELECT COUNT(*) as count
   FROM network_changes
   WHERE device_id = $1
     AND change_type = 'device_offline'
     AND detected_at >= NOW() - INTERVAL '24 hours'`,
  [deviceId]
);

const count = parseInt(disconnectionCount.rows[0].count);
const THRESHOLD = 5; // Soglia configurabile

if (count >= THRESHOLD) {
  // Genera alert
  await pool.query(
    `INSERT INTO network_agent_events (agent_id, event_type, event_data)
     VALUES ($1, 'frequent_disconnections', $2)`,
    [agentId, JSON.stringify({
      device_id: deviceId,
      ip_address: device_ip,
      disconnection_count: count,
      time_window: '24h'
    })]
  );
  
  // Invia notifica Telegram se configurato
  await sendTelegramNotification(agentId, aziendaId, 'frequent_disconnections', {
    ip: device_ip,
    count: count,
    timeWindow: '24 ore'
  });
}
```

#### Opzione B: Alert periodico (Cron Job)
Creare un job che gira ogni ora e verifica tutti i dispositivi:

```javascript
// Nuovo endpoint o funzione schedulata
async function checkFrequentDisconnections() {
  const result = await pool.query(`
    SELECT 
      nd.id,
      nd.ip_address,
      nd.mac_address,
      nd.agent_id,
      COUNT(*) as disconnection_count
    FROM network_changes nc
    INNER JOIN network_devices nd ON nc.device_id = nd.id
    WHERE nc.change_type = 'device_offline'
      AND nc.detected_at >= NOW() - INTERVAL '24 hours'
    GROUP BY nd.id, nd.ip_address, nd.mac_address, nd.agent_id
    HAVING COUNT(*) >= 5
  `);
  
  for (const device of result.rows) {
    // Genera alert per ogni dispositivo con disconnessioni frequenti
    // ...
  }
}
```

## 📋 Priorità Implementazione

1. **Alta**: Indicatore disconnessioni frequenti (frontend) - Visibilità immediata
2. **Media**: Correggere logica Nuovo vs Online - Correttezza dati
3. **Bassa**: Alert disconnessioni frequenti - Feature aggiuntiva

## 🔧 File da Modificare

1. `backend/routes/networkMonitoring.js`:
   - Logica Nuovo vs Online (~riga 1490-1550)
   - Alert disconnessioni frequenti (~riga 1690-1780)

2. `frontend/src/components/NetworkMonitoringDashboard.jsx`:
   - Indicatore disconnessioni frequenti (~riga 2125-2135)

3. `backend/routes/networkMonitoring.js` (endpoint unificato):
   - Includere campo `has_ping_failures` nella query (~riga 2374-2410)

## ✅ Test da Eseguire

1. Verificare che un MAC visto per la prima volta mostri "Nuovo"
2. Verificare che lo stesso MAC riconnesso mostri "Online"
3. Verificare che il tondo rosso con + appaia per dispositivi con has_ping_failures=true
4. Verificare tooltip "Disconnessioni frequenti rilevate"
5. Testare alert (se implementato)
