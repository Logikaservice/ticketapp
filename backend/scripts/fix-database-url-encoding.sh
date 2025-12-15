#!/bin/bash
# Script per fixare l'encoding della password nel DATABASE_URL

echo "🔧 Fix encoding password DATABASE_URL..."
echo ""

BACKEND_DIR="/var/www/ticketapp/backend"
ENV_FILE="$BACKEND_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ File .env non trovato: $ENV_FILE"
    exit 1
fi

# Leggi il DATABASE_URL corrente
CURRENT_URL=$(grep "^DATABASE_URL=" "$ENV_FILE" | cut -d'=' -f2-)

if [ -z "$CURRENT_URL" ]; then
    echo "❌ DATABASE_URL non trovato nel file .env"
    exit 1
fi

echo "📋 DATABASE_URL corrente:"
echo "$CURRENT_URL" | sed 's/:[^:@]*@/:****@/'
echo ""

# Estrai le parti dell'URL
# Formato: postgresql://user:password@host:port/database
if [[ $CURRENT_URL =~ postgresql://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+) ]]; then
    USER="${BASH_REMATCH[1]}"
    PASSWORD="${BASH_REMATCH[2]}"
    HOST="${BASH_REMATCH[3]}"
    PORT="${BASH_REMATCH[4]}"
    DATABASE="${BASH_REMATCH[5]}"
    
    echo "🔍 Parti estratte:"
    echo "   User: $USER"
    echo "   Password: ${PASSWORD:0:5}**** (lunghezza: ${#PASSWORD})"
    echo "   Host: $HOST"
    echo "   Port: $PORT"
    echo "   Database: $DATABASE"
    echo ""
    
    # URL-encode la password (sostituisci caratteri speciali)
    # ! diventa %21, @ diventa %40, # diventa %23, $ diventa %24, ecc.
    ENCODED_PASSWORD=$(echo "$PASSWORD" | sed 's/!/%21/g; s/@/%40/g; s/#/%23/g; s/\$/%24/g; s/%/%25/g; s/&/%26/g; s/*/%2A/g; s/(/%28/g; s/)/%29/g; s/+/%2B/g; s/,/%2C/g; s/:/%3A/g; s/;/%3B/g; s/=/%3D/g; s/?/%3F/g')
    
    # Se la password è già codificata o non ha caratteri speciali, non cambiarla
    if [ "$PASSWORD" = "$ENCODED_PASSWORD" ]; then
        echo "✅ Password già corretta o non contiene caratteri speciali"
    else
        # Ricostruisci l'URL con la password codificata
        NEW_URL="postgresql://${USER}:${ENCODED_PASSWORD}@${HOST}:${PORT}/${DATABASE}"
        
        echo "🔧 Nuovo DATABASE_URL (con password codificata):"
        echo "$NEW_URL" | sed 's/:[^:@]*@/:****@/'
        echo ""
        
        # Aggiorna il file .env
        sed -i "s|^DATABASE_URL=.*|DATABASE_URL=$NEW_URL|" "$ENV_FILE"
        
        echo "✅ DATABASE_URL aggiornato nel file .env"
    fi
else
    echo "❌ Formato DATABASE_URL non riconosciuto"
    echo "   Formato atteso: postgresql://user:password@host:port/database"
    exit 1
fi

# Stessa cosa per DATABASE_URL_VIVALDI se esiste
if grep -q "^DATABASE_URL_VIVALDI=" "$ENV_FILE"; then
    echo ""
    echo "🔧 Fix encoding DATABASE_URL_VIVALDI..."
    VIVALDI_URL=$(grep "^DATABASE_URL_VIVALDI=" "$ENV_FILE" | cut -d'=' -f2-)
    
    if [[ $VIVALDI_URL =~ postgresql://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+) ]]; then
        V_USER="${BASH_REMATCH[1]}"
        V_PASSWORD="${BASH_REMATCH[2]}"
        V_HOST="${BASH_REMATCH[3]}"
        V_PORT="${BASH_REMATCH[4]}"
        V_DATABASE="${BASH_REMATCH[5]}"
        
        V_ENCODED_PASSWORD=$(echo "$V_PASSWORD" | sed 's/!/%21/g; s/@/%40/g; s/#/%23/g; s/\$/%24/g; s/%/%25/g; s/&/%26/g; s/*/%2A/g; s/(/%28/g; s/)/%29/g; s/+/%2B/g; s/,/%2C/g; s/:/%3A/g; s/;/%3B/g; s/=/%3D/g; s/?/%3F/g')
        
        if [ "$V_PASSWORD" != "$V_ENCODED_PASSWORD" ]; then
            V_NEW_URL="postgresql://${V_USER}:${V_ENCODED_PASSWORD}@${V_HOST}:${V_PORT}/${V_DATABASE}"
            sed -i "s|^DATABASE_URL_VIVALDI=.*|DATABASE_URL_VIVALDI=$V_NEW_URL|" "$ENV_FILE"
            echo "✅ DATABASE_URL_VIVALDI aggiornato"
        fi
    fi
fi

echo ""
echo "✅ Fix completato!"
echo "🔄 Riavvia il backend:"
echo "   pm2 restart ticketapp-backend"










