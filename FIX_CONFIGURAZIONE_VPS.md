# 🔧 Fix Configurazione VPS Hetzner - Rimozione Render.com

## Problema Identificato

1. **File `.env.production` sul server** contiene `REACT_APP_API_URL=https://ticketapp-4eqb.onrender.com`
   - Questo hardcoda Render.com nel build frontend!
   - Deve essere rimosso o svuotato

2. **Backend routes** hanno fallback a Render.com invece di VPS Hetzner
   - Corretto: ora usano `https://ticket.logikaservice.it` come fallback

## Soluzione Immediata sul Server

### 1. Rimuovi/Correggi `.env.production` nel Frontend

```bash
cd /var/www/ticketapp/frontend

# RIMUOVI o CORREGGI il file .env.production
rm -f .env.production

# Oppure se vuoi mantenerlo, svuotalo:
echo "REACT_APP_API_URL=" > .env.production
echo "GENERATE_SOURCEMAP=false" >> .env.production
```

### 2. Verifica che `.env` sia Corretto

```bash
cd /var/www/ticketapp/frontend

# Verifica contenuto
cat .env

# Dovrebbe essere:
# REACT_APP_API_URL=
# GENERATE_SOURCEMAP=false

# Se non è così, correggilo:
echo "REACT_APP_API_URL=" > .env
echo "GENERATE_SOURCEMAP=false" >> .env
```

### 3. Verifica Configurazione Backend (Database VPS)

```bash
cd /var/www/ticketapp/backend

# Verifica DATABASE_URL
grep DATABASE_URL .env

# Dovrebbe essere qualcosa come:
# DATABASE_URL=postgresql://postgres:password@localhost:5432/ticketapp
# O puntare al database della VPS Hetzner

# Verifica FRONTEND_URL
grep FRONTEND_URL .env

# Dovrebbe essere:
# FRONTEND_URL=https://ticket.logikaservice.it
# O non essere presente (usa fallback corretto nel codice)
```

### 4. Aggiorna FRONTEND_URL nel Backend (se necessario)

```bash
cd /var/www/ticketapp/backend

# Se non esiste, aggiungilo
if ! grep -q "^FRONTEND_URL=" .env 2>/dev/null; then
    echo "FRONTEND_URL=https://ticket.logikaservice.it" >> .env
else
    # Aggiorna se punta a Render.com
    sed -i 's|^FRONTEND_URL=.*|FRONTEND_URL=https://ticket.logikaservice.it|' .env
fi
```

### 5. Rebuild Frontend (SENZA .env.production)

```bash
cd /var/www/ticketapp/frontend

# Rimuovi build vecchio
rm -rf build

# Assicurati che REACT_APP_API_URL sia vuota
unset REACT_APP_API_URL
export REACT_APP_API_URL=""

# Rebuild
npm run build

# Verifica che non contenga Render.com
grep -r "ticketapp.*onrender.com" build/ || echo "✅ Build corretto!"
```

### 6. Riavvia Backend

```bash
cd /var/www/ticketapp

# Riavvia backend per applicare nuove configurazioni
pm2 restart ticketapp-backend

# Verifica che funzioni
curl http://localhost:3001/api/health
```

### 7. Ricarica Nginx

```bash
sudo systemctl reload nginx
```

## Verifica Finale

### Sul Server:
```bash
# Verifica che non ci siano file .env.production
find /var/www/ticketapp -name ".env.production" -type f

# Verifica che DATABASE_URL punti alla VPS
grep DATABASE_URL /var/www/ticketapp/backend/.env

# Verifica build frontend
grep -r "onrender.com" /var/www/ticketapp/frontend/build/ || echo "✅ OK"
```

### Nel Browser:
1. Pulisci cache (Ctrl+Shift+Delete)
2. Hard reload (Ctrl+Shift+R)
3. Verifica che le chiamate API vadano a `ticket.logikaservice.it/api/...`
4. Verifica che non ci siano più errori CORS verso Render.com

## Configurazione Database VPS

Il database deve essere configurato sul server VPS Hetzner. Verifica:

```bash
# Verifica che PostgreSQL sia in esecuzione
sudo systemctl status postgresql

# Verifica connessione database
cd /var/www/ticketapp/backend
node -e "require('dotenv').config(); const {Pool} = require('pg'); const pool = new Pool({connectionString: process.env.DATABASE_URL}); pool.query('SELECT current_database()').then(r => {console.log('✅ DB:', r.rows[0].current_database); process.exit(0);}).catch(e => {console.error('❌ DB ERR:', e.message); process.exit(1);});"
```

Il DATABASE_URL dovrebbe essere qualcosa come:
- `postgresql://postgres:password@localhost:5432/ticketapp` (database locale VPS)
- O `postgresql://user:pass@hetzner-ip:5432/ticketapp` (database remoto VPS)

**NON** deve essere:
- `postgresql://...@onrender.com` (Render)
- `postgresql://...@localhost` (Windows locale)

