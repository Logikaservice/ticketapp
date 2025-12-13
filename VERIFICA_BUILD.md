# 🔍 Verifica Build Frontend - URL Corretti

## Problema
Anche dopo il rebuild, il frontend continua a cercare di connettersi a `ticketapp-4eqb.onrender.com`. Questo significa che:

1. **Il build non è stato fatto correttamente** (REACT_APP_API_URL ancora impostata)
2. **O il vecchio build è ancora servito** (cache nginx o browser)

## Verifica sul Server

### 1. Verifica che il build sia stato aggiornato
```bash
cd /var/www/ticketapp/frontend

# Verifica data ultima modifica del bundle
ls -lah build/static/js/main.*.js

# Verifica che non ci siano riferimenti a Render.com nel build
grep -r "ticketapp-4eqb.onrender.com" build/ || echo "✅ Nessun riferimento trovato"
grep -r "onrender.com" build/ || echo "✅ Nessun riferimento trovato"

# Se trovi riferimenti, il build è vecchio!
```

### 2. Se il build contiene ancora riferimenti a Render.com

```bash
cd /var/www/ticketapp/frontend

# 1. Rimuovi completamente REACT_APP_API_URL
unset REACT_APP_API_URL
export REACT_APP_API_URL=""

# 2. Verifica che non sia in .env
sed -i '/^REACT_APP_API_URL/d' .env 2>/dev/null || true

# 3. Pulisci il vecchio build
rm -rf build/

# 4. Rebuild completo
npm run build

# 5. Verifica di nuovo
grep -r "ticketapp-4eqb.onrender.com" build/ || echo "✅ Build corretto!"
```

### 3. Verifica configurazione nginx

```bash
# Verifica che nginx punti al build corretto
grep -r "root.*frontend.*build" /etc/nginx/sites-available/

# Dovrebbe essere qualcosa come:
# root /var/www/ticketapp/frontend/build;
```

### 4. Ricarica nginx e pulisci cache

```bash
# Ricarica nginx
sudo systemctl reload nginx

# Se usi cache nginx, puliscila
sudo nginx -s reload
```

## Verifica nel Browser

1. **Pulisci cache del browser:**
   - Chrome: Ctrl+Shift+Delete → Seleziona "Immagini e file nella cache" → Ultima ora
   - O usa modalità incognito per test

2. **Hard reload:**
   - Ctrl+Shift+R (o Ctrl+F5)
   - Questo forza il browser a scaricare di nuovo i file JS

3. **Verifica nella console:**
   - Apri DevTools (F12)
   - Vai su Network tab
   - Ricarica la pagina
   - Controlla che le chiamate API vadano a `ticket.logikaservice.it/api/...` e NON a `ticketapp-4eqb.onrender.com`

4. **Verifica il bundle JS caricato:**
   - In DevTools → Network → Trova `main.*.js`
   - Controlla che la data corrisponda al nuovo build
   - Oppure nel file cerca "ticketapp-4eqb" - NON dovrebbe essere presente

## Script Automatico di Verifica

```bash
#!/bin/bash
cd /var/www/ticketapp/frontend

echo "🔍 Verifica build frontend..."
echo ""

# Verifica riferimenti a Render.com
echo "1. Verifica riferimenti a Render.com nel build:"
if grep -r "ticketapp-4eqb.onrender.com" build/ > /dev/null 2>&1; then
    echo "❌ ERRORE: Trovati riferimenti a Render.com!"
    echo "   Il build è vecchio o REACT_APP_API_URL è ancora impostata"
    echo ""
    echo "🔧 Soluzione:"
    echo "   rm -rf build/"
    echo "   unset REACT_APP_API_URL"
    echo "   export REACT_APP_API_URL=\"\""
    echo "   npm run build"
    exit 1
else
    echo "✅ Nessun riferimento a Render.com trovato"
fi

# Verifica data build
echo ""
echo "2. Data ultima modifica build:"
ls -lh build/static/js/main.*.js | head -1

# Verifica nginx
echo ""
echo "3. Verifica configurazione nginx:"
NGINX_ROOT=$(grep -r "root.*frontend.*build" /etc/nginx/sites-available/ 2>/dev/null | head -1)
if [ -n "$NGINX_ROOT" ]; then
    echo "   $NGINX_ROOT"
else
    echo "   ⚠️  Impossibile determinare nginx root"
fi

echo ""
echo "✅ Verifica completata!"
```

