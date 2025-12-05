#!/bin/bash
# Script per fixare il SyntaxError alla linea 1136 in cryptoRoutes.js
# Esegui questo script sulla VPS: bash fix-syntax-error-direct.sh

cd /var/www/ticketapp || exit 1

echo "🔧 Applicazione fix per SyntaxError alla linea 1136..."

# Backup del file
cp backend/routes/cryptoRoutes.js backend/routes/cryptoRoutes.js.backup

# Verifica prima cosa c'è alla linea 1136
echo "📋 Contenuto attuale alle linee 1134-1137:"
sed -n '1134,1137p' backend/routes/cryptoRoutes.js

# Rimuovi la parentesi graffa `}` isolata alla linea 1136 se presente
# La struttura corretta dovrebbe essere:
# 1134:            } // ✅ FIX: Chiude il blocco else per SHORT supportato
# 1135:        } // ✅ FIX: Chiude il blocco else if per SHORT
# 1136:        else {

# Se la linea 1136 contiene solo `}`, rimuovila
if sed -n '1136p' backend/routes/cryptoRoutes.js | grep -q '^[[:space:]]*}[[:space:]]*$'; then
    echo "🔧 Rimozione parentesi graffa extra alla linea 1136..."
    sed -i '1136d' backend/routes/cryptoRoutes.js
    echo "✅ Parentesi graffa rimossa"
else
    echo "ℹ️  La linea 1136 non contiene solo una parentesi graffa, potrebbe essere già corretta"
fi

# Verifica che il fix sia stato applicato
echo ""
echo "✅ Contenuto dopo il fix alle linee 1134-1137:"
sed -n '1134,1137p' backend/routes/cryptoRoutes.js

# Verifica la sintassi
echo ""
echo "🔍 Verifica sintassi..."
if node -c backend/routes/cryptoRoutes.js 2>/dev/null; then
    echo "✅ Sintassi corretta!"
else
    echo "❌ Errore di sintassi! Ripristino backup..."
    mv backend/routes/cryptoRoutes.js.backup backend/routes/cryptoRoutes.js
    exit 1
fi

# Riavvia backend
echo ""
echo "🔄 Riavvio backend..."
pm2 stop ticketapp-backend 2>/dev/null
pm2 delete ticketapp-backend 2>/dev/null
pm2 start backend/index.js --name ticketapp-backend
pm2 save

echo ""
echo "✅ Fix applicato! Verifica con: pm2 status && pm2 logs ticketapp-backend --lines 20"
