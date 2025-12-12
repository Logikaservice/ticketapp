# 🔒 Guida SICURA per Fix 403 Forbidden

## ⚠️ IMPORTANTE: Non perderai NESSUN lavoro!

**✅ Il codice è già su GitHub - è al sicuro!**  
**✅ I comandi sono SOLO per verificare/riparare permessi e configurazione**  
**✅ NON modificano il codice sorgente**

---

## 📍 DOVE eseguire i comandi

### ❌ NON su Windows (macchina locale)
I comandi Linux non funzionano su Windows PowerShell.

### ✅ SULLA VPS (server Linux) via SSH

---

## 🔐 Come connettersi alla VPS

### Opzione 1: SSH da Windows (PowerShell o CMD)
```powershell
# In PowerShell o CMD su Windows
ssh root@ticket.logikaservice.it
# oppure
ssh root@IP_VPS
```

### Opzione 2: Pannello di controllo hosting
- Accedi al pannello del tuo hosting/VPS
- Cerca "Terminal", "SSH", "Console" o "Shell"
- Apri il terminale web

### Opzione 3: Software SSH (PuTTY, MobaXterm, etc.)
- Usa un client SSH come PuTTY
- Connettiti a `ticket.logikaservice.it` o all'IP della VPS

---

## 📋 Comandi da eseguire SULLA VPS (via SSH)

### FASE 1: Verifica (SOLO lettura - nessuna modifica)

**1. Verifica se index.html esiste:**
```bash
ls -la /var/www/ticketapp/frontend/build/index.html
```
**✅ Se esiste:** Vedrai il file con permessi  
**❌ Se non esiste:** Vedrai "No such file or directory"

**2. Verifica permessi directory:**
```bash
ls -la /var/www/ticketapp/frontend/build/ | head -10
```
**✅ DEVE mostrare:** File con permessi `-rw-r--r--` e directory `drwxr-xr-x`

**3. Verifica log Nginx (SOLO lettura):**
```bash
sudo tail -20 /var/log/nginx/error.log
```
**✅ Vedrai:** Eventuali errori specifici (se ci sono)

---

### FASE 2: Fix (SOLO se necessario)

**⚠️ Esegui SOLO se la FASE 1 ha mostrato problemi!**

**1. Se index.html manca - Ricostruisci frontend:**
```bash
cd /var/www/ticketapp/frontend
npm install
npm run build
```
**⏱️ Tempo:** 2-5 minuti  
**✅ Risultato:** Crea `build/index.html` e altri file

**2. Correggi permessi (SOLO se errati):**
```bash
sudo chown -R www-data:www-data /var/www/ticketapp/
sudo chmod -R 755 /var/www/ticketapp/
sudo find /var/www/ticketapp/frontend/build -type f -exec chmod 644 {} \;
sudo find /var/www/ticketapp/frontend/build -type d -exec chmod 755 {} \;
```
**⏱️ Tempo:** 10-30 secondi  
**✅ Risultato:** Corregge permessi file/directory

**3. Verifica configurazione Nginx (SOLO lettura):**
```bash
sudo nginx -t
```
**✅ DEVE mostrare:** "syntax is ok" e "test is successful"

**4. Ricarica Nginx (SOLO se tutto OK):**
```bash
sudo systemctl reload nginx
```
**⏱️ Tempo:** 1-2 secondi  
**✅ Risultato:** Nginx ricarica la configurazione

---

## 🛡️ Cosa NON viene modificato

- ❌ **NON modifica il codice sorgente**
- ❌ **NON modifica i file in `frontend/src/`**
- ❌ **NON modifica i file in `backend/`**
- ❌ **NON modifica il database**
- ❌ **NON elimina file**

## ✅ Cosa viene modificato (se necessario)

- ✅ **Solo permessi file/directory** (se errati)
- ✅ **Solo ricostruzione `frontend/build/`** (se manca)
- ✅ **Solo ricarica configurazione Nginx** (se tutto OK)

---

## 📊 Checklist Pre-Operazione

Prima di eseguire qualsiasi comando, verifica:

- [ ] ✅ Sei connesso alla VPS (non su Windows)
- [ ] ✅ Il codice è già pushato su GitHub (backup sicuro)
- [ ] ✅ Hai accesso SSH alla VPS
- [ ] ✅ Hai i permessi sudo (per comandi con `sudo`)

---

## 🚨 Se qualcosa va storto

**Nessun problema!** Il codice è su GitHub, puoi sempre:

1. **Ripristinare il codice:**
   ```bash
   cd /var/www/ticketapp
   git reset --hard origin/main
   git pull origin main
   ```

2. **Ripristinare permessi:**
   ```bash
   sudo chown -R www-data:www-data /var/www/ticketapp/
   sudo chmod -R 755 /var/www/ticketapp/
   ```

3. **Riavviare servizi:**
   ```bash
   pm2 restart ticketapp-backend
   sudo systemctl reload nginx
   ```

---

## 💡 Ordine Consigliato

1. **PRIMA:** Connettiti alla VPS via SSH
2. **POI:** Esegui FASE 1 (solo verifiche)
3. **POI:** Invia i risultati delle verifiche
4. **POI:** Esegui FASE 2 (solo se necessario)

---

## 📞 Supporto

Se hai dubbi su un comando:
- **Chiedi prima di eseguirlo**
- **Esegui prima i comandi di verifica (FASE 1)**
- **Invia i risultati prima di procedere**

