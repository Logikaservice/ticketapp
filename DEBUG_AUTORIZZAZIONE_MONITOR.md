# Debug Sistema Autorizzazione Monitor

## 🔍 Problema Identificato

Dall'analisi degli screenshot e dei log, il problema è:

1. ✅ **Frontend funziona**: La schermata di autorizzazione viene mostrata correttamente
2. ❌ **Backend API**: Quando si clicca "Richiedi Codice", l'API restituisce HTML invece di JSON
3. ❌ **Errore**: "Unexpected token '<', "<html> <h"... is not valid JSON"

## 🐛 Possibili Cause

### 1. Database PackVision non configurato

Il database `packvision_db` potrebbe non esistere o non essere accessibile.

**Verifica:**
```bash
# SSH sul server
ssh user@server

# Connettiti a PostgreSQL
sudo -u postgres psql

# Verifica database
\l | grep packvision

# Se non esiste, crealo
CREATE DATABASE packvision_db;
```

### 2. Variabile d'ambiente DATABASE_URL non configurata

**Verifica:**
```bash
# Sul server, controlla le variabili d'ambiente
sudo systemctl status ticketapp-backend
sudo cat /etc/systemd/system/ticketapp-backend.service | grep DATABASE_URL

# Oppure nel file .env
cat /var/www/ticketapp/.env | grep DATABASE_URL
```

**Configurazione corretta:**
```env
DATABASE_URL=postgresql://user:password@localhost:5432/packvision_db
```

### 3. Route non accessibile pubblicamente

Le route PackVision potrebbero essere bloccate da middleware di autenticazione.

**Verifica in `backend/index.js`:**
- Le route PackVision devono essere montate PRIMA dei middleware di autenticazione
- Le route `/api/packvision/monitor/*` devono essere pubbliche

### 4. Errore nel backend che restituisce HTML

Se c'è un errore, Express potrebbe restituire una pagina HTML di errore invece di JSON.

**Controlla i log del backend:**
```bash
# SSH sul server
ssh user@server

# Controlla i log
sudo journalctl -u ticketapp-backend -f
# oppure
tail -f /var/www/ticketapp/logs/backend.log
```

## 🔧 Soluzioni

### Soluzione 1: Verifica Database

```bash
# Crea database se non esiste
sudo -u postgres psql -c "CREATE DATABASE packvision_db;"

# Verifica connessione
sudo -u postgres psql -d packvision_db -c "SELECT version();"
```

### Soluzione 2: Verifica Variabili d'Ambiente

Controlla che nel file `.env` del backend ci siano:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/packvision_db
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
```

### Soluzione 3: Test API Diretto

Testa l'API direttamente dal server:

```bash
# Test richiesta monitor
curl -X POST https://packvision.logikaservice.it/api/packvision/monitor/request \
  -H "Content-Type: application/json" \
  -d '{"monitor_id": 1}'

# Dovrebbe restituire JSON, non HTML
```

### Soluzione 4: Verifica Log Backend

```bash
# Controlla errori recenti
sudo journalctl -u ticketapp-backend --since "10 minutes ago" | grep -i "packvision\|error\|monitor"
```

## 📋 Checklist Debug

- [ ] Database `packvision_db` esiste
- [ ] Variabile `DATABASE_URL` configurata correttamente
- [ ] Route `/api/packvision/monitor/request` è accessibile pubblicamente
- [ ] Backend è in esecuzione e raggiungibile
- [ ] Log backend non mostrano errori
- [ ] Test curl restituisce JSON, non HTML
- [ ] Email configurata (EMAIL_USER, EMAIL_PASSWORD)

## 🎯 Test Rapido

### 1. Test API Diretto

```bash
curl -v -X POST http://localhost:3001/api/packvision/monitor/request \
  -H "Content-Type: application/json" \
  -d '{"monitor_id": 1}'
```

### 2. Verifica Risposta

Dovrebbe restituire:
```json
{
  "success": true,
  "message": "Codice di autorizzazione generato...",
  "request_id": 123,
  "expires_at": "2025-12-01T..."
}
```

Se restituisce HTML, c'è un problema con:
- Il routing
- Il database
- Un errore non gestito

## 🔄 Prossimi Passi

1. **Verifica database**: Controlla che `packvision_db` esista
2. **Controlla log**: Verifica errori nel backend
3. **Test API**: Testa direttamente con curl
4. **Riavvia backend**: Se necessario, riavvia il servizio
5. **Verifica deploy**: Controlla che le modifiche siano state deployate

## 📞 Log da Controllare

```bash
# Log backend
sudo journalctl -u ticketapp-backend -n 100

# Log Nginx
sudo tail -f /var/log/nginx/error.log

# Log PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-*.log
```

## ✅ Verifica Funzionamento

Dopo aver risolto i problemi, verifica:

1. Apri: `https://packvision.logikaservice.it/?mode=display&monitor=1`
2. Dovrebbe mostrare: "Autorizzazione Monitor 1"
3. Clicca: "Richiedi Codice"
4. Dovrebbe:
   - Mostrare "Codice generato"
   - Non mostrare errori nella console
   - Inviare email a info@logikaservice.it

## 🐛 Errore Specifico: "Unexpected token '<'"

Questo errore significa che:
- Il server ha restituito HTML invece di JSON
- Probabilmente una pagina di errore o redirect
- La route non è accessibile o c'è un errore

**Soluzione immediata:**
1. Controlla i log del backend
2. Verifica che la route esista
3. Testa l'API direttamente
4. Verifica il database





