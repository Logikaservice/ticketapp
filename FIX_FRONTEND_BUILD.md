# 🔧 Fix Errori CORS - Frontend Build con URL Sbagliato

## Problema
Il frontend sta cercando di connettersi a `https://ticketapp-4eqb.onrender.com` invece di usare URL relativi (che vengono gestiti da nginx). Questo causa errori CORS.

## Causa
Il build del frontend è stato fatto con `REACT_APP_API_URL` impostata a `https://ticketapp-4eqb.onrender.com`. In produzione, questa variabile deve essere **vuota** o **non impostata** per usare URL relativi.

## Soluzione

### 1. Connettiti al server VPS
```bash
ssh root@159.69.121.162
```

### 2. Vai nella directory frontend
```bash
cd /var/www/ticketapp/frontend
```

### 3. Verifica/rimuovi REACT_APP_API_URL
```bash
# Verifica se esiste un file .env con REACT_APP_API_URL
cat .env 2>/dev/null || echo "Nessun file .env trovato"

# Se esiste, verifica il contenuto
grep REACT_APP_API_URL .env 2>/dev/null || echo "REACT_APP_API_URL non trovata"
```

### 4. Rimuovi o svuota REACT_APP_API_URL
```bash
# Se il file .env esiste e contiene REACT_APP_API_URL, rimuovila o svuotala
# Opzione 1: Rimuovi la riga
sed -i '/^REACT_APP_API_URL/d' .env

# Opzione 2: Impostala a stringa vuota
sed -i 's/^REACT_APP_API_URL=.*/REACT_APP_API_URL=/' .env

# Opzione 3: Se non c'è file .env, creane uno vuoto (opzionale)
# touch .env
```

### 5. Fai il rebuild del frontend
```bash
# Installa dipendenze se necessario
npm install

# Fai il build (SENZA REACT_APP_API_URL impostata)
npm run build
```

### 6. Verifica che il build sia corretto
```bash
# Controlla che non ci sia il riferimento a Render.com nel bundle
grep -r "ticketapp-4eqb.onrender.com" build/ || echo "✅ Nessun riferimento a Render.com trovato"

# Se trovi riferimenti, significa che la variabile è ancora nel codice
# In quel caso, verifica che REACT_APP_API_URL non sia impostata
```

### 7. Riavvia nginx (se necessario)
```bash
sudo systemctl reload nginx
```

### 8. Test
- Ricarica il dashboard nel browser (Ctrl+Shift+R)
- Verifica nella console che non ci siano più errori CORS verso Render.com
- Verifica che le chiamate API vadano a `ticket.logikaservice.it/api/...` (relative)

## Script Automatico

Esegui questo script per fix automatico:

```bash
cd /var/www/ticketapp/frontend

# Rimuovi REACT_APP_API_URL se presente
if [ -f ".env" ]; then
    sed -i '/^REACT_APP_API_URL/d' .env
    echo "✅ REACT_APP_API_URL rimossa da .env"
fi

# Assicurati che REACT_APP_API_URL non sia impostata per questo build
unset REACT_APP_API_URL
export REACT_APP_API_URL=""

# Rebuild
echo "🔨 Building frontend..."
npm run build

# Verifica
echo "🔍 Verifica build..."
if grep -r "ticketapp-4eqb.onrender.com" build/ > /dev/null 2>&1; then
    echo "❌ ERRORE: Trovati riferimenti a Render.com nel build!"
    echo "   Verifica che REACT_APP_API_URL non sia impostata nel sistema"
else
    echo "✅ Build corretto - nessun riferimento a Render.com"
fi
```

## Verifica Finale

Dopo il rebuild, nella console del browser dovresti vedere:
- ✅ Chiamate API a `https://ticket.logikaservice.it/api/...` (URL relative)
- ✅ WebSocket connesso a `wss://ticket.logikaservice.it/socket.io/...`
- ✅ Nessun errore CORS
- ✅ Nessun errore 502 (se il backend è attivo)

