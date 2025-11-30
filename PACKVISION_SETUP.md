# 📺 Guida Setup PackVision - packvision.logikaservice.it

## 📋 Panoramica

PackVision è il sistema di visualizzazione messaggi per display pubblicitari/informativi. Quando si accede da `packvision.logikaservice.it`, viene mostrata automaticamente la vista display a schermo intero (senza pannello admin).

## ✅ Cosa è già implementato

1. **Componente PackVision** (`frontend/src/components/PackVision.jsx`)
   - Gestione completa messaggi con priorità
   - Vista display a schermo intero con animazioni
   - Pannello admin per la gestione
   - Rotazione automatica messaggi con effetti animati

2. **Route Backend** (`backend/routes/packvision.js`)
   - Endpoint `/api/packvision/messages` - CRUD messaggi
   - Endpoint `/api/packvision/settings` - Gestione impostazioni
   - Endpoint `/api/packvision/health` - Health check

3. **Rilevamento Dominio**
   - Automatico quando si accede da `packvision.logikaservice.it`
   - Mostra solo la vista display (senza Header/Dashboard)

## 🚀 Come configurare packvision.logikaservice.it

### Step 1: Configura DNS su Aruba

1. Accedi al pannello DNS di Aruba
2. Aggiungi un record **A** per `packvision.logikaservice.it` che punti all'IP del server (es. `159.69.121.162`)
   - Oppure un record **CNAME** che punta a `ticket.logikaservice.it`

### Step 2: Configura Nginx sul server

```bash
# Copia il file di configurazione
sudo cp deploy/nginx/packvision.logikaservice.it.conf /etc/nginx/sites-available/packvision.logikaservice.it

# Abilita il sito
sudo ln -s /etc/nginx/sites-available/packvision.logikaservice.it /etc/nginx/sites-enabled/

# Test configurazione
sudo nginx -t

# Ricarica nginx
sudo systemctl reload nginx
```

### Step 3: Configura SSL/HTTPS (opzionale ma consigliato)

```bash
# Ottieni certificato SSL con Certbot
sudo certbot --nginx -d packvision.logikaservice.it

# Verifica che il certificato sia stato installato
sudo ls -la /etc/letsencrypt/live/packvision.logikaservice.it/
```

### Step 4: Verifica configurazione

1. Verifica che il DNS punti correttamente:
   ```bash
   dig packvision.logikaservice.it
   # o
   nslookup packvision.logikaservice.it
   ```

2. Testa l'accesso:
   ```bash
   curl -I http://packvision.logikaservice.it
   # Dopo SSL:
   curl -I https://packvision.logikaservice.it
   ```

3. Accedi da browser:
   - `http://packvision.logikaservice.it` (o `https://` se configurato SSL)
   - Dovresti vedere direttamente la vista display di PackVision (senza login/Dashboard)

## 📝 Note Importanti

- **Accesso Diretto**: Quando si accede da `packvision.logikaservice.it`, viene mostrata **automaticamente** solo la vista display (senza Header, Dashboard o pannello admin)
- **Login**: Per accedere al pannello admin, usa `ticket.logikaservice.it` e apri PackVision dal menu
- **Modalità Display**: Il componente PackVision rileva automaticamente se si è su `packvision.logikaservice.it` e passa in modalità display
- **Backend**: Le API PackVision sono già configurate e accettano richieste da tutti i sottodomini `.logikaservice.it`

## 🔧 Troubleshooting

### Il dominio non risolve
- Verifica che il record DNS sia stato propagato (può richiedere fino a 24 ore)
- Controlla il record DNS nel pannello Aruba

### Errore 502 Bad Gateway
- Verifica che il backend Node.js sia in esecuzione sulla porta 3001
- Controlla i log: `sudo journalctl -u ticketapp-backend -n 50`

### Errore 404
- Verifica che il file di build del frontend esista: `/var/www/ticketapp/frontend/build`
- Controlla che il path in nginx sia corretto

### Non mostra PackVision ma mostra la dashboard
- Verifica che l'hostname sia esattamente `packvision.logikaservice.it`
- Controlla la console del browser per errori JavaScript
- Verifica che il file `frontend/src/App.jsx` contenga il rilevamento di `isPackVisionHostname`

## 📚 File di Riferimento

- **Configurazione Nginx**: `deploy/nginx/packvision.logikaservice.it.conf`
- **Componente PackVision**: `frontend/src/components/PackVision.jsx`
- **Rilevamento Dominio**: `frontend/src/App.jsx` (righe 59, 66-85)

## ✅ Checklist Finale

- [ ] DNS configurato su Aruba (record A o CNAME)
- [ ] File nginx copiato in `/etc/nginx/sites-available/`
- [ ] Symlink creato in `/etc/nginx/sites-enabled/`
- [ ] Nginx ricaricato senza errori
- [ ] SSL configurato (opzionale)
- [ ] Accesso testato da browser
- [ ] Vista display mostrata correttamente

