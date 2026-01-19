# Configurazione Telegram per Notifiche Tecnici

## 📱 Panoramica

Il sistema TicketApp è configurato per inviare notifiche push su Telegram ai tecnici per eventi importanti, invece che via email (che rimane attiva per i clienti).

---

## 🤖 Bot Telegram Configurato

- **Bot Name**: TicketApp Notifiche
- **Username**: @LogikaService_TicketApp_Bot
- **Bot Token**: *(Configurato nel file `.env` - NON committare)*
- **Tecnico Chat ID**: *(Configurato nel file `.env` - Ottienilo con `/start` al bot)*

---

## ⚙️ Configurazione .env sulla VPS

Aggiungi queste variabili al file `.env` del backend:

```bash
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

### Comandi per configurare sulla VPS:

```bash
cd /var/www/ticketapp/TicketApp/backend

# Aggiungi le variabili al file .env (sostituisci con i tuoi valori)
echo "" >> .env
echo "# Telegram Bot Configuration" >> .env
echo "TELEGRAM_BOT_TOKEN=your_bot_token_here" >> .env
echo "TELEGRAM_CHAT_ID=your_chat_id_here" >> .env

# Riavvia il backend per caricare le nuove variabili
pm2 restart backend
```

---

## 🔔 Notifiche Implementate

Il sistema invia notifiche Telegram al tecnico per:

### 1. **Segnalazioni KeePass** 🔐
Quando un cliente crea una segnalazione KeePass:
- Titolo e tipo (informazione/avviso/critico)
- Descrizione
- Dettagli credenziale (titolo, username, URL, percorso gruppo)
- Dati cliente (nome, azienda)
- ID segnalazione

### 2. **Nuovi Ticket** 🎫
Quando viene creato un nuovo ticket:
- Titolo del ticket
- Priorità (bassa/media/alta/urgente)
- Descrizione (primi 200 caratteri)
- Cliente e azienda
- ID ticket

### 3. **Aggiornamenti Ticket** 🔄
Quando cambia lo stato di un ticket:
- Titolo del ticket
- Nuovo stato
- Utente che ha modificato
- ID ticket

### 4. **Avvisi Importanti** 📢
Quando viene creato un avviso importante:
- Titolo
- Livello (info/warning/danger/success)
- Messaggio (primi 300 caratteri)
- Creato da
- ID avviso

### 5. **Agent Offline** 🔴
Quando un agent risulta offline:
- Nome azienda
- ID agent
- Minuti offline
- Avviso di verifica connessione

---

## 🧪 Test Notifiche Telegram

Per testare che le notifiche funzionino correttamente:

### 1. Test Segnalazione KeePass
```bash
# Dalla dashboard cliente, vai su:
# Credenziali KeePass → Ricerca → "Segnala Problema"
# Compila il form e invia
```

### 2. Test Nuovo Ticket
```bash
# Dalla dashboard cliente, clicca su:
# "Nuovo Ticket" → Compila → Invia
```

### 3. Test Telegram Diretto
```bash
cd /var/www/ticketapp/TicketApp/backend

node -e "
const telegramService = require('./utils/telegramService');
telegramService.notifyGeneric('Test Notifica', 'Questo è un test dal backend').then(success => {
  console.log(success ? '✅ Notifica inviata!' : '❌ Errore invio');
  process.exit(0);
});
"
```

---

## 📊 Verifica Log

Dopo aver configurato Telegram, verifica i log:

```bash
# Monitora i log del backend
pm2 logs backend --lines 20

# Cerca log specifici di Telegram
pm2 logs backend | grep "📱\|Telegram"
```

### Log di successo:
```
📱 Notifica Telegram inviata con successo
```

### Log di errore:
```
❌ Errore invio Telegram: [messaggio]
⚠️ Telegram non configurato (TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID mancanti)
```

---

## 🆘 Risoluzione Problemi

### Problema: Notifiche non arrivano su Telegram

1. **Verifica configurazione .env**:
   ```bash
   cd /var/www/ticketapp/TicketApp/backend
   grep TELEGRAM_ .env
   ```

2. **Verifica che il bot sia avviato**:
   - Su Telegram, cerca `@LogikaService_TicketApp_Bot`
   - Invia `/start`
   - Il bot dovrebbe rispondere

3. **Test connettività API Telegram**:
   ```bash
   curl "https://api.telegram.org/bot<TUO_BOT_TOKEN>/getMe"
   ```
   Risposta attesa: `{"ok":true,"result":{...}}`

4. **Verifica Chat ID**:
   ```bash
   curl "https://api.telegram.org/bot<TUO_BOT_TOKEN>/getUpdates"
   ```
   Cerca il campo `"chat":{"id":XXXXXX}` (il tuo Chat ID)

5. **Riavvia backend**:
   ```bash
   pm2 restart backend
   pm2 logs backend --lines 50
   ```

---

## 🔄 Aggiungere Altri Tecnici

Per ricevere notifiche su più chat Telegram:

1. **Ogni tecnico deve**:
   - Aprire Telegram
   - Cercare `@LogikaService_TicketApp_Bot`
   - Inviare `/start`

2. **Ottenere il Chat ID**:
   ```bash
   curl "https://api.telegram.org/bot<TUO_BOT_TOKEN>/getUpdates"
   ```

3. **Modificare `telegramService.js`**:
   - Cambiare da singolo Chat ID a array di Chat IDs
   - Inviare notifiche in loop a tutti i tecnici

---

## 📧 Email vs Telegram

### Per Tecnici:
- ✅ **Telegram**: Notifiche immediate per tutte le attività
- ❌ **Email**: Disattivate (attendendo sblocco porte SMTP da Hetzner)

### Per Clienti:
- ❌ **Telegram**: Non configurato
- ✅ **Email**: Attive quando Hetzner sbloccherà le porte SMTP (587, 465)

---

## 📝 Note Tecniche

- Il servizio Telegram è implementato in `backend/utils/telegramService.js`
- Usa l'API HTTPS di Telegram (nessuna dipendenza esterna)
- Le notifiche sono asincrone (non bloccano le risposte HTTP)
- Formato messaggi: HTML con emoji e formattazione
- Timeout di 10 secondi per richieste API
- Gli errori vengono loggati ma non bloccano le operazioni principali

---

## 🔐 Sicurezza

- **Bot Token**: Mantienilo privato, non condividerlo pubblicamente
- **Chat ID**: Specifico per ogni utente Telegram
- **Variabili .env**: NON committare nel repository Git
- **File .env**: Protetto da permessi Linux (600)

---

## 📚 Risorse

- **Telegram Bot API**: https://core.telegram.org/bots/api
- **Bot Father**: https://t.me/BotFather
- **Test Bot**: https://t.me/LogikaService_TicketApp_Bot

---

**Ultimo aggiornamento**: 2026-01-19
