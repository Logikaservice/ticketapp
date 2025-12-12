# 🔍 Verifica Finale Configurazione Nginx

## ⚠️ Problema Persiste: 403 Forbidden

Il conflitto potrebbe non essere stato risolto completamente. Verifica:

## 🔍 Comandi di Verifica

### 1. Verifica Contenuto Attuale di ticketapp

```bash
# Verifica se ticket.logikaservice.it è ancora presente
sudo grep "server_name" /etc/nginx/sites-available/ticketapp

# Dovresti vedere solo:
# server_name app.logikaservice.it www.app.logikaservice.it;
```

### 2. Verifica Contenuto di ticketapp.conf

```bash
# Verifica configurazione ticketapp.conf
sudo cat /etc/nginx/sites-available/ticketapp.conf | head -30

# Verifica server_name
sudo grep "server_name" /etc/nginx/sites-available/ticketapp.conf
```

### 3. Verifica Nessun Conflitto

```bash
# Test configurazione (dovrebbe essere SENZA warning)
sudo nginx -t

# Se c'è ancora warning, cerca tutte le occorrenze
sudo grep -r "ticket.logikaservice.it" /etc/nginx/sites-enabled/
```

## ✅ Soluzioni Alternative

### Opzione 1: Disabilita ticketapp.conf Temporaneamente

Se `ticketapp.conf` causa problemi:

```bash
# Rinomina (disabilita)
sudo mv /etc/nginx/sites-enabled/ticketapp.conf /etc/nginx/sites-enabled/ticketapp.conf.disabled

# Verifica
sudo nginx -t

# Ricarica
sudo systemctl reload nginx
```

### Opzione 2: Usa Solo ticketapp.conf

Se `ticketapp.conf` è quello corretto:

```bash
# Disabilita ticketapp
sudo rm /etc/nginx/sites-enabled/ticketapp

# Verifica
sudo nginx -t

# Ricarica
sudo systemctl reload nginx
```

### Opzione 3: Unifica Configurazioni

Crea una configurazione unica che gestisce entrambi i domini:

```bash
# Modifica ticketapp.conf per includere anche app.logikaservice.it
sudo nano /etc/nginx/sites-available/ticketapp.conf

# Aggiungi app.logikaservice.it al server_name:
server_name app.logikaservice.it www.app.logikaservice.it ticket.logikaservice.it www.ticket.logikaservice.it;

# Disabilita ticketapp
sudo rm /etc/nginx/sites-enabled/ticketapp

# Verifica e ricarica
sudo nginx -t
sudo systemctl reload nginx
```

## 🔍 Verifica Permessi Frontend

Il 403 potrebbe anche essere causato da permessi file:

```bash
# Verifica permessi frontend
ls -la /var/www/ticketapp/frontend/build/

# Se necessario, correggi
sudo chown -R www-data:www-data /var/www/ticketapp/frontend/build/
sudo chmod -R 755 /var/www/ticketapp/frontend/build/
```

## 📋 Checklist Diagnostica

Esegui questi comandi e invia output:

```bash
# 1. Verifica server_name in entrambi i file
echo "=== ticketapp ==="
sudo grep "server_name" /etc/nginx/sites-available/ticketapp
echo ""
echo "=== ticketapp.conf ==="
sudo grep "server_name" /etc/nginx/sites-available/ticketapp.conf
echo ""

# 2. Verifica conflitti
sudo nginx -t

# 3. Verifica file attivi
sudo ls -la /etc/nginx/sites-enabled/ | grep ticket

# 4. Verifica permessi frontend
ls -la /var/www/ticketapp/frontend/build/ | head -5
```

