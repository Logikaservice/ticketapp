-- Script per creare la tabella forniture_temporanee_standalone
-- Questa tabella gestisce le forniture temporanee non legate a ticket specifici

CREATE TABLE IF NOT EXISTS forniture_temporanee_standalone (
    id SERIAL PRIMARY KEY,
    materiale VARCHAR(255) NOT NULL,
    quantita INTEGER NOT NULL DEFAULT 1,
    cliente_id INTEGER NOT NULL,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key verso la tabella users
    FOREIGN KEY (cliente_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indici per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_forniture_temporanee_standalone_cliente_id ON forniture_temporanee_standalone(cliente_id);
CREATE INDEX IF NOT EXISTS idx_forniture_temporanee_standalone_created_at ON forniture_temporanee_standalone(created_at);

-- Commenti per documentazione
COMMENT ON TABLE forniture_temporanee_standalone IS 'Forniture temporanee non legate a ticket specifici';
COMMENT ON COLUMN forniture_temporanee_standalone.materiale IS 'Nome del materiale fornito';
COMMENT ON COLUMN forniture_temporanee_standalone.quantita IS 'Quantità del materiale';
COMMENT ON COLUMN forniture_temporanee_standalone.cliente_id IS 'ID del cliente a cui è stata fornita';
COMMENT ON COLUMN forniture_temporanee_standalone.note IS 'Note aggiuntive sulla fornitura';
