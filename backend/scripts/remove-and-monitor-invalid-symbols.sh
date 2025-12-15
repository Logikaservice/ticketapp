#!/bin/bash
# Script per eliminare simboli non validi e monitorare chi li ricrea

echo "🗑️  RIMOZIONE E MONITORAGGIO SIMBOLI NON VALIDI"
echo "================================================"
echo ""

# Estrai simboli validi
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VALID_SYMBOLS_JSON=$(node "$SCRIPT_DIR/extract-valid-symbols.js" 2>/dev/null | tail -1)

if [ -z "$VALID_SYMBOLS_JSON" ]; then
    echo "❌ Errore: Impossibile estrarre simboli validi"
    exit 1
fi

echo "📊 Simboli validi: $(echo "$VALID_SYMBOLS_JSON" | tr ',' '\n' | wc -l)"
echo ""

# FASE 1: Identifica e elimina simboli non validi
echo "🔍 FASE 1: Identificazione simboli non validi..."
ALL_INVALID=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT DISTINCT symbol
FROM (
    SELECT symbol FROM klines WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
    UNION
    SELECT symbol FROM price_history WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
    UNION
    SELECT symbol FROM symbol_volumes_24h WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
    UNION
    SELECT symbol FROM bot_settings WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
    UNION
    SELECT symbol FROM open_positions WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
    UNION
    SELECT symbol FROM trades WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
) AS all_symbols
ORDER BY symbol;
" | sed 's/^[[:space:]]*//' | sed '/^$/d')

if [ -z "$ALL_INVALID" ]; then
    echo "   ✅ Nessun simbolo non valido trovato!"
    exit 0
fi

INVALID_COUNT=$(echo "$ALL_INVALID" | wc -l)
echo "   ⚠️  Trovati $INVALID_COUNT simboli non validi"
echo ""

