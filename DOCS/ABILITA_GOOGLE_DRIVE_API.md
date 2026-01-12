# Abilita Google Drive API

Per utilizzare il servizio KeePass con Google Drive, è necessario abilitare l'API Google Drive nel progetto Google Cloud.

## Passo 1: Accedi a Google Cloud Console

1. Vai su [Google Cloud Console](https://console.cloud.google.com/)
2. Seleziona il progetto **`ticketapp-b2a2a`** (o il progetto che contiene il Service Account)

## Passo 2: Abilita Google Drive API

1. Nel menu laterale, vai su **"API & Services"** > **"Library"**
2. Cerca **"Google Drive API"** nella barra di ricerca
3. Clicca sul risultato **"Google Drive API"**
4. Clicca sul pulsante **"Enable"** (Abilita)
5. Attendi qualche secondo per la propagazione

## Passo 3: Verifica l'abilitazione

1. Vai su **"API & Services"** > **"Enabled APIs"**
2. Verifica che **"Google Drive API"** sia presente nella lista

## Passo 4: Condividi il file keepass.kdbx con il Service Account

⚠️ **IMPORTANTE**: Il Service Account deve avere accesso al file `keepass.kdbx` su Google Drive!

1. Vai su [Google Drive](https://drive.google.com/)
2. Trova il file `keepass.kdbx`
3. Clicca con il tasto destro sul file > **"Share"** (Condividi)
4. Inserisci l'email del Service Account: `ticketapp-calendar-sync@ticketapp-b2a2a.iam.gserviceaccount.com`
5. Assegna il permesso **"Viewer"** (Visualizzatore) - sufficiente per la lettura
6. Clicca **"Send"** (Invia)

**Nota**: Se il file è già condiviso con un account Google, puoi anche condividerlo con il Service Account.

## Passo 5: Testa la configurazione

Dopo aver abilitato l'API e condiviso il file, esegui lo script di test:

```bash
cd /var/www/ticketapp/TicketApp/backend
node scripts/test-google-drive-access.js alpheus
```

Dovresti vedere:
- ✅ Autenticazione completata
- ✅ File keepass.kdbx trovato
- ✅ File KDBX caricato
- ✅ Mappa MAC->Titolo creata

## Troubleshooting

### Errore: "Google Drive API has not been used in project X before or it is disabled"
- **Soluzione**: Segui i passi 1-3 sopra per abilitare l'API

### Errore: "File keepass.kdbx non trovato su Google Drive"
- **Soluzione**: Verifica che il file esista e sia condiviso con il Service Account (Passo 4)

### Errore: "Forbidden" o "Access denied"
- **Soluzione**: Assicurati che il file `keepass.kdbx` sia condiviso con l'email del Service Account con almeno permessi di "Viewer"

## Link rapido

- [Abilita Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com?project=ticketapp-b2a2a)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Google Drive](https://drive.google.com/)
