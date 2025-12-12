# 🔍 Diagnostica Problema 403/500 VPS Hetzner

## 📊 Errori Rilevati

- **403 Forbidden** su `https://ticket.logikaservice.it/`
- **500 Internal Server Error** su `favicon.ico`
- Backend probabilmente non risponde correttamente

## 🔧 Checklist Diagnostica

### 1. Verifica Backend in Esecuzione

```bash
# Connettiti alla VPS
ssh user@vps

# Verifica PM2
pm2 status

# Se backend non è in esecuzione:
pm2 restart backend
# oppure
pm2 start backend

# Vedi log in tempo reale
pm2 logs backend --lines 50
```

**Cosa cercare nei log:**
- Errori di connessione database
- Errori di porta già in uso
- Errori di moduli mancanti

### 2. Verifica Nginx

```bash
# Stato nginx
sudo systemctl status nginx

# Se non è attivo:
sudo systemctl restart nginx

# Verifica configurazione
sudo nginx -t

# Log errori nginx
sudo tail -f /var/log/nginx/error.log
```

### 3. Verifica Database VPS

```bash
# Verifica connessione database dal backend
pm2 logs backend | grep -i "database\|error\|connection"

# Test connessione manuale (se hai accesso)
psql $DATABASE_URL -c "SELECT 1;"
```

### 4. Verifica Porte e Processi

```bash
# Verifica che la porta 3001 sia in uso (backend)
sudo netstat -tlnp | grep 3001
# oppure
sudo ss -tlnp | grep 3001

# Verifica processi Node.js
ps aux | grep node
```

### 5. Verifica Permessi File

```bash
# Verifica permessi directory backend
ls -la /var/www/ticketapp/backend/

# Verifica permessi file .env
ls -la /var/www/ticketapp/backend/.env

# Se necessario, correggi permessi
sudo chown -R www-data:www-data /var/www/ticketapp/
sudo chmod -R 755 /var/www/ticketapp/
```

## 🚨 Problemi Comuni e Soluzioni

### Problema 1: Backend Non Avviato

**Sintomi:**
- `pm2 status` mostra backend come "stopped" o "errored"

**Soluzione:**
```bash
cd /var/www/ticketapp/backend
pm2 restart backend
# oppure
pm2 delete backend
pm2 start index.js --name backend
pm2 save
```

### Problema 2: Errore Database

**Sintomi:**
- Log mostrano "autenticazione con password fallita" o "connection refused"

**Soluzione:**
```bash
# Verifica DATABASE_URL nel .env
cat /var/www/ticketapp/backend/.env | grep DATABASE_URL

# Verifica che PostgreSQL sia in esecuzione
sudo systemctl status postgresql

# Se necessario, riavvia PostgreSQL
sudo systemctl restart postgresql
```

### Problema 3: Nginx Non Configurato Correttamente

**Sintomi:**
- 403 Forbidden anche se backend funziona

**Soluzione:**
```bash
# Verifica configurazione nginx
sudo cat /etc/nginx/sites-available/ticketapp

# Verifica che il file sia linkato
sudo ls -la /etc/nginx/sites-enabled/ | grep ticketapp

# Se manca il link:
sudo ln -s /etc/nginx/sites-available/ticketapp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Problema 4: Porta Già in Uso

**Sintomi:**
- Backend non si avvia, errore "EADDRINUSE"

**Soluzione:**
```bash
# Trova processo che usa porta 3001
sudo lsof -i :3001
# oppure
sudo fuser -k 3001/tcp

# Riavvia backend
pm2 restart backend
```

## 📝 Comandi Rapidi Diagnostica

```bash
# Diagnostica completa
echo "=== PM2 STATUS ==="
pm2 status
echo ""
echo "=== NGINX STATUS ==="
sudo systemctl status nginx
echo ""
echo "=== BACKEND LOGS (ultime 20 righe) ==="
pm2 logs backend --lines 20 --nostream
echo ""
echo "=== NGINX ERROR LOG (ultime 10 righe) ==="
sudo tail -10 /var/log/nginx/error.log
echo ""
echo "=== PORTA 3001 ==="
sudo netstat -tlnp | grep 3001
```

## ✅ Dopo la Diagnostica

Una volta identificato il problema:

1. **Risolvi il problema** usando le soluzioni sopra
2. **Riavvia servizi** se necessario:
   ```bash
   pm2 restart backend
   sudo systemctl restart nginx
   ```
3. **Verifica** che il sito funzioni:
   - Apri `https://ticket.logikaservice.it/`
   - Dovresti vedere il login, non 403

## 🆘 Se Niente Funziona

1. **Ripristina backup** se disponibile
2. **Verifica file .env** sulla VPS
3. **Controlla firewall** (ufw/iptables)
4. **Verifica certificati SSL** (Let's Encrypt)

