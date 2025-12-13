# 🔍 Verifica Chiamate API - Debug Problemi Caricamento Dati

## Cosa Verificare

### 1. Apri Network Tab nel Browser

1. Apri `https://ticket.logikaservice.it`
2. Apri DevTools (F12)
3. Vai sul tab **Network** (Rete)
4. Ricarica la pagina (F5)
5. Filtra per **XHR** o **Fetch**

### 2. Cerca Chiamate Fallite

Cerca chiamate che:
- ❌ Hanno status **rosso** (4xx, 5xx)
- ❌ Hanno status **canceled** o **failed**
- ❌ Mostrano **CORS errors**
- ❌ Non restituiscono dati (risposta vuota)

### 3. Chiamate API Principali da Verificare

Verifica che queste chiamate funzionino:

#### `/api/tickets`
- **Dovrebbe**: Restituire lista ticket
- **Verifica**: Status 200, response contiene array di ticket

#### `/api/users`
- **Dovrebbe**: Restituire lista utenti
- **Verifica**: Status 200, response contiene array di utenti

#### `/api/alerts`
- **Dovrebbe**: Restituire lista avvisi
- **Verifica**: Status 200

#### `/api/crypto/portfolio`
- **Dovrebbe**: Restituire dati portfolio crypto
- **Verifica**: Status 200

#### `/api/tickets/forniture`
- **Dovrebbe**: Restituire lista forniture
- **Verifica**: Status 200

### 4. Verifica Headers

Per ogni chiamata, controlla:
- **Request URL**: Deve essere `/api/...` o `https://ticket.logikaservice.it/api/...`
- **Status Code**: Deve essere `200 OK`
- **Response Headers**: Deve avere `Content-Type: application/json`
- **Request Headers**: Deve avere `Authorization: Bearer <token>` (se richiesto)

### 5. Problemi Comuni

#### Problema: 401 Unauthorized
**Causa**: Token mancante o scaduto
**Fix**: 
- Verifica che il token sia presente in localStorage
- Controlla che il backend accetti il token
- Verifica JWT_SECRET nel backend

#### Problema: 502 Bad Gateway
**Causa**: Backend non raggiungibile
**Fix**:
- Verifica che il backend sia in esecuzione: `pm2 status`
- Controlla log backend: `pm2 logs ticketapp-backend`
- Verifica che Nginx possa raggiungere il backend

#### Problema: CORS Error
**Causa**: Backend non permette richieste dal dominio frontend
**Fix**:
- Verifica `ALLOWED_ORIGINS` nel backend `.env`
- Deve contenere `https://ticket.logikaservice.it`

#### Problema: Network Error / Failed to fetch
**Causa**: Backend non risponde o errore di rete
**Fix**:
- Verifica che il backend sia in esecuzione
- Controlla che la porta 3001 sia aperta
- Verifica firewall

## Script di Verifica Backend

Esegui sul server:

```bash
cd /var/www/ticketapp
./verifica-backend-status.sh
```

Questo verificherà:
- Se il backend è in esecuzione
- Se risponde a `/api/health`
- Se il database è connesso
- Se ci sono errori nei log

## Debug Dettagliato

### Console Browser

Cerca errori specifici:
```javascript
// Controlla token
console.log('Token:', localStorage.getItem('authToken'));

// Test chiamata API manuale
fetch('/api/tickets', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
  }
})
.then(r => r.json())
.then(data => console.log('Tickets:', data))
.catch(err => console.error('Error:', err));
```

### Log Backend

```bash
# Vedi log in tempo reale
pm2 logs ticketapp-backend --lines 100

# Cerca errori specifici
pm2 logs ticketapp-backend --lines 500 | grep -i "error\|failed\|unauthorized"
```

## Cosa Fare Se...

### ...non vedi ticket nella dashboard
1. Verifica `/api/tickets` nella Network tab
2. Controlla se restituisce dati
3. Verifica filtri applicati (potrebbero filtrare tutti i ticket)

### ...non vedi utenti
1. Verifica `/api/users` nella Network tab
2. Controlla permessi utente (solo tecnico/admin vedono utenti)
3. Verifica token e ruolo utente

### ...non vedi avvisi
1. Verifica `/api/alerts` nella Network tab
2. Controlla se ci sono avvisi nel database

### ...non vedi forniture
1. Verifica `/api/tickets/forniture` nella Network tab
2. Controlla se ci sono forniture collegate ai ticket

