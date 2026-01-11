#!/bin/bash
# Script per diagnosticare e risolvere errori 502 sul VPS
# Diagnostica e riavvia il backend se necessario

echo "🔧 DIAGNOSTICA E FIX ERRORI 502 BACKEND"
echo "======================================"
echo ""

# Colori
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# 1. Verifica PM2
echo -e "${CYAN}1️⃣  Verifica PM2...${NC}"
if command -v pm2 &> /dev/null; then
    echo -e "${GREEN}✅ PM2 installato${NC}"
    echo ""
    echo "Status PM2:"
    pm2 list
    echo ""
else
    echo -e "${RED}❌ PM2 non installato!${NC}"
    echo "Installa PM2 con: npm install -g pm2"
    exit 1
fi

# 2. Verifica processo backend
echo -e "${CYAN}2️⃣  Verifica processo backend...${NC}"
BACKEND_STATUS=$(pm2 list | grep -E "backend|ticketapp-backend" | grep -v grep || echo "")
if [ -z "$BACKEND_STATUS" ]; then
    echo -e "${RED}❌ Backend NON in esecuzione!${NC}"
    BACKEND_RUNNING=false
else
    echo -e "${GREEN}✅ Backend trovato in PM2${NC}"
    echo "$BACKEND_STATUS"
    BACKEND_RUNNING=true
fi
echo ""

# 3. Verifica porta 3001
echo -e "${CYAN}3️⃣  Verifica porta 3001...${NC}"
PORT_CHECK=$(sudo lsof -ti:3001 2>/dev/null || echo "")
if [ -z "$PORT_CHECK" ]; then
    echo -e "${YELLOW}⚠️  Nessun processo in ascolto sulla porta 3001${NC}"
    PORT_FREE=true
else
    echo -e "${YELLOW}⚠️  Porta 3001 occupata da processo: $PORT_CHECK${NC}"
    PORT_FREE=false
fi
echo ""

# 4. Test endpoint backend
echo -e "${CYAN}4️⃣  Test endpoint backend...${NC}"
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health 2>/dev/null || echo "000")
if [ "$HEALTH_CHECK" = "200" ]; then
    echo -e "${GREEN}✅ Backend risponde correttamente (HTTP 200)${NC}"
    BACKEND_RESPONDING=true
elif [ "$HEALTH_CHECK" = "000" ]; then
    echo -e "${RED}❌ Backend NON risponde (timeout/connessione rifiutata)${NC}"
    BACKEND_RESPONDING=false
else
    echo -e "${YELLOW}⚠️  Backend risponde con HTTP $HEALTH_CHECK${NC}"
    BACKEND_RESPONDING=false
fi
echo ""

# 5. Verifica log errori recenti
echo -e "${CYAN}5️⃣  Ultimi errori backend (ultimi 50 log)...${NC}"
if [ "$BACKEND_RUNNING" = true ]; then
    pm2 logs backend --lines 50 --nostream 2>/dev/null | grep -i "error\|exception\|fatal\|crash" | tail -20 || echo "   Nessun errore trovato negli ultimi log"
else
    # Prova con ticketapp-backend
    pm2 logs ticketapp-backend --lines 50 --nostream 2>/dev/null | grep -i "error\|exception\|fatal\|crash" | tail -20 || echo "   Nessun errore trovato negli ultimi log"
fi
echo ""

# 6. Diagnosi e soluzione
echo -e "${CYAN}6️⃣  Diagnosi...${NC}"
echo ""

NEEDS_RESTART=false

if [ "$BACKEND_RUNNING" = false ]; then
    echo -e "${RED}❌ Problema: Backend non è in esecuzione${NC}"
    NEEDS_RESTART=true
elif [ "$BACKEND_RESPONDING" = false ]; then
    echo -e "${RED}❌ Problema: Backend non risponde alle richieste${NC}"
    NEEDS_RESTART=true
elif [ "$PORT_FREE" = false ] && [ "$BACKEND_RUNNING" = false ]; then
    echo -e "${RED}❌ Problema: Porta 3001 occupata ma backend non in esecuzione${NC}"
    NEEDS_RESTART=true
