# 🔧 Fix Errori 502 - Backend Non Raggiungibile

## Problema
Gli errori **502 Bad Gateway** indicano che nginx non riesce a raggiungere il backend Node.js su `http://127.0.0.1:3001`.

## Soluzione Rapida

### 1. Connettiti al server VPS
```bash
ssh root@159.69.121.162
# oppure
ssh tuo-utente@159.69.121.162
```

### 2. Verifica stato backend
```bash
# Verifica se PM2 è in esecuzione
pm2 status

# Verifica se la porta 3001 è in ascolto
netstat -tuln | grep 3001
# oppure
ss -tuln | grep 3001
```

### 3. Riavvia il backend
```bash
cd /var/www/ticketapp/backend

# Riavvia con PM2
pm2 restart ticketapp-backend
# oppure se il nome è diverso
pm2 restart all

# Verifica i log
pm2 logs ticketapp-backend --lines 50
```

### 4. Se PM2 non funziona, riavvia manualmente
```bash
cd /var/www/ticketapp/backend

# Ferma eventuali processi sulla porta 3001
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

# Avvia il backend
pm2 start index.js --name ticketapp-backend --cwd /var/www/ticketapp/backend
pm2 save
```

### 5. Verifica che funzioni
```bash
# Test health check
curl http://localhost:3001/api/health

# Test crypto dashboard
curl http://localhost:3001/api/crypto/dashboard

# Dovrebbero restituire JSON (non 502)
```

### 6. Verifica nginx
```bash
# Riavvia nginx se necessario
sudo systemctl restart nginx

# Verifica configurazione nginx
sudo nginx -t

# Verifica log nginx
sudo tail -f /var/log/nginx/error.log
```

## Diagnostica Completa

### Script automatico
```bash
cd /var/www/ticketapp
bash diagnostica-502-backend.sh
```

### Verifica manuale
1. **Backend in esecuzione?**
   ```bash
   pm2 list
   ps aux | grep node
   ```

2. **Porta 3001 aperta?**
   ```bash
   netstat -tuln | grep 3001
   ```

3. **Database raggiungibile?**
   ```bash
   cd /var/www/ticketapp/backend
   node -e "require('dotenv').config(); const {Pool} = require('pg'); const pool = new Pool({connectionString: process.env.DATABASE_URL}); pool.query('SELECT 1').then(() => console.log('✅ DB OK')).catch(e => console.error('❌ DB ERR:', e));"
   ```

4. **Log errori backend?**
   ```bash
   pm2 logs ticketapp-backend --err --lines 100
   tail -100 /var/log/pm2/ticketapp-backend-error.log
   ```

## Cause Comuni

1. **Backend crashato** → Riavvia con PM2
2. **Database non raggiungibile** → Verifica DATABASE_URL in .env
3. **Porta 3001 occupata** → Libera la porta
4. **Memoria esaurita** → Verifica con `free -h`
5. **Errori nel codice** → Controlla log PM2

## Fix Permanente

Se il backend continua a crashare:

1. **Aumenta memoria PM2:**
   ```bash
   pm2 delete ticketapp-backend
   pm2 start index.js --name ticketapp-backend --max-memory-restart 500M
   pm2 save
   ```

2. **Abilita auto-restart:**
   ```bash
   pm2 startup
   pm2 save
   ```

3. **Monitora con PM2 Plus:**
   ```bash
   pm2 monit
   ```

## Verifica Finale

Dopo il fix, ricarica il dashboard nel browser (Ctrl+Shift+R) e verifica che:
- ✅ Non ci siano più errori 502 nella console
- ✅ I dati del dashboard si caricano correttamente
- ✅ Il bot status si aggiorna

