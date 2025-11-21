#!/bin/bash
# Script per verificare se i dipendenti vengono salvati nel database

echo "🔍 VERIFICA SALVATAGGIO DIPENDENTI"
echo "=================================="
echo ""

# Colori
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

cd /var/www/ticketapp/backend

# Carica variabili d'ambiente
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo -e "${RED}❌ File .env non trovato${NC}"
    exit 1
fi

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ DATABASE_URL non configurato${NC}"
    exit 1
fi

echo "1️⃣ Stato tabella orari_data:"
echo "----------------------------"
psql "$DATABASE_URL" -c "SELECT COUNT(*) as total_records FROM orari_data;" 2>/dev/null
echo ""

echo "2️⃣ Ultimo record salvato (ID e data):"
echo "--------------------------------------"
psql "$DATABASE_URL" -c "SELECT id, updated_at FROM orari_data ORDER BY id DESC LIMIT 1;" 2>/dev/null
echo ""

echo "3️⃣ Aziende presenti:"
echo "---------------------"
psql "$DATABASE_URL" -c "SELECT jsonb_array_elements_text(data->'companies') as azienda FROM orari_data ORDER BY id DESC LIMIT 1;" 2>/dev/null
echo ""

echo "4️⃣ Reparti per azienda:"
echo "-----------------------"
psql "$DATABASE_URL" -c "SELECT jsonb_pretty(data->'departments') as reparti FROM orari_data ORDER BY id DESC LIMIT 1;" 2>/dev/null
echo ""

echo "5️⃣ DIPENDENTI SALVATI (dettaglio completo):"
echo "==========================================="
psql "$DATABASE_URL" -c "
SELECT 
    jsonb_object_keys(data->'employees') as chiave_azienda_reparto,
    jsonb_array_length(data->'employees'->jsonb_object_keys(data->'employees')) as num_dipendenti
FROM orari_data 
ORDER BY id DESC 
LIMIT 1;
" 2>/dev/null
echo ""

echo "6️⃣ Dettaglio dipendenti per ogni chiave:"
echo "----------------------------------------"
psql "$DATABASE_URL" -c "
SELECT 
    key as chiave,
    jsonb_pretty(value) as dipendenti
FROM orari_data,
LATERAL jsonb_each(data->'employees')
ORDER BY orari_data.id DESC
LIMIT 10;
" 2>/dev/null
echo ""

echo "7️⃣ Ultimi 20 log del backend (cerca 'orari' o 'dipendente'):"
echo "------------------------------------------------------------"
sudo journalctl -u ticketapp-backend -n 20 --no-pager | grep -iE "orari|dipendente|save|salva" || echo "Nessun log trovato"
echo ""

echo "8️⃣ Errori recenti:"
echo "------------------"
sudo journalctl -u ticketapp-backend -n 50 --no-pager | grep -iE "error|errore|fail" | tail -10 || echo "Nessun errore trovato"
echo ""

echo "=================================="
echo "📋 ISTRUZIONI:"
echo "=================================="
echo ""
echo "1. Aggiungi un dipendente dall'interfaccia web"
echo "2. Attendi 2-3 secondi"
echo "3. Esegui di nuovo questo script per vedere se è stato salvato"
echo ""
echo "Per monitorare i log in tempo reale:"
echo "  sudo journalctl -u ticketapp-backend -f"
echo ""

