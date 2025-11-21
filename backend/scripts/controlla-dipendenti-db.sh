#!/bin/bash
# Script per controllare direttamente nel database se i dipendenti sono salvati

echo "🔍 CONTROLLO DIRETTO DATABASE - DIPENDENTI"
echo "=========================================="
echo ""

cd /var/www/ticketapp/backend

# Carica variabili d'ambiente
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "❌ File .env non trovato"
    exit 1
fi

if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL non configurato"
    exit 1
fi

echo "📊 QUERY DIRETTA SUL DATABASE"
echo "=============================="
echo ""

echo "1️⃣ Record nella tabella orari_data:"
echo "-----------------------------------"
psql "$DATABASE_URL" -c "SELECT id, updated_at FROM orari_data ORDER BY id DESC;" 2>/dev/null
echo ""

echo "2️⃣ Aziende nel database:"
echo "------------------------"
psql "$DATABASE_URL" -c "
SELECT 
    jsonb_array_elements_text(data->'companies') as azienda
FROM orari_data 
ORDER BY id DESC 
LIMIT 1;
" 2>/dev/null
echo ""

echo "3️⃣ TUTTE LE CHIAVI DIPENDENTI NEL DATABASE:"
echo "============================================"
psql "$DATABASE_URL" -c "
SELECT 
    jsonb_object_keys(data->'employees') as chiave_completa
FROM orari_data 
ORDER BY id DESC 
LIMIT 1;
" 2>/dev/null
echo ""

echo "4️⃣ NUMERO DIPENDENTI PER OGNI CHIAVE:"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT 
    key as chiave,
    jsonb_array_length(value) as numero_dipendenti
FROM orari_data,
LATERAL jsonb_each(data->'employees')
ORDER BY orari_data.id DESC, key;
" 2>/dev/null
echo ""

echo "5️⃣ DETTAGLIO COMPLETO - TUTTI I DIPENDENTI:"
echo "============================================"
psql "$DATABASE_URL" -c "
SELECT 
    key as 'Azienda-Reparto',
    jsonb_pretty(value) as 'Lista Dipendenti'
FROM orari_data,
LATERAL jsonb_each(data->'employees')
ORDER BY orari_data.id DESC, key;
" 2>/dev/null
echo ""

echo "6️⃣ VERIFICA CHIAVI PROBLEMATICHE:"
echo "================================="
psql "$DATABASE_URL" -c "
SELECT 
    key as chiave_problema,
    jsonb_array_length(value) as num_dipendenti
FROM orari_data,
LATERAL jsonb_each(data->'employees')
WHERE key::text LIKE '%object%' OR key::text LIKE '%Object%';
" 2>/dev/null || echo "✅ Nessuna chiave problematica trovata"
echo ""

echo "7️⃣ JSON COMPLETO (ultimo record):"
echo "=================================="
psql "$DATABASE_URL" -c "
SELECT 
    id,
    updated_at,
    jsonb_pretty(data) as dati_completi
FROM orari_data 
ORDER BY id DESC 
LIMIT 1;
" 2>/dev/null | head -100
echo ""

echo "=================================="
echo "📋 ISTRUZIONI:"
echo "=================================="
echo ""
echo "1. Aggiungi un dipendente dall'interfaccia web"
echo "2. Attendi 5 secondi"
echo "3. Esegui questo script: ./backend/scripts/controlla-dipendenti-db.sh"
echo "4. Verifica se il dipendente appare nella sezione 'DETTAGLIO COMPLETO'"
echo ""

