# Configurazione Certificato SSL per packvision.logikaservice.it

## 🔒 Problema

Il certificato SSL non è configurato correttamente per `packvision.logikaservice.it`, causando:
- Warning "Non sicuro" nel browser
- Possibili problemi con il sistema di autorizzazione monitor

## 🛠️ Soluzione: Configurazione SSL con Certbot (Let's Encrypt)

### Prerequisiti

1. **Server accessibile** via internet
2. **Dominio configurato** con DNS puntato al server
3. **Porta 80 aperta** nel firewall (necessaria per verifica Let's Encrypt)

### Passo 1: Verifica DNS

Verifica che il dominio punti al server:

```bash
dig packvision.logikaservice.it
# o
nslookup packvision.logikaservice.it
```

Dovrebbe restituire l'IP del server (es. `159.69.121.162`).

### Passo 2: Installa Certbot

```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx -y
```

### Passo 3: Ottieni Certificato SSL

```bash
sudo certbot --nginx -d packvision.logikaservice.it
```

Durante la configurazione:
- Inserisci email per notifiche (opzionale)
- Accetta i termini di servizio
- Scegli se condividere email con EFF (opzionale)
- Certbot modificherà automaticamente la configurazione Nginx

### Passo 4: Verifica Configurazione Nginx

Certbot dovrebbe aver modificato `/etc/nginx/sites-available/packvision.logikaservice.it` aggiungendo:
- Redirect HTTP → HTTPS
- Configurazione SSL con certificati Let's Encrypt

Verifica la configurazione:

```bash
sudo nginx -t
```

Se tutto è OK, ricarica Nginx:

```bash
sudo systemctl reload nginx
```

### Passo 5: Rinnovo Automatico

Let's Encrypt certificati scadono ogni 90 giorni. Certbot crea automaticamente un timer per il rinnovo:

```bash
# Verifica che il timer sia attivo
sudo systemctl status certbot.timer

# Testa il rinnovo (dry-run)
sudo certbot renew --dry-run
```

## 📋 Configurazione Nginx Manuale (Alternativa)

Se preferisci configurare manualmente, ecco la configurazione completa:

### File: `/etc/nginx/sites-available/packvision.logikaservice.it`

```nginx
# Redirect HTTP a HTTPS
server {
    listen 80;
    server_name packvision.logikaservice.it;
    
    # Per Certbot (SSL)
    location ~ /.well-known/acme-challenge {
        allow all;
        root /var/www/certbot;
    }
    
    # Redirect a HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# Configurazione HTTPS
server {
    listen 443 ssl http2;
    server_name packvision.logikaservice.it;
    
    # Certificati SSL
    ssl_certificate /etc/letsencrypt/live/packvision.logikaservice.it/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/packvision.logikaservice.it/privkey.pem;
    
    # Configurazione SSL sicura
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    root /var/www/ticketapp/frontend/build;
    index index.html index.htm;

    # Serve file statici del frontend
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy per API requests al backend Node.js
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeout aumentato per richieste lunghe
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Proxy per uploads (file statici dal backend)
    location /uploads/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Proxy per Socket.IO
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeout per WebSocket
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }
}
```

Dopo aver creato/modificato il file:

```bash
# Abilita il sito (se non già fatto)
sudo ln -s /etc/nginx/sites-available/packvision.logikaservice.it /etc/nginx/sites-enabled/

# Testa la configurazione
sudo nginx -t

# Ricarica Nginx
sudo systemctl reload nginx
```

## 🔍 Verifica Certificato

Dopo la configurazione, verifica:

1. **Accesso HTTPS**: `https://packvision.logikaservice.it` dovrebbe funzionare
2. **Icona lucchetto**: Il browser dovrebbe mostrare un lucchetto verde
3. **Validità certificato**: Controlla con:
   ```bash
   sudo certbot certificates
   ```

## ⚠️ Troubleshooting

### Errore: "Failed to obtain certificate"

**Possibili cause:**
- DNS non configurato correttamente
- Porta 80 bloccata dal firewall
- Nginx non in ascolto su porta 80

**Soluzione:**
```bash
# Verifica DNS
dig packvision.logikaservice.it

# Verifica porta 80
sudo netstat -tlnp | grep :80

# Verifica firewall
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### Errore: "Certificate already exists"

Se hai già un certificato per il dominio:

```bash
# Vedi certificati esistenti
sudo certbot certificates

# Rinnova certificato esistente
sudo certbot renew

# O forza rinnovo
sudo certbot renew --force-renewal
```

### Errore: "Nginx configuration test failed"

```bash
# Verifica errori nella configurazione
sudo nginx -t

# Controlla log Nginx
sudo tail -f /var/log/nginx/error.log
```

## 📝 Note Importanti

1. **Rinnovo automatico**: Certbot configura un timer systemd per il rinnovo automatico. Verifica con `sudo systemctl status certbot.timer`

2. **Wildcard certificate**: Se hai più sottodomini (es. `*.logikaservice.it`), considera un certificato wildcard:
   ```bash
   sudo certbot certonly --dns-cloudflare -d *.logikaservice.it -d logikaservice.it
   ```

3. **Backup certificati**: I certificati sono in `/etc/letsencrypt/live/packvision.logikaservice.it/`. Fai backup periodici.

4. **Test rinnovo**: Testa il rinnovo ogni tanto:
   ```bash
   sudo certbot renew --dry-run
   ```

## 🎯 Prossimi Passi

Dopo aver configurato SSL:

1. Verifica che `https://packvision.logikaservice.it/?mode=display&monitor=1` funzioni
2. Controlla che non ci siano warning di sicurezza nel browser
3. Testa il sistema di autorizzazione monitor

## 📞 Supporto

Se hai problemi, controlla:
- Log Certbot: `/var/log/letsencrypt/letsencrypt.log`
- Log Nginx: `/var/log/nginx/error.log`
- Status servizi: `sudo systemctl status nginx certbot.timer`

