#!/bin/bash
# Script per trovare l'errore esatto che causa il crash del backend

echo "🔍 RICERCA ERRORE CRASH BACKEND"
echo "================================"
echo ""

# 1. Verifica stato attuale
echo "1. STATO ATTUALE:"
pm2 status
echo ""

# 2. Cattura log in tempo reale per 10 secondi per vedere l'errore
echo "2. MONITORAGGIO CRASH IN TEMPO REALE (10 secondi):"
echo "-------------------------------------------------"
echo "Aspetta 10 secondi per vedere l'errore esatto..."
timeout 10 pm2 logs ticketapp-backend --lines 0 --raw 2>&1 | grep -i "error\|exception\|crash\|fail\|typeerror\|referenceerror\|syntaxerror" | head -20
echo ""

# 3. Ultimi errori nei log
echo "3. ULTIMI ERRORI NEI LOG:"
echo "-------------------------"
pm2 logs ticketapp-backend --lines 200 --nostream | grep -i "error\|exception\|crash\|fail\|typeerror\|referenceerror\|syntaxerror" | tail -30
echo ""

# 4. Verifica se ci sono altri route null
echo "4. VERIFICA ROUTE POTENZIALMENTE NULL:"
echo "--------------------------------------"
cd /var/www/ticketapp/backend
echo "Checking packvisionRoutes..."
grep -n "packvisionRoutes" index.js | head -5
echo ""
echo "Checking cryptoRoutes..."
grep -n "cryptoRoutes" index.js | head -5
echo ""

# 5. Test avvio manuale per vedere errore completo
echo "5. TEST AVVIO MANUALE (primi 5 secondi):"
echo "-----------------------------------------"
echo "⚠️  Questo mostrerà l'errore esatto all'avvio"
cd /var/www/ticketapp/backend
timeout 5 node index.js 2>&1 | head -50 || echo "Processo terminato o errore catturato"
echo ""

# 6. Verifica dipendenze
echo "6. VERIFICA DIPENDENZE:"
echo "-----------------------"
cd /var/www/ticketapp/backend
if [ -f "package.json" ]; then
    echo "✅ package.json trovato"
    echo "Verifica moduli critici..."
    node -e "try { require('express'); console.log('✅ express OK'); } catch(e) { console.log('❌ express:', e.message); }"
    node -e "try { require('pg'); console.log('✅ pg OK'); } catch(e) { console.log('❌ pg:', e.message); }"
    node -e "try { require('socket.io'); console.log('✅ socket.io OK'); } catch(e) { console.log('❌ socket.io:', e.message); }"
else
    echo "❌ package.json non trovato!"
fi
echo ""

# 7. Verifica database crypto
echo "7. VERIFICA DATABASE CRYPTO:"
echo "-----------------------------"
if [ -f "/var/www/ticketapp/backend/crypto.db" ]; then
    echo "✅ crypto.db esiste"
    ls -lh /var/www/ticketapp/backend/crypto.db
    # Test accesso database
    node -e "const db = require('./crypto_db'); db.get('SELECT 1', (err) => { if(err) console.log('❌ Errore DB:', err.message); else console.log('✅ DB accessibile'); process.exit(0); });" 2>&1
else
    echo "⚠️  crypto.db non esiste (verrà creato automaticamente)"
fi
echo ""

echo "================================"
echo "✅ Diagnostica completata!"
echo ""
echo "📋 Cerca nella sezione 2 e 3 per l'errore esatto che causa il crash"
