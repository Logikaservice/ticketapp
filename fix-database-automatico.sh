#!/bin/bash
# Script automatico completo per fix database valori anomali
# Esegui: bash fix-database-automatico.sh

set -e

echo "🚀 Fix Database Automatico - Script Completo"
echo "=============================================="
echo ""

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Directory progetto
PROJECT_DIR="/var/www/ticketapp"
cd "$PROJECT_DIR" 2>/dev/null || {
    echo -e "${RED}❌ Directory $PROJECT_DIR non trovata!${NC}"
    exit 1
}

echo "📁 Directory: $PROJECT_DIR"
echo ""

# Step 1: Aggiorna codice (opzionale)
echo -e "${YELLOW}📥 Step 1: Aggiornamento codice...${NC}"
if [ -d ".git" ]; then
    echo "   Eseguo git pull..."
    git pull origin main 2>/dev/null || echo "   ⚠️  Git pull fallito (continua comunque...)"
    echo ""
else
    echo "   ℹ️  Directory non è un repository git, salto aggiornamento"
    echo ""
fi

# Step 2: Trova database
echo -e "${YELLOW}🔍 Step 2: Ricerca database...${NC}"
DB_PATH=""
if [ -f "$PROJECT_DIR/crypto.db" ]; then
    DB_PATH="$PROJECT_DIR/crypto.db"
elif [ -f "$PROJECT_DIR/backend/crypto.db" ]; then
    DB_PATH="$PROJECT_DIR/backend/crypto.db"
else
    echo "   Cercando database..."
    DB_PATH=$(find "$PROJECT_DIR" -name "crypto.db" -type f 2>/dev/null | head -1)
    if [ -z "$DB_PATH" ]; then
        echo -e "${RED}❌ ERRORE: crypto.db non trovato!${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}   ✅ Database trovato: $DB_PATH${NC}"
echo ""

# Step 3: Verifica sqlite3
if ! command -v sqlite3 &> /dev/null; then
    echo -e "${RED}❌ ERRORE: sqlite3 non installato!${NC}"
    echo "   Installa con: apt-get install sqlite3"
    exit 1
fi

# Step 4: Backup
echo -e "${YELLOW}💾 Step 3: Creazione backup...${NC}"
BACKUP_PATH="${DB_PATH}.backup.$(date +%Y%m%d_%H%M%S)"
cp "$DB_PATH" "$BACKUP_PATH" || {
    echo -e "${RED}❌ ERRORE: Impossibile creare backup!${NC}"
    exit 1
}
echo -e "${GREEN}   ✅ Backup creato: $BACKUP_PATH${NC}"
echo ""

# Step 5: Analisi
echo -e "${YELLOW}📊 Step 4: Analisi valori anomali...${NC}"
POS_ANOMALI=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM open_positions WHERE status != 'open' AND ABS(CAST(profit_loss AS REAL)) > 1000000;" 2>/dev/null || echo "0")
TRADE_ANOMALI=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM trades WHERE profit_loss IS NOT NULL AND ABS(CAST(profit_loss AS REAL)) > 1000000;" 2>/dev/null || echo "0")

echo "   ⚠️  Posizioni chiuse anomale: $POS_ANOMALI"
echo "   ⚠️  Trades anomali: $TRADE_ANOMALI"
echo ""

if [ "$POS_ANOMALI" -eq 0 ] && [ "$TRADE_ANOMALI" -eq 0 ]; then
    echo -e "${GREEN}✅ Nessun valore anomalo trovato! Il database è pulito.${NC}"
    echo ""
    echo "💡 Non serve correzione. Lo script termina qui."
    exit 0
fi

# Step 6: Mostra dettagli
if [ "$POS_ANOMALI" -gt 0 ]; then
    echo "📋 Dettagli posizioni anomale (prime 5):"
    sqlite3 -header -column "$DB_PATH" "SELECT ticket_id, symbol, profit_loss, closed_at FROM open_positions WHERE status != 'open' AND ABS(CAST(profit_loss AS REAL)) > 1000000 LIMIT 5;" 2>/dev/null || echo "   (Errore lettura dettagli)"
    echo ""
fi

# Step 7: Conferma (opzionale - commenta per esecuzione completamente automatica)
# read -p "Vuoi procedere con la correzione? (s/N): " -n 1 -r
# echo
# if [[ ! $REPLY =~ ^[Ss]$ ]]; then
#     echo "Operazione annullata."
#     exit 0
# fi

# Step 8: Correzione
echo -e "${YELLOW}🔧 Step 5: Correzione valori anomali...${NC}"
echo ""

