#!/bin/bash
# Script per aggiungere la colonna last_activity_at alla tabella access_logs

echo "🔧 Aggiunta colonna last_activity_at a access_logs..."

# Leggi le variabili d'ambiente dal file .env se esiste
if [ -f /var/www/ticketapp/backend/.env ]; then
    export $(cat /var/www/ticketapp/backend/.env | grep -v '^#' | xargs)
fi

# Usa DATABASE_URL o costruisci la stringa di connessione
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL non trovato nel .env"
    exit 1
fi

# Esegui la migrazione usando psql
psql "$DATABASE_URL" <<EOF
-- Aggiungi colonna last_activity_at se non esiste
ALTER TABLE access_logs 
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW();

-- Verifica che la colonna sia stata aggiunta
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'access_logs' 
  AND column_name = 'last_activity_at';
EOF

if [ $? -eq 0 ]; then
    echo "✅ Colonna last_activity_at aggiunta con successo!"
    echo "🔄 Riavvia il backend con: pm2 restart backend"
else
    echo "❌ Errore durante l'aggiunta della colonna"
    exit 1
fi


