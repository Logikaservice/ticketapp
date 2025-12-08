#!/bin/bash
# Script per ricalcolare il balance partendo da €1000

INITIAL_BALANCE=${1:-1000}

echo "💰 Ricalcolo balance partendo da €${INITIAL_BALANCE}..."
echo ""

curl -X POST http://localhost:3001/api/crypto/recalculate-balance \
  -H "Content-Type: application/json" \
  -d "{\"initial_balance\": ${INITIAL_BALANCE}}" \
  | jq '.'

echo ""
echo "✅ Completato!"
