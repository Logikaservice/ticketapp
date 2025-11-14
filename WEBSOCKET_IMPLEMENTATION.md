# Implementazione WebSocket e Notifiche Push

## 📋 Panoramica

Questo documento descrive cosa serve per implementare:
- **WebSocket** per aggiornamenti in tempo reale
- **Notifiche push browser** per notifiche anche quando l'app è chiusa
- **Aggiornamenti istantanei** senza refresh della pagina

---

## 🔧 Requisiti Tecnici

### 1. Backend (Node.js/Express)

#### Dipendenze da installare:
```bash
cd backend
npm install socket.io
```

#### Modifiche necessarie a `backend/index.js`:
- Convertire il server Express in un server HTTP che supporta WebSocket
- Integrare Socket.io
- Creare eventi per:
  - Nuovi ticket
  - Cambi di stato ticket
  - Nuovi messaggi/commenti
  - Aggiornamenti forniture
  - Nuovi avvisi

#### Struttura suggerita:
```javascript
// backend/index.js
const http = require('http');
const { Server } = require('socket.io');
const express = require('express');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    methods: ['GET', 'POST']
  }
});

// Middleware per autenticazione WebSocket
io.use((socket, next) => {
  // Verifica token JWT
  const token = socket.handshake.auth.token;
  // ... validazione token
  next();
});

// Eventi WebSocket
io.on('connection', (socket) => {
  const userId = socket.userId;
  const userRole = socket.userRole;
  
  // Unisciti a room per utente specifico
  socket.join(`user:${userId}`);
  
  // Unisciti a room per ruolo
  socket.join(`role:${userRole}`);
  
  // Eventi da emettere:
  // - ticket:created
  // - ticket:updated
  // - ticket:status-changed
  // - message:new
  // - alert:new
});
```

---

### 2. Frontend (React)

#### Dipendenze da installare:
```bash
cd frontend
npm install socket.io-client
```

#### Modifiche necessarie:
- Creare un hook `useWebSocket.js` per gestire la connessione
- Sostituire il polling (`setInterval`) con eventi WebSocket
- Integrare con il sistema di notifiche esistente

#### Struttura suggerita:
```javascript
// frontend/src/hooks/useWebSocket.js
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './useAuth';

export const useWebSocket = (onTicketUpdate, onNewMessage, onStatusChange) => {
  const socketRef = useRef(null);
  const { getAuthHeader, currentUser } = useAuth();
  
  useEffect(() => {
    if (!currentUser) return;
    
    const apiBase = process.env.REACT_APP_API_URL;
    const token = getAuthHeader()['Authorization']?.replace('Bearer ', '');
    
    socketRef.current = io(apiBase, {
      auth: { token },
      transports: ['websocket', 'polling']
    });
    
    const socket = socketRef.current;
    
    // Eventi in ascolto
    socket.on('ticket:created', (ticket) => {
      onTicketUpdate(ticket);
    });
    
    socket.on('ticket:updated', (ticket) => {
      onTicketUpdate(ticket);
    });
    
    socket.on('ticket:status-changed', ({ ticketId, newStatus }) => {
      onStatusChange(ticketId, newStatus);
    });
    
    socket.on('message:new', (message) => {
      onNewMessage(message);
    });
    
    socket.on('connect', () => {
      console.log('WebSocket connesso');
    });
    
    socket.on('disconnect', () => {
      console.log('WebSocket disconnesso');
    });
    
    return () => {
      socket.disconnect();
    };
  }, [currentUser]);
  
  return socketRef.current;
};
```

---

### 3. Notifiche Push Browser

#### Requisiti:
1. **Service Worker** (`public/sw.js`)
2. **Manifest** (`public/manifest.json`)
3. **VAPID Keys** (per Web Push Protocol)

#### Dipendenze backend:
```bash
cd backend
npm install web-push
```

#### Configurazione VAPID Keys:
```bash
# Genera chiavi VAPID (una volta sola)
npx web-push generate-vapid-keys
```

Salva le chiavi in variabili d'ambiente:
```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:your-email@example.com
```

#### Struttura Service Worker:
```javascript
// public/sw.js
self.addEventListener('push', (event) => {
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    data: data.data,
    actions: [
      { action: 'open', title: 'Apri' },
      { action: 'close', title: 'Chiudi' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow(event.notification.data.url || '/')
    );
  }
});
```

#### Registrazione nel frontend:
```javascript
// frontend/src/utils/pushNotifications.js
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.log('Browser non supporta notifiche');
    return false;
  }
  
  if (Notification.permission === 'granted') {
    return true;
  }
  
  const permission = await Notification.requestPermission();
  return permission === 'granted';
};

export const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registrato:', registration);
      return registration;
    } catch (error) {
      console.error('Errore registrazione Service Worker:', error);
    }
  }
};

export const subscribeToPush = async (registration) => {
  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
    
    // Invia subscription al backend
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription)
    });
    
    return subscription;
  } catch (error) {
    console.error('Errore sottoscrizione push:', error);
  }
};
```

