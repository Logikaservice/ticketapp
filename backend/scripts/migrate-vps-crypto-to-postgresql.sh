#!/bin/bash
# Script di migrazione crypto da SQLite a PostgreSQL sulla VPS
# ⚠️ IMPORTANTE: Non tocca gli altri progetti!

set -e  # Exit on error

echo "🚀 Migrazione Crypto VPS: SQLite → PostgreSQL"
echo "=============================================="
echo ""

# Colori
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verifica che siamo nella directory corretta
if [ ! -f "crypto.db" ]; then
    echo -e "${RED}❌ Errore: crypto.db non trovato!${NC}"
    echo "Esegui questo script da: /var/www/ticketapp/backend"
    exit 1
fi

# Carica variabili d'ambiente da .env
if [ -f ".env" ]; then
    echo -e "${YELLOW}📋 Caricamento variabili d'ambiente da .env...${NC}"
    export $(grep -v '^#' .env | grep -v '^$' | xargs)
    echo -e "${GREEN}✅ Variabili d'ambiente caricate${NC}"
else
    echo -e "${RED}❌ File .env non trovato!${NC}"
    exit 1
fi

# STEP 1: Backup SQLite
echo -e "${YELLOW}📦 STEP 1: Backup Database SQLite...${NC}"
BACKUP_NAME="crypto.db.backup-$(date +%Y%m%d-%H%M%S)"
cp crypto.db "$BACKUP_NAME"
echo -e "${GREEN}✅ Backup creato: $BACKUP_NAME${NC}"
ls -lh "$BACKUP_NAME"
echo ""

# STEP 2: Verifica DATABASE_URL
echo -e "${YELLOW}📊 STEP 2: Verifica Database PostgreSQL Principale...${NC}"
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ DATABASE_URL non configurato!${NC}"
    echo "Configura DATABASE_URL in .env"
    exit 1
fi

# Test connessione database principale
psql "$DATABASE_URL" -c "SELECT current_database();" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Database principale funzionante${NC}"
    
    # Verifica che NON ci siano tabelle crypto
    CRYPTO_TABLES=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('portfolio', 'trades', 'bot_settings');" 2>/dev/null | xargs)
    if [ "$CRYPTO_TABLES" = "0" ]; then
        echo -e "${GREEN}✅ Database principale NON contiene tabelle crypto (OK)${NC}"
    else
        echo -e "${RED}⚠️  ATTENZIONE: Trovate tabelle crypto nel database principale!${NC}"
        read -p "Continuare comunque? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
else
    echo -e "${RED}❌ Errore connessione database principale${NC}"
    exit 1
fi
echo ""

# STEP 3: Crea database crypto_db
echo -e "${YELLOW}📊 STEP 3: Creazione Database Separato crypto_db...${NC}"
# Estrai URL base (senza nome database)
DB_BASE_URL=$(echo "$DATABASE_URL" | sed 's|/[^/]*$|/postgres|')
psql "$DB_BASE_URL" -c "CREATE DATABASE crypto_db;" 2>/dev/null || {
    if psql "$DB_BASE_URL" -c "\l" | grep -q "crypto_db"; then
        echo -e "${YELLOW}⚠️  Database crypto_db già esiste (OK)${NC}"
    else
        echo -e "${RED}❌ Errore creazione database crypto_db${NC}"
        exit 1
    fi
}
echo -e "${GREEN}✅ Database crypto_db creato${NC}"
echo ""

# STEP 4: Crea tabelle
echo -e "${YELLOW}📊 STEP 4: Creazione Tabelle in crypto_db...${NC}"
CRYPTO_DB_URL=$(echo "$DATABASE_URL" | sed 's|/[^/]*$|/crypto_db|')
if [ -f "scripts/migrate-crypto-to-postgresql.sql" ]; then
    psql "$CRYPTO_DB_URL" -f scripts/migrate-crypto-to-postgresql.sql
    echo -e "${GREEN}✅ Tabelle create${NC}"
else
    echo -e "${RED}❌ File scripts/migrate-crypto-to-postgresql.sql non trovato!${NC}"
    exit 1
fi
echo ""

# STEP 5: Configura DATABASE_URL_CRYPTO
echo -e "${YELLOW}📊 STEP 5: Configurazione DATABASE_URL_CRYPTO...${NC}"
if ! grep -q "DATABASE_URL_CRYPTO" .env 2>/dev/null; then
    echo "DATABASE_URL_CRYPTO=$CRYPTO_DB_URL" >> .env
    echo -e "${GREEN}✅ DATABASE_URL_CRYPTO aggiunto a .env${NC}"
else
    echo -e "${YELLOW}⚠️  DATABASE_URL_CRYPTO già presente in .env${NC}"
fi
echo ""

# STEP 6: Migra dati
echo -e "${YELLOW}📊 STEP 6: Migrazione Dati da SQLite a PostgreSQL...${NC}"
if [ -f "scripts/migrate-crypto-data-sqlite-to-postgresql.js" ]; then
    node scripts/migrate-crypto-data-sqlite-to-postgresql.js
    echo -e "${GREEN}✅ Dati migrati${NC}"
else
    echo -e "${RED}❌ File scripts/migrate-crypto-data-sqlite-to-postgresql.js non trovato!${NC}"
    exit 1
fi
echo ""

# STEP 7: Backup e sostituzione modulo
echo -e "${YELLOW}📊 STEP 7: Sostituzione Modulo...${NC}"
if [ -f "crypto_db_postgresql.js" ]; then
    cp crypto_db.js crypto_db.js.sqlite.backup
    cp crypto_db_postgresql.js crypto_db.js
    echo -e "${GREEN}✅ Modulo sostituito${NC}"
    echo -e "${GREEN}✅ Backup creato: crypto_db.js.sqlite.backup${NC}"
else
    echo -e "${RED}❌ File crypto_db_postgresql.js non trovato!${NC}"
    echo "Assicurati di aver fatto git pull"
    exit 1
fi
echo ""

# STEP 8: Verifica finale
echo -e "${YELLOW}📊 STEP 8: Verifica Finale...${NC}"
echo "Verifico dati migrati..."
psql "$CRYPTO_DB_URL" -c "SELECT COUNT(*) as portfolio FROM portfolio; SELECT COUNT(*) as bot_settings FROM bot_settings; SELECT COUNT(*) as performance_stats FROM performance_stats;" 2>/dev/null
echo ""

echo -e "${GREEN}✅ Migrazione completata!${NC}"
echo ""
echo "📋 PROSSIMI PASSI:"
echo "1. Riavvia backend: pm2 restart backend"
echo "2. Verifica log: pm2 logs backend --lines 50"
echo "3. Testa dashboard crypto nel browser"
echo ""
echo "⚠️  IMPORTANTE:"
echo "- Database principale NON toccato ✅"
echo "- Altri progetti NON toccati ✅"
echo "- Backup SQLite disponibile: $BACKUP_NAME"

