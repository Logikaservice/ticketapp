#!/bin/bash
# Script di diagnostica per il sistema Orari e Turni

echo "🔍 DIAGNOSTICA SISTEMA ORARI E TURNI"
echo "===================================="
echo ""

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Verifica che il backend sia in esecuzione
echo "1️⃣ Verifica servizio backend..."
if systemctl is-active --quiet ticketapp-backend; then
    echo -e "${GREEN}✅ Backend in esecuzione${NC}"
else
    echo -e "${RED}❌ Backend NON in esecuzione${NC}"
    echo "   Avvia con: sudo systemctl start ticketapp-backend"
fi
echo ""

# 2. Controlla gli ultimi log del backend
echo "2️⃣ Ultimi 50 log del backend (cerca 'orari'):"
echo "----------------------------------------------"
sudo journalctl -u ticketapp-backend -n 50 --no-pager | grep -i "orari" || echo "Nessun log con 'orari' trovato"
echo ""

# 3. Controlla errori recenti
echo "3️⃣ Errori recenti nel backend:"
echo "-------------------------------"
sudo journalctl -u ticketapp-backend -n 100 --no-pager | grep -i "error\|errore\|fail" | tail -20 || echo "Nessun errore trovato"
echo ""

# 4. Verifica connessione database
echo "4️⃣ Verifica connessione database..."
cd /var/www/ticketapp/backend
if [ -f .env ]; then
    source .env
    if [ -z "$DATABASE_URL" ]; then
        echo -e "${RED}❌ DATABASE_URL non configurato in .env${NC}"
    else
        echo -e "${GREEN}✅ DATABASE_URL trovato${NC}"
        # Estrai informazioni database
        DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
        echo "   Database: $DB_NAME"
    fi
else
    echo -e "${RED}❌ File .env non trovato${NC}"
fi
echo ""

# 5. Controlla tabella orari_data
echo "5️⃣ Controlla tabella orari_data nel database:"
echo "----------------------------------------------"
if [ -f .env ] && [ ! -z "$DATABASE_URL" ]; then
    # Usa psql per controllare la tabella
    psql "$DATABASE_URL" -c "\d orari_data" 2>/dev/null && echo -e "${GREEN}✅ Tabella orari_data esiste${NC}" || echo -e "${RED}❌ Tabella orari_data non trovata o errore di connessione${NC}"
    echo ""
    
    # Conta i record
    echo "   Record nella tabella:"
    psql "$DATABASE_URL" -c "SELECT COUNT(*) as total FROM orari_data;" 2>/dev/null || echo "Errore nel conteggio"
    echo ""
    
    # Mostra ultimo record
    echo "   Ultimo record salvato:"
    psql "$DATABASE_URL" -c "SELECT id, updated_at, jsonb_pretty(data) FROM orari_data ORDER BY id DESC LIMIT 1;" 2>/dev/null || echo "Errore nel recupero dati"
    echo ""
    
    # Conta dipendenti per azienda
    echo "   Dipendenti per azienda (dall'ultimo record):"
    psql "$DATABASE_URL" -c "
    SELECT 
        jsonb_object_keys(data->'employees') as chiave,
        jsonb_array_length(data->'employees'->jsonb_object_keys(data->'employees')) as num_dipendenti
    FROM orari_data 
    ORDER BY id DESC 
    LIMIT 1;
    " 2>/dev/null || echo "Errore nel conteggio dipendenti"
else
    echo -e "${YELLOW}⚠️  Impossibile controllare database: .env non configurato${NC}"
fi
echo ""

# 6. Verifica route backend
echo "6️⃣ Verifica route /api/orari nel codice:"
echo "----------------------------------------"
if grep -q "orari" /var/www/ticketapp/backend/index.js; then
    echo -e "${GREEN}✅ Route orari trovate in index.js${NC}"
    grep -n "orari" /var/www/ticketapp/backend/index.js | head -5
else
    echo -e "${RED}❌ Route orari NON trovate in index.js${NC}"
fi
echo ""

# 7. Verifica file route
echo "7️⃣ Verifica file routes/orari.js:"
echo "----------------------------------"
if [ -f /var/www/ticketapp/backend/routes/orari.js ]; then
    echo -e "${GREEN}✅ File routes/orari.js esiste${NC}"
    echo "   Dimensione: $(stat -c%s /var/www/ticketapp/backend/routes/orari.js) bytes"
else
    echo -e "${RED}❌ File routes/orari.js NON trovato${NC}"
fi
echo ""

# 8. Test endpoint (se possibile)
echo "8️⃣ Test endpoint /api/orari/data (richiede token JWT):"
echo "------------------------------------------------------"
echo "   Per testare manualmente:"
echo "   curl -H 'Authorization: Bearer TOKEN' http://localhost:3001/api/orari/data"
echo ""

# 9. Controlla permessi file
echo "9️⃣ Verifica permessi file:"
echo "---------------------------"
ls -la /var/www/ticketapp/backend/routes/orari.js 2>/dev/null || echo "File non trovato"
echo ""

# 10. Riepilogo
echo "===================================="
echo "📊 RIEPILOGO"
echo "===================================="
echo ""
echo "Per vedere i log in tempo reale:"
echo "  sudo journalctl -u ticketapp-backend -f"
echo ""
echo "Per riavviare il backend:"
echo "  sudo systemctl restart ticketapp-backend"
echo ""
echo "Per controllare lo stato:"
echo "  sudo systemctl status ticketapp-backend"
echo ""