if [ "$POS_ANOMALI" -gt 0 ]; then
    echo "   Resetto posizioni chiuse anomale..."
    sqlite3 "$DB_PATH" "UPDATE open_positions SET profit_loss = 0 WHERE status != 'open' AND ABS(CAST(profit_loss AS REAL)) > 1000000;" 2>/dev/null && {
        echo -e "${GREEN}   ✅ Posizioni corrette${NC}"
    } || {
        echo -e "${RED}   ❌ Errore correzione posizioni${NC}"
    }
fi

if [ "$TRADE_ANOMALI" -gt 0 ]; then
    echo "   Resetto trades anomali..."
    sqlite3 "$DB_PATH" "UPDATE trades SET profit_loss = NULL WHERE profit_loss IS NOT NULL AND ABS(CAST(profit_loss AS REAL)) > 1000000;" 2>/dev/null && {
        echo -e "${GREEN}   ✅ Trades corretti${NC}"
    } || {
        echo -e "${RED}   ❌ Errore correzione trades${NC}"
    }
fi

echo ""

# Step 9: Verifica finale
echo -e "${YELLOW}✅ Step 6: Verifica finale...${NC}"
POS_RIMASTE=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM open_positions WHERE status != 'open' AND ABS(CAST(profit_loss AS REAL)) > 1000000;" 2>/dev/null || echo "0")
TRADE_RIMASTI=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM trades WHERE profit_loss IS NOT NULL AND ABS(CAST(profit_loss AS REAL)) > 1000000;" 2>/dev/null || echo "0")

if [ "$POS_RIMASTE" -eq 0 ] && [ "$TRADE_RIMASTI" -eq 0 ]; then
    echo -e "${GREEN}   ✅ Correzione completata con successo!${NC}"
    echo "   Posizioni anomale rimaste: $POS_RIMASTE"
    echo "   Trades anomali rimasti: $TRADE_RIMASTI"
else
    echo -e "${YELLOW}   ⚠️  Attenzione: rimangono alcuni valori anomali${NC}"
    echo "   Posizioni: $POS_RIMASTE"
    echo "   Trades: $TRADE_RIMASTI"
fi

echo ""

# Step 10: Riavvia backend
echo -e "${YELLOW}🔄 Step 7: Riavvio backend...${NC}"
if command -v pm2 &> /dev/null; then
    echo "   Riavvio con PM2..."
    pm2 restart ticketapp-backend 2>/dev/null && {
        echo -e "${GREEN}   ✅ Backend riavviato con PM2${NC}"
    } || {
        echo -e "${YELLOW}   ⚠️  PM2 restart fallito, provo systemctl...${NC}"
        sudo systemctl restart ticketapp-backend 2>/dev/null && {
            echo -e "${GREEN}   ✅ Backend riavviato con systemctl${NC}"
        } || {
            echo -e "${YELLOW}   ⚠️  Riavvio automatico fallito. Riavvia manualmente:${NC}"
            echo "      pm2 restart ticketapp-backend"
            echo "      # oppure"
            echo "      sudo systemctl restart ticketapp-backend"
        }
    }
elif command -v systemctl &> /dev/null; then
    echo "   Riavvio con systemctl..."
    sudo systemctl restart ticketapp-backend 2>/dev/null && {
        echo -e "${GREEN}   ✅ Backend riavviato${NC}"
    } || {
        echo -e "${YELLOW}   ⚠️  Riavvio automatico fallito. Riavvia manualmente.${NC}"
    }
else
    echo -e "${YELLOW}   ⚠️  PM2 e systemctl non trovati. Riavvia manualmente il backend.${NC}"
fi

echo ""

# Riepilogo finale
echo "=============================================="
echo -e "${GREEN}✅ PROCESSO COMPLETATO!${NC}"
echo "=============================================="
echo ""
echo "📁 Backup salvato in: $BACKUP_PATH"
echo "📊 Record corretti:"
echo "   - Posizioni: $POS_ANOMALI → $POS_RIMASTE"
echo "   - Trades: $TRADE_ANOMALI → $TRADE_RIMASTI"
echo ""
echo -e "${YELLOW}💡 Prossimi passi:${NC}"
echo "   1. Ricarica il dashboard nel browser"
echo "   2. Fai Hard Refresh: Ctrl+Shift+R (o Cmd+Shift+R su Mac)"
echo "   3. Verifica che le statistiche siano corrette"
echo ""
echo -e "${GREEN}🎉 Fatto!${NC}"
