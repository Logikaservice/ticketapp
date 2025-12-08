#!/bin/bash
# Script Automatico Completo - Fix Database Valori Anomali
# Questo script: 1) Aggiorna il codice, 2) Trova il database, 3) Crea backup, 4) Corregge valori anomali, 5) Verifica

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  🔧 Fix Database Automatico - Valori Anomali Profit/Loss  ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Directory progetto
PROJECT_DIR="/var/www/ticketapp"
cd "$PROJECT_DIR" 2>/dev/null || {
    echo "❌ ERRORE: Directory $PROJECT_DIR non trovata!"
    echo "   Esegui questo script dalla directory corretta o modifica PROJECT_DIR"
    exit 1
}

echo "📁 Directory progetto: $PROJECT_DIR"
echo ""

# Step 1: Aggiorna codice (opzionale, commenta se non vuoi)
echo "📥 Step 1/5: Aggiornamento codice da GitHub..."
if git pull origin main >/dev/null 2>&1; then
    echo "   ✅ Codice aggiornato"
else
    echo "   ⚠️  Git pull non riuscito o già aggiornato (continua...)"
fi
echo ""

# Step 2: Trova database
echo "🔍 Step 2/5: Ricerca database..."
DB_PATH=""
if [ -f "$PROJECT_DIR/crypto.db" ]; then
    DB_PATH="$PROJECT_DIR/crypto.db"
elif [ -f "$PROJECT_DIR/backend/crypto.db" ]; then
    DB_PATH="$PROJECT_DIR/backend/crypto.db"
else
    echo "   🔍 Ricerca database..."
    DB_PATH=$(find "$PROJECT_DIR" -name "crypto.db" -type f 2>/dev/null | head -1)
    if [ -z "$DB_PATH" ]; then
        echo "   ❌ ERRORE: crypto.db non trovato!"
        echo "   Cerca manualmente con: find $PROJECT_DIR -name 'crypto.db'"
        exit 1
    fi
fi

echo "   ✅ Database trovato: $DB_PATH"
DB_SIZE=$(du -h "$DB_PATH" | cut -f1)
echo "   📊 Dimensione database: $DB_SIZE"
echo ""

# Step 3: Backup
echo "💾 Step 3/5: Creazione backup..."
BACKUP_DIR="$PROJECT_DIR/backups"
mkdir -p "$BACKUP_DIR"
BACKUP_PATH="$BACKUP_DIR/crypto.db.backup.$(date +%Y%m%d_%H%M%S)"

cp "$DB_PATH" "$BACKUP_PATH"
BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
echo "   ✅ Backup creato: $BACKUP_PATH"
echo "   📊 Dimensione backup: $BACKUP_SIZE"
echo ""

# Step 4: Analisi valori anomali
echo "📊 Step 4/5: Analisi valori anomali..."
echo ""

# Verifica che sqlite3 sia installato
if ! command -v sqlite3 &> /dev/null; then
    echo "   ❌ ERRORE: sqlite3 non installato!"
    echo "   Installa con: apt-get install sqlite3"
    exit 1
fi

POS_ANOMALI=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM open_positions WHERE status != 'open' AND ABS(CAST(profit_loss AS REAL)) > 1000000;" 2>/dev/null || echo "0")
TRADE_ANOMALI=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM trades WHERE profit_loss IS NOT NULL AND ABS(CAST(profit_loss AS REAL)) > 1000000;" 2>/dev/null || echo "0")

echo "   ⚠️  Posizioni chiuse anomale: $POS_ANOMALI"
echo "   ⚠️  Trades anomali: $TRADE_ANOMALI"
echo ""

# Mostra valore totale anomalo se presente
if [ "$POS_ANOMALI" -gt 0 ] || [ "$TRADE_ANOMALI" -gt 0 ]; then
    echo "   📋 Dettagli valori anomali (prime 3):"
    if [ "$POS_ANOMALI" -gt 0 ]; then
        sqlite3 -header -column "$DB_PATH" "SELECT substr(ticket_id,1,12) as ticket_id, symbol, printf('€%.2f', profit_loss) as profit_loss FROM open_positions WHERE status != 'open' AND ABS(CAST(profit_loss AS REAL)) > 1000000 LIMIT 3;" 2>/dev/null || echo "      (errore lettura)"
    fi
    echo ""
