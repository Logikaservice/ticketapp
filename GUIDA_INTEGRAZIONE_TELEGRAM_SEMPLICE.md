# 📱 Guida Semplice: Integrazione Telegram con il Tuo Account

## 🎯 Come Funziona

Il sistema invia notifiche Telegram direttamente al tuo account quando succedono eventi importanti nel Network Monitoring:
- 🔴 Agent offline
- ⚠️ Cambio IP su dispositivi statici
- ⚠️ Cambio MAC su dispositivi statici
- 🟢/🔴 Dispositivo statico va online/offline

## 📋 Passo 1: Crea il Bot Telegram

### 1.1 Apri Telegram e cerca BotFather

1. Apri l'app **Telegram** sul tuo telefono o computer
2. Cerca **@BotFather** nella barra di ricerca
3. Clicca su **@BotFather** (dovrebbe avere un badge blu "VERIFIED")

### 1.2 Crea un Nuovo Bot

1. Invia il comando: `/newbot`
2. BotFather ti chiederà un **nome** per il bot (es: "Network Monitor Logika")
3. BotFather ti chiederà un **username** per il bot (deve finire con `bot`, es: `network_monitor_logika_bot`)
4. BotFather ti darà un **TOKEN** tipo: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`
5. **COPIA E SALVA QUESTO TOKEN** - ti servirà dopo!

## 📋 Passo 2: Ottieni il Tuo Chat ID

### Metodo 1: Usando il Bot che hai appena creato

1. Cerca il tuo bot su Telegram (usa l'username che hai scelto, es: `@network_monitor_logika_bot`)
2. Clicca su **START** o invia `/start` al bot
3. Apri questo URL nel browser (sostituisci `YOUR_BOT_TOKEN` con il token che hai ricevuto):
   ```
   https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates
   ```
4. Cerca nel JSON la riga `"chat":{"id":` - il numero dopo `"id":` è il tuo **Chat ID**
5. **COPIA E SALVA QUESTO NUMERO** (es: `123456789`)

### Metodo 2: Usando @userinfobot

1. Cerca **@userinfobot** su Telegram
2. Invia `/start` a @userinfobot
3. Ti risponderà con il tuo Chat ID

## 📋 Passo 3: Configura nel Sistema

1. Apri **Monitoraggio Rete** nel sistema TicketApp
2. Clicca sul **menu hamburger** (icona Menu in alto a sinistra)
3. Seleziona **"Notifiche Telegram"**
4. Clicca su **"Nuova Configurazione"**
5. Compila il form:
   - **Azienda**: Seleziona un'azienda specifica (o lascia "Tutte le aziende")
   - **Agent**: Seleziona un agent specifico (o lascia "Tutti gli agent")
   - **Bot Token**: Incolla il token che hai ricevuto da BotFather
   - **Chat ID**: Incolla il tuo Chat ID
   - **Abilita notifiche**: ✅ (spunta)
   - **Tipi di notifiche**: Spunta quelli che vuoi ricevere:
     - ✅ Agent offline
     - ✅ Cambio IP (dispositivi statici)
     - ✅ Cambio MAC (dispositivi statici)
     - ✅ Online/Offline (dispositivi statici)
6. Clicca su **"Salva"**

## ✅ Fatto!

Ora riceverai notifiche Telegram quando:
- Un agent va offline
- Un dispositivo statico cambia IP
- Un dispositivo statico cambia MAC
- Un dispositivo statico va online o offline

## 🔧 Come Disabilitare le Notifiche

1. Vai in **Monitoraggio Rete** → **Menu** → **Notifiche Telegram**
2. Nella lista delle configurazioni, clicca sull'icona **campanella** (Bell/BellOff)
3. Le notifiche verranno disabilitate immediatamente

## 🔧 Come Modificare la Configurazione

1. Vai in **Monitoraggio Rete** → **Menu** → **Notifiche Telegram**
2. Clicca sull'icona **matita** (Edit) sulla configurazione che vuoi modificare
3. Modifica i campi che vuoi cambiare
4. Clicca su **"Salva"**

## 🔧 Come Eliminare una Configurazione

1. Vai in **Monitoraggio Rete** → **Menu** → **Notifiche Telegram**
2. Clicca sull'icona **cestino** (Trash) sulla configurazione che vuoi eliminare
3. Conferma l'eliminazione

## 📝 Note Importanti

- **Sicurezza**: Il Bot Token è sensibile - non condividerlo pubblicamente
- **Privacy**: Il Chat ID è personale - solo tu riceverai le notifiche
- **Multiple Configurazioni**: Puoi creare più configurazioni (es: una per azienda, una per agent specifico)
- **Priorità**: Se hai più configurazioni, il sistema userà quella più specifica (agent > azienda > globale)

## 🆘 Problemi Comuni

### "Bot Token non valido"
- Verifica di aver copiato tutto il token da BotFather
- Assicurati che non ci siano spazi prima o dopo

### "Chat ID non valido"
- Verifica di aver inviato `/start` al bot prima di ottenere il Chat ID
- Prova a usare @userinfobot per ottenere il tuo Chat ID

### "Non ricevo notifiche"
- Verifica che la configurazione sia "Attiva" (badge verde)
- Controlla che i tipi di notifica siano spuntati
- Verifica che il bot sia ancora attivo su Telegram

### "Ricevo notifiche duplicate"
- Controlla se hai più configurazioni attive che si sovrappongono
- Elimina le configurazioni duplicate

## 🎉 Esempio di Notifica

Quando un agent va offline, riceverai un messaggio tipo:

```
🔴 Agent Offline

Agent: Logika Service - Ufficio
Ultimo heartbeat: 16/01/2026, 17:30:00
Timestamp: 16/01/2026, 17:38:00
```
