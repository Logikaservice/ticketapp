#!/bin/bash

# Script di verifica completa klines sulla VPS
# Esegui sulla VPS con: bash verify_all_klines_vps.sh

cd /var/www/ticketapp/backend

echo "🔍 VERIFICA COMPLETA KLINES SULLA VPS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Simboli critici che DEVONO avere dati
CRITICAL_SYMBOLS=(
    "bitcoin"
    "ethereum"
    "polkadot"
    "polygon"
    "chainlink"
    "litecoin"
    "stellar"
    "monero"
    "tron"
    "cosmos"
    "near"
    "uniswap"
    "optimism"
    "the_sandbox"
    "decentraland"
    "axie_infinity"
    "gala"
    "avalanche"
    "binance_coin"
)

echo "📊 Verifica klines nel database PostgreSQL..."
echo ""

# Query per contare klines per ogni simbolo
for symbol in "${CRITICAL_SYMBOLS[@]}"; do
    count=$(node -e "
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL_CRYPTO });
    
    pool.query('SELECT COUNT(*) as count FROM klines WHERE symbol = \$1', ['$symbol'])
        .then(result => {
            console.log(result.rows[0].count);
            pool.end();
        })
        .catch(err => {
            console.log('0');
            pool.end();
        });
    ")
    
    if [ "$count" -ge 5000 ]; then
        echo "✅ $symbol: $count klines"
    elif [ "$count" -ge 1000 ]; then
        echo "⚠️  $symbol: $count klines (sufficiente ma non ottimale)"
    elif [ "$count" -ge 50 ]; then
        echo "⚠️  $symbol: $count klines (minimo accettabile)"
    else
        echo "❌ $symbol: $count klines (INSUFFICIENTE!)"
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Verifica completata!"
