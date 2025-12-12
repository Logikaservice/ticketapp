# 🔧 Fix 403 Forbidden su ticket.logikaservice.it

## 📋 Problema
Errore `403 Forbidden` quando si accede a `ticket.logikaservice.it/?domain=crypto`

## 🔍 Diagnostica sulla VPS

### 1. Verifica permessi directory frontend/build
```bash
cd /var/www/ticketapp
ls -la frontend/build/
```

**✅ DEVE mostrare:**
- `index.html` presente
- Permessi: `-rw-r--r--` per i file
- Directory: `drwxr-xr-x`
- Owner: `www-data` o `root`

**❌ Se manca `index.html`:**
```bash
cd frontend
npm install
npm run build
```

### 2. Verifica permessi directory principale
```bash
ls -la /var/www/ticketapp/
```

**✅ DEVE mostrare:**
- Directory: `drwxr-xr-x` (755)
- Owner: `www-data` o `root`

**❌ Se permessi errati:**
```bash
sudo chown -R www-data:www-data /var/www/ticketapp/
sudo chmod -R 755 /var/www/ticketapp/
sudo chmod -R 644 /var/www/ticketapp/frontend/build/*.html
sudo chmod -R 644 /var/www/ticketapp/frontend/build/*.js
sudo chmod -R 644 /var/www/ticketapp/frontend/build/*.css
```

### 3. Verifica configurazione Nginx
```bash
sudo cat /etc/nginx/sites-available/ticketapp.conf
# oppure
sudo cat /etc/nginx/sites-enabled/ticketapp.conf
```

**✅ DEVE contenere:**
```nginx
server {
    listen 80;
    server_name ticket.logikaservice.it;
    
    root /var/www/ticketapp/frontend/build;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4. Verifica log Nginx per errori specifici
```bash
sudo tail -50 /var/log/nginx/error.log | grep -i "403\|forbidden\|permission"
```

### 5. Test configurazione Nginx
```bash
sudo nginx -t
```

**✅ DEVE mostrare:**
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### 6. Ricarica Nginx
```bash
sudo systemctl reload nginx
# oppure
sudo service nginx reload
```

## 🔧 Fix Comuni

### Fix 1: Ricostruire frontend
```bash
cd /var/www/ticketapp/frontend
npm install
npm run build
sudo chown -R www-data:www-data build/
sudo chmod -R 755 build/
```

### Fix 2: Correggere permessi
```bash
sudo chown -R www-data:www-data /var/www/ticketapp/
sudo find /var/www/ticketapp/frontend/build -type f -exec chmod 644 {} \;
sudo find /var/www/ticketapp/frontend/build -type d -exec chmod 755 {} \;
```

### Fix 3: Verificare che index.html esista
```bash
ls -la /var/www/ticketapp/frontend/build/index.html
```

**Se non esiste:**
```bash
cd /var/www/ticketapp/frontend
npm run build
```

### Fix 4: Verificare SELinux (se attivo)
```bash
# Se SELinux è attivo, potrebbe bloccare Nginx
sudo getenforce
# Se mostra "Enforcing", prova:
sudo setenforce 0  # Temporaneo
# Poi verifica se funziona
```

## 📋 Checklist

- [ ] `index.html` esiste in `frontend/build/`
- [ ] Permessi directory corretti (755)
- [ ] Permessi file corretti (644)
- [ ] Owner è `www-data` o `root`
- [ ] Configurazione Nginx corretta
- [ ] `nginx -t` passa senza errori
- [ ] Nginx ricaricato dopo modifiche

## 🚨 Se il problema persiste

1. **Verifica log Nginx dettagliati:**
   ```bash
   sudo tail -100 /var/log/nginx/error.log
   ```

2. **Verifica se il problema è solo per `/domain=crypto`:**
   - Prova ad accedere a `ticket.logikaservice.it` senza parametri
   - Se funziona, potrebbe essere un problema del frontend React Router

3. **Verifica se il backend risponde:**
   ```bash
   curl http://localhost:3001/api/health
   ```

4. **Verifica se Nginx può accedere ai file:**
   ```bash
   sudo -u www-data ls -la /var/www/ticketapp/frontend/build/
   ```

