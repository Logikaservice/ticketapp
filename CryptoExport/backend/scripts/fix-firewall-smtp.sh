#!/bin/bash
# Script per configurare il firewall per permettere SMTP in uscita

echo "🔧 Configurazione firewall per SMTP..."

# Verifica se UFW è attivo
if ! sudo ufw status | grep -q "Status: active"; then
  echo "⚠️  UFW non è attivo. Attivazione..."
  sudo ufw --force enable
fi

# Verifica policy di default per connessioni in uscita
echo "🔍 Verifica policy di default..."
DEFAULT_OUTPUT=$(sudo ufw status verbose | grep "Default:" | grep -o "deny (outgoing)" || echo "")
if [ -n "$DEFAULT_OUTPUT" ]; then
  echo "⚠️  Policy di default blocca connessioni in uscita!"
  echo "📝 Impostazione policy per permettere connessioni in uscita..."
  sudo ufw default allow outgoing
  echo "✅ Policy di default aggiornata: allow outgoing"
else
  echo "✅ Policy di default già permette connessioni in uscita"
fi

echo ""
echo "📧 Apertura porte SMTP in uscita..."

# Porta 587 (TLS) - Aruba e Gmail
sudo ufw allow out 587/tcp
echo "✅ Porta 587 (TLS) aperta in uscita"

# Porta 465 (SSL) - Aruba fallback
sudo ufw allow out 465/tcp
echo "✅ Porta 465 (SSL) aperta in uscita"

# Porta 25 (SMTP standard) - per compatibilità
sudo ufw allow out 25/tcp
echo "✅ Porta 25 (SMTP) aperta in uscita"

# Porta 993 (IMAPS) - per ricezione email se necessario
sudo ufw allow out 993/tcp
echo "✅ Porta 993 (IMAPS) aperta in uscita"

# Porta 995 (POP3S) - per ricezione email se necessario
sudo ufw allow out 995/tcp
echo "✅ Porta 995 (POP3S) aperta in uscita"

echo ""
echo "📋 Stato firewall:"
sudo ufw status numbered

echo ""
echo "🧪 Test connessioni SMTP..."

echo "Test 1: smtp.aruba.it:587"
timeout 5 telnet smtp.aruba.it 587 2>&1 | head -n 3 || echo "❌ Timeout o errore"

echo ""
echo "Test 2: smtps.aruba.it:465"
timeout 5 telnet smtps.aruba.it 465 2>&1 | head -n 3 || echo "❌ Timeout o errore"

echo ""
echo "✅ Configurazione completata!"
echo ""
echo "📝 Prossimi passi:"
echo "1. Esegui: node scripts/test-email-smtp.js"
echo "2. Se funziona, prova a creare un ticket"
echo "3. Controlla i log: pm2 logs ticketapp-backend"

