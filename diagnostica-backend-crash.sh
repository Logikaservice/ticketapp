#!/bin/bash
# Script per diagnosticare perché il backend non si avvia

echo "🔍 DIAGNOSTICA CRASH BACKEND"
echo "============================="
echo ""

# 1. Verifica log backend (ultimi 50)
echo "1️⃣ Ultimi log backend (cerca errori):"
echo "--------------------------------------"
pm2 logs ticketapp-backend --lines 50 --nostream | grep -E "error|Error|ERROR|❌|⚠️|failed|Failed|FAILED" || echo "Nessun errore trovato negli ultimi 50 log"
echo ""

# 2. Verifica log completi (ultimi 100)
echo "2️⃣ Log completi ultimi 100 (per vedere cosa succede all'avvio):"
echo "---------------------------------------------------------------"
pm2 logs ticketapp-backend --lines 100 --nostream | tail -30
echo ""

# 3. Verifica file .env
echo "3️⃣ Verifica file .env:"
echo "----------------------"
if [ -f "/var/www/ticketapp/backend/.env" ]; then
    echo "✅ File .env trovato"
    echo "Variabili d'ambiente presenti:"
    grep -E "^[A-Z_]+=" /var/www/ticketapp/backend/.env | cut -d'=' -f1 | head -15
    echo ""
    echo "Verifica DATABASE_URL:"
    if grep -q "DATABASE_URL=" /var/www/ticketapp/backend/.env; then
        DB_URL=$(grep "DATABASE_URL=" /var/www/ticketapp/backend/.env | cut -d'=' -f2- | head -c 50)
        echo "✅ DATABASE_URL configurato: ${DB_URL}..."
    else
        echo "❌ DATABASE_URL NON configurato!"
    fi
else
    echo "❌ File .env NON trovato in /var/www/ticketapp/backend/.env"
fi
echo ""

# 4. Test connessione database
echo "4️⃣ Test connessione database:"
echo "------------------------------"
cd /var/www/ticketapp/backend
if [ -f ".env" ]; then
    # Carica .env e testa connessione
    source .env 2>/dev/null || true
    if [ -n "$DATABASE_URL" ]; then
        echo "Tento connessione al database..."
        node -e "
        const { Pool } = require('pg');
        const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
        pool.connect()
          .then(() => { console.log('✅ Connessione database OK'); process.exit(0); })
          .catch(err => { console.error('❌ Errore connessione:', err.message); process.exit(1); });
        " 2>&1 || echo "❌ Errore durante test connessione"
    else
        echo "❌ DATABASE_URL non definito nel .env"
    fi
else
    echo "❌ File .env non trovato"
fi
echo ""

# 5. Prova avvio manuale (per vedere errore in tempo reale)
echo "5️⃣ Prova avvio manuale (vedrai l'errore in tempo reale):"
echo "----------------------------------------------------------"
echo "⚠️  Questo mostrerà l'errore esatto. Premi Ctrl+C dopo 5 secondi per fermarlo."
echo ""
cd /var/www/ticketapp/backend
timeout 5 node index.js 2>&1 || echo ""
echo ""

# 6. Verifica dipendenze
echo "6️⃣ Verifica dipendenze:"
echo "-----------------------"
if [ -d "/var/www/ticketapp/backend/node_modules" ]; then
    echo "✅ node_modules presente"
    if [ -f "/var/www/ticketapp/backend/node_modules/pg/package.json" ]; then
        echo "✅ Modulo 'pg' (PostgreSQL) installato"
    else
        echo "❌ Modulo 'pg' NON installato!"
        echo "   Esegui: cd /var/www/ticketapp/backend && npm install"
    fi
else
    echo "❌ node_modules NON presente!"
    echo "   Esegui: cd /var/www/ticketapp/backend && npm install"
fi
echo ""

echo "=========================================="
echo "📋 RIEPILOGO"
echo "=========================================="
echo ""
echo "Se vedi errori di connessione database:"
echo "  1. Verifica DATABASE_URL nel file .env"
echo "  2. Verifica che PostgreSQL sia in esecuzione: systemctl status postgresql"
echo "  3. Verifica che il database esista: psql -U postgres -l"
echo ""
echo "Se vedi errori di moduli mancanti:"
echo "  1. Esegui: cd /var/www/ticketapp/backend && npm install"
echo "  2. Riavvia: pm2 restart ticketapp-backend"
echo ""



