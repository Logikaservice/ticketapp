#!/bin/bash
# Script per correggere valori anomali nel database crypto.db
# Esegui questo script sul VPS dopo aver fatto backup

set -e

echo "🔍 Fix Database - Correzione Valori Anomali"
echo "============================================"
echo ""

# Trova il database
DB_PATH=""
if [ -f "/var/www/ticketapp/crypto.db" ]; then
    DB_PATH="/var/www/ticketapp/crypto.db"
elif [ -f "/var/www/ticketapp/backend/crypto.db" ]; then
    DB_PATH="/var/www/ticketapp/backend/crypto.db"
else
    echo "❌ Database non trovato! Cercando..."
    DB_PATH=$(find /var/www/ticketapp -name "crypto.db" -type f | head -1)
    if [ -z "$DB_PATH" ]; then
        echo "❌ ERRORE: crypto.db non trovato in /var/www/ticketapp"
        exit 1
    fi
fi

echo "📁 Database trovato: $DB_PATH"
echo ""

# Backup
BACKUP_PATH="${DB_PATH}.backup.$(date +%Y%m%d_%H%M%S)"
echo "💾 Creazione backup..."
cp "$DB_PATH" "$BACKUP_PATH"
echo "✅ Backup creato: $BACKUP_PATH"
echo ""

# Analisi valori anomali
echo "📊 Analisi valori anomali..."
echo ""

POS_ANOMALI=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM open_positions WHERE status != 'open' AND ABS(CAST(profit_loss AS REAL)) > 1000000;")
TRADE_ANOMALI=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM trades WHERE profit_loss IS NOT NULL AND ABS(CAST(profit_loss AS REAL)) > 1000000;")

echo "⚠️  Posizioni chiuse anomale: $POS_ANOMALI"
echo "⚠️  Trades anomali: $TRADE_ANOMALI"
echo ""

if [ "$POS_ANOMALI" -eq 0 ] && [ "$TRADE_ANOMALI" -eq 0 ]; then
    echo "✅ Nessun valore anomalo trovato! Il database è pulito."
    exit 0
fi

# Mostra dettagli (opzionale)
if [ "$POS_ANOMALI" -gt 0 ]; then
    echo "📋 Dettagli posizioni anomale (prime 5):"
    sqlite3 -header -column "$DB_PATH" "SELECT ticket_id, symbol, profit_loss, closed_at FROM open_positions WHERE status != 'open' AND ABS(CAST(profit_loss AS REAL)) > 1000000 LIMIT 5;"
    echo ""
fi

# Correzione
echo "🔧 Correzione valori anomali..."
echo ""

# Resetta posizioni anomale
if [ "$POS_ANOMALI" -gt 0 ]; then
    echo "   Resetto posizioni chiuse anomale..."
    sqlite3 "$DB_PATH" "UPDATE open_positions SET profit_loss = 0 WHERE status != 'open' AND ABS(CAST(profit_loss AS REAL)) > 1000000;"
    echo "   ✅ Posizioni corrette"
fi

# Resetta trades anomali
if [ "$TRADE_ANOMALI" -gt 0 ]; then
    echo "   Resetto trades anomali..."
    sqlite3 "$DB_PATH" "UPDATE trades SET profit_loss = NULL WHERE profit_loss IS NOT NULL AND ABS(CAST(profit_loss AS REAL)) > 1000000;"
    echo "   ✅ Trades corretti"
fi

echo ""

# Verifica finale
echo "✅ Verifica finale..."
POS_RIMASTE=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM open_positions WHERE status != 'open' AND ABS(CAST(profit_loss AS REAL)) > 1000000;")
TRADE_RIMASTI=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM trades WHERE profit_loss IS NOT NULL AND ABS(CAST(profit_loss AS REAL)) > 1000000;")

if [ "$POS_RIMASTE" -eq 0 ] && [ "$TRADE_RIMASTI" -eq 0 ]; then
    echo "✅ Correzione completata con successo!"
    echo "   Posizioni anomale rimaste: $POS_RIMASTE"
    echo "   Trades anomali rimasti: $TRADE_RIMASTI"
    echo ""
    echo "💡 Prossimi passi:"
    echo "   1. Riavvia il backend: pm2 restart ticketapp-backend"
    echo "   2. Ricarica il frontend con Hard Refresh (Ctrl+Shift+R)"
else
    echo "⚠️  Attenzione: rimangono alcuni valori anomali"
    echo "   Posizioni: $POS_RIMASTE"
    echo "   Trades: $TRADE_RIMASTI"
fi

echo ""
echo "📁 Backup salvato in: $BACKUP_PATH"
