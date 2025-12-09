# 🔧 Risoluzione Conflitto Nginx - ticket.logikaservice.it

## ⚠️ Problema Identificato

**Warning:** `conflicting server name "ticket.logikaservice.it" on 0.0.0.0:80, ignored`

Questo significa che esiste **già un'altra configurazione nginx** per `ticket.logikaservice.it`, quindi la modifica è stata ignorata.

## 🔍 Verifica Configurazioni Esistenti

Esegui questi comandi sulla VPS:

```bash
# 1. Cerca tutte le configurazioni nginx
sudo ls -la /etc/nginx/sites-available/
sudo ls -la /etc/nginx/sites-enabled/

# 2. Cerca "ticket.logikaservice.it" in tutte le configurazioni
sudo grep -r "ticket.logikaservice.it" /etc/nginx/sites-available/
sudo grep -r "ticket.logikaservice.it" /etc/nginx/sites-enabled/

# 3. Verifica se esiste una configurazione separata per "ticket"
sudo cat /etc/nginx/sites-available/ticketapp-ticket 2>/dev/null
sudo cat /etc/nginx/sites-enabled/ticketapp-ticket 2>/dev/null
```

## ✅ Soluzioni

### Opzione 1: Rimuovi la configurazione duplicata

Se esiste una configurazione separata per `ticket.logikaservice.it` che non funziona:

```bash
# Disabilita configurazione duplicata
sudo rm /etc/nginx/sites-enabled/ticketapp-ticket  # o nome file trovato

# Verifica
sudo nginx -t

# Ricarica
sudo systemctl reload nginx
```

### Opzione 2: Modifica la configurazione esistente

Se la configurazione esistente per `ticket.logikaservice.it` è quella corretta, modificala invece di aggiungere a `ticketapp`:

```bash
# Trova il file con ticket.logikaservice.it
sudo grep -l "ticket.logikaservice.it" /etc/nginx/sites-available/*

# Modifica quel file
sudo nano /etc/nginx/sites-available/[nome-file-trovato]

# Verifica e ricarica
sudo nginx -t
sudo systemctl reload nginx
```

### Opzione 3: Rimuovi ticket.logikaservice.it da ticketapp

Se preferisci mantenere configurazioni separate:

```bash
# Rimuovi ticket.logikaservice.it da ticketapp
sudo nano /etc/nginx/sites-available/ticketapp

# Torna a:
server_name app.logikaservice.it www.app.logikaservice.it;

# Salva e ricarica
sudo nginx -t
sudo systemctl reload nginx
```

## 🔍 Verifica Finale

Dopo la modifica:

```bash
# 1. Verifica nessun warning
sudo nginx -t

# 2. Verifica configurazioni attive
sudo nginx -T | grep "server_name"

# 3. Test accesso
curl -I http://ticket.logikaservice.it/
curl -I https://ticket.logikaservice.it/
```

## 📋 Checklist

- [ ] Trovata configurazione duplicata
- [ ] Risolto conflitto (rimossa o modificata)
- [ ] `sudo nginx -t` senza warning
- [ ] Nginx ricaricato
- [ ] Sito accessibile

