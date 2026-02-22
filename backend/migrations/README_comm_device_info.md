# Tabella comm_device_info (Dispositivi aziendali)

Se la pagina **Dispositivi aziendali** restituisce errore 500 o "nessun dato", la tabella `comm_device_info` potrebbe non esistere nel database.

## Creare la tabella manualmente

Sul server (o in locale con `DATABASE_URL` impostato):

```bash
cd /path/to/TicketApp
node backend/migrations/create_comm_device_info.js
```

Lo script usa `DATABASE_URL` dal file `.env` (database principale). Crea la tabella e gli indici; se la tabella esiste già, non fa nulla.

Dopo l’esecuzione, riavviare il backend e riprovare la pagina Dispositivi aziendali.
