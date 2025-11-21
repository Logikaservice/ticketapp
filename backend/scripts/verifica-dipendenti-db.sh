#!/bin/bash
# Script per verificare direttamente nel database se i dipendenti sono salvati

echo "🔍 VERIFICA DIPENDENTI NEL DATABASE"
echo "==================================="
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

echo "1️⃣ Record nella tabella orari_data:"
echo "-----------------------------------"
psql "$DATABASE_URL" -c "SELECT id, updated_at FROM orari_data ORDER BY id DESC;" 2>/dev/null
echo ""

echo "2️⃣ Aziende salvate:"
echo "-------------------"
psql "$DATABASE_URL" -c "SELECT jsonb_array_elements_text(data->'companies') as azienda FROM orari_data ORDER BY id DESC LIMIT 1;" 2>/dev/null
echo ""

echo "3️⃣ Chiavi dipendenti nel database:"
echo "-----------------------------------"
psql "$DATABASE_URL" -c "
SELECT 
    jsonb_object_keys(data->'employees') as chiave
FROM orari_data 
ORDER BY id DESC 
LIMIT 1;
" 2>/dev/null
echo ""

echo "4️⃣ Numero dipendenti per chiave:"
echo "---------------------------------"
psql "$DATABASE_URL" -c "
SELECT 
    key as chiave,
    jsonb_array_length(value) as num_dipendenti
FROM orari_data,
LATERAL jsonb_each(data->'employees')
ORDER BY orari_data.id DESC;
" 2>/dev/null
echo ""

echo "5️⃣ DETTAGLIO COMPLETO DIPENDENTI:"
echo "=================================="
psql "$DATABASE_URL" -c "
SELECT 
    key as chiave_azienda_reparto,
    jsonb_pretty(value) as dipendenti
FROM orari_data,
LATERAL jsonb_each(data->'employees')
ORDER BY orari_data.id DESC;
" 2>/dev/null
echo ""

echo "6️⃣ Verifica chiavi con [object Object]:"
echo "----------------------------------------"
psql "$DATABASE_URL" -c "
SELECT 
    key as chiave_problema
FROM orari_data,
LATERAL jsonb_object_keys(data->'employees')
WHERE key::text LIKE '%[object Object]%' OR key::text LIKE '%object%';
" 2>/dev/null || echo "Nessuna chiave problematica trovata"
echo ""

echo "7️⃣ Ultimo aggiornamento:"
echo "------------------------"
psql "$DATABASE_URL" -c "SELECT id, updated_at, jsonb_object_keys(data->'employees') as chiave FROM orari_data ORDER BY id DESC LIMIT 1;" 2>/dev/null
echo ""

echo "=================================="
echo "📋 ISTRUZIONI:"
echo "=================================="
echo ""
echo "1. Aggiungi un dipendente dall'interfaccia"
echo "2. Attendi 3-5 secondi"
echo "3. Esegui questo script di nuovo"
echo "4. Confronta i risultati"
echo ""

