# Sistema di Autorizzazione Monitor PackVision

## 🎯 Obiettivo

Proteggere l'accesso ai monitor PackVision tramite un sistema di autorizzazione con codice univoco, evitando login manuali ma mantenendo la sicurezza.

## 🔐 Come Funziona

### 1. Richiesta Autorizzazione

Quando un monitor accede per la prima volta a `https://packvision.logikaservice.it/?mode=display&monitor=X`:

1. **Verifica Token**: Il sistema verifica se esiste un token valido nel localStorage
2. **Se non c'è token**: Mostra schermata di richiesta autorizzazione
3. **Richiesta Codice**: L'utente clicca su "Richiedi Codice"
4. **Generazione Codice**: Viene generato un codice univoco a 6 cifre
5. **Email Automatica**: Il codice viene inviato a `info@logikaservice.it` con:
   - Numero monitor
   - Codice di autorizzazione
   - IP e informazioni browser
   - Link diretto a PackVision Control

### 2. Autorizzazione da PackVision Control

1. **Accesso Interfaccia**: L'amministratore accede a PackVision Control
2. **Sezione Autorizzazioni**: Scorri fino alla sezione "Autorizzazioni Monitor"
3. **Visualizza Richieste**: Vedi tutte le richieste in attesa con:
   - Numero monitor
   - Codice di autorizzazione
   - IP e browser
   - Data/ora richiesta
4. **Autorizza**: Clicca su "Autorizza" per la richiesta
5. **Token Generato**: Viene generato un token permanente per quel monitor
6. **Notifica WebSocket**: Il monitor riceve automaticamente il token e si aggiorna

### 3. Accesso Permanente

Una volta autorizzato:
- Il token viene salvato nel localStorage del browser
- Il monitor bypassa il login automaticamente
- L'accesso è permanente fino a revoca manuale

## 📋 Componenti Implementati

### Backend (`backend/routes/packvision.js`)

#### Nuove Route API:

1. **POST `/api/packvision/monitor/request`**
   - Richiede autorizzazione per un monitor
   - Genera codice univoco a 6 cifre
   - Invia email con codice
   - Restituisce `request_id`

2. **GET `/api/packvision/monitor/requests`**
   - Lista tutte le richieste in attesa
   - Usato da PackVision Control

3. **POST `/api/packvision/monitor/approve`**
   - Approva una richiesta di autorizzazione
   - Genera token permanente
   - Emette evento WebSocket

4. **POST `/api/packvision/monitor/verify`**
   - Verifica se un token è valido
   - Usato per bypassare il login

5. **GET `/api/packvision/monitor/list`**
   - Lista monitor autorizzati
   - Mostra informazioni su ogni monitor

6. **DELETE `/api/packvision/monitor/revoke/:monitor_id`**
   - Revoca autorizzazione di un monitor
   - Invalida il token

#### Tabella Database:

```sql
CREATE TABLE monitor_authorizations (
    id SERIAL PRIMARY KEY,
    monitor_id INTEGER NOT NULL,
    authorization_code VARCHAR(6) NOT NULL,
    token VARCHAR(255) UNIQUE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    authorized BOOLEAN DEFAULT FALSE,
    authorized_at TIMESTAMPTZ,
    authorized_by INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);
```

### Frontend

#### Nuovi Componenti:

1. **`MonitorAuthRequest.jsx`**
   - Schermata di richiesta autorizzazione
   - Gestisce generazione codice
   - Mostra stato richiesta
   - Ascolta WebSocket per notifiche

2. **`PackVisionWithAuth.jsx`**
   - Wrapper per PackVision
   - Gestisce verifica token monitor
   - Mostra MonitorAuthRequest se non autorizzato
   - Polling ogni 10 secondi per autorizzazioni

3. **`MonitorAuthManager.jsx`**
   - Interfaccia gestione autorizzazioni
   - Mostra monitor autorizzati
   - Lista richieste in attesa
   - Pulsanti autorizza/revoca

#### Modifiche Esistenti:

- **`App.jsx`**: Gestisce autorizzazione monitor prima di mostrare PackVision
- **`useAuth.js`**: Bypassa login se c'è token monitor valido
- **`PackVision.jsx`**: Aggiunta sezione MonitorAuthManager

## 🔒 Sicurezza

1. **Codice Univoco**: 6 cifre casuali, valido 24 ore
2. **Token Crittografici**: Token generati con crypto.randomBytes
3. **Una Sola Autorizzazione**: Solo un monitor autorizzato per numero
4. **Revoca Immediata**: Possibilità di revocare autorizzazioni
5. **Verifica IP/User-Agent**: Tracciamento richieste

## 📧 Email di Notifica

L'email contiene:
- **Oggetto**: `🔐 Richiesta Autorizzazione Monitor PackVision - Monitor X`
- **Codice**: Visualizzato grande e chiaro
- **Dettagli**: IP, browser, data/ora
- **Link**: Diretto a PackVision Control
- **Scadenza**: 24 ore

## 🎨 Interfaccia Utente

### Schermata Richiesta Autorizzazione
- Design pulito e professionale
- Istruzioni chiare
- Stato richiesta visibile
- Aggiornamento automatico

### Sezione Autorizzazioni in PackVision Control
- **Monitor Autorizzati**: Grid con card per ogni monitor
- **Richieste in Attesa**: Lista con tutti i dettagli
- **Pulsanti Azione**: Autorizza/Revoca con conferma
- **Aggiornamento**: Auto-refresh ogni 5 secondi

## 🔄 Flusso Completo

```
1. Monitor accede → https://packvision.logikaservice.it/?mode=display&monitor=1
2. Sistema verifica token → Non trovato
3. Mostra MonitorAuthRequest
4. Utente clicca "Richiedi Codice"
5. Backend genera codice → 123456
6. Email inviata a info@logikaservice.it
7. Admin accede PackVision Control
8. Vede richiesta in "Richieste in Attesa"
9. Clicca "Autorizza"
10. Token generato e salvato
11. WebSocket notifica monitor
12. Monitor riceve token → Salva in localStorage
13. Pagina si aggiorna automaticamente
14. PackVision si carica senza login
```

## 🛠️ Manutenzione

### Revocare Autorizzazione Monitor

1. Vai in PackVision Control
2. Sezione "Autorizzazioni Monitor"
3. Clicca icona cestino sul monitor da revocare
4. Conferma revoca
5. Il monitor dovrà richiedere nuova autorizzazione

### Monitorizzare Richieste

- Tutte le richieste sono salvate nel database
- Possibilità di vedere storico
- Scadenza automatica dopo 24 ore

## ⚠️ Note Importanti

1. **Token nel Browser**: Se si cancella il localStorage, il monitor perderà l'autorizzazione
2. **Una Autorizzazione Attiva**: Se autorizzi un nuovo monitor con stesso numero, la precedente viene revocata
3. **Email Obbligatoria**: Serve configurare EMAIL_USER e EMAIL_PASSWORD nel backend
4. **WebSocket**: Le notifiche richiedono connessione WebSocket attiva

## 📝 Configurazione Email

Assicurati che nel backend siano configurate:

```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
```

O per altri provider SMTP, modifica la configurazione in `backend/routes/packvision.js`.

## 🎯 Vantaggi

✅ **Sicurezza**: Accesso protetto senza password facilmente intercettabili  
✅ **Convenienza**: Una volta autorizzato, nessun login necessario  
✅ **Controllo**: Gestione centralizzata delle autorizzazioni  
✅ **Tracciabilità**: Log completo di tutte le richieste  
✅ **Flessibilità**: Revoca immediata quando necessario  

