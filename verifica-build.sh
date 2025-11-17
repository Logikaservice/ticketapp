#!/bin/bash
# Script per verificare se il build contiene ancora riferimenti a Render

echo "🔍 Verifica build per riferimenti a Render..."

cd /var/www/ticketapp/frontend/build || {
  echo "❌ Directory build non trovata"
  exit 1
}

echo "📊 Cercando riferimenti a 'ticketapp-4eqb.onrender.com'..."
if grep -r "ticketapp-4eqb.onrender.com" . 2>/dev/null; then
  echo "❌ TROVATI riferimenti a Render nel build!"
  echo "⚠️ Il build deve essere rifatto"
else
  echo "✅ Nessun riferimento a Render trovato nel build"
fi

echo ""
echo "📊 Cercando riferimenti a 'REACT_APP_API_URL'..."
if grep -r "REACT_APP_API_URL" . 2>/dev/null | head -5; then
  echo "ℹ️ Trovati riferimenti a REACT_APP_API_URL (normale, sono variabili d'ambiente)"
else
  echo "⚠️ Nessun riferimento a REACT_APP_API_URL trovato"
fi

echo ""
echo "📊 Verifica file .env..."
if [ -f "../.env" ]; then
  echo "✅ File .env trovato:"
  cat ../.env
else
  echo "❌ File .env non trovato!"
fi

