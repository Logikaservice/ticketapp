#!/bin/bash

# Script per sincronizzare forzatamente gli interventi mancanti su Google Calendar
# Esegui sulla VPS con: bash backend/scripts/sync-missing-interventi.sh

cd /var/www/ticketapp

echo "🔄 Avvio sincronizzazione interventi mancanti su Google Calendar..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

node backend/scripts/sync-missing-interventi-direct.js

EXIT_CODE=$?

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Sincronizzazione completata!"
else
    echo "❌ Sincronizzazione fallita con codice: $EXIT_CODE"
fi

exit $EXIT_CODE
