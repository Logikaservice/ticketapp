# Guida Deploy su Render

## Configurazione Backend

### 1. Variabili d'Ambiente su Render
Configura queste variabili nel dashboard di Render per il servizio backend:

```
DATABASE_URL=postgresql://username:password@host:port/database
JWT_SECRET=your_jwt_secret_here
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
NODE_ENV=production
```

### 2. Build Command
```
cd backend && npm install
```

### 3. Start Command
```
cd backend && npm start
```

## Configurazione Frontend

### 1. Variabili d'Ambiente su Render
Configura queste variabili nel dashboard di Render per il servizio frontend:

```
REACT_APP_API_URL=https://your-backend-url.onrender.com
REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id
```

### 2. Build Command
```
cd frontend && npm install && npm run build
```

### 3. Publish Directory
```
frontend/build
```

## Database PostgreSQL

1. Crea un database PostgreSQL su Render
2. Copia la connection string e usala come DATABASE_URL nel backend

## Passi per il Deploy

1. **Push del codice su GitHub**
2. **Crea servizio Backend su Render**
3. **Crea servizio Frontend su Render**
4. **Crea database PostgreSQL su Render**
5. **Configura le variabili d'ambiente**
6. **Deploy**

## URL Finali

- Backend: `https://ticketapp-backend.onrender.com`
- Frontend: `https://ticketapp-frontend.onrender.com`
- Database: Configurato automaticamente
