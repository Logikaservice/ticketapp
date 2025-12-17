#!/bin/bash
# Script per verificare se il constraint UNIQUE esiste su price_history

echo "🔍 VERIFICA CONSTRAINT UNIQUE su price_history"
echo "=============================================="
echo ""

# Verifica constraint
echo "📊 Verifica constraint..."
CONSTRAINT_COUNT=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(*)
FROM pg_constraint
WHERE conrelid = 'price_history'::regclass
AND contype = 'u'
AND (
    conname = 'price_history_symbol_timestamp_unique' OR
    array_to_string(conkey, ',') IN (
        SELECT string_agg(attnum::text, ',' ORDER BY attnum)
        FROM pg_attribute
        WHERE attrelid = 'price_history'::regclass
        AND attname IN ('symbol', 'timestamp')
        GROUP BY attrelid
    )
);
" | xargs)

echo "   Constraint trovati: $CONSTRAINT_COUNT"

# Verifica index UNIQUE
echo ""
echo "📊 Verifica index UNIQUE..."
INDEX_COUNT=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(*)
FROM pg_indexes
WHERE tablename = 'price_history'
AND indexname LIKE '%symbol%timestamp%' OR indexname LIKE '%timestamp%symbol%';
" | xargs)

echo "   Index UNIQUE trovati: $INDEX_COUNT"

# Lista tutti gli index su price_history
echo ""
echo "📊 Tutti gli index su price_history:"
sudo -u postgres psql -d crypto_db -c "
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'price_history';
"

# Lista tutti i constraint su price_history
echo ""
echo "📊 Tutti i constraint su price_history:"
sudo -u postgres psql -d crypto_db -c "
SELECT 
    conname,
    contype,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'price_history'::regclass;
"

# Prova a creare il constraint se non esiste
echo ""
echo "🔧 Tentativo di creare constraint se non esiste..."
sudo -u postgres psql -d crypto_db <<EOF
DO \$\$
BEGIN
    -- Prova a creare il constraint
    BEGIN
        ALTER TABLE price_history
        ADD CONSTRAINT price_history_symbol_timestamp_unique
        UNIQUE (symbol, timestamp);
        
        RAISE NOTICE 'Constraint UNIQUE creato con successo';
    EXCEPTION
        WHEN duplicate_object THEN
            RAISE NOTICE 'Constraint già esistente';
        WHEN others THEN
            RAISE NOTICE 'Errore: %', SQLERRM;
    END;
END \$\$;
EOF

echo ""
echo "✅ Verifica completata"
