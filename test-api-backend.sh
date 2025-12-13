#!/bin/bash

# Script per testare le chiamate API del backend

echo "🧪 Test Chiamate API Backend"
echo "============================="
echo ""

# Verifica che il backend sia in esecuzione
echo "1️⃣  Verifica backend in esecuzione..."
if pm2 list | grep -q "ticketapp-backend.*online"; then
    echo "   ✅ Backend online"
else
    echo "   ❌ Backend NON è online!"
    echo "   Esegui: pm2 restart ticketapp-backend"
    exit 1
fi

# Test endpoint health
echo ""
echo "2️⃣  Test endpoint /api/health..."
HEALTH_RESPONSE=$(curl -s http://localhost:3001/api/health)
if echo "$HEALTH_RESPONSE" | grep -q "OK\|status"; then
    echo "   ✅ Health endpoint OK"
    echo "   Response: $HEALTH_RESPONSE"
else
    echo "   ❌ Health endpoint NON risponde!"
    echo "   Response: $HEALTH_RESPONSE"
    exit 1
fi

# Test endpoint tickets (senza auth - potrebbe fallire ma vediamo cosa restituisce)
echo ""
echo "3️⃣  Test endpoint /api/tickets (senza auth)..."
TICKETS_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" http://localhost:3001/api/tickets)
HTTP_CODE=$(echo "$TICKETS_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$TICKETS_RESPONSE" | grep -v "HTTP_CODE:")

if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Tickets endpoint risponde (200)"
    TICKET_COUNT=$(echo "$BODY" | grep -o '"id"' | wc -l || echo "0")
    echo "   Ticket trovati: $TICKET_COUNT"
elif [ "$HTTP_CODE" = "401" ]; then
    echo "   ⚠️  Tickets endpoint richiede autenticazione (401) - NORMALE"
else
    echo "   ⚠️  Tickets endpoint risponde con: $HTTP_CODE"
    echo "   Response: $BODY"
fi

# Test endpoint users (senza auth)
echo ""
echo "4️⃣  Test endpoint /api/users (senza auth)..."
USERS_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" http://localhost:3001/api/users)
HTTP_CODE=$(echo "$USERS_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$USERS_RESPONSE" | grep -v "HTTP_CODE:")

if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Users endpoint risponde (200)"
    USER_COUNT=$(echo "$BODY" | grep -o '"id"' | wc -l || echo "0")
    echo "   Utenti trovati: $USER_COUNT"
elif [ "$HTTP_CODE" = "401" ]; then
    echo "   ⚠️  Users endpoint richiede autenticazione (401) - NORMALE"
else
    echo "   ⚠️  Users endpoint risponde con: $HTTP_CODE"
    echo "   Response: $BODY"
fi

# Test CORS headers
echo ""
echo "5️⃣  Test CORS headers..."
CORS_HEADERS=$(curl -s -I -H "Origin: https://ticket.logikaservice.it" http://localhost:3001/api/health | grep -i "access-control")
if [ -n "$CORS_HEADERS" ]; then
    echo "   ✅ CORS headers presenti:"
    echo "   $CORS_HEADERS"
else
    echo "   ⚠️  CORS headers non trovati"
    echo "   Verifica ALLOWED_ORIGINS nel backend .env"
fi

# Verifica configurazione backend
echo ""
echo "6️⃣  Verifica configurazione backend..."
cd /var/www/ticketapp/backend || exit 1

if [ -f .env ]; then
    if grep -q "ALLOWED_ORIGINS=.*ticket.logikaservice.it" .env; then
        echo "   ✅ ALLOWED_ORIGINS contiene ticket.logikaservice.it"
        grep "ALLOWED_ORIGINS=" .env
    else
        echo "   ⚠️  ALLOWED_ORIGINS potrebbe non contenere ticket.logikaservice.it"
        grep "ALLOWED_ORIGINS=" .env || echo "   ALLOWED_ORIGINS non trovato in .env"
    fi
else
    echo "   ⚠️  File .env non trovato"
fi

echo ""
echo "✅ Test completato!"
echo ""
echo "💡 Se vedi errori 401, è normale - significa che l'autenticazione funziona"
echo "   Il problema potrebbe essere nel frontend che non invia il token correttamente"
echo ""

