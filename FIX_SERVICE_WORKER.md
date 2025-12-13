# 🔧 Fix Service Worker Cache - Rimuovi Render.com dal Browser

## Problema

Il browser sta ancora caricando vecchi file JavaScript che contengono `ticketapp-4eqb.onrender.com` hardcoded, anche dopo aver:
- ✅ Ricostruito il frontend sul server
- ✅ Pulito la cache del browser
- ✅ Verificato che il nuovo build non contenga Render.com

Questo è probabilmente causato da un **Service Worker** che sta servendo file dalla cache.

## Soluzione: Disabilita Service Worker

### Metodo 1: Via Console Browser (Chrome/Edge)

1. Apri la pagina `https://ticket.logikaservice.it`
2. Apri **DevTools** (F12)
3. Vai sul tab **Application** (o **Applicazioni**)
4. Nel menu a sinistra, espandi **Service Workers**
5. Se vedi un Service Worker attivo:
   - Clicca su **Unregister** per ogni Service Worker
   - Oppure spunta **Bypass for network** e ricarica la pagina
6. Vai su **Cache Storage**
7. Elimina tutte le cache (clic destro → Delete)
8. Ricarica la pagina con **Hard Reload** (Ctrl+Shift+R)

### Metodo 2: Via Console JavaScript

Esegui questo nella Console del browser (F12):

```javascript
// Disabilita tutti i Service Worker
navigator.serviceWorker.getRegistrations().then(function(registrations) {
  for(let registration of registrations) {
    registration.unregister().then(function(boolean) {
      console.log('Service Worker disabilitato:', boolean);
    });
  }
});

// Pulisci tutte le cache
caches.keys().then(function(names) {
  for (let name of names) {
    caches.delete(name).then(function(boolean) {
      console.log('Cache eliminata:', name, boolean);
    });
  }
});

// Ricarica la pagina
location.reload(true);
```

### Metodo 3: Disabilita Service Worker Permanente (Chrome)

1. Apri Chrome DevTools (F12)
2. Vai su **Settings** (icona ingranaggio o F1)
3. Nella sezione **Network**, spunta:
   - ✅ **Disable cache** (mentre DevTools è aperto)
   - ✅ **Update service workers on page load**
4. Chiudi e riapri DevTools
5. Ricarica la pagina

### Metodo 4: Modalità Incognito con DevTools

1. Apri una finestra in **modalità incognito** (Ctrl+Shift+N)
2. Apri DevTools (F12)
3. Vai su **Application** → **Service Workers**
4. Se vedi un Service Worker, disabilitalo
5. Vai su **Network** tab
6. Spunta **Disable cache**
7. Vai a `https://ticket.logikaservice.it`

## Verifica che Funzioni

Dopo aver disabilitato il Service Worker:

1. Apri Console (F12 → Console)
2. Ricarica la pagina (F5)
3. Verifica che **NON** ci siano più:
   - ❌ Errori verso `ticketapp-4eqb.onrender.com`
   - ❌ CORS errors verso Render.com
   - ❌ WebSocket connection a Render.com

4. Verifica **Network** tab:
   - Le chiamate API devono andare a `/api/...` o `ticket.logikaservice.it/api/...`
   - **NON** devono andare a `ticketapp-4eqb.onrender.com`

## Se Ancora Non Funziona

### Verifica che il Server Stia Servendo il Nuovo Build

```bash
# Sul server VPS
cd /var/www/ticketapp/frontend/build/static/js
ls -lah main.*.js

# Verifica hash del file (dovrebbe essere diverso da prima)
# Controlla che non contenga Render.com
grep -a "ticketapp.*onrender.com" main.*.js || echo "✅ OK - nessun Render.com"
```

### Verifica Nginx Serve i File Corretti

```bash
# Verifica timestamp file servito da Nginx
curl -I https://ticket.logikaservice.it/static/js/main.XXXXX.js
# (sostituisci XXXXX con hash attuale)

# Il header Last-Modified dovrebbe essere recente (oggi)
```

### Forza Aggiornamento Build sul Server

```bash
cd /var/www/ticketapp
./rebuild-frontend-server.sh
sudo systemctl reload nginx
```

## Prevenzione Futura

Per evitare che Service Worker facciano cache aggressiva:

1. **Abilita versioning file** (già attivo: `main.378ab973.js` cambia ad ogni build)
2. **Configura Service Worker** per non fare cache dei file JS:

```javascript
// Nel service worker (se esiste)
self.addEventListener('fetch', event => {
  if (event.request.url.includes('/static/js/')) {
    // Non fare cache dei file JS
    event.respondWith(
      fetch(event.request)
    );
  }
});
```

3. **Aggiungi header Nginx** per non fare cache JS:

```nginx
location /static/js/ {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}
```

