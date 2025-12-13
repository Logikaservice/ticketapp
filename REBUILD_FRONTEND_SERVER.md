# 🔧 Rebuild Frontend sul Server - Rimozione Render.com

## Problema
Il frontend sta ancora cercando di connettersi a `ticketapp-4eqb.onrender.com` invece di usare URL relativi. Questo significa che il build sul server è ancora vecchio.

## Soluzione: Rebuild Completo sul Server

### Passo 1: Connettiti al Server
```bash
ssh root@159.69.121.162
```

### Passo 2: Vai nella Directory Frontend
```bash
cd /var/www/ticketapp/frontend
```

### Passo 3: Aggiorna il Codice
```bash
git pull origin main
```

### Passo 4: Rimuovi Completamente Build e Cache
```bash
# Rimuovi build vecchio
rm -rf build || true

# Rimuovi cache (gestisci directory non vuote)
if [ -d "node_modules/.cache" ]; then
  find node_modules/.cache -mindepth 1 -delete 2>/dev/null || rm -rf node_modules/.cache 2>/dev/null || true
fi

# Rimuovi altre cache
rm -rf .cache || true
rm -f .eslintcache || true
```

### Passo 5: Assicurati che REACT_APP_API_URL NON sia Impostata
```bash
# Rimuovi da .env se presente
sed -i '/^REACT_APP_API_URL/d' .env 2>/dev/null || true

# Assicurati che non sia impostata nel sistema
unset REACT_APP_API_URL
export REACT_APP_API_URL=""

# Crea/aggiorna .env con REACT_APP_API_URL vuoto
echo "REACT_APP_API_URL=" > .env
echo "GENERATE_SOURCEMAP=false" >> .env
```

### Passo 6: Rebuild Completo
```bash
# Installa dipendenze (se necessario)
npm install

# Build frontend (SENZA REACT_APP_API_URL)
npm run build
```

### Passo 7: Verifica che il Build sia Corretto
```bash
# Verifica che non ci siano riferimenti a Render.com
grep -r "ticketapp.*onrender.com" build/ 2>/dev/null || echo "✅ Build corretto - nessun riferimento a Render.com!"

# Se trovi riferimenti, significa che REACT_APP_API_URL è ancora impostata da qualche parte
# Verifica con:
env | grep REACT_APP_API_URL
```

### Passo 8: Ricarica Nginx
```bash
sudo systemctl reload nginx
```

### Passo 9: Test nel Browser
1. **Pulisci cache del browser:**
   - Chrome: Ctrl+Shift+Delete → "Immagini e file nella cache" → Ultima ora
   - Oppure usa modalità incognito

2. **Hard reload:**
   - Ctrl+Shift+R (o Ctrl+F5)

3. **Verifica nella console:**
   - NON dovrebbero esserci più errori CORS verso Render.com
   - Le chiamate API dovrebbero andare a `ticket.logikaservice.it/api/...`

## Script Automatico Completo

```bash
#!/bin/bash
set -e

echo "🔧 REBUILD FRONTEND - Rimozione Render.com"
echo "==========================================="

cd /var/www/ticketapp/frontend

# 1. Aggiorna codice
echo "1️⃣ Aggiornamento codice..."
git pull origin main

# 2. Rimuovi build e cache
echo "2️⃣ Rimozione build e cache..."
rm -rf build || true
if [ -d "node_modules/.cache" ]; then
  find node_modules/.cache -mindepth 1 -delete 2>/dev/null || rm -rf node_modules/.cache 2>/dev/null || true
fi
rm -rf .cache || true
rm -f .eslintcache || true

# 3. Configura .env
echo "3️⃣ Configurazione .env..."
unset REACT_APP_API_URL
export REACT_APP_API_URL=""
sed -i '/^REACT_APP_API_URL/d' .env 2>/dev/null || true
echo "REACT_APP_API_URL=" > .env
echo "GENERATE_SOURCEMAP=false" >> .env

# 4. Build
echo "4️⃣ Build frontend..."
npm install
npm run build

# 5. Verifica
echo "5️⃣ Verifica build..."
if grep -r "ticketapp.*onrender.com" build/ 2>/dev/null; then
  echo "❌ ERRORE: Trovati ancora riferimenti a Render.com!"
  echo "   Verifica che REACT_APP_API_URL non sia impostata"
  exit 1
else
  echo "✅ Build corretto - nessun riferimento a Render.com"
fi

# 6. Ricarica nginx
echo "6️⃣ Ricarica nginx..."
sudo systemctl reload nginx

echo ""
echo "✅ Rebuild completato!"
echo ""
echo "📝 IMPORTANTE:"
echo "1. Pulisci cache del browser (Ctrl+Shift+R)"
echo "2. Verifica nella console che non ci siano più errori CORS"
```

## Troubleshooting

### Se il build contiene ancora riferimenti a Render.com:

1. **Verifica variabili d'ambiente:**
   ```bash
   env | grep REACT_APP_API_URL
   ```

2. **Verifica file .env:**
   ```bash
   cat .env | grep REACT_APP_API_URL
   ```

3. **Verifica .env.local o altri file:**
   ```bash
   ls -la .env*
   cat .env.local 2>/dev/null || echo "Nessun .env.local"
   ```

4. **Pulisci tutto e ricomincia:**
   ```bash
   cd /var/www/ticketapp/frontend
   rm -rf build node_modules/.cache .cache .env .env.local .env.production
   unset REACT_APP_API_URL
   export REACT_APP_API_URL=""
   npm install
   npm run build
   ```

