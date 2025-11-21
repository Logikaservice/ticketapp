# Guida Setup Sistema Orari e Turni

## 📋 Panoramica

Il sistema "Orari e Turni" è stato integrato nel progetto TicketApp come modulo separato e isolato. Utilizza lo stesso database PostgreSQL ma con una tabella dedicata (`orari_data`) per garantire che possa essere rimosso in futuro senza impattare il sistema Ticket.

## ✅ Cosa è stato implementato

1. **Componente TimesheetManager** (`frontend/src/components/TimesheetManager.jsx`)
   - Gestione completa orari e turni
   - Esportazione Excel con stili (come richiesto)
   - Gestione aziende, reparti e dipendenti
   - Calcolo automatico ore settimanali

2. **Route Backend** (`backend/routes/orari.js`)
   - Endpoint `/api/orari/data` - GET: Ottiene tutti i dati
   - Endpoint `/api/orari/save` - POST: Salva i dati
   - Tabella database separata: `orari_data` (JSONB)

3. **Integrazione Frontend**
   - Voce "Progetti" nel pannello rapido Header
   - Sottovoce "Orari e Turni" accessibile solo ai tecnici
   - Navigazione tra Dashboard Ticket e Orari e Turni

4. **Database**
   - Tabella `orari_data` separata (non interferisce con ticket)
   - Struttura JSONB per massima flessibilità
   - Può essere eliminata senza impatti sul sistema Ticket

## 🚀 Come configurare orari.logikaservice.it

### Opzione 1: Sottodominio separato (CONSIGLIATO)

1. **Configura DNS**
   - Aggiungi record A per `orari.logikaservice.it` che punta all'IP del server
   - Oppure record CNAME che punta a `ticket.logikaservice.it`

2. **Configura Nginx**
   ```bash
   # Copia il file di configurazione
   sudo cp deploy/nginx/orari.logikaservice.it.conf /etc/nginx/sites-available/orari.logikaservice.it
   
   # Abilita il sito
   sudo ln -s /etc/nginx/sites-available/orari.logikaservice.it /etc/nginx/sites-enabled/
   
   # Test configurazione
   sudo nginx -t
   
   # Ricarica nginx
   sudo systemctl reload nginx
   ```

3. **Configura SSL (opzionale ma consigliato)**
   ```bash
   sudo certbot --nginx -d orari.logikaservice.it
   ```

### Opzione 2: Stesso dominio, percorso diverso

Se preferisci usare `ticket.logikaservice.it/orari`, modifica `deploy/nginx/ticketapp.conf` aggiungendo:

```nginx
location /orari {
    try_files $uri $uri/ /index.html;
}
```

## 📊 Struttura Database

La tabella `orari_data` viene creata automaticamente al primo accesso:

```sql
CREATE TABLE orari_data (
  id SERIAL PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

Struttura JSON salvata:
```json
{
  "companies": ["Avellino", "Atripalda", "Lioni"],
  "departments": {
    "Avellino": ["Cucina"],
    "Atripalda": ["Cucina"],
    "Lioni": ["Cucina", "Bar"]
  },
  "employees": {
    "Atripalda-Cucina": [
      { "id": 1, "name": "ELENA" },
      ...
    ]
  },
  "schedule": {
    "1": {
      "0": { "in1": "10.30", "out1": "15.00", "in2": "18.30", "out2": "23.00" },
      ...
    }
  }
}
```

## 🔒 Sicurezza

- Le route `/api/orari/*` sono protette da autenticazione JWT
- Accesso consentito solo a utenti con ruolo `tecnico` o `admin`
- Il frontend mostra "Orari e Turni" solo ai tecnici

## 🗑️ Come rimuovere il sistema Orari (se necessario)

1. **Rimuovi tabella database:**
   ```sql
   DROP TABLE IF EXISTS orari_data;
   ```

2. **Rimuovi route backend:**
   - Elimina `backend/routes/orari.js`
   - Rimuovi le righe in `backend/index.js`:
     ```javascript
     const orariRoutes = require('./routes/orari')(pool);
     app.use('/api/orari', authenticateToken, requireRole(['tecnico', 'admin']), orariRoutes);
     ```

3. **Rimuovi componente frontend:**
   - Elimina `frontend/src/components/TimesheetManager.jsx`
   - Rimuovi import e utilizzo in `frontend/src/App.jsx`
   - Rimuovi voce "Progetti" da `frontend/src/components/Header.jsx`

4. **Rimuovi configurazione nginx:**
   ```bash
   sudo rm /etc/nginx/sites-enabled/orari.logikaservice.it
   sudo rm /etc/nginx/sites-available/orari.logikaservice.it
   sudo nginx -t && sudo systemctl reload nginx
   ```

**Nessun impatto sul sistema Ticket!** ✅

## 📝 Note Importanti

- Il sistema Orari utilizza lo stesso backend e frontend del sistema Ticket
- I dati sono completamente isolati nella tabella `orari_data`
- L'esportazione Excel mantiene tutti gli stili e formattazioni del codice originale
- Il salvataggio è automatico dopo ogni modifica
- Supporta aziende multiple, reparti multipli per azienda, e dipendenti multipli per reparto

## 🐛 Troubleshooting

### Il componente non si carica
- Verifica che l'utente abbia ruolo `tecnico`
- Controlla la console del browser per errori
- Verifica che le route backend siano attive: `curl http://localhost:3001/api/orari/data` (con token JWT)

### Errore database
- Verifica che PostgreSQL sia in esecuzione
- Controlla i log del backend: `sudo journalctl -u ticketapp-backend -f`

### Nginx non funziona
- Verifica configurazione: `sudo nginx -t`
- Controlla log: `sudo tail -f /var/log/nginx/error.log`

