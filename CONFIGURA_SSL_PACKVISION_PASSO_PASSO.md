# Configurazione SSL per packvision.logikaservice.it - Guida Passo Passo

## 🎯 Obiettivo
Configurare il certificato SSL per `packvision.logikaservice.it` per abilitare HTTPS.

## 📋 Passo 1: Configurazione Temporanea (Senza HTTPS)

Prima di configurare SSL, dobbiamo far funzionare il sito. **Nel file nano, cancella tutto e incolla questo:**

```nginx
# Configurazione Nginx per packvision.logikaservice.it
# Versione temporanea SENZA HTTPS (per configurare SSL dopo)

server {
    listen 80;
    server_name packvision.logikaservice.it;
    
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
        
        # Timeout aumentati per richieste che possono richiedere tempo (database, email)
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        
        # Buffering disabilitato per risposte immediate
        proxy_buffering off;
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

    # Per Certbot (SSL) - IMPORTANTE per la verifica
    location ~ /.well-known/acme-challenge {
        allow all;
        root /var/www/certbot;
    }
}
```

**Salva e testa:**
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 🔒 Passo 2: Installa Certbot (Se Non Già Installato)

```bash
# Aggiorna pacchetti
sudo apt update

# Installa Certbot per Nginx
sudo apt install certbot python3-certbot-nginx -y
```

## 🌐 Passo 3: Verifica DNS

Assicurati che il dominio punti al server:

```bash
# Controlla che packvision.logikaservice.it punti al tuo server
dig packvision.logikaservice.it +short
# oppure
nslookup packvision.logikaservice.it
```

Dovrebbe restituire l'IP del server (es. `159.69.121.162`).

## 🔐 Passo 4: Ottieni Certificato SSL

```bash
# Esegui Certbot per ottenere il certificato
sudo certbot --nginx -d packvision.logikaservice.it
```

Durante la configurazione:
1. **Email**: Inserisci una email per notifiche (opzionale ma consigliato)
2. **Termini**: Accetta i termini di servizio (`A` per Agree)
3. **Condivisione email**: Scegli se condividere email con EFF (`Y` o `N`)
4. **Redirect HTTP→HTTPS**: Scegli `2` per reindirizzare automaticamente HTTP a HTTPS

Certbot modificherà automaticamente la configurazione Nginx!

## ✅ Passo 5: Verifica

```bash
# Verifica che il certificato sia stato creato
sudo certbot certificates

# Testa la configurazione Nginx
sudo nginx -t

# Ricarica Nginx
sudo systemctl reload nginx
```

## 🧪 Passo 6: Test HTTPS

```bash
# Test HTTPS dal server
curl -I https://packvision.logikaservice.it

# Dovrebbe restituire 200 OK o 301 redirect
```

## 🔄 Passo 7: Configurazione Automatica Post-Certbot

Dopo che Certbot ha modificato il file, avrà aggiunto:
- Il blocco `server { listen 443 ssl ... }`
- Il redirect HTTP → HTTPS
- Le configurazioni SSL corrette

**Il file sarà simile a questo (Certbot lo modificherà automaticamente):**

```nginx
server {
    listen 80;
    server_name packvision.logikaservice.it;
    
    # Redirect HTTP a HTTPS (aggiunto da Certbot)
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name packvision.logikaservice.it;
    
    ssl_certificate /etc/letsencrypt/live/packvision.logikaservice.it/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/packvision.logikaservice.it/privkey.pem;
    
    # ... resto della configurazione ...
}
```

## 📝 Passo 8: Rinnovo Automatico

Let's Encrypt certificati scadono ogni 90 giorni. Certbot crea automaticamente un timer:

```bash
# Verifica che il timer sia attivo
sudo systemctl status certbot.timer

# Testa il rinnovo (dry-run, non rinnova realmente)
sudo certbot renew --dry-run
```

## 🐛 Troubleshooting

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

### Errore: "Nginx is not running"

```bash
# Avvia Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### Certificato Esistente ma Non Funziona

```bash
# Verifica certificati esistenti
sudo certbot certificates

# Rinnova certificato esistente
sudo certbot renew

# O forza rinnovo
sudo certbot renew --force-renewal
```

## ✅ Checklist Finale

- [ ] Configurazione Nginx senza HTTPS funziona
- [ ] Certbot installato
- [ ] DNS configurato correttamente
- [ ] Certificato SSL ottenuto
- [ ] HTTPS funziona (`https://packvision.logikaservice.it`)
- [ ] HTTP reindirizza a HTTPS
- [ ] Timer rinnovo automatico attivo

## 🎯 Dopo la Configurazione SSL

Una volta configurato SSL, il sito sarà accessibile via:
- ✅ `https://packvision.logikaservice.it` (sicuro)
- ✅ `http://packvision.logikaservice.it` (reindirizza a HTTPS)

E l'autorizzazione monitor funzionerà correttamente!