---

## 📦 File da Creare/Modificare

### Backend:
1. ✅ `backend/index.js` - Aggiungere Socket.io
2. ✅ `backend/routes/pushNotifications.js` - Nuovo file per gestire subscription push
3. ✅ `backend/utils/pushNotifications.js` - Utility per inviare notifiche push

### Frontend:
1. ✅ `frontend/src/hooks/useWebSocket.js` - Nuovo hook per WebSocket
2. ✅ `frontend/src/utils/pushNotifications.js` - Utility per notifiche push
3. ✅ `frontend/public/sw.js` - Service Worker
4. ✅ `frontend/public/manifest.json` - Manifest per PWA
5. ✅ `frontend/src/App.jsx` - Integrare WebSocket e rimuovere polling
6. ✅ `frontend/src/components/Dashboard.jsx` - Aggiornare per WebSocket

---

## 🔄 Migrazione da Polling a WebSocket

### Passi:
1. **Installare dipendenze** (backend e frontend)
2. **Configurare Socket.io** nel backend
3. **Creare hook useWebSocket** nel frontend
4. **Sostituire setInterval** con eventi WebSocket
5. **Mantenere fallback** a polling se WebSocket non disponibile
6. **Implementare notifiche push** (opzionale ma consigliato)

### Esempio migrazione:
```javascript
// PRIMA (polling)
useEffect(() => {
  const interval = setInterval(() => {
    fetchTickets();
  }, 10000);
  return () => clearInterval(interval);
}, []);

// DOPO (WebSocket)
useEffect(() => {
  const socket = useWebSocket(
    (ticket) => updateTicket(ticket),
    (message) => handleNewMessage(message),
    (ticketId, status) => handleStatusChange(ticketId, status)
  );
  return () => socket?.disconnect();
}, []);
```

---

## 🚀 Deployment

### Render.com:
- Il server HTTP deve supportare WebSocket
- Verificare che la porta sia configurata correttamente
- Aggiungere variabili d'ambiente per VAPID keys

### Variabili d'ambiente necessarie:
```
# Backend
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:your-email@example.com

# Frontend (opzionale, se serve VAPID key lato client)
REACT_APP_VAPID_PUBLIC_KEY=...
```

---

## 📝 Checklist Implementazione

### Fase 1: WebSocket Base
- [ ] Installare `socket.io` nel backend
- [ ] Installare `socket.io-client` nel frontend
- [ ] Configurare server HTTP con Socket.io
- [ ] Creare hook `useWebSocket`
- [ ] Emettere eventi quando cambiano ticket
- [ ] Sostituire polling con WebSocket
- [ ] Testare connessione/disconnessione

### Fase 2: Eventi Real-time
- [ ] Evento `ticket:created`
- [ ] Evento `ticket:updated`
- [ ] Evento `ticket:status-changed`
- [ ] Evento `message:new`
- [ ] Evento `alert:new`
- [ ] Testare tutti gli eventi

### Fase 3: Notifiche Push
- [ ] Installare `web-push` nel backend
- [ ] Generare VAPID keys
- [ ] Creare Service Worker
- [ ] Creare manifest.json
- [ ] Implementare registrazione subscription
- [ ] Implementare invio notifiche
- [ ] Testare notifiche push

### Fase 4: Ottimizzazione
- [ ] Gestire riconnessione automatica
- [ ] Implementare retry logic
- [ ] Aggiungere indicatore stato connessione
- [ ] Ottimizzare performance
- [ ] Testare su dispositivi mobili

---

## 🔍 Testing

### Test WebSocket:
1. Aprire app in due browser diversi
2. Creare/modificare ticket in uno
3. Verificare aggiornamento istantaneo nell'altro

### Test Notifiche Push:
1. Richiedere permesso notifiche
2. Chiudere il browser
3. Creare ticket/modificare stato
4. Verificare notifica push

---

## 📚 Risorse Utili

- [Socket.io Documentation](https://socket.io/docs/v4/)
- [Web Push Protocol](https://web.dev/push-notifications-overview/)
- [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [VAPID Keys Generator](https://web-push-codelab.glitch.me/)

---

## ⚠️ Note Importanti

1. **Sicurezza**: Sempre autenticare connessioni WebSocket
2. **Fallback**: Mantenere polling come fallback se WebSocket fallisce
3. **Performance**: Limitare frequenza eventi per evitare spam
4. **Privacy**: Rispettare permessi utente per notifiche push
5. **Compatibilità**: Verificare supporto browser per WebSocket e Service Workers

