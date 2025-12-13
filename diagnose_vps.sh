#!/bin/bash

# Script di diagnostica per VPS Hetzner
# Esegui questo script sulla VPS via SSH per verificare lo stato del backend

echo "🔍 DIAGNOSTICA BACKEND VPS HETZNER"
echo "=========================================="
echo ""

# 1. Verifica PM2
echo "📋 1. Stato PM2:"
echo "----------------------------------------"
if command -v pm2 &> /dev/null; then
    pm2 list
    echo ""
    echo "📊 Dettagli processi:"
    pm2 describe backend 2>/dev/null || echo "⚠️  Processo 'backend' non trovato"
else
    echo "❌ PM2 non installato!"
fi
echo ""

# 2. Verifica processi Node.js
echo "📋 2. Processi Node.js attivi:"
echo "----------------------------------------"
ps aux | grep node | grep -v grep
echo ""

# 3. Verifica porte in ascolto
echo "📋 3. Porte in ascolto:"
echo "----------------------------------------"
echo "Porta 3001 (Backend):"
netstat -tlnp 2>/dev/null | grep :3001 || ss -tlnp 2>/dev/null | grep :3001 || echo "❌ Nessun processo in ascolto sulla porta 3001"
echo ""
echo "Tutte le porte Node.js:"
netstat -tlnp 2>/dev/null | grep node || ss -tlnp 2>/dev/null | grep node || echo "❌ Nessun processo Node.js in ascolto"
echo ""

# 4. Verifica firewall
echo "📋 4. Stato Firewall (UFW):"
echo "----------------------------------------"
if command -v ufw &> /dev/null; then
    sudo ufw status | grep 3001 || echo "⚠️  Porta 3001 non configurata in UFW"
else
    echo "ℹ️  UFW non installato"
fi
echo ""

# 5. Verifica logs PM2
echo "📋 5. Ultimi log PM2 (errori):"
echo "----------------------------------------"
if command -v pm2 &> /dev/null; then
    pm2 logs backend --lines 50 --nostream --err 2>/dev/null || echo "⚠️  Nessun log disponibile"
else
    echo "❌ PM2 non disponibile"
fi
echo ""

# 6. Verifica directory progetto
echo "📋 6. Directory progetto:"
echo "----------------------------------------"
if [ -d "/root/TicketApp" ]; then
    echo "✅ /root/TicketApp esiste"
    ls -la /root/TicketApp/backend/*.js 2>/dev/null | head -5
elif [ -d "/home/*/TicketApp" ]; then
    echo "✅ TicketApp trovato in /home"
    ls -la /home/*/TicketApp/backend/*.js 2>/dev/null | head -5
else
    echo "❌ Directory TicketApp non trovata"
fi
echo ""

# 7. Verifica file .env
echo "📋 7. File .env backend:"
echo "----------------------------------------"
if [ -f "/root/TicketApp/backend/.env" ]; then
    echo "✅ .env esiste"
    echo "Variabili configurate:"
    grep -E "^[A-Z_]+" /root/TicketApp/backend/.env | sed 's/=.*/=***/' | head -10
elif [ -f "/home/*/TicketApp/backend/.env" ]; then
    echo "✅ .env esiste in /home"
    grep -E "^[A-Z_]+" /home/*/TicketApp/backend/.env | sed 's/=.*/=***/' | head -10
else
    echo "❌ File .env non trovato"
fi
echo ""

# 8. Memoria e risorse
echo "📋 8. Risorse sistema:"
echo "----------------------------------------"
free -h
echo ""
df -h | grep -E "Filesystem|/$"
echo ""

# 9. Riepilogo
echo "=========================================="
echo "📊 RIEPILOGO:"
echo "=========================================="
echo ""
echo "💡 AZIONI CONSIGLIATE:"
echo ""

# Verifica se PM2 ha processi
if command -v pm2 &> /dev/null; then
    BACKEND_RUNNING=$(pm2 jlist 2>/dev/null | grep -c "backend" || echo "0")
    if [ "$BACKEND_RUNNING" -eq "0" ]; then
        echo "❌ Backend NON in esecuzione"
        echo "   Avvia con: cd /root/TicketApp/backend && pm2 start index.js --name backend"
    else
        BACKEND_STATUS=$(pm2 jlist 2>/dev/null | grep -A 5 "backend" | grep "status" | cut -d'"' -f4)
        if [ "$BACKEND_STATUS" != "online" ]; then
            echo "⚠️  Backend in stato: $BACKEND_STATUS"
            echo "   Riavvia con: pm2 restart backend"
            echo "   Vedi log con: pm2 logs backend"
        else
            echo "✅ Backend in esecuzione"
            # Verifica se ascolta sulla porta
            if netstat -tlnp 2>/dev/null | grep -q :3001 || ss -tlnp 2>/dev/null | grep -q :3001; then
                echo "✅ Backend in ascolto sulla porta 3001"
                echo "   Verifica firewall Hetzner Cloud Console"
            else
                echo "❌ Backend NON in ascolto sulla porta 3001"
                echo "   Verifica log: pm2 logs backend"
            fi
        fi
    fi
else
    echo "❌ PM2 non installato"
    echo "   Installa con: npm install -g pm2"
fi

echo ""
echo "🔗 Link utili:"
echo "   - Firewall Hetzner: https://console.hetzner.cloud/"
echo "   - PM2 docs: https://pm2.keymetrics.io/docs/usage/quick-start/"
