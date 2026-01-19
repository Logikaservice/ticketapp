/**
 * Servizio Telegram per invio notifiche ai tecnici
 * Invia notifiche push su Telegram invece che via email
 */

// Carica variabili d'ambiente dal file .env
require('dotenv').config();

const https = require('https');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/**
 * Invia un messaggio su Telegram
 * @param {string} message - Messaggio in formato Markdown o HTML
 * @param {string} parseMode - 'Markdown' o 'HTML' (default: 'HTML')
 * @returns {Promise<boolean>} - true se inviato con successo
 */
async function sendTelegramMessage(message, parseMode = 'HTML') {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn('⚠️ Telegram non configurato (TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID mancanti)');
    return false;
  }

  const payload = JSON.stringify({
    chat_id: TELEGRAM_CHAT_ID,
    text: message,
    parse_mode: parseMode,
    disable_web_page_preview: true
  });

  const options = {
    hostname: 'api.telegram.org',
    path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('📱 Notifica Telegram inviata con successo');
          resolve(true);
        } else {
          console.error('❌ Errore invio Telegram:', res.statusCode, data);
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      console.error('❌ Errore connessione Telegram:', err.message);
      resolve(false);
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Invia notifica per nuova segnalazione KeePass
 */
async function notifyKeePassReport(reportData) {
  const { reportId, titolo, tipo, descrizione, cliente, credenziale } = reportData;
  
  const tipoEmoji = {
    'informazione': 'ℹ️',
    'avviso': '⚠️',
    'critico': '🚨'
  };

  const emoji = tipoEmoji[tipo] || '🔐';

  let message = `${emoji} <b>Nuova Segnalazione KeePass</b>\n\n`;
  message += `<b>Tipo:</b> ${tipo.toUpperCase()}\n`;
  message += `<b>Titolo:</b> ${titolo}\n\n`;
  
  if (descrizione) {
    message += `<b>Descrizione:</b>\n${descrizione}\n\n`;
  }

  if (credenziale) {
    message += `<b>Credenziale:</b>\n`;
    message += `• Titolo: ${credenziale.title || 'N/A'}\n`;
    message += `• Username: ${credenziale.username || 'N/A'}\n`;
    message += `• Gruppo: ${credenziale.groupPath || 'N/A'}\n\n`;
  }

  if (cliente) {
    message += `<b>Cliente:</b> ${cliente.nome} ${cliente.cognome}\n`;
    message += `<b>Azienda:</b> ${cliente.azienda || 'N/A'}\n`;
  }

  message += `\n<b>ID Segnalazione:</b> #${reportId}`;

  return await sendTelegramMessage(message);
}

/**
 * Invia notifica per nuovo ticket
 */
async function notifyNewTicket(ticketData) {
  const { ticketId, titolo, descrizione, priorita, cliente, azienda } = ticketData;

  const prioritaEmoji = {
    'bassa': '🟢',
    'media': '🟡',
    'alta': '🔴',
    'urgente': '🚨'
  };

  const emoji = prioritaEmoji[priorita?.toLowerCase()] || '🎫';

  let message = `${emoji} <b>Nuovo Ticket Creato</b>\n\n`;
  message += `<b>Titolo:</b> ${titolo}\n`;
  message += `<b>Priorità:</b> ${priorita || 'Non specificata'}\n\n`;
  
  if (descrizione) {
    const desc = descrizione.length > 200 
      ? descrizione.substring(0, 200) + '...' 
      : descrizione;
    message += `<b>Descrizione:</b>\n${desc}\n\n`;
  }

  if (cliente) {
    message += `<b>Cliente:</b> ${cliente}\n`;
  }
  
  if (azienda) {
    message += `<b>Azienda:</b> ${azienda}\n`;
  }

  message += `\n<b>ID Ticket:</b> #${ticketId}`;

  return await sendTelegramMessage(message);
}

/**
 * Invia notifica per ticket modificato
 */
async function notifyTicketUpdate(ticketData) {
  const { ticketId, titolo, stato, modificatoDa } = ticketData;

  let message = `🔄 <b>Ticket Aggiornato</b>\n\n`;
  message += `<b>Ticket:</b> ${titolo}\n`;
  message += `<b>Nuovo Stato:</b> ${stato}\n`;
  
  if (modificatoDa) {
    message += `<b>Modificato da:</b> ${modificatoDa}\n`;
  }

  message += `\n<b>ID Ticket:</b> #${ticketId}`;

  return await sendTelegramMessage(message);
}

/**
 * Invia notifica per nuovo avviso importante
 */
async function notifyImportantAlert(alertData) {
  const { alertId, titolo, messaggio, livello, creatoDa } = alertData;

  const livelloEmoji = {
    'info': 'ℹ️',
    'warning': '⚠️',
    'danger': '🚨',
    'success': '✅'
  };

  const emoji = livelloEmoji[livello] || '📢';

  let message = `${emoji} <b>Nuovo Avviso Importante</b>\n\n`;
  message += `<b>Titolo:</b> ${titolo}\n`;
  message += `<b>Livello:</b> ${livello?.toUpperCase() || 'INFO'}\n\n`;
  
  if (messaggio) {
    const msg = messaggio.length > 300 
      ? messaggio.substring(0, 300) + '...' 
      : messaggio;
    message += `<b>Messaggio:</b>\n${msg}\n\n`;
  }

  if (creatoDa) {
    message += `<b>Creato da:</b> ${creatoDa}\n`;
  }

  message += `\n<b>ID Avviso:</b> #${alertId}`;

  return await sendTelegramMessage(message);
}

/**
 * Invia notifica per agent offline
 */
async function notifyAgentOffline(agentData) {
  const { agentId, nomeAzienda, offlineMinuti } = agentData;

  let message = `🔴 <b>Agent Offline Rilevato</b>\n\n`;
  message += `<b>Azienda:</b> ${nomeAzienda}\n`;
  message += `<b>Agent ID:</b> ${agentId}\n`;
  message += `<b>Offline da:</b> ${offlineMinuti} minuti\n\n`;
  message += `⚠️ Verificare la connessione dell'agent`;

  return await sendTelegramMessage(message);
}

/**
 * Invia notifica generica
 */
async function notifyGeneric(title, body, emoji = '🔔') {
  let message = `${emoji} <b>${title}</b>\n\n${body}`;
  return await sendTelegramMessage(message);
}

module.exports = {
  sendTelegramMessage,
  notifyKeePassReport,
  notifyNewTicket,
  notifyTicketUpdate,
  notifyImportantAlert,
  notifyAgentOffline,
  notifyGeneric
};
