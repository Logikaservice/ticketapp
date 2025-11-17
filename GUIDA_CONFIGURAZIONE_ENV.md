# Guida Configurazione File .env

## 📋 Come Creare il File .env

### 1. Crea il file .env sul server

Collegati al server e vai nella directory backend:

```bash
cd /var/www/ticketapp/backend
nano .env
```

### 2. Copia il template

Copia il contenuto del file `.env.example` e incollalo nel file `.env`.

### 3. Compila le variabili

Sostituisci tutti i valori che iniziano con `TUO_` con i tuoi valori reali.

---

## 🔑 Variabili da Configurare

### ✅ OBBLIGATORIE (minimo per far funzionare l'app)

#### 1. DATABASE_URL
**Dove trovarla:**
- Vai su [Supabase Dashboard](https://supabase.com/dashboard)
- Seleziona il tuo progetto
- Vai su "Settings" → "Database"
- Copia la "Connection string" (URI)
- Formato: `postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres`

**Esempio:**
```
DATABASE_URL=postgresql://postgres.xxxxx:password@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
```

#### 2. JWT_SECRET
**Cosa fare:**
- Genera una stringa casuale lunga (minimo 32 caratteri)
- Puoi usare: `openssl rand -base64 32` sul server

**Esempio:**
```
JWT_SECRET=super-secret-key-123456789012345678901234567890
```

#### 3. EMAIL_USER e EMAIL_PASSWORD
**Se usi Gmail:**
- Vai su [Google Account](https://myaccount.google.com/)
- "Sicurezza" → "Verifica in 2 passaggi" (deve essere attiva)
- "Password delle app" → Crea nuova password app
- Usa quella password come `EMAIL_PASSWORD`

**Se usi Aruba:**
- Usa le credenziali della tua casella email Aruba

**Esempio:**
```
EMAIL_USER=info@logikaservice.it
EMAIL_PASSWORD=tua-app-password-qui
```

#### 4. FRONTEND_URL e API_URL
**Dominio ufficiale (ticket.logikaservice.it):**
```
FRONTEND_URL=https://ticket.logikaservice.it
API_URL=https://ticket.logikaservice.it
```

**Solo per test con IP diretto (senza HTTPS):**
```
FRONTEND_URL=http://159.69.121.162
API_URL=http://159.69.121.162
```

---

### ⚙️ OPZIONALI (ma consigliati)

#### GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET
**Dove trovarli:**
- Vai su [Google Cloud Console](https://console.cloud.google.com/)
- Crea un progetto o seleziona quello esistente
- "APIs & Services" → "Credentials"
- Crea "OAuth 2.0 Client ID"
- Copia Client ID e Client Secret

**Esempio:**
```
GOOGLE_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnopqrstuvwxyz
```

#### GOOGLE CALENDAR (Service Account)
**Dove trovarli:**
- Vai su [Google Cloud Console](https://console.cloud.google.com/)
- "APIs & Services" → "Credentials"
- Crea "Service Account"
- Scarica il file JSON
- Apri il JSON e copia i valori nel .env

**Esempio:**
```
GOOGLE_CLIENT_EMAIL=ticketapp@ticketapp-123456.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
GOOGLE_PROJECT_ID=ticketapp-123456
GOOGLE_USER_EMAIL=tua-email@gmail.com
```

---

## 📝 Esempio File .env Completo (Minimo)

```env
NODE_ENV=production
PORT=3001

# Database Supabase
DATABASE_URL=postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres

# JWT
JWT_SECRET=super-secret-key-123456789012345678901234567890

# Email
EMAIL_USER=info@logikaservice.it
EMAIL_PASSWORD=tua-app-password

# URL (usa IP per ora, poi cambia con dominio)
FRONTEND_URL=http://159.69.121.162
API_URL=http://159.69.121.162

# CORS (separa con virgola)
ALLOWED_ORIGINS=https://ticket.logikaservice.it,http://localhost:3000
```

---

## ✅ Verifica Configurazione

Dopo aver creato il file `.env`, verifica che sia corretto:

```bash
cd /var/www/ticketapp/backend
cat .env
```

**Assicurati che:**
- Non ci siano spazi prima o dopo il `=`
- Le stringhe con spazi siano tra virgolette (se necessario)
- Non ci siano caratteri strani

---

## 🔒 Sicurezza

⚠️ **IMPORTANTE:**
- Il file `.env` contiene informazioni sensibili
- Non committarlo mai su GitHub (dovrebbe essere già in `.gitignore`)
- Mantieni i permessi sicuri: `chmod 600 .env`

---

## 🚀 Dopo la Configurazione

Una volta configurato il `.env`, puoi:
1. Testare il backend: `node index.js`
2. Configurare Nginx
3. Generare certificato SSL
4. Avviare con PM2


