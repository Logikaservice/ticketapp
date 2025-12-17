#!/bin/bash
# 🔍 Script per verificare il valore di "Dimensione Trade" nel database
# Uso: ./check_trade_size.sh

echo "🔍 Verifica Dimensione Trade nel database..."
echo ""

# Carica variabili d'ambiente se esiste .env
if [ -f "../../.env" ]; then
    export $(cat ../../.env | grep -v '^#' | xargs)
fi

# Usa DATABASE_URL_CRYPTO se disponibile, altrimenti DATABASE_URL
DB_URL="${DATABASE_URL_CRYPTO:-$DATABASE_URL}"

if [ -z "$DB_URL" ]; then
    echo "❌ Errore: DATABASE_URL_CRYPTO o DATABASE_URL non configurato"
    exit 1
fi

# Estrai informazioni di connessione dal DATABASE_URL
# Formato: postgresql://user:password@host:port/database
DB_USER=$(echo $DB_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $DB_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo $DB_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DB_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DB_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

# Decodifica password (gestisce caratteri speciali URL-encoded)
DB_PASS=$(printf '%b' "${DB_PASS//%/\\x}")

echo "📊 Connessione al database:"
echo "   Host: $DB_HOST"
echo "   Port: $DB_PORT"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo ""

# Query per recuperare i parametri
QUERY="SELECT parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = 'global' LIMIT 1;"

# Esegui query usando psql
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "$QUERY" 2>/dev/null | while read line; do
    if [ ! -z "$line" ]; then
        # Estrai trade_size_usdt e trade_size_eur dal JSON
        TRADE_SIZE_USDT=$(echo "$line" | grep -o '"trade_size_usdt":[0-9.]*' | cut -d':' -f2)
        TRADE_SIZE_EUR=$(echo "$line" | grep -o '"trade_size_eur":[0-9.]*' | cut -d':' -f2)
        MAX_POSITIONS=$(echo "$line" | grep -o '"max_positions":[0-9]*' | cut -d':' -f2)
        
        echo "✅ Parametri trovati:"
        echo ""
        if [ ! -z "$TRADE_SIZE_USDT" ]; then
            echo "   💰 Dimensione Trade (USDT): \$$TRADE_SIZE_USDT"
        else
            echo "   ⚠️  Dimensione Trade (USDT): NON CONFIGURATO"
        fi
        
        if [ ! -z "$TRADE_SIZE_EUR" ]; then
            echo "   💰 Dimensione Trade (EUR): €$TRADE_SIZE_EUR"
        else
            echo "   ⚠️  Dimensione Trade (EUR): NON CONFIGURATO"
        fi
        
        if [ ! -z "$MAX_POSITIONS" ]; then
            echo "   📊 Max Posizioni: $MAX_POSITIONS"
        else
            echo "   ⚠️  Max Posizioni: NON CONFIGURATO"
        fi
        
        echo ""
        echo "📋 JSON completo (primi 500 caratteri):"
        echo "$line" | head -c 500
        echo "..."
    else
        echo "❌ Nessun record trovato per strategy_name='RSI_Strategy' e symbol='global'"
    fi
done

# Se psql non è disponibile, prova con node
if ! command -v psql &> /dev/null; then
    echo ""
    echo "⚠️  psql non disponibile, uso Node.js..."
    node << 'EOF'
const cryptoDb = require('../crypto_db');
const dbGet = cryptoDb.dbGet;

(async () => {
    try {
        const result = await dbGet(
            "SELECT parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = 'global' LIMIT 1"
        );
        
        if (result && result.parameters) {
            const params = typeof result.parameters === 'string' 
                ? JSON.parse(result.parameters) 
                : result.parameters;
            
            console.log('\n✅ Parametri trovati:\n');
            console.log(`   💰 Dimensione Trade (USDT): $${params.trade_size_usdt || 'NON CONFIGURATO'}`);
            console.log(`   💰 Dimensione Trade (EUR): €${params.trade_size_eur || 'NON CONFIGURATO'}`);
            console.log(`   📊 Max Posizioni: ${params.max_positions || 'NON CONFIGURATO'}`);
            console.log('\n📋 Tutti i parametri:');
            console.log(JSON.stringify(params, null, 2));
        } else {
            console.log('❌ Nessun record trovato per strategy_name=\'RSI_Strategy\' e symbol=\'global\'');
        }
    } catch (err) {
        console.error('❌ Errore:', err.message);
        process.exit(1);
    }
})();
EOF
fi

echo ""
echo "✅ Verifica completata!"