# Mostra conteggi
echo "📊 Conteggi PRIMA della rimozione:"
for table in klines price_history symbol_volumes_24h; do
    COUNT=$(sudo -u postgres psql -d crypto_db -t -c "
    SELECT COUNT(DISTINCT symbol)
    FROM $table
    WHERE symbol NOT IN ($VALID_SYMBOLS_JSON);
    " | xargs)
    RECORDS=$(sudo -u postgres psql -d crypto_db -t -c "
    SELECT COUNT(*)
    FROM $table
    WHERE symbol NOT IN ($VALID_SYMBOLS_JSON);
    " | xargs)
    echo "   • $table: $COUNT simboli ($RECORDS record)"
done
echo ""

read -p "⚠️  Eliminare questi simboli e monitorare ricreazione? (s/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "⏭️  Operazione annullata"
    exit 0
fi

# Salva timestamp e ID massimo prima dell'eliminazione
BEFORE_TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M:%S")
MAX_KLINES_ID_BEFORE=$(sudo -u postgres psql -d crypto_db -t -c "SELECT COALESCE(MAX(id), 0) FROM klines;" | xargs)
echo ""
echo "🔄 Eliminazione in corso (timestamp: $BEFORE_TIMESTAMP, max klines id: $MAX_KLINES_ID_BEFORE)..."

# Crea lista SQL
INVALID_SQL=$(echo "$ALL_INVALID" | sed "s/^/'/" | sed "s/$/',/" | tr -d '\n' | sed 's/,$//')

# Elimina da tutte le tabelle
TOTAL_DELETED=0
for table in bot_settings klines open_positions trades price_history symbol_volumes_24h; do
    DELETED=$(sudo -u postgres psql -d crypto_db -c "
    DELETE FROM $table 
    WHERE symbol IN ($INVALID_SQL);
    " 2>&1 | grep -o "DELETE [0-9]*" | grep -o "[0-9]*" || echo "0")
    TOTAL_DELETED=$((TOTAL_DELETED + DELETED))
done

echo "   ✅ Eliminati $TOTAL_DELETED record totali"
echo ""

# FASE 2: Monitoraggio
echo "🔍 FASE 2: Monitoraggio ricreazione simboli..."
echo "   ⏱️  Monitoraggio per 60 secondi..."
echo "   (Premi Ctrl+C per interrompere prima)"
echo ""

# Crea file temporaneo per tracciare
MONITOR_FILE="/tmp/monitor_invalid_symbols_$$.txt"
echo "Timestamp,Table,Symbol,Action" > "$MONITOR_FILE"

# Funzione per controllare nuovi inserimenti
check_new_inserts() {
    local check_time=$(date -u +"%Y-%m-%d %H:%M:%S")
    
    # Controlla price_history (più probabile che venga ricreato)
    NEW_PRICE=$(sudo -u postgres psql -d crypto_db -t -c "
    SELECT DISTINCT symbol
    FROM price_history
    WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
    AND timestamp > '$BEFORE_TIMESTAMP'::timestamp;
    " | sed 's/^[[:space:]]*//' | sed '/^$/d')
    
    if [ ! -z "$NEW_PRICE" ]; then
        echo "$check_time,price_history,$NEW_PRICE,INSERTED" >> "$MONITOR_FILE"
        echo "   ⚠️  [$check_time] Trovato in price_history: $NEW_PRICE"
    fi
    
    # Controlla klines (usa ID invece di timestamp)
    NEW_KLINES=$(sudo -u postgres psql -d crypto_db -t -c "
    SELECT DISTINCT symbol
    FROM klines
    WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
    AND id > $MAX_KLINES_ID_BEFORE;
    " | sed 's/^[[:space:]]*//' | sed '/^$/d')
    
    if [ ! -z "$NEW_KLINES" ]; then
        echo "$check_time,klines,$NEW_KLINES,INSERTED" >> "$MONITOR_FILE"
        echo "   ⚠️  [$check_time] Trovato in klines: $NEW_KLINES"
    fi
    
    # Controlla symbol_volumes_24h
    NEW_VOLUMES=$(sudo -u postgres psql -d crypto_db -t -c "
    SELECT DISTINCT symbol
    FROM symbol_volumes_24h
    WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
    AND updated_at > '$BEFORE_TIMESTAMP'::timestamp;
    " | sed 's/^[[:space:]]*//' | sed '/^$/d')
    
    if [ ! -z "$NEW_VOLUMES" ]; then
        echo "$check_time,symbol_volumes_24h,$NEW_VOLUMES,INSERTED" >> "$MONITOR_FILE"
        echo "   ⚠️  [$check_time] Trovato in symbol_volumes_24h: $NEW_VOLUMES"
    fi
}

# Monitora per 60 secondi (o fino a Ctrl+C)
END_TIME=$(($(date +%s) + 60))
MONITORING=true
TRAPPED=false

trap 'MONITORING=false; TRAPPED=true' INT TERM

while [ $MONITORING ] && [ $(date +%s) -lt $END_TIME ]; do
    check_new_inserts
    sleep 5  # Controlla ogni 5 secondi
done

if [ "$TRAPPED" = false ]; then
    echo ""
    echo "   ✅ Monitoraggio completato (60 secondi)"
fi

echo ""

# FASE 3: Analisi risultati
echo "📊 FASE 3: Analisi risultati..."
echo ""

# Verifica finale
FINAL_INVALID=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol)
FROM (
    SELECT symbol FROM klines WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
    UNION
    SELECT symbol FROM price_history WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
    UNION
    SELECT symbol FROM symbol_volumes_24h WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
) AS all_symbols;
" | xargs)

if [ "$FINAL_INVALID" -eq 0 ]; then
    echo "   ✅ Nessun simbolo non valido ricreato!"
else
    echo "   ⚠️  Trovati $FINAL_INVALID simboli non validi ricreati:"
    sudo -u postgres psql -d crypto_db -t -c "
    SELECT DISTINCT symbol, 
           (SELECT COUNT(*) FROM price_history WHERE symbol = s.symbol AND timestamp > '$BEFORE_TIMESTAMP'::timestamp) as price_history_count,
           (SELECT COUNT(*) FROM klines WHERE symbol = s.symbol AND id > $MAX_KLINES_ID_BEFORE) as klines_count,
           (SELECT COUNT(*) FROM symbol_volumes_24h WHERE symbol = s.symbol AND updated_at > '$BEFORE_TIMESTAMP'::timestamp) as volumes_count
    FROM (
        SELECT symbol FROM klines WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
        UNION
        SELECT symbol FROM price_history WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
        UNION
        SELECT symbol FROM symbol_volumes_24h WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
    ) AS s
    ORDER BY symbol;
    " | while read line; do
        if [ ! -z "$line" ]; then
            echo "      - $line"
        fi
    done
fi

echo ""

# Mostra log del monitoraggio
if [ -f "$MONITOR_FILE" ] && [ $(wc -l < "$MONITOR_FILE") -gt 1 ]; then
    echo "📋 Log monitoraggio (chi ha ricreato cosa):"
    echo ""
    tail -n +2 "$MONITOR_FILE" | while IFS=',' read timestamp table symbol action; do
        echo "   [$timestamp] $table → $symbol ($action)"
    done
    echo ""
    echo "   💾 Log completo salvato in: $MONITOR_FILE"
else
    echo "   ℹ️  Nessuna ricreazione rilevata durante il monitoraggio"
    rm -f "$MONITOR_FILE"
fi

echo ""

# Analisi dettagliata di chi ha inserito cosa
if [ "$FINAL_INVALID" -gt 0 ]; then
    echo "🔍 Analisi dettagliata inserimenti:"
    echo ""
    
    # Analizza price_history (più probabile che venga da WebSocket)
    echo "   📊 Price History (probabilmente da WebSocket):"
    PRICE_INSERTS=$(sudo -u postgres psql -d crypto_db -t -c "
    SELECT symbol, COUNT(*) as count, MIN(timestamp) as first_insert, MAX(timestamp) as last_insert
    FROM price_history
    WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
    AND timestamp > '$BEFORE_TIMESTAMP'::timestamp
    GROUP BY symbol
    ORDER BY count DESC, symbol;
    " 2>/dev/null)
    
    if [ ! -z "$PRICE_INSERTS" ]; then
        echo "$PRICE_INSERTS" | while read line; do
            if [ ! -z "$line" ]; then
                echo "      - $line"
            fi
        done
    else
        echo "      (nessun inserimento rilevato)"
    fi
    
    echo ""
    
    # Analizza klines (probabilmente da KlinesAggregatorService)
    echo "   📊 Klines (probabilmente da KlinesAggregatorService):"
    KLINES_INSERTS=$(sudo -u postgres psql -d crypto_db -t -c "
    SELECT symbol, COUNT(*) as count, MIN(open_time) as first_kline, MAX(open_time) as last_kline
    FROM klines
    WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
    AND id > $MAX_KLINES_ID_BEFORE
    GROUP BY symbol
    ORDER BY count DESC, symbol;
    " 2>/dev/null)
    
    if [ ! -z "$KLINES_INSERTS" ]; then
        echo "$KLINES_INSERTS" | while read line; do
            if [ ! -z "$line" ]; then
                echo "      - $line"
            fi
        done
    else
        echo "      (nessun inserimento rilevato)"
    fi
    
    echo ""
    
    # Analizza symbol_volumes_24h (probabilmente da WebSocket)
    echo "   📊 Symbol Volumes 24h (probabilmente da WebSocket):"
    VOLUMES_INSERTS=$(sudo -u postgres psql -d crypto_db -t -c "
    SELECT symbol, COUNT(*) as count, MIN(updated_at) as first_update, MAX(updated_at) as last_update
    FROM symbol_volumes_24h
    WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
    AND updated_at > '$BEFORE_TIMESTAMP'::timestamp
    GROUP BY symbol
    ORDER BY count DESC, symbol;
    " 2>/dev/null)
    
    if [ ! -z "$VOLUMES_INSERTS" ]; then
        echo "$VOLUMES_INSERTS" | while read line; do
            if [ ! -z "$line" ]; then
                echo "      - $line"
            fi
        done
    else
        echo "      (nessun inserimento rilevato)"
    fi
    
    echo ""
    echo "💡 SUGGERIMENTI:"
    echo ""
    echo "   Se simboli sono stati ricreati, controlla i log del backend:"
    echo "   pm2 logs ticketapp-backend --lines 200 | grep -E '(WEBSOCKET|KLINES-AGGREGATOR|DATA-INTEGRITY|price_history|INSERT)'"
    echo ""
    echo "   Verifica che i filtri siano attivi in:"
    echo "   - backend/routes/cryptoRoutes.js (WebSocket callback - riga ~1510)"
    echo "   - backend/services/KlinesAggregatorService.js (riga ~128)"
    echo "   - backend/services/DataIntegrityService.js (riga ~71)"
fi

echo ""
echo "✅ Script completato"
