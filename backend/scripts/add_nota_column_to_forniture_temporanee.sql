-- Script per aggiungere la colonna 'nota' alla tabella forniture_temporanee
-- Se la colonna esiste già, lo script non darà errore

-- Aggiungi la colonna 'nota' se non esiste
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'forniture_temporanee' 
        AND column_name = 'nota'
    ) THEN
        ALTER TABLE forniture_temporanee 
        ADD COLUMN nota TEXT;
        
        -- Aggiungi un commento per documentazione
        COMMENT ON COLUMN forniture_temporanee.nota IS 'Note aggiuntive sulla fornitura temporanea';
        
        RAISE NOTICE 'Colonna "nota" aggiunta alla tabella forniture_temporanee';
    ELSE
        RAISE NOTICE 'Colonna "nota" già esistente nella tabella forniture_temporanee';
    END IF;
END $$;
