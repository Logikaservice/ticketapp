# 🧹 Come Pulire la Cache del Browser - Soluzione Definitiva

## ⚠️ PROBLEMA

Il browser sta ancora caricando il vecchio JavaScript bundle che contiene riferimenti a `https://ticketapp-4eqb.onrender.com`, anche se il nuovo build sul server è corretto.

## ✅ SOLUZIONE: Pulizia Cache Completa

### Metodo 1: Hard Reload (Più Veloce)

1. **Apri Chrome DevTools** (F12 o Ctrl+Shift+I)
2. **Clic destro sul pulsante di ricarica** (Refresh)
3. Seleziona **"Svuota cache e ricarica forzatamente"** (Empty Cache and Hard Reload)

### Metodo 2: Pulisci Cache Manualmente

**Chrome/Edge:**
1. Premi `Ctrl+Shift+Delete` (Windows) o `Cmd+Shift+Delete` (Mac)
2. Seleziona **"Immagini e file in cache"**
3. Intervallo: **"Ultimo ora"** o **"Tutto"**
4. Clicca **"Cancella dati"**

**Firefox:**
1. Premi `Ctrl+Shift+Delete`
2. Seleziona **"Cache"**
3. Intervallo: **"Ultimo ora"**
4. Clicca **"Cancella adesso"**

### Metodo 3: Modalità Incognito (Test Veloce)

1. Apri una finestra in **modalità incognito** (Ctrl+Shift+N)
2. Vai a `https://ticket.logikaservice.it`
3. Verifica se funziona (non dovrebbe avere cache)

### Metodo 4: Disabilita Cache Durante Sviluppo

**In Chrome DevTools:**
1. Apri DevTools (F12)
2. Vai su **Network** tab
3. **Spunta "Disable cache"**
4. **Tieni DevTools aperto** durante il test
5. Ricarica la pagina (F5)

### Metodo 5: Cancella Dati del Sito (Soluzione Estrema)

**Chrome/Edge:**
1. Clicca sul **lucchetto** nella barra degli indirizzi
2. Clicca su **"Impostazioni sito"**
3. Scorri giù e clicca **"Cancella dati"**
4. Ricarica la pagina

**Oppure:**
1. Vai su `chrome://settings/siteData`
2. Cerca `ticket.logikaservice.it`
3. Clicca sulla **X** per eliminare
4. Ricarica la pagina

## 🔍 Verifica che Funzioni

Dopo aver pulito la cache:

1. **Apri Console** (F12 → Console)
2. **Ricarica la pagina** (F5)
3. **Verifica che NON ci siano più errori** tipo:
   - ❌ `Access to fetch at 'https://ticketapp-4eqb.onrender.com/...'`
   - ❌ `Failed to fetch https://ticketapp-4eqb.onrender.com/...`

4. **Verifica che le chiamate API vadano a**:
   - ✅ `/api/tickets` (URL relativo)
   - ✅ `https://ticket.logikaservice.it/api/...`

## 🚨 Se NON Funziona Dopo Cache Clear

1. **Verifica che il server abbia il nuovo build**:
   ```bash
   # Sul server VPS
   grep -r "ticketapp.*onrender.com" /var/www/ticketapp/frontend/build/ || echo "✅ OK"
   ```

2. **Se trova Render.com, ricostruisci il frontend**:
   ```bash
   cd /var/www/ticketapp/frontend
   rm -rf build
   echo "REACT_APP_API_URL=" > .env
   npm run build
   ```

3. **Verifica timestamp file**:
   ```bash
   ls -lah /var/www/ticketapp/frontend/build/static/js/main.*.js
   # Dovrebbe essere recente (oggi)
   ```

4. **Ricarica Nginx**:
   ```bash
   sudo systemctl reload nginx
   ```

## 💡 Prevenzione Futura

Per evitare problemi di cache in futuro:

1. **Abilita versioning dei file** (già attivo con hash nel nome: `main.378ab973.js`)
2. **Configura Nginx per cache busting**:
   ```nginx
   location /static/ {
       add_header Cache-Control "no-cache, no-store, must-revalidate";
   }
   ```

3. **Usa Service Worker** per gestire cache in modo intelligente

## 📝 Note

- Il **nome del file JavaScript** cambia ad ogni build (es: `main.378ab973.js` → `main.NUOVOHASH.js`)
- Questo dovrebbe forzare il browser a scaricare il nuovo file
- Se il browser **non scarica** il nuovo file, la cache è troppo persistente → usa Metodo 4 o 5