else
    echo -e "${YELLOW}⚠️  Backend in esecuzione ma potrebbe avere problemi${NC}"
    NEEDS_RESTART=true
fi

echo ""

# 7. Azioni correttive
if [ "$NEEDS_RESTART" = true ]; then
    echo -e "${CYAN}7️⃣  Esecuzione azioni correttive...${NC}"
    echo ""
    
    # Ferma tutti i processi backend esistenti
    echo "   🛑 Fermo tutti i processi backend..."
    pm2 stop backend 2>/dev/null || true
    pm2 stop ticketapp-backend 2>/dev/null || true
    pm2 delete backend 2>/dev/null || true
    pm2 delete ticketapp-backend 2>/dev/null || true
    
    # Libera porta 3001 se occupata
    if [ "$PORT_FREE" = false ]; then
        echo "   🔓 Libero porta 3001..."
        sudo lsof -ti:3001 | xargs sudo kill -9 2>/dev/null || true
        sleep 2
    fi
    
    # Vai alla directory backend
    cd /var/www/ticketapp/backend || cd /root/ticketapp/backend || cd ~/ticketapp/backend || {
        echo -e "${RED}❌ ERRORE: Directory backend non trovata!${NC}"
        echo "   Verifica il percorso: /var/www/ticketapp/backend"
        exit 1
    }
    
    echo "   📁 Directory backend: $(pwd)"
    echo ""
    
    # Verifica che index.js esista
    if [ ! -f "index.js" ]; then
        echo -e "${RED}❌ ERRORE: index.js non trovato in $(pwd)!${NC}"
        exit 1
    fi
    
    # Installa dipendenze se necessario
    if [ ! -d "node_modules" ]; then
        echo "   📦 Installo dipendenze..."
        npm install
    fi
    
    # Avvia backend con PM2
    echo "   🚀 Avvio backend con PM2..."
    pm2 start index.js --name backend --update-env
    pm2 save
    
    sleep 3
    
    # Verifica avvio
    echo ""
    echo "   🔍 Verifica avvio..."
    pm2 list | grep backend
    
    sleep 2
    
    # Test endpoint
    echo ""
    echo "   🧪 Test endpoint..."
    HEALTH_CHECK_AFTER=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health 2>/dev/null || echo "000")
    if [ "$HEALTH_CHECK_AFTER" = "200" ]; then
        echo -e "${GREEN}   ✅ Backend avviato correttamente! (HTTP 200)${NC}"
    else
        echo -e "${YELLOW}   ⚠️  Backend avviato ma non risponde ancora (HTTP $HEALTH_CHECK_AFTER)${NC}"
        echo "   Attendi 10 secondi e riprova..."
        sleep 10
        HEALTH_CHECK_AFTER2=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health 2>/dev/null || echo "000")
        if [ "$HEALTH_CHECK_AFTER2" = "200" ]; then
            echo -e "${GREEN}   ✅ Backend ora risponde correttamente! (HTTP 200)${NC}"
        else
            echo -e "${RED}   ❌ Backend ancora non risponde (HTTP $HEALTH_CHECK_AFTER2)${NC}"
            echo ""
            echo "   Ultimi log backend:"
            pm2 logs backend --lines 30 --nostream 2>/dev/null | tail -30
        fi
    fi
else
    echo -e "${GREEN}✅ Backend sembra funzionare correttamente${NC}"
    echo "   Se vedi ancora errori 502, verifica:"
    echo "   - Nginx configurazione"
    echo "   - Firewall/VPN"
    echo "   - Log nginx: tail -f /var/log/nginx/error.log"
fi

echo ""
echo -e "${CYAN}======================================"
echo "DIAGNOSTICA COMPLETATA"
echo "======================================${NC}"
echo ""
echo "💡 Comandi utili:"
echo "   - Verifica status: pm2 list"
echo "   - Visualizza log: pm2 logs backend --lines 100"
echo "   - Riavvia: pm2 restart backend"
echo "   - Test endpoint: curl http://localhost:3001/api/health"
echo ""
