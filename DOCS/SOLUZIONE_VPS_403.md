# 🔧 Soluzione Problema 403 VPS

## 🔍 Problema Identificato

**Configurazione nginx attuale:**
- Server name: `app.logikaservice.it` e `www.app.logikaservice.it`
- Accesso utente: `ticket.logikaservice.it`

**Risultato:** Nginx non trova la configurazione per `ticket.logikaservice.it` → 403 Forbidden

## ✅ Soluzioni

### Opzione 1: Aggiungi `ticket.logikaservice.it` alla configurazione esistente

```bash
# Modifica configurazione nginx
sudo nano /etc/nginx/sites-available/ticketapp

# Cambia questa riga:
# server_name app.logikaservice.it www.app.logikaservice.it;

# In:
server_name app.logikaservice.it www.app.logikaservice.it ticket.logikaservice.it www.ticket.logikaservice.it;

# Salva (Ctrl+O, Enter, Ctrl+X)

# Verifica configurazione
sudo nginx -t

# Ricarica nginx
sudo systemctl reload nginx
```

### Opzione 2: Crea configurazione separata per `ticket.logikaservice.it`

```bash
# Copia configurazione esistente
sudo cp /etc/nginx/sites-available/ticketapp /etc/nginx/sites-available/ticketapp-ticket

# Modifica per ticket.logikaservice.it
sudo nano /etc/nginx/sites-available/ticketapp-ticket

# Cambia server_name in:
server_name ticket.logikaservice.it www.ticket.logikaservice.it;

# Abilita configurazione
sudo ln -s /etc/nginx/sites-available/ticketapp-ticket /etc/nginx/sites-enabled/

# Verifica
sudo nginx -t

# Ricarica
sudo systemctl reload nginx
```

### Opzione 3: Verifica se esiste già una configurazione per ticket

```bash
# Cerca configurazioni esistenti
sudo ls -la /etc/nginx/sites-available/ | grep ticket
sudo ls -la /etc/nginx/sites-enabled/ | grep ticket

# Se esiste, verifica contenuto
sudo cat /etc/nginx/sites-available/ticketapp-ticket 2>/dev/null
```

## 🔍 Verifiche Aggiuntive

### 1. Verifica Frontend Buildato

```bash
# Verifica che il frontend sia buildato
ls -la /var/www/ticketapp/frontend/build/

# Se manca, builda il frontend
cd /var/www/ticketapp/frontend
npm run build
```

### 2. Verifica Certificati SSL

```bash
# Verifica certificati Let's Encrypt
sudo certbot certificates

# Se manca certificato per ticket.logikaservice.it:
sudo certbot --nginx -d ticket.logikaservice.it -d www.ticket.logikaservice.it
```

### 3. Test Dopo Modifiche

```bash
# Test configurazione
sudo nginx -t

# Ricarica nginx
sudo systemctl reload nginx

# Test accesso
curl -I https://ticket.logikaservice.it/
```

## 📋 Checklist Post-Fix

- [ ] Configurazione nginx aggiornata con `ticket.logikaservice.it`
- [ ] `sudo nginx -t` senza errori
- [ ] Nginx ricaricato
- [ ] Frontend buildato (`/var/www/ticketapp/frontend/build/` esiste)
- [ ] Certificato SSL valido per `ticket.logikaservice.it`
- [ ] Sito accessibile da browser

