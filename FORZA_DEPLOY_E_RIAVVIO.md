# 🚀 FORZA DEPLOY E RIAVVIO BACKEND

## Problema
Gli errori 500 persistono perché il codice modificato non è stato ancora deployato sul VPS o il backend non è stato riavviato.

## Soluzione Rapida

### 1. Connettiti al VPS
```bash
ssh root@<IP_VPS>
# oppure
ssh root@ticketapp-server
```

### 2. Vai alla directory del progetto
```bash
cd /var/www/ticketapp
```

### 3. Verifica che il codice sia aggiornato
```bash
git pull
```

### 4. Verifica sintassi backend
```bash
cd backend
node -c index.js
node -c routes/cryptoRoutes.js
```

### 5. Riavvia backend con PM2
```bash
pm2 restart ticketapp-backend
# oppure se non esiste:
pm2 delete ticketapp-backend
cd /var/www/ticketapp/backend
pm2 start index.js --name ticketapp-backend --update-env
pm2 save
```

### 6. Verifica che il backend sia online
```bash
pm2 status ticketapp-backend
curl http://localhost:3001/api/health
```

### 7. Controlla i log
```bash
pm2 logs ticketapp-backend --lines 50
```

## Test rapido

Dopo il riavvio, testa l'endpoint:
```bash
curl "http://localhost:3001/api/crypto/bot-analysis?symbol=aave"
```

Dovresti vedere:
- Status 200 (non 500)
- JSON con dati mock se c'è un errore
- Log `🔍 [BOT-ANALYSIS] Richiesta ricevuta per simbolo: aave`

## Se gli errori persistono

1. Verifica che GitHub Actions abbia completato il deploy
2. Controlla i log PM2 per errori di sintassi
3. Verifica che il backend stia usando il codice aggiornato

