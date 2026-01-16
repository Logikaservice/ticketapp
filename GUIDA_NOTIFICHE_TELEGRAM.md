# 📱 Guida Completa: Notifiche Telegram per Network Monitoring

## 📋 Panoramica

Questa guida ti aiuta a implementare notifiche Telegram per il Network Monitoring con 4 tipi di notifiche:
1. **Agent non raggiungibile** (controllo backend)
2. **MAC statico cambia IP** (rilevato agent, notifica backend)
3. **IP statico cambia MAC** (rilevato agent, notifica backend)
4. **Dispositivo statico va online/offline** (rilevato agent, notifica backend)

---

## 🎯 Passo 1: Creare Bot Telegram

### 1.1 Crea il Bot con BotFather

1. Apri Telegram e cerca **@BotFather**
2. Invia `/newbot`
3. Scegli un nome per il bot (es: "Network Monitor Bot")
4. Scegli un username (deve finire con `bot`, es: `network_monitor_bot`)
5. **Salva il TOKEN** che ti viene fornito (es: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 1.2 Ottieni il Chat ID

1. Cerca il tuo bot su Telegram (usa il username che hai scelto)
2. Invia `/start` al bot
3. Apri questo URL nel browser (sostituisci `YOUR_BOT_TOKEN`):
   ```
   https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates
   ```
4. Cerca `"chat":{"id":` nel JSON - quel numero è il tuo Chat ID
5. **Salva il Chat ID** (es: `123456789`)

---

## 🔧 Passo 2: Installare Dipendenza Telegram

```bash
cd backend
npm install node-telegram-bot-api
```

---

## 📦 Passo 3: Creare Servizio Telegram

Crea il file `backend/services/TelegramService.js`:

```javascript
// backend/services/TelegramService.js
const TelegramBot = require('node-telegram-bot-api');

class TelegramService {
  constructor() {
    this.bot = null;
    this.chatId = null;
    this.enabled = false;
  }

  // Inizializza il bot Telegram
  initialize(botToken, chatId) {
    if (!botToken || !chatId) {
      console.warn('⚠️ TelegramService: Token o Chat ID non configurati');
      this.enabled = false;
      return false;
    }

    try {
      this.bot = new TelegramBot(botToken, { polling: false });
      this.chatId = chatId;
      this.enabled = true;
      console.log('✅ TelegramService inizializzato');
      return true;
    } catch (error) {
      console.error('❌ Errore inizializzazione TelegramService:', error);
      this.enabled = false;
      return false;
    }
  }

  // Invia messaggio Telegram
  async sendMessage(message, options = {}) {
    if (!this.enabled || !this.bot || !this.chatId) {
      console.warn('⚠️ TelegramService: Bot non configurato, messaggio non inviato');
      return false;
    }

    try {
      await this.bot.sendMessage(this.chatId, message, {
        parse_mode: 'HTML',
        ...options
      });
      return true;
    } catch (error) {
      console.error('❌ Errore invio messaggio Telegram:', error.message);
      return false;
    }
  }

  // Formatta messaggio per agent offline
  formatAgentOfflineMessage(agentName, lastHeartbeat) {
    const lastSeen = lastHeartbeat 
      ? new Date(lastHeartbeat).toLocaleString('it-IT')
      : 'Mai';
    
    return `🔴 <b>Agent Offline</b>

<b>Agent:</b> ${agentName}
<b>Ultimo heartbeat:</b> ${lastSeen}
<b>Timestamp:</b> ${new Date().toLocaleString('it-IT')}`;
  }

  // Formatta messaggio per cambio IP (dispositivo statico)
  formatIPChangedMessage(deviceInfo) {
    return `⚠️ <b>IP Cambiato (Dispositivo Statico)</b>

<b>Dispositivo:</b> ${deviceInfo.hostname || deviceInfo.mac || 'Sconosciuto'}
<b>MAC:</b> ${deviceInfo.mac || 'N/A'}
<b>IP Precedente:</b> ${deviceInfo.oldIP}
<b>IP Nuovo:</b> ${deviceInfo.newIP}
<b>Agent:</b> ${deviceInfo.agentName}
<b>Timestamp:</b> ${new Date().toLocaleString('it-IT')}`;
  }

  // Formatta messaggio per cambio MAC (dispositivo statico)
  formatMACChangedMessage(deviceInfo) {
    return `⚠️ <b>MAC Cambiato (Dispositivo Statico)</b>

<b>Dispositivo:</b> ${deviceInfo.hostname || deviceInfo.ip || 'Sconosciuto'}
<b>IP:</b> ${deviceInfo.ip || 'N/A'}
<b>MAC Precedente:</b> ${deviceInfo.oldMAC}
<b>MAC Nuovo:</b> ${deviceInfo.newMAC}
<b>Agent:</b> ${deviceInfo.agentName}
<b>Timestamp:</b> ${new Date().toLocaleString('it-IT')}`;
  }

  // Formatta messaggio per dispositivo statico online/offline
  formatDeviceStatusMessage(deviceInfo) {
    const emoji = deviceInfo.status === 'online' ? '🟢' : '🔴';
    const statusText = deviceInfo.status === 'online' ? 'Online' : 'Offline';
    
    return `${emoji} <b>Dispositivo Statico ${statusText}</b>

<b>Dispositivo:</b> ${deviceInfo.hostname || deviceInfo.mac || deviceInfo.ip || 'Sconosciuto'}
<b>IP:</b> ${deviceInfo.ip || 'N/A'}
<b>MAC:</b> ${deviceInfo.mac || 'N/A'}
<b>Stato Precedente:</b> ${deviceInfo.oldStatus || 'N/A'}
<b>Stato Attuale:</b> ${statusText}
<b>Agent:</b> ${deviceInfo.agentName}
<b>Timestamp:</b> ${new Date().toLocaleString('it-IT')}`;
  }
}

// Esporta singleton
module.exports = new TelegramService();
```

---

## 🗄️ Passo 4: Creare Tabella Database per Configurazione Telegram

Aggiungi questa migrazione in `backend/routes/networkMonitoring.js` nella funzione `initTables`:

```javascript
// Aggiungi dopo le altre creazioni tabelle
await pool.query(`
  CREATE TABLE IF NOT EXISTS network_telegram_config (
    id SERIAL PRIMARY KEY,
    azienda_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    agent_id INTEGER REFERENCES network_agents(id) ON DELETE CASCADE,
    bot_token VARCHAR(255) NOT NULL,
    chat_id VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    notify_agent_offline BOOLEAN DEFAULT true,
    notify_ip_changes BOOLEAN DEFAULT true,
    notify_mac_changes BOOLEAN DEFAULT true,
    notify_status_changes BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(azienda_id, agent_id)
  );
`);

await pool.query(`
  CREATE INDEX IF NOT EXISTS idx_network_telegram_config_azienda 
  ON network_telegram_config(azienda_id);
`);

await pool.query(`
  CREATE INDEX IF NOT EXISTS idx_network_telegram_config_agent 
  ON network_telegram_config(agent_id);
`);
```

---

## ⚙️ Passo 5: Integrare TelegramService nel Backend

### 5.1 Importa il Servizio

In `backend/routes/networkMonitoring.js`, all'inizio del file:

```javascript
const telegramService = require('../services/TelegramService');
```

### 5.2 Funzione Helper per Inviare Notifiche

Aggiungi questa funzione in `networkMonitoring.js`:

```javascript
// Funzione helper per inviare notifiche Telegram
async function sendTelegramNotification(agentId, aziendaId, messageType, data) {
  try {
    // Ottieni configurazione Telegram per questo agent/azienda
    const configResult = await pool.query(
      `SELECT bot_token, chat_id, enabled, 
              notify_agent_offline, notify_ip_changes, 
              notify_mac_changes, notify_status_changes
       FROM network_telegram_config
       WHERE (agent_id = $1 OR azienda_id = $2)
         AND enabled = true
       ORDER BY agent_id DESC NULLS LAST
       LIMIT 1`,
      [agentId, aziendaId]
    );

    if (configResult.rows.length === 0) {
      return false; // Nessuna configurazione Telegram
    }

    const config = configResult.rows[0];
    
    // Verifica se questo tipo di notifica è abilitato
    let shouldNotify = false;
    let message = '';

    switch (messageType) {
      case 'agent_offline':
        shouldNotify = config.notify_agent_offline;
        if (shouldNotify) {
          message = telegramService.formatAgentOfflineMessage(
            data.agentName,
            data.lastHeartbeat
          );
        }
        break;

      case 'ip_changed':
        shouldNotify = config.notify_ip_changes;
        if (shouldNotify) {
          message = telegramService.formatIPChangedMessage(data);
        }
        break;

      case 'mac_changed':
        shouldNotify = config.notify_mac_changes;
        if (shouldNotify) {
          message = telegramService.formatMACChangedMessage(data);
        }
        break;

      case 'status_changed':
        shouldNotify = config.notify_status_changes;
        if (shouldNotify) {
          message = telegramService.formatDeviceStatusMessage(data);
        }
        break;

      default:
        return false;
    }

    if (!shouldNotify || !message) {
      return false;
    }

    // Inizializza bot se non già fatto
    if (!telegramService.enabled) {
      telegramService.initialize(config.bot_token, config.chat_id);
    } else {
      // Aggiorna token/chat se cambiati
      telegramService.bot = new TelegramBot(config.bot_token, { polling: false });
      telegramService.chatId = config.chat_id;
    }

    // Invia messaggio
    return await telegramService.sendMessage(message);
  } catch (error) {
    console.error('❌ Errore invio notifica Telegram:', error);
    return false;
  }
}
```

---

## 🔔 Passo 6: Implementare Notifiche

### 6.1 Notifica Agent Offline (Backend)

Modifica la funzione `checkOfflineAgents` in `networkMonitoring.js`:

```javascript
// Nella funzione checkOfflineAgents, dopo aver trovato agent offline:
for (const agent of offlineAgents.rows) {
  // ... codice esistente per aggiornare status ...
  
  // Invia notifica Telegram
  const agentInfo = await pool.query(
    'SELECT azienda_id FROM network_agents WHERE id = $1',
    [agent.id]
  );
  
  if (agentInfo.rows.length > 0) {
    await sendTelegramNotification(
      agent.id,
      agentInfo.rows[0].azienda_id,
      'agent_offline',
      {
        agentName: agent.agent_name,
        lastHeartbeat: agent.last_heartbeat
      }
    );
  }
}
```

### 6.2 Notifiche Cambiamenti Dispositivi Statici (Backend)

Modifica la sezione che gestisce i cambiamenti in `networkMonitoring.js` (dopo la riga ~1058):

```javascript
// Quando rilevi cambio IP per dispositivo statico:
if (existingDevice.is_static && normalizedCurrentIp !== existingIp) {
  // ... codice esistente ...
  
  // Invia notifica Telegram
  const agentInfo = await pool.query(
    'SELECT agent_name, azienda_id FROM network_agents WHERE id = $1',
    [agentId]
  );
  
  if (agentInfo.rows.length > 0) {
    await sendTelegramNotification(
      agentId,
      agentInfo.rows[0].azienda_id,
      'ip_changed',
      {
        hostname: existingDevice.hostname,
        mac: existingDevice.mac_address,
        oldIP: existingIp,
        newIP: normalizedCurrentIp,
        agentName: agentInfo.rows[0].agent_name
      }
    );
  }
}

// Quando rilevi cambio MAC per dispositivo statico (dopo riga ~1084):
if (existingDevice.is_static && existingDevice.mac_address) {
  // ... codice esistente ...
  
  // Invia notifica Telegram
  const agentInfo = await pool.query(
    'SELECT agent_name, azienda_id FROM network_agents WHERE id = $1',
    [agentId]
  );
  
  if (agentInfo.rows.length > 0) {
    await sendTelegramNotification(
      agentId,
      agentInfo.rows[0].azienda_id,
      'mac_changed',
      {
        hostname: existingDevice.hostname,
        ip: existingDevice.ip_address,
        oldMAC: existingDevice.mac_address,
        newMAC: normalizedMac,
        agentName: agentInfo.rows[0].agent_name
      }
    );
  }
}
```

### 6.3 Notifica Online/Offline Dispositivo Statico

L'agent deve inviare questi cambiamenti. Modifica `agent/NetworkMonitorService.ps1` per rilevare cambiamenti di status su dispositivi statici e inviarli al backend.

Nel backend, quando ricevi `change_type === 'device_offline'` o `'device_online'` per un dispositivo statico:

```javascript
// Nella sezione che gestisce changes (dopo riga ~1304):
if (change_type === 'device_offline' || change_type === 'device_online') {
  // ... codice esistente ...
  
  // Verifica se è un dispositivo statico
  const deviceCheck = await pool.query(
    'SELECT is_static, hostname, ip_address, mac_address FROM network_devices WHERE id = $1',
    [deviceId]
  );
  
  if (deviceCheck.rows.length > 0 && deviceCheck.rows[0].is_static) {
    const device = deviceCheck.rows[0];
    const agentInfo = await pool.query(
      'SELECT agent_name, azienda_id FROM network_agents WHERE id = $1',
      [agentId]
    );
    
    if (agentInfo.rows.length > 0) {
      await sendTelegramNotification(
        agentId,
        agentInfo.rows[0].azienda_id,
        'status_changed',
        {
          hostname: device.hostname,
          ip: device.ip_address,
          mac: device.mac_address,
          oldStatus: change_type === 'device_offline' ? 'online' : 'offline',
          status: change_type === 'device_offline' ? 'offline' : 'online',
          agentName: agentInfo.rows[0].agent_name
        }
      );
    }
  }
}
```

---

## 🌐 Passo 7: API per Configurare Telegram

Aggiungi questi endpoint in `networkMonitoring.js`:

```javascript
// POST /api/network-monitoring/telegram/config
// Configura notifiche Telegram per un'azienda o agent
router.post('/telegram/config', authenticateToken, requireRole('tecnico'), async (req, res) => {
  try {
    const { azienda_id, agent_id, bot_token, chat_id, enabled, 
            notify_agent_offline, notify_ip_changes, 
            notify_mac_changes, notify_status_changes } = req.body;

    if (!bot_token || !chat_id) {
      return res.status(400).json({ error: 'bot_token e chat_id sono obbligatori' });
    }

    const result = await pool.query(
      `INSERT INTO network_telegram_config 
       (azienda_id, agent_id, bot_token, chat_id, enabled,
        notify_agent_offline, notify_ip_changes, notify_mac_changes, notify_status_changes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (azienda_id, agent_id) 
       DO UPDATE SET 
         bot_token = EXCLUDED.bot_token,
         chat_id = EXCLUDED.chat_id,
         enabled = EXCLUDED.enabled,
         notify_agent_offline = EXCLUDED.notify_agent_offline,
         notify_ip_changes = EXCLUDED.notify_ip_changes,
         notify_mac_changes = EXCLUDED.notify_mac_changes,
         notify_status_changes = EXCLUDED.notify_status_changes,
         updated_at = NOW()
       RETURNING *`,
      [azienda_id || null, agent_id || null, bot_token, chat_id, enabled !== false,
       notify_agent_offline !== false, notify_ip_changes !== false,
       notify_mac_changes !== false, notify_status_changes !== false]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ Errore configurazione Telegram:', err);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// GET /api/network-monitoring/telegram/config
// Ottieni configurazione Telegram
router.get('/telegram/config', authenticateToken, requireRole('tecnico'), async (req, res) => {
  try {
    const { azienda_id, agent_id } = req.query;
    
    let query = 'SELECT * FROM network_telegram_config WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (azienda_id) {
      query += ` AND azienda_id = $${paramIndex++}`;
      params.push(azienda_id);
    }

    if (agent_id) {
      query += ` AND agent_id = $${paramIndex++}`;
      params.push(agent_id);
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Errore recupero configurazione Telegram:', err);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});
```

---

## 🤖 Passo 8: Modificare Agent per Rilevare Cambiamenti Status

L'agent deve rilevare quando un dispositivo statico va online/offline. Modifica `agent/NetworkMonitorService.ps1` per:

1. Confrontare lo status attuale con quello precedente
2. Inviare un change al backend quando cambia lo status di un dispositivo statico

---

## ✅ Passo 9: Test

1. Configura Telegram tramite API
2. Marca un dispositivo come statico
3. Cambia IP/MAC del dispositivo
4. Verifica che arrivi la notifica su Telegram

---

## 📝 Note Importanti

- **Sicurezza**: Il bot_token è sensibile, non committarlo su GitHub
- **Rate Limiting**: Telegram ha limiti (30 messaggi/secondo), gestisci eventuali errori
- **Privacy**: I chat_id sono personali, non condividerli
