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
      return { success: false, error: 'Bot non configurato' };
    }

    try {
      await this.bot.sendMessage(this.chatId, message, {
        parse_mode: 'HTML',
        ...options
      });
      return { success: true };
    } catch (error) {
      console.error('❌ Errore invio messaggio Telegram:', error.message);
      
      let errorMessage = 'Errore invio messaggio Telegram';
      if (error.response && error.response.statusCode === 401) {
        errorMessage = 'Token bot o Chat ID non validi. Verifica che il bot token sia corretto e che tu abbia avviato il bot con /start.';
      } else if (error.response && error.response.statusCode === 400) {
        errorMessage = 'Chat ID non valido o bot non autorizzato. Assicurati di aver avviato il bot con /start.';
      } else if (error.response && error.response.statusCode === 403) {
        errorMessage = 'Bot bloccato o senza permessi. Controlla che il bot non sia stato bloccato dall\'utente.';
      }
      
      return { success: false, error: errorMessage, details: error.message };
    }
  }

  // Formatta messaggio per agent offline
  formatAgentOfflineMessage(agentName, lastHeartbeat, aziendaName) {
    const lastSeen = lastHeartbeat 
      ? new Date(lastHeartbeat).toLocaleString('it-IT')
      : 'Mai';
    
    return `🔴 <b>Agent Offline</b>

<b>Azienda:</b> ${aziendaName || 'N/A'}
<b>Agent:</b> ${agentName}
<b>Ultimo heartbeat:</b> ${lastSeen}
<b>Timestamp:</b> ${new Date().toLocaleString('it-IT')}`;
  }

  // Formatta messaggio per cambio IP (dispositivo statico)
  formatIPChangedMessage(deviceInfo) {
    return `⚠️ <b>IP Cambiato</b>

<b>Azienda:</b> ${deviceInfo.aziendaName || 'N/A'}
<b>Agent:</b> ${deviceInfo.agentName || 'N/A'}
<b>Dispositivo:</b> ${deviceInfo.hostname || deviceInfo.deviceType || 'Sconosciuto'}
<b>IP Precedente:</b> ${deviceInfo.oldIP}
<b>IP Nuovo:</b> ${deviceInfo.newIP}
<b>MAC:</b> ${deviceInfo.mac || 'N/A'}
<b>Timestamp:</b> ${new Date().toLocaleString('it-IT')}`;
  }

  // Formatta messaggio per cambio MAC (dispositivo statico)
  formatMACChangedMessage(deviceInfo) {
    return `⚠️ <b>MAC Cambiato</b>

<b>Azienda:</b> ${deviceInfo.aziendaName || 'N/A'}
<b>Agent:</b> ${deviceInfo.agentName || 'N/A'}
<b>Dispositivo:</b> ${deviceInfo.hostname || deviceInfo.deviceType || 'Sconosciuto'}
<b>IP:</b> ${deviceInfo.ip || 'N/A'}
<b>MAC Precedente:</b> ${deviceInfo.oldMAC}
<b>MAC Nuovo:</b> ${deviceInfo.newMAC}
<b>Timestamp:</b> ${new Date().toLocaleString('it-IT')}`;
  }

  // Formatta messaggio per dispositivo statico online/offline
  formatDeviceStatusMessage(deviceInfo) {
    const isOnline = deviceInfo.status === 'online';
    const statusEmoji = isOnline ? '🟢' : '🔴';
    const deviceLabel = (deviceInfo.hostname || deviceInfo.deviceType || '').toLowerCase();

    // Scegli icona in base al tipo di dispositivo (coerente con il monitoraggio)
    let deviceEmoji = '💻'; // default: PC
    if (deviceLabel.includes('ap') || deviceLabel.includes('u6') || deviceLabel.includes('wi-fi') || deviceLabel.includes('wifi') || deviceLabel.includes('access point')) {
      // Access Point / WiFi
      deviceEmoji = '📶';
    } else if (deviceLabel.includes('switch')) {
      deviceEmoji = '🔀';
    } else if (deviceLabel.includes('server')) {
      deviceEmoji = '🖥️';
    } else if (deviceLabel.includes('router')) {
      deviceEmoji = '📡';
    }

    const emoji = `${statusEmoji} ${deviceEmoji}`;
    const statusText = deviceInfo.status === 'online' ? 'Online' : 'Offline';
    
    return `${emoji} <b>Dispositivo ${statusText}</b>

<b>Azienda:</b> ${deviceInfo.aziendaName || 'N/A'}
<b>Agent:</b> ${deviceInfo.agentName || 'N/A'}
<b>Dispositivo:</b> ${deviceInfo.hostname || deviceInfo.deviceType || 'Sconosciuto'}
<b>IP:</b> ${deviceInfo.ip || 'N/A'}
<b>MAC:</b> ${deviceInfo.mac || 'N/A'}
<b>Stato Precedente:</b> ${deviceInfo.oldStatus || 'N/A'}
<b>Timestamp:</b> ${new Date().toLocaleString('it-IT')}`;
  }
}

// Esporta singleton
module.exports = new TelegramService();
