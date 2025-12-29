# Fix: File Allegati Mancanti

## 🔍 Problema Identificato

I file allegati ai ticket non venivano caricati correttamente e davano errore 404. 

**Causa**: Le directory di upload (`/var/www/ticketapp/backend/uploads/tickets/photos/` e altre) non esistevano sul server.

**File persi**: 11 file allegati sono stati persi (probabilmente durante un deploy o aggiornamento precedente) e non possono essere recuperati.

## ✅ Soluzione Applicata

### 1. Creazione Directory Upload

Le directory mancanti sono state create con i permessi corretti:

```bash
mkdir -p /var/www/ticketapp/backend/uploads/tickets/photos
mkdir -p /var/www/ticketapp/backend/uploads/tickets/offerte
mkdir -p /var/www/ticketapp/backend/uploads/alerts
mkdir -p /var/www/ticketapp/backend/uploads/keepass
chown -R www-data:www-data /var/www/ticketapp/backend/uploads
chmod -R 755 /var/www/ticketapp/backend/uploads
```

### 2. Miglioramento Gestione Errori Frontend

Il frontend è stato aggiornato per mostrare un messaggio più chiaro quando un file non è disponibile:
- **Prima**: Errore generico "Errore caricamento"
- **Ora**: Messaggio chiaro "File non disponibile - Il file allegato è stato eliminato o non è disponibile"

### 3. Script di Verifica

Creati script utili:
- `backend/scripts/check-missing-files.js` - Verifica quali file nel database non esistono fisicamente
- `backend/scripts/list-upload-directory.js` - Elenca i file nella directory uploads
- `backend/scripts/fix-upload-directories.js` - Crea le directory mancanti

## 📊 Situazione Attuale

- ✅ **Directory create**: Le directory di upload sono state create correttamente
- ✅ **Permessi corretti**: Le directory hanno i permessi corretti (755, owner: www-data)
- ✅ **Backend riavviato**: Il backend è stato riavviato per applicare le modifiche
- ⚠️ **File vecchi persi**: 11 file allegati già presenti nel database sono stati persi e non possono essere recuperati
- ✅ **Nuovi upload**: I nuovi file caricati funzioneranno correttamente

## 🔄 Prossimi Passi (Opzionali)

### Opzione 1: Pulire i Riferimenti ai File Mancanti

Se vuoi rimuovere i riferimenti ai file mancanti dal database, puoi eseguire:

```bash
cd /var/www/ticketapp/backend
node -e "
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  const client = await pool.connect();
  const result = await client.query('SELECT id, numero, photos FROM tickets WHERE photos IS NOT NULL');
  
  for (const ticket of result.rows) {
    let photos = [];
    try {
      photos = typeof ticket.photos === 'string' ? JSON.parse(ticket.photos) : ticket.photos;
      if (!Array.isArray(photos)) photos = [];
    } catch (e) { continue; }
    
    const uploadPath = path.join(__dirname, 'uploads/tickets/photos');
    const validPhotos = photos.filter(photo => {
      if (!photo.path) return false;
      const filename = photo.path.replace('/uploads/tickets/photos/', '');
      const physicalPath = path.join(uploadPath, filename);
      return fs.existsSync(physicalPath);
    });
    
    if (validPhotos.length !== photos.length) {
      await client.query('UPDATE tickets SET photos = $1 WHERE id = $2', [
        validPhotos.length > 0 ? JSON.stringify(validPhotos) : null,
        ticket.id
      ]);
      console.log(\`✅ Ticket #\${ticket.numero}: rimossi \${photos.length - validPhotos.length} file mancanti\`);
    }
  }
  
  client.release();
  await pool.end();
})();
"
```

### Opzione 2: Mantenere i Riferimenti

Puoi anche lasciare i riferimenti nel database. Quando un utente cerca di aprire un file mancante, vedrà il messaggio "File non disponibile".

## 🛡️ Prevenzione Futura

Per evitare che questo problema si ripeta:

1. **Backup regolari**: Assicurati di fare backup della directory `uploads/`
2. **Verifica durante deploy**: Verifica che le directory esistano dopo ogni deploy
3. **Script di inizializzazione**: Il backend crea automaticamente le directory quando necessario, ma assicurati che i permessi siano corretti

## 📝 Note

- I file persi non possono essere recuperati a meno che non ci sia un backup
- I nuovi upload funzioneranno correttamente ora che le directory sono state create
- Il frontend mostra un messaggio chiaro quando un file non è disponibile
