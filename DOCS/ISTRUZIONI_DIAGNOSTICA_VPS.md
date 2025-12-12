# 🔍 Istruzioni Diagnostica VPS - HTTP 500 /bot-analysis

## ⚠️ IMPORTANTE: Questi comandi vanno eseguiti sulla VPS (server Linux), NON su Windows!

### 📋 Come connettersi alla VPS

**Opzione 1: SSH (se hai accesso SSH)**
```bash
ssh utente@ticket.logikaservice.it
# oppure
ssh utente@IP_VPS
```

**Opzione 2: Se usi un pannello di controllo**
- Accedi al pannello di controllo del tuo hosting/VPS
- Cerca "Terminal", "SSH", o "Console"
- Apri il terminale web

**Opzione 3: Se usi Windows e hai SSH installato**
```powershell
# In PowerShell o CMD
ssh utente@ticket.logikaservice.it
```

---

## 🔍 Comandi da eseguire SULLA VPS (dopo esserti connesso)

### 1. Verifica log errori bot-analysis
```bash
pm2 logs ticketapp-backend --lines 100 | grep -i "bot-analysis\|error" | tail -30
```

### 2. Log completi ultima richiesta
```bash
pm2 logs ticketapp-backend --lines 200 | grep -A 20 "BOT-ANALYSIS"
```

### 3. Test connessione database
```bash
cd /var/www/ticketapp/backend
node -e "const db=require('./crypto_db');db.dbAll('SELECT 1',[]).then(r=>console.log('OK:',r)).catch(e=>console.error('ERR:',e.message));"
```

### 4. Verifica database esiste
```bash
psql -U postgres -h localhost -c "\l" | grep crypto_db
```

### 5. Verifica tabelle nel database
```bash
psql -U postgres -h localhost -d crypto_db -c "\dt"
```

### 6. Test query klines (quella che fallisce)
```bash
cd /var/www/ticketapp/backend
node -e "
const db = require('./crypto_db');
const symbol = 'bitcoin';
db.dbAll('SELECT open_time, open_price FROM klines WHERE symbol = \$1 AND interval = '\''15m'\'' LIMIT 5', [symbol])
  .then(r => console.log('✅ Query OK:', r.length, 'righe'))
  .catch(e => console.error('❌ Errore:', e.message, e.stack));
"
```

---

## 📤 Cosa inviare

Dopo aver eseguito i comandi sulla VPS, invia:
1. **Output del comando 1** (log errori)
2. **Output del comando 2** (log completi bot-analysis)
3. **Output del comando 3** (test database)
4. **Output del comando 4** (verifica database esiste)
5. **Output del comando 6** (test query klines)

---

## 🔧 Alternativa: Se non puoi accedere alla VPS

Se non hai accesso SSH diretto, puoi:
1. Chiedere al tuo hosting provider di eseguire i comandi
2. Usare un pannello di controllo con terminale web
3. Contattare chi gestisce il server

---

## 💡 Nota per Windows

Se stai usando Windows e vuoi connetterti via SSH:
- **Windows 10/11**: SSH è incluso, usa `ssh` in PowerShell o CMD
- **Windows più vecchi**: Installa PuTTY o Git Bash
- **Alternativa**: Usa WSL (Windows Subsystem for Linux)