fi

if [ "$POS_ANOMALI" -eq 0 ] && [ "$TRADE_ANOMALI" -eq 0 ]; then
    echo "   ✅ Nessun valore anomalo trovato! Il database è pulito."
    echo ""
    echo "✅ Script completato - Nessuna azione necessaria"
    exit 0
fi

# Step 5: Correzione
echo "🔧 Step 5/5: Correzione valori anomali..."
echo ""

# Chiedi conferma se ci sono molti record
if [ "$POS_ANOMALI" -gt 10 ] || [ "$TRADE_ANOMALI" -gt 10 ]; then
    echo "   ⚠️  ATTENZIONE: Verranno modificati molti record!"
    echo "   Posizioni: $POS_ANOMALI"
    echo "   Trades: $TRADE_ANOMALI"
    echo ""
    read -p "   Continuare? (s/N): " CONFIRM
    if [ "$CONFIRM" != "s" ] && [ "$CONFIRM" != "S" ]; then
        echo "   ❌ Operazione annullata dall'utente"
        exit 0
    fi
    echo ""
fi

# Resetta posizioni anomale
if [ "$POS_ANOMALI" -gt 0 ]; then
    echo "   🔄 Resetto posizioni chiuse anomale..."
    sqlite3 "$DB_PATH" "UPDATE open_positions SET profit_loss = 0 WHERE status != 'open' AND ABS(CAST(profit_loss AS REAL)) > 1000000;" 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "   ✅ $POS_ANOMALI posizioni corrette"
    else
        echo "   ❌ Errore durante la correzione delle posizioni"
    fi
fi

# Resetta trades anomali
if [ "$TRADE_ANOMALI" -gt 0 ]; then
    echo "   🔄 Resetto trades anomali..."
    sqlite3 "$DB_PATH" "UPDATE trades SET profit_loss = NULL WHERE profit_loss IS NOT NULL AND ABS(CAST(profit_loss AS REAL)) > 1000000;" 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "   ✅ $TRADE_ANOMALI trades corretti"
    else
        echo "   ❌ Errore durante la correzione dei trades"
    fi
fi

echo ""

# Verifica finale
echo "✅ Verifica finale..."
POS_RIMASTE=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM open_positions WHERE status != 'open' AND ABS(CAST(profit_loss AS REAL)) > 1000000;" 2>/dev/null || echo "0")
TRADE_RIMASTI=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM trades WHERE profit_loss IS NOT NULL AND ABS(CAST(profit_loss AS REAL)) > 1000000;" 2>/dev/null || echo "0")

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    📊 RISULTATO FINALE                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

if [ "$POS_RIMASTE" -eq 0 ] && [ "$TRADE_RIMASTI" -eq 0 ]; then
    echo "✅ Correzione completata con successo!"
    echo ""
    echo "📊 Statistiche:"
    echo "   • Posizioni corrette: $POS_ANOMALI"
    echo "   • Trades corretti: $TRADE_ANOMALI"
    echo "   • Valori anomali rimasti: 0"
    echo ""
    echo "💡 Prossimi passi:"
    echo "   1. Riavvia il backend:"
    echo "      pm2 restart ticketapp-backend"
    echo "      # oppure"
    echo "      systemctl restart ticketapp-backend"
    echo ""
    echo "   2. Ricarica il frontend con Hard Refresh (Ctrl+Shift+R)"
    echo ""
else
    echo "⚠️  Attenzione: alcuni valori anomali potrebbero essere rimasti"
    echo ""
    echo "📊 Statistiche:"
    echo "   • Posizioni corrette: $((POS_ANOMALI - POS_RIMASTE))"
    echo "   • Trades corretti: $((TRADE_ANOMALI - TRADE_RIMASTI))"
    echo "   • Posizioni anomale rimaste: $POS_RIMASTE"
    echo "   • Trades anomali rimasti: $TRADE_RIMASTI"
    echo ""
fi

echo "📁 Backup salvato in: $BACKUP_PATH"
echo ""
echo "✅ Script completato!"
echo ""
