#!/bin/bash
# 💾 Script Backup Database PostgreSQL - Versione Semplice
# 
# Esegui questo script sul VPS per creare un backup del database crypto

# Colori per output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}💾 BACKUP DATABASE POSTGRESQL${NC}\n"
echo "=================================================================================="

# Leggi variabili d'ambiente
if [ -f /var/www/ticketapp/backend/.env ]; then
    source /var/www/ticketapp/backend/.env
fi

# Estrai parametri da DATABASE_URL_CRYPTO
if [ -z "$DATABASE_URL_CRYPTO" ]; then
    echo -e "${RED}❌ DATABASE_URL_CRYPTO non configurato${NC}"
    exit 1
fi

# Parse DATABASE_URL (formato: postgresql://user:password@host:port/database)
DB_URL=$(echo $DATABASE_URL_CRYPTO | sed 's|postgresql://||')
DB_USER=$(echo $DB_URL | cut -d: -f1)
DB_PASS=$(echo $DB_URL | cut -d: -f2 | cut -d@ -f1)
DB_HOST=$(echo $DB_URL | cut -d@ -f2 | cut -d: -f1)
DB_PORT=$(echo $DB_URL | cut -d: -f3 | cut -d/ -f1)
DB_NAME=$(echo $DB_URL | cut -d/ -f2)

echo "📊 Configurazione Database:"
echo "   Host: $DB_HOST:$DB_PORT"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo ""

# Crea directory backup
BACKUP_DIR="/var/www/ticketapp/backups"
mkdir -p $BACKUP_DIR

# Nome file backup con timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/crypto_db_backup_$TIMESTAMP.sql"
BACKUP_FILE_GZ="$BACKUP_FILE.gz"

echo "💾 Creazione backup..."
echo "   File: $BACKUP_FILE_GZ"
echo ""

# Crea backup
export PGPASSWORD="$DB_PASS"

# Prova formato custom (compresso)
if pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -F c -f $BACKUP_FILE_GZ 2>/dev/null; then
    echo -e "${GREEN}✅ Backup creato: $BACKUP_FILE_GZ${NC}"
    SIZE=$(du -h $BACKUP_FILE_GZ | cut -f1)
    echo "   Dimensione: $SIZE"
elif pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -F p -f $BACKUP_FILE 2>/dev/null; then
    echo -e "${GREEN}✅ Backup creato: $BACKUP_FILE${NC}"
    SIZE=$(du -h $BACKUP_FILE | cut -f1)
    echo "   Dimensione: $SIZE"
    # Comprimi manualmente
    gzip $BACKUP_FILE
    BACKUP_FILE_FINAL="$BACKUP_FILE.gz"
    echo -e "${GREEN}✅ Backup compresso: $BACKUP_FILE_FINAL${NC}"
else
    echo -e "${RED}❌ Errore durante la creazione del backup${NC}"
    echo "   Verifica che pg_dump sia installato: apt-get install postgresql-client"
    exit 1
fi

unset PGPASSWORD

echo ""
echo "=================================================================================="
echo -e "${GREEN}📊 RIEPILOGO BACKUP${NC}\n"
echo -e "${GREEN}✅ Backup completato con successo!${NC}"
echo "📁 File: $BACKUP_FILE_GZ"
echo "🕐 Timestamp: $TIMESTAMP"
echo ""
echo "💡 Per ripristinare il backup:"
echo "   pg_restore -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME $BACKUP_FILE_GZ"
echo ""

