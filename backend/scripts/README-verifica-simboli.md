# Script di Verifica Simboli

## Verifica che nel database ci siano solo simboli validi

Dopo aver eseguito `remove-invalid-symbols-v2.sh`, usa questo script per verificare:

```bash
cd /var/www/ticketapp/backend/scripts
git pull origin main  # Scarica gli ultimi script
chmod +x verify-only-valid-symbols.sh
./verify-only-valid-symbols.sh
```

Lo script verifica tutte le tabelle e mostra se ci sono ancora simboli non validi.
