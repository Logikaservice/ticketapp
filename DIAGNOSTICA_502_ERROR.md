# 🔍 Diagnostica Errori 502 Bad Gateway

## Problema
Gli errori **502 Bad Gateway** indicano che nginx non riesce a raggiungere il backend Node.js su `http://127.0.0.1:3001`.

## Cause Possibili

1. **Backend non in esecuzione** - Il processo Node.js è crashato o non è stato avviato
2. **Backend non in ascolto sulla porta 3001** - Il backend potrebbe essere su una porta diversa
3. **Deploy non completato** - Le modifiche non sono state deployate sul server VPS
4. **Errore nel codice** - Il backend crashato all'avvio a causa di un errore

## Soluzione: Verifica e Riavvio Backend

### 1. Connettiti al Server VPS

```bash
ssh root@159.69.121.162
# oppure
ssh tuo-utente@159.69.121.162
```

### 2. Verifica Stato Backend

```bash
# Verifica se PM2 è in esecuzione
pm2 status

# Verifica se il backend è in ascolto sulla porta 3001
netstat -tlnp | grep 3001

# Verifica log backend
pm2 logs ticketapp-backend --lines 50
```

### 3. Verifica Processi Node.js

```bash
# Verifica tutti i processi Node.js
ps aux | grep node

# Verifica se c'è un processo sulla porta 3001
lsof -i :3001
```

### 4. Test Backend Locale

```bash
# Prova a connetterti al backend direttamente
curl http://localhost:3001/api/tickets

# Se non risponde, il backend non è in esecuzione
```

### 5. Riavvio Backend

```bash
cd /var/www/ticketapp

# Se usi PM2
pm2 restart ticketapp-backend
# oppure
pm2 restart all

# Se usi systemd
sudo systemctl restart ticketapp-backend
# oppure
sudo systemctl restart ticketapp
```

### 6. Verifica Deploy

```bash
cd /var/www/ticketapp

# Verifica che il codice sia aggiornato
git log -1

# Se non è aggiornato, fai pull
git pull origin main

# Reinstalla dipendenze backend
cd backend
npm install --production

# Riavvia backend
pm2 restart ticketapp-backend
```

### 7. Verifica Nginx

```bash
# Verifica configurazione nginx
sudo nginx -t

# Verifica log nginx per errori
sudo tail -50 /var/log/nginx/error.log

# Riavvia nginx
sudo systemctl restart nginx
```

## Script Automatico di Diagnostica

Esegui lo script di verifica:

```bash
cd /var/www/ticketapp
bash verifica-backend.sh
```

## Deploy Manuale Completo

Se il backend non risponde, fai un deploy completo:

```bash
cd /var/www/ticketapp

# 1. Aggiorna codice
git pull origin main

# 2. Installa dipendenze backend
cd backend
npm install --production

# 3. Riavvia backend con PM2
pm2 restart ticketapp-backend || pm2 start backend/index.js --name ticketapp-backend

# 4. Verifica che sia in esecuzione
pm2 status
netstat -tlnp | grep 3001

# 5. Riavvia nginx
sudo systemctl restart nginx
```

## Verifica Finale

Dopo il riavvio, verifica:

1. **Backend risponde localmente:**
   ```bash
   curl http://localhost:3001/api/tickets
   ```

2. **Backend risponde tramite nginx:**
   ```bash
   curl http://localhost/api/tickets
   ```

3. **Verifica da browser:**
   - Vai su: https://ticket.logikaservice.it
   - Apri console browser (F12)
   - Verifica che non ci siano più errori 502

## Se il Problema Persiste

1. **Controlla log backend:**
   ```bash
   pm2 logs ticketapp-backend --lines 100
   ```

2. **Controlla errori nel codice:**
   - Verifica che tutte le dipendenze siano installate
   - Verifica che le variabili d'ambiente siano configurate
   - Verifica che il database sia raggiungibile

3. **Riavvia tutto:**
   ```bash
   pm2 restart all
   sudo systemctl restart nginx
   ```

## Note Importanti

- Gli errori **502** sono diversi dagli errori **500** che abbiamo fixato
- **502** = Backend non raggiungibile (nginx non può connettersi)
- **500** = Backend raggiungibile ma errore interno del server
- Il fix che abbiamo fatto (errori 500 su `/api/crypto/statistics`) è corretto, ma il backend deve essere in esecuzione per funzionare
