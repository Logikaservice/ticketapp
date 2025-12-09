# 🚀 Deploy Modifiche sulla VPS

## ✅ Comandi da Eseguire sulla VPS

Connettiti alla VPS e esegui:

```bash
# 1. Vai nella directory del progetto
cd /var/www/ticketapp

# 2. Pull modifiche da GitHub
git pull origin main

# 3. Vai nella directory frontend
cd frontend

# 4. Rebuild frontend (questo creerà index.html)
npm run build

# 5. Verifica che index.html sia stato creato
ls -la build/index.html

# 6. Correggi permessi (importante!)
sudo chown -R www-data:www-data /var/www/ticketapp/frontend/build/
sudo chmod -R 755 /var/www/ticketapp/frontend/build/

# 7. Ricarica nginx
sudo systemctl reload nginx
```

## 🔍 Verifica Finale

Dopo i comandi, verifica:

```bash
# Verifica file creati
ls -la /var/www/ticketapp/frontend/build/ | head -10

# Dovresti vedere:
# - index.html ✅
# - static/ (directory) ✅
# - Altri file necessari ✅
```

## 🌐 Test Accesso

Apri nel browser: `https://ticket.logikaservice.it/`

Dovrebbe funzionare! 🎉

