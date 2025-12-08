# ✅ Soluzione: PM2 Non Funziona ma `node index.js` Sì

## Problema Identificato

Quando esegui `node index.js` manualmente, il backend funziona e i dati compaiono. Ma con PM2 no.

**Causa:** PM2 non è configurato correttamente:
- ❌ Directory di lavoro sbagliata
- ❌ File `.env` non trovato/caricato
- ❌ Variabili d'ambiente non passate a PM2

## Soluzione Immediata

### Step 1: Riconfigura PM2

Esegui questo script sul server:

```bash
ssh root@159.69.121.162
cd /var/www/ticketapp
bash FIX_PM2_CONFIG.sh
```

Oppure esegui manualmente:

```bash
# 1. Vai nella directory backend
cd /var/www/ticketapp/backend

# 2. Ferma PM2 esistente
pm2 delete ticketapp-backend 2>/dev/null || pm2 delete backend 2>/dev/null

# 3. Avvia PM2 con configurazione corretta
pm2 start index.js \
    --name ticketapp-backend \
    --cwd /var/www/ticketapp/backend \
    --interpreter node \
    --env production

# 4. Salva configurazione
pm2 save

# 5. Verifica
pm2 status
pm2 logs ticketapp-backend --lines 20
```

### Step 2: Verifica Funzionamento

```bash
# Test endpoint
curl http://localhost:3001/api/health
curl http://localhost:3001/api/crypto/dashboard

# Verifica log
pm2 logs ticketapp-backend --lines 30
```

## Perché Funziona Manualmente ma Non con PM2?

### Quando esegui `node index.js` manualmente:
✅ Sei nella directory `/var/www/ticketapp/backend`  
✅ Il file `.env` viene trovato automaticamente (stessa directory)  
✅ Le variabili d'ambiente vengono caricate correttamente  
✅ Il percorso del database crypto è relativo e funziona  

### Quando PM2 avvia il processo:
❌ PM2 potrebbe essere avviato da un'altra directory  
❌ Il file `.env` non viene trovato  
❌ Le variabili d'ambiente non vengono caricate  
❌ I percorsi relativi non funzionano  

## Fix Definitivo: Configurazione PM2 Corretta

Lo script `FIX_PM2_CONFIG.sh` fa questo:

1. ✅ Ferma il processo PM2 esistente
2. ✅ Verifica che il file `.env` esista
3. ✅ Avvia PM2 con `--cwd` (current working directory) corretto
4. ✅ Configura i log correttamente
5. ✅ Salva la configurazione

## Verifica Dopo il Fix

Dopo aver eseguito lo script:

1. **Verifica stato PM2:**
   ```bash
   pm2 status
   # Dovrebbe mostrare "online" senza restart continui
   ```

2. **Verifica log:**
   ```bash
   pm2 logs ticketapp-backend --lines 30
   # Non dovrebbero esserci errori
   ```

3. **Test endpoint:**
   ```bash
   curl http://localhost:3001/api/health
   # Dovrebbe restituire {"status":"ok",...}
   ```

4. **Verifica dashboard:**
   - Ricarica la pagina del dashboard crypto
   - I dati dovrebbero caricarsi automaticamente (senza dover eseguire `node index.js` manualmente)

## Se il Problema Persiste

Se dopo il fix PM2 continua a non funzionare:

1. **Verifica file .env:**
   ```bash
   cd /var/www/ticketapp/backend
   cat .env
   # Verifica che tutte le variabili necessarie siano presenti
   ```

2. **Verifica permessi:**
   ```bash
   ls -la /var/www/ticketapp/backend/.env
   # Dovrebbe essere leggibile da PM2
   ```

3. **Avvia manualmente per confronto:**
   ```bash
   cd /var/www/ticketapp/backend
   node index.js
   # Se funziona manualmente ma non con PM2, il problema è nella configurazione PM2
   ```

4. **Verifica log PM2:**
   ```bash
   pm2 logs ticketapp-backend --lines 100
   # Cerca errori specifici
   ```

## Comandi Rapidi

```bash
# Riconfigura PM2 in un comando
ssh root@159.69.121.162 << 'EOF'
cd /var/www/ticketapp/backend
pm2 delete ticketapp-backend 2>/dev/null
pm2 start index.js --name ticketapp-backend --cwd /var/www/ticketapp/backend --env production
pm2 save
sleep 3
pm2 status
curl -s http://localhost:3001/api/health
EOF
```

## Risultato Atteso

Dopo il fix:
- ✅ PM2 avvia il backend correttamente
- ✅ I dati compaiono automaticamente nel dashboard
- ✅ Non serve più eseguire `node index.js` manualmente
- ✅ Il backend resta attivo anche dopo riavvii del server
