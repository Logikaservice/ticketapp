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
