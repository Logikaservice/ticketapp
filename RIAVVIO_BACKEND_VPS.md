# 🔄 Riavvio Backend VPS dopo Migrazione

## ⚠️ Problema: Processo PM2 non trovato

Il comando `pm2 restart backend` ha fallito perché il processo non si chiama "backend".

## 🔍 Soluzione: Trova il Nome Corretto

Esegui sulla VPS:

```bash
# 1. Lista tutti i processi PM2
pm2 list

# 2. Cerca il processo del backend
pm2 list | grep -i ticket
```

**Nomi comuni:**
- `ticketapp-backend`
- `ticketapp`
- `backend-ticketapp`

## ✅ Riavvio Corretto

Una volta trovato il nome, riavvia:

```bash
# Esempio se si chiama "ticketapp-backend"
pm2 restart ticketapp-backend

# Oppure se si chiama "ticketapp"
pm2 restart ticketapp
```

## 🔍 Verifica Log

Dopo il riavvio:

```bash
# Vedi log (usa il nome corretto)
pm2 logs ticketapp-backend --lines 50
# oppure
pm2 logs ticketapp --lines 50

# Cerca questi messaggi:
# ✅ Connected to the crypto PostgreSQL database
# ✅ Tabelle crypto PostgreSQL inizializzate correttamente
```

## 🆘 Se il Processo Non Esiste

Se PM2 non trova nessun processo, avvialo manualmente:

```bash
cd /var/www/ticketapp/backend
pm2 start index.js --name ticketapp-backend
pm2 save
```

