#!/bin/bash
# Script di backup prima dell'installazione del sistema Orari e Turni
# Crea un punto di ripristino completo del progetto Ticket

set -e

BACKUP_DIR="/var/backups/ticketapp"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="backup_pre_orari_${TIMESTAMP}"

echo "🔄 Creazione backup prima dell'installazione Orari e Turni..."
echo "📁 Directory backup: ${BACKUP_DIR}/${BACKUP_NAME}"

# Crea directory backup se non esiste
mkdir -p "${BACKUP_DIR}/${BACKUP_NAME}"

# 1. Backup database PostgreSQL
echo "💾 Backup database..."
pg_dump "${DATABASE_URL}" > "${BACKUP_DIR}/${BACKUP_NAME}/database_backup.sql" 2>/dev/null || {
    echo "⚠️  Errore backup database. Verifica DATABASE_URL."
}

# 2. Backup codice sorgente
echo "📦 Backup codice sorgente..."
cd /var/www/ticketapp || {
    echo "❌ Directory /var/www/ticketapp non trovata"
    exit 1
}

tar -czf "${BACKUP_DIR}/${BACKUP_NAME}/code_backup.tar.gz" \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='build' \
    --exclude='uploads' \
    . 2>/dev/null || {
    echo "⚠️  Errore backup codice"
}

# 3. Backup configurazione nginx
echo "⚙️  Backup configurazione nginx..."
if [ -f /etc/nginx/sites-available/ticketapp.conf ]; then
    cp /etc/nginx/sites-available/ticketapp.conf "${BACKUP_DIR}/${BACKUP_NAME}/nginx_ticketapp.conf"
fi

# 4. Backup variabili d'ambiente (senza password)
echo "🔐 Backup variabili d'ambiente (solo nomi, non valori sensibili)..."
if [ -f /var/www/ticketapp/backend/.env ]; then
    grep -E '^[A-Z_]+=' /var/www/ticketapp/backend/.env | sed 's/=.*/=***HIDDEN***/' > "${BACKUP_DIR}/${BACKUP_NAME}/env_vars.txt" || true
fi

# 5. Crea file di ripristino
cat > "${BACKUP_DIR}/${BACKUP_NAME}/RESTORE.md" << EOF
# Istruzioni per il Ripristino

## Backup creato il: $(date)

## File inclusi:
- database_backup.sql: Backup completo del database PostgreSQL
- code_backup.tar.gz: Backup del codice sorgente
- nginx_ticketapp.conf: Configurazione nginx originale
- env_vars.txt: Lista variabili d'ambiente (valori nascosti)

## Per ripristinare:

### 1. Ripristina database:
\`\`\`bash
psql \${DATABASE_URL} < database_backup.sql
\`\`\`

### 2. Ripristina codice:
\`\`\`bash
cd /var/www/ticketapp
tar -xzf ${BACKUP_DIR}/${BACKUP_NAME}/code_backup.tar.gz
\`\`\`

### 3. Ripristina nginx:
\`\`\`bash
sudo cp nginx_ticketapp.conf /etc/nginx/sites-available/ticketapp.conf
sudo nginx -t && sudo systemctl reload nginx
\`\`\`

### 4. Riavvia backend:
\`\`\`bash
sudo systemctl restart ticketapp-backend
\`\`\`
EOF

echo "✅ Backup completato!"
echo "📁 Location: ${BACKUP_DIR}/${BACKUP_NAME}"
echo "📄 Leggi RESTORE.md per le istruzioni di ripristino"

