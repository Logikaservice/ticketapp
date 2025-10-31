-- Script di migrazione: aggiunge colonna admin_companies alla tabella users
-- Permette a un cliente di essere amministratore di più aziende

-- Aggiungi colonna admin_companies (JSONB per array di nomi aziende)
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_companies JSONB DEFAULT '[]'::jsonb;

-- Commento sulla colonna
COMMENT ON COLUMN users.admin_companies IS 'Array di nomi aziende per cui l''utente è amministratore. Esempio: ["Logika Service", "Altra Azienda"]';

-- Esempio di utilizzo:
-- UPDATE users SET admin_companies = '["Logika Service"]'::jsonb WHERE id = 1;
-- UPDATE users SET admin_companies = '["Logika Service", "Altra Azienda"]'::jsonb WHERE id = 2;

