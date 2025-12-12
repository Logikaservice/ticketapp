# 🔍 Debug Backend che Non Risponde (PM2 Online ma Porta 3001 Non Attiva)

## 🚨 Problema Identificato

PM2 mostra il processo come `online`, ma `curl http://localhost:3001/api/health` fallisce.
Questo significa che il backend si avvia ma crasha subito o non si avvia correttamente.

## ✅ Comandi da Eseguire Subito

### 1. Vedi i Log di PM2 (IMPORTANTE - Mostra l'errore)

```bash
pm2 logs ticketapp-backend --lines 100 --nostream
```

**Questo ti mostrerà l'errore esatto che causa il crash.**

### 2. Verifica se la porta 3001 è effettivamente in ascolto

```bash
netstat -tuln | grep 3001
# oppure
ss -tuln | grep 3001
```

**Se non vedi nulla, la porta NON è in ascolto = backend non è attivo.**

### 3. Prova ad avviare il backend manualmente per vedere l'errore

```bash
cd /var/www/ticketapp/backend
node index.js
```

**Questo mostrerà l'errore esatto in tempo reale.** Premi `Ctrl+C` dopo aver visto l'errore.

### 4. Verifica che il file .env esista e sia configurato

```bash
cd /var/www/ticketapp/backend
ls -la .env
cat .env | head -20
```

### 5. Verifica le dipendenze

```bash
cd /var/www/ticketapp/backend
ls -la node_modules
```

---

## 🔧 Soluzioni Comuni

### Se vedi errore "Cannot connect to database"

```bash
# Verifica che PostgreSQL sia attivo
systemctl status postgresql

# Se non è attivo, avvialo
systemctl start postgresql
systemctl enable postgresql

# Verifica la connessione
cd /var/www/ticketapp/backend
cat .env | grep DATABASE_URL
```

### Se vedi errore "Cannot find module"

```bash
cd /var/www/ticketapp/backend
npm install
```

### Se vedi errore "Port 3001 already in use"

```bash
# Trova quale processo usa la porta
lsof -i :3001
# oppure
fuser -k 3001/tcp

# Poi riavvia PM2
pm2 restart ticketapp-backend
```

### Se vedi errore di sintassi JavaScript

```bash
cd /var/www/ticketapp/backend
node -c index.js
```

Questo verificherà errori di sintassi.

---

## 🎯 Comando Completo di Diagnostica

Esegui questo blocco completo:

```bash
cd /var/www/ticketapp/backend && \
echo "=== LOG PM2 (ultimi 100) ===" && \
pm2 logs ticketapp-backend --lines 100 --nostream && \
echo "" && \
echo "=== PORTA 3001 ===" && \
netstat -tuln | grep 3001 && \
echo "" && \
echo "=== FILE .ENV ===" && \
ls -la .env && \
echo "" && \
echo "=== PROVA AVVIO MANUALE (premi Ctrl+C dopo 5 secondi) ===" && \
timeout 5 node index.js || echo "Backend crashato o errore"
```

---

## 📋 Cosa Fare Dopo

1. **Esegui `pm2 logs ticketapp-backend --lines 100 --nostream`**
2. **Copia l'errore completo** che vedi
3. **Condividi l'errore** così posso aiutarti a risolverlo

Gli errori più comuni sono:
- ❌ Connessione database fallita
- ❌ File .env mancante o errato
- ❌ Modulo npm mancante
- ❌ Errore di sintassi nel codice
- ❌ Porta già occupata



