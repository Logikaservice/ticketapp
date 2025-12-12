# 🚨 Fix Immediato - Errori 502 Crypto Dashboard

## Problema
Il backend continua a crashare e restituisce errori 502 per tutti gli endpoint `/api/crypto/*`.

## Soluzione Immediata

### Opzione 1: Deploy Automatico (Raccomandato)

Esegui questo script sul server VPS:

```bash
ssh root@159.69.121.162
cd /var/www/ticketapp
bash DEPLOY_FIX_CRASH.sh
```

### Opzione 2: Fix Manuale Diretto sul Server

Se lo script non funziona, applica il fix manualmente:

```bash
ssh root@159.69.121.162
cd /var/www/ticketapp/backend

# 1. Fai backup del file
cp index.js index.js.backup

# 2. Apri il file con nano o vi
nano index.js

# 3. Cerca la riga ~1127 che dice:
#    app.use('/api/vivaldi', authenticateToken, (req, res, next) => {
#    }, vivaldiRoutes);

# 4. Sostituisci tutto il blocco da riga ~1126 a ~1154 con questo codice:

# Route Vivaldi (per tecnico/admin e clienti con permesso progetto vivaldi)
// ✅ FIX: Monta le route solo se vivaldiRoutes non è null per evitare crash
if (vivaldiRoutes) {
  app.use('/api/vivaldi', authenticateToken, (req, res, next) => {
    // Tecnici e admin hanno sempre accesso
    if (req.user?.ruolo === 'tecnico' || req.user?.ruolo === 'admin') {
      console.log(`✅ Accesso Vivaldi autorizzato per STAFF ${req.user.email}`);
      return next();
    }

    // Per clienti, verifica che abbiano il progetto "vivaldi" abilitato nel token
    if (req.user?.ruolo === 'cliente') {
      const enabledProjects = req.user?.enabled_projects || ['ticket'];

      if (Array.isArray(enabledProjects) && enabledProjects.includes('vivaldi')) {
        console.log(`✅ Cliente ${req.user.email} ha accesso a Vivaldi`);
        return next();
      }
    }

    // Accesso negato
    console.log(`❌ Accesso negato a /api/vivaldi per ${req.user?.email} (${req.user?.ruolo})`);
    return res.status(403).json({
      error: 'Accesso negato. Non hai i permessi per accedere a Vivaldi.'
    });
  }, vivaldiRoutes);
} else {
  // ✅ FIX: Se Vivaldi non è disponibile, restituisci 503 per tutte le richieste
  app.use('/api/vivaldi', authenticateToken, (req, res) => {
    res.status(503).json({
      error: 'Vivaldi non disponibile: DATABASE_URL_VIVALDI non configurato'
    });
  });
}

# 5. Salva il file (Ctrl+O, Enter, Ctrl+X in nano)

# 6. Riavvia backend
pm2 restart ticketapp-backend

# 7. Verifica che funzioni
pm2 status
pm2 logs ticketapp-backend --lines 20
curl http://localhost:3001/api/crypto/dashboard
```

### Opzione 3: Fix con sed (Automatico)

Se preferisci un comando automatico:

```bash
ssh root@159.69.121.162
cd /var/www/ticketapp/backend

# Crea il fix direttamente
cat > /tmp/fix_vivaldi.txt << 'EOF'
// Route Vivaldi (per tecnico/admin e clienti con permesso progetto vivaldi)
// ✅ FIX: Monta le route solo se vivaldiRoutes non è null per evitare crash
if (vivaldiRoutes) {
  app.use('/api/vivaldi', authenticateToken, (req, res, next) => {
    // Tecnici e admin hanno sempre accesso
    if (req.user?.ruolo === 'tecnico' || req.user?.ruolo === 'admin') {
      console.log(`✅ Accesso Vivaldi autorizzato per STAFF ${req.user.email}`);
      return next();
    }

    // Per clienti, verifica che abbiano il progetto "vivaldi" abilitato nel token
    if (req.user?.ruolo === 'cliente') {
      const enabledProjects = req.user?.enabled_projects || ['ticket'];

      if (Array.isArray(enabledProjects) && enabledProjects.includes('vivaldi')) {
        console.log(`✅ Cliente ${req.user.email} ha accesso a Vivaldi`);
        return next();
      }
    }

    // Accesso negato
    console.log(`❌ Accesso negato a /api/vivaldi per ${req.user?.email} (${req.user?.ruolo})`);
    return res.status(403).json({
      error: 'Accesso negato. Non hai i permessi per accedere a Vivaldi.'
    });
  }, vivaldiRoutes);
} else {
  // ✅ FIX: Se Vivaldi non è disponibile, restituisci 503 per tutte le richieste
  app.use('/api/vivaldi', authenticateToken, (req, res) => {
    res.status(503).json({
      error: 'Vivaldi non disponibile: DATABASE_URL_VIVALDI non configurato'
    });
  });
}
EOF

# Applica il fix (richiede che tu modifichi manualmente il file)
# Oppure usa un editor per sostituire il blocco
```

## Verifica Dopo il Fix

Dopo aver applicato il fix, verifica:

1. **Backend non crasha più:**
   ```bash
   pm2 status
   # Dovrebbe mostrare status "online" senza restart continui
   ```

2. **Log senza TypeError:**
   ```bash
   pm2 logs ticketapp-backend --lines 30
   # Non dovrebbero esserci più "TypeError: Router.use() requires a middleware function but got a Null"
   ```

3. **Endpoint crypto risponde:**
   ```bash
   curl http://localhost:3001/api/crypto/dashboard
   # Dovrebbe restituire JSON invece di 502
   ```

4. **Dashboard funziona:**
   - Ricarica la pagina del dashboard crypto
   - Dovrebbero sparire gli errori 502 dalla console
   - I dati dovrebbero caricarsi

## Se il Problema Persiste

Se dopo il fix vedi ancora errori 502:

1. **Verifica che il fix sia stato applicato:**
   ```bash
   grep -n "if (vivaldiRoutes)" /var/www/ticketapp/backend/index.js
   # Dovrebbe mostrare una riga con il fix
   ```

2. **Controlla altri errori nei log:**
   ```bash
   pm2 logs ticketapp-backend --lines 100 | grep -i error
   ```

3. **Verifica che il backend sia in esecuzione:**
   ```bash
   netstat -tlnp | grep 3001
   # Dovrebbe mostrare che la porta 3001 è in ascolto
   ```

4. **Riavvia tutto:**
   ```bash
   pm2 restart all
   sudo systemctl restart nginx
   ```
