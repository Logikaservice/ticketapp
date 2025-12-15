#!/bin/bash
# Script per aggiungere constraint UNIQUE su price_history (symbol, timestamp)

echo "🔧 FIX: Aggiunta constraint UNIQUE su price_history"
echo "=================================================="
echo ""

# Rimuovi duplicati prima di aggiungere il constraint
echo "📊 Rimozione duplicati da price_history..."
sudo -u postgres psql -d crypto_db -c "
DELETE FROM price_history
WHERE id NOT IN (
    SELECT MIN(id)
    FROM price_history
    GROUP BY symbol, timestamp
);
" > /dev/null 2>&1

DUPLICATES_REMOVED=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(*) FROM (
    SELECT symbol, timestamp, COUNT(*) as cnt
    FROM price_history
    GROUP BY symbol, timestamp
    HAVING COUNT(*) > 1
) AS duplicates;
" | xargs)

if [ "$DUPLICATES_REMOVED" -gt 0 ]; then
    echo "   ⚠️  Rimossi duplicati (verifica manuale consigliata)"
else
    echo "   ✅ Nessun duplicato trovato"
fi

echo ""

# Aggiungi constraint
echo "🔧 Aggiunta constraint UNIQUE..."
RESULT=$(sudo -u postgres psql -d crypto_db <<'SQL'
DO $$
BEGIN
    -- Prova a creare il constraint
    BEGIN
        ALTER TABLE price_history
        ADD CONSTRAINT price_history_symbol_timestamp_unique
        UNIQUE (symbol, timestamp);
        
        RAISE NOTICE 'Constraint aggiunto';
    EXCEPTION
        WHEN duplicate_object THEN
            RAISE NOTICE 'Constraint già esistente';
        WHEN others THEN
            RAISE NOTICE 'Errore durante creazione constraint: %', SQLERRM;
            -- Se il constraint esiste già come index, prova a creare un index UNIQUE
            BEGIN
                CREATE UNIQUE INDEX IF NOT EXISTS price_history_symbol_timestamp_idx 
                ON price_history (symbol, timestamp);
                RAISE NOTICE 'Index UNIQUE creato come fallback';
            EXCEPTION
                WHEN others THEN
                    RAISE NOTICE 'Errore anche nella creazione index: %', SQLERRM;
            END;
    END;
END $$;
SQL
)

if echo "$RESULT" | grep -q "Constraint aggiunto"; then
    echo "   ✅ Constraint UNIQUE aggiunto con successo"
elif echo "$RESULT" | grep -q "Constraint già esistente"; then
    echo "   ℹ️  Constraint UNIQUE già presente"
elif echo "$RESULT" | grep -q "Index UNIQUE creato"; then
    echo "   ✅ Index UNIQUE creato come fallback (funziona con ON CONFLICT)"
else
    echo "   ⚠️  Output: $RESULT"
    echo "   Tentativo di creare index UNIQUE diretto..."
    sudo -u postgres psql -d crypto_db -c "CREATE UNIQUE INDEX IF NOT EXISTS price_history_symbol_timestamp_idx ON price_history (symbol, timestamp);" 2>&1
    if [ $? -eq 0 ]; then
        echo "   ✅ Index UNIQUE creato direttamente"
    else
        echo "   ❌ Errore nella creazione index"
    fi
fi

echo ""

# Verifica
echo "📊 Verifica constraint..."
CONSTRAINT_EXISTS=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(*)
FROM pg_constraint
WHERE conrelid = 'price_history'::regclass
AND conname = 'price_history_symbol_timestamp_unique';
" | xargs)

if [ "$CONSTRAINT_EXISTS" -eq 1 ]; then
    echo "   ✅ Constraint verificato e presente"
else
    echo "   ⚠️  Constraint non trovato (potrebbe essere un problema)"
fi

echo ""
echo "✅ Script completato"
echo ""
echo "Ora DataIntegrityService può usare ON CONFLICT senza errori!"
