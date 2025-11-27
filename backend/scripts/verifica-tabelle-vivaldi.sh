#!/bin/bash
# Script per verificare che le tabelle Vivaldi siano state create correttamente

echo "🔍 Verifica tabelle database Vivaldi..."
echo ""

# Connetti al database vivaldi_db e lista le tabelle
psql -U postgres -d vivaldi_db -c "\dt" 2>/dev/null || {
  echo "❌ Errore connessione al database vivaldi_db"
  echo "Verifica che il database esista e che l'utente postgres abbia i permessi"
  exit 1
}

echo ""
echo "📊 Verifica struttura tabelle..."

# Verifica ogni tabella
TABLES=("vivaldi_config" "annunci" "annunci_schedule" "annunci_queue" "annunci_history")

for table in "${TABLES[@]}"; do
  echo -n "Verifica tabella $table... "
  if psql -U postgres -d vivaldi_db -c "\d $table" > /dev/null 2>&1; then
    echo "✅ Esiste"
  else
    echo "❌ NON ESISTE"
  fi
done

echo ""
echo "📋 Controllo record in vivaldi_config..."
psql -U postgres -d vivaldi_db -c "SELECT chiave, descrizione FROM vivaldi_config;" 2>/dev/null || echo "⚠️ Errore lettura vivaldi_config"

echo ""
echo "✅ Verifica completata"

