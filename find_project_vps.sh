#!/bin/bash

# Script per trovare il progetto TicketApp sulla VPS

echo "🔍 Ricerca progetto TicketApp sulla VPS..."
echo ""

# Possibili percorsi
POSSIBLE_PATHS=(
    "/root/TicketApp"
    "/home/ticketapp"
    "/var/www/ticketapp"
    "/opt/ticketapp"
    "~/TicketApp"
)

echo "📂 Verifica percorsi comuni:"
for path in "${POSSIBLE_PATHS[@]}"; do
    if [ -d "$path" ]; then
        echo "   ✅ Trovato: $path"
        ls -la "$path" | head -10
    else
        echo "   ❌ Non trovato: $path"
    fi
done

echo ""
echo "🔍 Ricerca globale (potrebbe richiedere tempo)..."
find / -type d -name "TicketApp" 2>/dev/null | head -5

echo ""
echo "📊 Processi PM2 attivi:"
pm2 list

echo ""
echo "🔍 Verifica repository Git:"
find / -type d -name ".git" -path "*/TicketApp/*" 2>/dev/null | head -5

echo ""
echo "✅ Ricerca completata!"
