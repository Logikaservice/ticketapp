# 🔒 Guida Completa: Configurazione SSL/HTTPS per vivaldi.logikaservice.it

Questa guida ti accompagna passo-passo nella configurazione di un certificato SSL gratuito (Let's Encrypt) per abilitare HTTPS su vivaldi.logikaservice.it.

---

## 📋 Prerequisiti

Prima di iniziare, assicurati di avere:

1. ✅ **Accesso SSH al server** con privilegi sudo
2. ✅ **Dominio configurato**: `vivaldi.logikaservice.it` deve puntare all'IP del server
3. ✅ **Nginx installato** e funzionante
4. ✅ **Porte aperte**: 80 (HTTP) e 443 (HTTPS) devono essere accessibili dal firewall
5. ✅ **Configurazione Nginx base** già presente (HTTP funzionante)

**Verifica DNS:**
```bash
dig vivaldi.logikaservice.it
# oppure
nslookup vivaldi.logikaservice.it
```

---

## 🚀 Passo 1: Installazione di Certbot

Certbot è lo strumento ufficiale di Let's Encrypt per ottenere e gestire certificati SSL.

### Su Ubuntu/Debian:
```bash
# Aggiorna i pacchetti
sudo apt update

# Installa Certbot e il plugin Nginx
sudo apt install certbot python3-certbot-nginx -y
```

### Su CentOS/RHEL:
```bash
# Installa EPEL repository
sudo yum install epel-release -y

# Installa Certbot
sudo yum install certbot python3-certbot-nginx -y
```

**Verifica installazione:**
```bash
certbot --version
```

---

## 🔧 Passo 2: Preparazione Configurazione Nginx

### 2.1 Verifica che la configurazione HTTP sia attiva

```bash
# Verifica che il file esista
sudo ls -la /etc/nginx/sites-available/vivaldi.logikaservice.it.conf

# Se non esiste, copialo dal repository
sudo cp /path/to/TicketApp/deploy/nginx/vivaldi.logikaservice.it.conf /etc/nginx/sites-available/vivaldi.logikaservice.it.conf

# Abilita il sito (se non già fatto)
sudo ln -s /etc/nginx/sites-available/vivaldi.logikaservice.it.conf /etc/nginx/sites-enabled/

# Verifica la configurazione
sudo nginx -t
```

### 2.2 Assicurati che la configurazione HTTP includa il blocco per Certbot

Il file deve contenere questa sezione (già presente):
```nginx
# Per Certbot (SSL)
location ~ /.well-known/acme-challenge {
    allow all;
    root /var/www/certbot;
}
```

### 2.3 Crea la directory per le challenge di Certbot

```bash
sudo mkdir -p /var/www/certbot
sudo chown -R www-data:www-data /var/www/certbot
sudo chmod -R 755 /var/www/certbot
```

### 2.4 Riavvia Nginx

```bash
sudo systemctl reload nginx
# oppure
sudo systemctl restart nginx
```

---

## 📜 Passo 3: Ottenimento del Certificato SSL

### 3.1 Esegui Certbot per ottenere il certificato

Certbot modificherà automaticamente la configurazione Nginx per te:

```bash
sudo certbot --nginx -d vivaldi.logikaservice.it
```

**Durante l'esecuzione, Certbot ti chiederà:**

1. **Email per notifiche di rinnovo**: Inserisci una email valida
   ```
   Enter email address (used for urgent renewal and security notices)
   ```

2. **Termini di servizio**: Accetta digitando `A` (Agree)
   ```
   (A)gree/(C)ancel: A
   ```

3. **Condivisione email con EFF**: Opzionale, scegli `Y` o `N`
   ```
   (Y)es/(N)o: N
   ```

4. **Redirect HTTP a HTTPS**: **Scegli `2` (Redirect)** per forzare HTTPS
   ```
   Please choose whether or not to redirect HTTP traffic to HTTPS, removing HTTP access.
   -------------------------------------------------------------------------------
   1: No redirect - Make no further changes to the webserver configuration.
   2: Redirect - Make all requests redirect to secure HTTPS access. 
   Select the appropriate number [1-2] then [enter] (press 'c' to cancel): 2
   ```

### 3.2 Verifica che il certificato sia stato creato

```bash
# Verifica i file del certificato
sudo ls -la /etc/letsencrypt/live/vivaldi.logikaservice.it/

# Dovresti vedere:
# - cert.pem
# - chain.pem
# - fullchain.pem
# - privkey.pem
```

---

## ✅ Passo 4: Verifica e Test

### 4.1 Testa la configurazione Nginx

```bash
sudo nginx -t
```

**Output atteso:**
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### 4.2 Riavvia Nginx

```bash
sudo systemctl reload nginx
```

### 4.3 Testa HTTPS dal browser

1. Apri: `https://vivaldi.logikaservice.it`
2. Verifica che:
   - ✅ Il lucchetto sia verde/chiuso
   - ✅ Non ci siano avvisi di sicurezza
   - ✅ Il sito carichi correttamente

### 4.4 Testa il redirect HTTP → HTTPS

1. Apri: `http://vivaldi.logikaservice.it`
2. Dovresti essere automaticamente reindirizzato a `https://vivaldi.logikaservice.it`

### 4.5 Verifica con SSL Labs (opzionale)

Visita: https://www.ssllabs.com/ssltest/analyze.html?d=vivaldi.logikaservice.it

---

## 🔄 Passo 5: Auto-Rinnovo del Certificato

I certificati Let's Encrypt scadono ogni 90 giorni. Certbot crea automaticamente un cron job per il rinnovo.

### 5.1 Testa il rinnovo automatico

```bash
sudo certbot renew --dry-run
```

**Output atteso:**
```
The dry run was successful.
```

### 5.2 Verifica il cron job

```bash
sudo systemctl status certbot.timer
# oppure
sudo crontab -l | grep certbot
```

### 5.3 Rinnovo manuale (se necessario)

```bash
sudo certbot renew
```

---

## 🛠️ Passo 6: Configurazione Avanzata (Opzionale)

### 6.1 Configurazione SSL Ottimizzata

Dopo l'installazione, puoi ottimizzare la configurazione SSL aggiungendo queste direttive nel blocco `server` HTTPS:

```nginx
# Configurazione SSL ottimizzata
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;

# HSTS (HTTP Strict Transport Security)
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

### 6.2 Verifica la configurazione finale

Il file `/etc/nginx/sites-available/vivaldi.logikaservice.it.conf` dovrebbe contenere:

```nginx
# Blocco HTTP - Redirect a HTTPS
server {
    listen 80;
    server_name vivaldi.logikaservice.it;
    
    location ~ /.well-known/acme-challenge {
        allow all;
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# Blocco HTTPS
server {
    listen 443 ssl http2;
    server_name vivaldi.logikaservice.it;
    
    ssl_certificate /etc/letsencrypt/live/vivaldi.logikaservice.it/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vivaldi.logikaservice.it/privkey.pem;
    
    # ... resto della configurazione ...
}
```

---

## 🐛 Risoluzione Problemi

### Problema: "Failed to obtain certificate"

**Causa**: Il dominio non punta al server o la porta 80 è bloccata.

**Soluzione**:
```bash
# Verifica DNS
dig vivaldi.logikaservice.it

# Verifica che Nginx sia in ascolto sulla porta 80
sudo netstat -tlnp | grep :80

# Verifica il firewall
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### Problema: "Connection refused" su HTTPS

**Causa**: Porta 443 non aperta o Nginx non configurato correttamente.

**Soluzione**:
```bash
# Verifica che Nginx ascolti sulla porta 443
sudo netstat -tlnp | grep :443

# Verifica la configurazione
sudo nginx -t

# Riavvia Nginx
sudo systemctl restart nginx
```

### Problema: Certificato scaduto

**Soluzione**:
```bash
# Rinnova manualmente
sudo certbot renew --force-renewal

# Riavvia Nginx
sudo systemctl reload nginx
```

### Problema: "Too many requests" da Let's Encrypt

**Causa**: Hai superato il limite di 5 certificati per dominio/settimana.

**Soluzione**: Aspetta 7 giorni o usa un certificato esistente.

---

## 📝 Checklist Finale

- [ ] Certbot installato
- [ ] DNS configurato correttamente
- [ ] Porte 80 e 443 aperte
- [ ] Certificato SSL ottenuto
- [ ] HTTPS funzionante
- [ ] Redirect HTTP → HTTPS attivo
- [ ] Auto-rinnovo configurato
- [ ] Test SSL Labs superato

---

## 🔗 Risorse Utili

- **Documentazione Certbot**: https://certbot.eff.org/
- **Let's Encrypt**: https://letsencrypt.org/
- **SSL Labs Test**: https://www.ssllabs.com/ssltest/
- **Mozilla SSL Configuration Generator**: https://ssl-config.mozilla.org/

---

## 📞 Supporto

Se incontri problemi durante la configurazione:

1. Verifica i log di Certbot: `sudo tail -f /var/log/letsencrypt/letsencrypt.log`
2. Verifica i log di Nginx: `sudo tail -f /var/log/nginx/error.log`
3. Controlla lo stato di Nginx: `sudo systemctl status nginx`

---

**🎉 Congratulazioni!** Il tuo sito ora è protetto con HTTPS!

